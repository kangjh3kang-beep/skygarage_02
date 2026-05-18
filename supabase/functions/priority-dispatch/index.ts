import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DispatchRequest {
  action:
    | "calculate_priority"
    | "get_queue"
    | "assign_slot"
    | "get_stats";
  complex_id?: string;
  resident_id?: string;
  session_id?: string;
}

interface QueueEntry {
  session_id: string;
  resident_id: string | null;
  vehicle_number: string;
  entry_at: string;
  priority_score: number;
  is_priority: boolean;
  category: string | null;
  wait_seconds: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DispatchRequest = await req.json();
    const { action } = body;

    let result: unknown;

    switch (action) {
      case "calculate_priority": {
        result = await calculatePriority(supabase, body.complex_id!, body.session_id!);
        break;
      }
      case "get_queue": {
        result = await getDispatchQueue(supabase, body.complex_id!);
        break;
      }
      case "assign_slot": {
        result = await assignPrioritySlot(supabase, body.session_id!, body.complex_id!);
        break;
      }
      case "get_stats": {
        result = await getDispatchStats(supabase, body.complex_id!);
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

async function calculatePriority(
  supabase: ReturnType<typeof createClient>,
  complexId: string,
  sessionId: string
) {
  const { data: session } = await supabase
    .from("parking_sessions")
    .select("*, resident_accounts!inner(id)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { priority_score: 0, is_priority: false };

  const { data: vehicles } = await supabase
    .from("resident_vehicles")
    .select("resident_id")
    .eq("plate_number", session.vehicle_number)
    .maybeSingle();

  if (!vehicles) return { priority_score: 0, is_priority: false };

  const residentId = vehicles.resident_id;

  const { data: profile } = await supabase
    .from("resident_accessibility_profiles")
    .select("*")
    .eq("resident_id", residentId)
    .eq("active", true)
    .maybeSingle();

  if (!profile) return { priority_score: 0, is_priority: false, resident_id: residentId };

  const { data: rule } = await supabase
    .from("priority_dispatch_rules")
    .select("*")
    .eq("complex_id", complexId)
    .eq("category", profile.category)
    .eq("enabled", true)
    .maybeSingle();

  if (!rule) return { priority_score: 0, is_priority: false, resident_id: residentId };

  const baseWeight = rule.priority_weight;
  const severityMultiplier = profile.severity_level;
  const urgencyBonus = profile.wheelchair_required ? 3 : 0;
  const assistanceBonus = profile.assistance_required ? 2 : 0;

  const priorityScore = baseWeight * severityMultiplier + urgencyBonus + assistanceBonus;

  await supabase
    .from("parking_sessions")
    .update({ priority_score: priorityScore, is_priority_dispatch: true })
    .eq("id", sessionId);

  return {
    priority_score: priorityScore,
    is_priority: true,
    resident_id: residentId,
    category: profile.category,
    rule_applied: rule.id,
    auto_assign_ground: rule.auto_assign_ground,
    escort_required: rule.escort_required,
  };
}

async function getDispatchQueue(
  supabase: ReturnType<typeof createClient>,
  complexId: string
): Promise<{ queue: QueueEntry[] }> {
  const { data: sessions } = await supabase
    .from("parking_sessions")
    .select("id, vehicle_number, entry_at, priority_score, is_priority_dispatch, status")
    .eq("complex_id", complexId)
    .in("status", ["in_progress", "retrieving"])
    .order("priority_score", { ascending: false })
    .order("entry_at", { ascending: true });

  if (!sessions) return { queue: [] };

  const now = new Date();
  const queue: QueueEntry[] = sessions.map((s) => ({
    session_id: s.id,
    resident_id: null,
    vehicle_number: s.vehicle_number,
    entry_at: s.entry_at,
    priority_score: s.priority_score,
    is_priority: s.is_priority_dispatch,
    category: null,
    wait_seconds: Math.floor((now.getTime() - new Date(s.entry_at).getTime()) / 1000),
  }));

  return { queue };
}

async function assignPrioritySlot(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  complexId: string
) {
  const { data: session } = await supabase
    .from("parking_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { error: "Session not found" };

  const { data: rule } = await supabase
    .from("priority_dispatch_rules")
    .select("*")
    .eq("complex_id", complexId)
    .eq("enabled", true)
    .order("priority_weight", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assignedFloor = rule?.auto_assign_ground ? 0 : session.floor;
  const assignedSlot = `P${Math.abs(assignedFloor)}-${String(Math.floor(Math.random() * 10) + 1).padStart(3, "0")}`;

  await supabase
    .from("parking_sessions")
    .update({ floor: assignedFloor, slot_id: assignedSlot })
    .eq("id", sessionId);

  await supabase.from("priority_dispatch_log").insert({
    session_id: sessionId,
    resident_id: null,
    profile_id: null,
    rule_id: rule?.id || null,
    priority_score: session.priority_score,
    original_queue_position: 0,
    final_queue_position: 0,
    wait_time_seconds: 0,
    assigned_floor: assignedFloor,
    assigned_slot: assignedSlot,
    escort_dispatched: rule?.escort_required || false,
  });

  return {
    assigned_floor: assignedFloor,
    assigned_slot: assignedSlot,
    escort_dispatched: rule?.escort_required || false,
  };
}

async function getDispatchStats(
  supabase: ReturnType<typeof createClient>,
  complexId: string
) {
  const { data: profiles } = await supabase
    .from("resident_accessibility_profiles")
    .select("category, active")
    .eq("active", true);

  const { data: logs } = await supabase
    .from("priority_dispatch_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: rules } = await supabase
    .from("priority_dispatch_rules")
    .select("*")
    .eq("complex_id", complexId)
    .eq("enabled", true);

  const categoryCounts: Record<string, number> = {};
  (profiles || []).forEach((p) => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });

  const totalDispatches = (logs || []).length;
  const avgWait =
    totalDispatches > 0
      ? Math.round(
          (logs || []).reduce((sum, l) => sum + l.wait_time_seconds, 0) / totalDispatches
        )
      : 0;

  return {
    total_profiles: (profiles || []).length,
    category_breakdown: categoryCounts,
    active_rules: (rules || []).length,
    total_dispatches: totalDispatches,
    avg_wait_seconds: avgWait,
    escort_rate:
      totalDispatches > 0
        ? Math.round(
            ((logs || []).filter((l) => l.escort_dispatched).length / totalDispatches) * 100
          )
        : 0,
  };
}
