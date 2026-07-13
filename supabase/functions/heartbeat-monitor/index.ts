/**
 * PALATRIA Heartbeat Monitor
 *
 * Detects devices that have missed their heartbeat interval.
 * Transitions:
 *   - 3x interval missed → connection_status = 'degraded'
 *   - 10x interval missed → connection_status = 'offline'
 *
 * Creates hardware_health_events alerts for degraded/offline transitions.
 * Should be invoked on a cron schedule (e.g., every 30 seconds).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = Date.now();

    // Get all devices with their adapter's heartbeat interval
    const { data: devices } = await supabase
      .from("hardware_device_registry")
      .select("id, device_serial, connection_status, last_heartbeat_at, adapter_id, hardware_adapters(heartbeat_interval_sec)")
      .in("connection_status", ["online", "degraded"]);

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({ message: "No devices to check", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let degradedCount = 0;
    let offlineCount = 0;

    for (const device of devices) {
      if (!device.last_heartbeat_at) continue;

      const adapter = device.hardware_adapters as unknown as { heartbeat_interval_sec: number } | null;
      const intervalSec = adapter?.heartbeat_interval_sec || 30;
      const intervalMs = intervalSec * 1000;

      const lastBeat = new Date(device.last_heartbeat_at).getTime();
      const elapsed = now - lastBeat;

      let newStatus: string | null = null;

      if (elapsed > intervalMs * 10 && device.connection_status !== "offline") {
        newStatus = "offline";
        offlineCount++;
      } else if (elapsed > intervalMs * 3 && device.connection_status === "online") {
        newStatus = "degraded";
        degradedCount++;
      }

      if (newStatus) {
        await supabase
          .from("hardware_device_registry")
          .update({ connection_status: newStatus })
          .eq("id", device.id);

        const severity = newStatus === "offline" ? "critical" : "high";
        const title = newStatus === "offline"
          ? `Device ${device.device_serial} went offline`
          : `Device ${device.device_serial} heartbeat delayed`;

        await supabase.from("hardware_health_events").insert({
          device_id: device.id,
          event_type: "heartbeat_miss",
          severity,
          title,
          description: `Last heartbeat was ${Math.round(elapsed / 1000)}s ago (interval: ${intervalSec}s). Status: ${device.connection_status} → ${newStatus}`,
          diagnostic_data: {
            last_heartbeat_at: device.last_heartbeat_at,
            elapsed_ms: elapsed,
            threshold_multiplier: newStatus === "offline" ? 10 : 3,
            interval_sec: intervalSec,
          },
        });

        await supabase.from("event_log").insert({
          event_type: `device.${newStatus}`,
          source_tier: "T3",
          source_id: device.device_serial,
          payload: {
            device_id: device.id,
            previous_status: device.connection_status,
            new_status: newStatus,
            elapsed_seconds: Math.round(elapsed / 1000),
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Heartbeat check complete",
        checked: devices.length,
        degraded: degradedCount,
        offline: offlineCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
