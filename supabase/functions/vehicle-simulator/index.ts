import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SimRequest {
  action: "simulate_step" | "start_route" | "get_status";
  vehicle_id?: string;
  steps?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: SimRequest = await req.json();
    const { action } = body;

    let result: unknown;

    switch (action) {
      case "simulate_step": {
        result = await simulateStep(supabase, body.steps || 1);
        break;
      }
      case "start_route": {
        result = await startRoute(supabase, body.vehicle_id!);
        break;
      }
      case "get_status": {
        result = await getStatus(supabase);
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function simulateStep(
  supabase: ReturnType<typeof createClient>,
  steps: number
) {
  const { data: vehicles } = await supabase
    .from("tracking_vehicles")
    .select("*")
    .eq("status", "in_transit");

  if (!vehicles || vehicles.length === 0) {
    return { updated: 0, message: "No in_transit vehicles" };
  }

  const { data: routes } = await supabase
    .from("tracking_routes")
    .select("*")
    .eq("status", "active");

  let updated = 0;

  for (const vehicle of vehicles) {
    const route = (routes || []).find(
      (r: { vehicle_id: string }) => r.vehicle_id === vehicle.id
    );
    if (!route) continue;

    const destLat = route.dest_lat;
    const destLng = route.dest_lng;
    const curLat = vehicle.current_lat;
    const curLng = vehicle.current_lng;

    const dLat = destLat - curLat;
    const dLng = destLng - curLng;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);

    if (distance < 0.001) {
      await supabase
        .from("tracking_vehicles")
        .update({ status: "available", speed: 0, last_updated: new Date().toISOString() })
        .eq("id", vehicle.id);
      await supabase
        .from("tracking_routes")
        .update({ status: "completed", actual_arrival: new Date().toISOString() })
        .eq("id", route.id);
      continue;
    }

    const stepSize = 0.002 + Math.random() * 0.001;
    const ratio = Math.min(stepSize / distance, 1);
    const newLat = curLat + dLat * ratio;
    const newLng = curLng + dLng * ratio;
    const speed = 25 + Math.random() * 35;
    const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

    await supabase
      .from("tracking_vehicles")
      .update({
        current_lat: newLat,
        current_lng: newLng,
        speed: Math.round(speed),
        heading: Math.round((heading + 360) % 360),
        last_updated: new Date().toISOString(),
      })
      .eq("id", vehicle.id);

    await supabase.from("tracking_location_history").insert({
      vehicle_id: vehicle.id,
      lat: newLat,
      lng: newLng,
      speed: Math.round(speed),
      heading: Math.round((heading + 360) % 360),
    });

    updated++;
  }

  return { updated, total_vehicles: vehicles.length, steps_executed: steps };
}

async function startRoute(
  supabase: ReturnType<typeof createClient>,
  vehicleId: string
) {
  const { data: vehicle } = await supabase
    .from("tracking_vehicles")
    .select("*")
    .eq("id", vehicleId)
    .maybeSingle();

  if (!vehicle) return { error: "Vehicle not found" };

  const { data: route } = await supabase
    .from("tracking_routes")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("status", "planned")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!route) return { error: "No planned route for vehicle" };

  await supabase
    .from("tracking_vehicles")
    .update({ status: "in_transit", last_updated: new Date().toISOString() })
    .eq("id", vehicleId);

  await supabase
    .from("tracking_routes")
    .update({ status: "active", estimated_arrival: new Date(Date.now() + 15 * 60000).toISOString() })
    .eq("id", route.id);

  return { started: true, vehicle_id: vehicleId, route_id: route.id };
}

async function getStatus(supabase: ReturnType<typeof createClient>) {
  const { data: vehicles } = await supabase
    .from("tracking_vehicles")
    .select("id, driver_name, status, speed, current_lat, current_lng");

  const { data: routes } = await supabase
    .from("tracking_routes")
    .select("id, vehicle_id, status, destination_name");

  return {
    vehicles: vehicles || [],
    active_routes: (routes || []).filter((r: { status: string }) => r.status === "active").length,
    in_transit: (vehicles || []).filter((v: { status: string }) => v.status === "in_transit").length,
  };
}
