import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: devices } = await supabase
      .from("hardware_device_registry")
      .select("id, device_serial, device_type, connection_status, last_heartbeat_at, adapter_id")
      .neq("connection_status", "decommissioned");

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({ checked: 0, degraded: 0, offline: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: adapters } = await supabase
      .from("hardware_adapters")
      .select("id, heartbeat_interval_sec");

    const adapterMap = new Map<string, number>();
    adapters?.forEach((a: any) => adapterMap.set(a.id, a.heartbeat_interval_sec || 30));

    const now = Date.now();
    let degradedCount = 0;
    let offlineCount = 0;
    const alertsToCreate: any[] = [];

    for (const device of devices) {
      if (!device.last_heartbeat_at) continue;

      const heartbeatInterval = adapterMap.get(device.adapter_id) || 30;
      const lastBeat = new Date(device.last_heartbeat_at).getTime();
      const silenceSeconds = (now - lastBeat) / 1000;

      const degradedThreshold = heartbeatInterval * 3;
      const offlineThreshold = heartbeatInterval * 10;

      let newStatus: string | null = null;

      if (silenceSeconds > offlineThreshold && device.connection_status !== "offline") {
        newStatus = "offline";
        offlineCount++;
        alertsToCreate.push({
          device_id: device.id,
          event_type: "heartbeat_miss",
          severity: "critical",
          title: `Device ${device.device_serial} offline`,
          description: `No heartbeat for ${Math.floor(silenceSeconds)}s (threshold: ${offlineThreshold}s)`,
          resolution_status: "open",
        });
      } else if (silenceSeconds > degradedThreshold && device.connection_status === "online") {
        newStatus = "degraded";
        degradedCount++;
        alertsToCreate.push({
          device_id: device.id,
          event_type: "heartbeat_miss",
          severity: "high",
          title: `Device ${device.device_serial} degraded`,
          description: `No heartbeat for ${Math.floor(silenceSeconds)}s (threshold: ${degradedThreshold}s)`,
          resolution_status: "open",
        });
      }

      if (newStatus) {
        await supabase
          .from("hardware_device_registry")
          .update({ connection_status: newStatus })
          .eq("id", device.id);
      }
    }

    if (alertsToCreate.length > 0) {
      await supabase.from("hardware_health_events").insert(alertsToCreate);
    }

    return new Response(
      JSON.stringify({
        checked: devices.length,
        degraded: degradedCount,
        offline: offlineCount,
        alerts_created: alertsToCreate.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
