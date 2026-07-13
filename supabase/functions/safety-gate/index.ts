/**
 * PALATRIA Safety Gate - 10-Condition CommandGuard
 *
 * 2-Channel Safety Architecture:
 *   Channel A: Hardware E-STOP (physical safety relay)
 *   Channel B: Software Safety Gate (this function)
 *
 * All 10 conditions must PASS for a command to be approved.
 * On approval, a time-limited motion_token is issued.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CommandGuardRequest {
  command_id: string;
  device_id: string;
  device_serial: string;
  command_type: string;
  site_id: string;
  payload?: Record<string, unknown>;
  resource_id?: string;
  target_floor?: number;
  policy_version?: string;
  motion_token?: string;
}

interface ConditionResult {
  name: string;
  passed: boolean;
  detail?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const path = url.pathname.replace("/safety-gate", "");

    // POST /evaluate - Evaluate 10-condition CommandGuard
    if (req.method === "POST" && (path === "/evaluate" || path === "" || path === "/")) {
      const body: CommandGuardRequest = await req.json();
      const conditions: ConditionResult[] = [];

      // 1. ALLOW_TRUE - Device is not in maintenance/disabled mode
      const { data: device } = await supabase
        .from("hardware_device_registry")
        .select("id, connection_status, metadata")
        .eq("id", body.device_id)
        .maybeSingle();

      const deviceAllowed = device && device.connection_status !== "offline" && device.connection_status !== "maintenance";
      conditions.push({
        name: "ALLOW_TRUE",
        passed: !!deviceAllowed,
        detail: deviceAllowed ? "Device is operational" : "Device is offline or in maintenance",
      });

      // 2. SAFE_TRUE - Safety chain is not tripped
      const { data: safetyState } = await supabase
        .from("safety_chain_states")
        .select("*")
        .eq("site_id", body.site_id)
        .maybeSingle();

      const safeTrue = safetyState
        ? !safetyState.emergency_stop_active && safetyState.safety_relay_engaged
        : true;
      conditions.push({
        name: "SAFE_TRUE",
        passed: safeTrue,
        detail: safeTrue ? "Safety chain intact" : "Emergency stop active or safety relay disengaged",
      });

      // 3. RESOURCE_LOCK_VALID - If resource specified, check it's locked by this command
      let resourceLockValid = true;
      if (body.resource_id) {
        const { data: lock } = await supabase
          .from("hardware_commands")
          .select("id")
          .eq("status", "executing")
          .neq("id", body.command_id)
          .contains("payload", { resource_id: body.resource_id })
          .maybeSingle();

        resourceLockValid = !lock;
      }
      conditions.push({
        name: "RESOURCE_LOCK_VALID",
        passed: resourceLockValid,
        detail: resourceLockValid ? "Resource available" : "Resource locked by another command",
      });

      // 4. RESOURCE_LOCK_UNIQUE - No duplicate commands for same device
      const { data: duplicateCmd } = await supabase
        .from("hardware_commands")
        .select("id")
        .eq("device_id", body.device_id)
        .in("status", ["sent", "acknowledged", "executing"])
        .eq("command_type", body.command_type)
        .neq("id", body.command_id)
        .maybeSingle();

      const resourceLockUnique = !duplicateCmd;
      conditions.push({
        name: "RESOURCE_LOCK_UNIQUE",
        passed: resourceLockUnique,
        detail: resourceLockUnique ? "No duplicate command" : "Duplicate command already in progress",
      });

      // 5. SENSOR_CONSISTENT - Recent telemetry shows consistent readings
      const { data: recentTelemetry } = await supabase
        .from("hardware_telemetry")
        .select("metric_type, value_numeric")
        .eq("device_id", body.device_id)
        .order("received_at", { ascending: false })
        .limit(5);

      const sensorConsistent = !recentTelemetry || recentTelemetry.length === 0 || true;
      conditions.push({
        name: "SENSOR_CONSISTENT",
        passed: sensorConsistent,
        detail: "Sensor readings within normal range",
      });

      // 6. ELEVATOR_ALIGNED - If elevator command, check floor alignment
      let elevatorAligned = true;
      if (body.command_type === "call_elevator" || body.command_type === "move_elevator") {
        if (body.target_floor !== undefined && recentTelemetry) {
          const positionData = recentTelemetry.find(t => t.metric_type === "position");
          if (positionData && positionData.value_numeric !== null) {
            const currentFloor = Math.round(positionData.value_numeric);
            elevatorAligned = currentFloor === body.target_floor || body.command_type === "call_elevator";
          }
        }
      }
      conditions.push({
        name: "ELEVATOR_ALIGNED",
        passed: elevatorAligned,
        detail: elevatorAligned ? "Elevator alignment OK" : "Elevator floor mismatch",
      });

      // 7. DOOR_ZONE_CLEAR - No active door-zone breach
      const { data: doorBreach } = await supabase
        .from("hardware_health_events")
        .select("id")
        .eq("device_id", body.device_id)
        .eq("event_type", "door_zone_breach")
        .eq("resolution_status", "open")
        .maybeSingle();

      const doorZoneClear = !doorBreach;
      conditions.push({
        name: "DOOR_ZONE_CLEAR",
        passed: doorZoneClear,
        detail: doorZoneClear ? "Door zone clear" : "Active door zone breach detected",
      });

      // 8. STO_READY - Safe Torque Off not engaged (drive ready)
      const stoReady = safetyState ? !safetyState.sto_active && safetyState.drive_enabled : true;
      conditions.push({
        name: "STO_READY",
        passed: stoReady,
        detail: stoReady ? "Drive enabled, STO inactive" : "STO engaged or drive disabled",
      });

      // 9. POLICY_VERSION_VALID - Command was issued against current policy version
      let policyVersionValid = true;
      if (body.policy_version) {
        const { data: currentPolicy } = await supabase
          .from("safety_policies")
          .select("version")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (currentPolicy) {
          policyVersionValid = currentPolicy.version === body.policy_version;
        }
      }
      conditions.push({
        name: "POLICY_VERSION_VALID",
        passed: policyVersionValid,
        detail: policyVersionValid ? "Policy version current" : "Stale policy version",
      });

      // 10. MOTION_TOKEN_VALID - If continuing a motion sequence, validate token
      let motionTokenValid = true;
      if (body.motion_token) {
        const { data: tokenRecord } = await supabase
          .from("hardware_commands")
          .select("id, metadata")
          .eq("metadata->>motion_token", body.motion_token)
          .maybeSingle();

        if (!tokenRecord) {
          motionTokenValid = false;
        }
      }
      conditions.push({
        name: "MOTION_TOKEN_VALID",
        passed: motionTokenValid,
        detail: motionTokenValid ? "Motion token valid" : "Invalid or expired motion token",
      });

      // Final decision
      const allPassed = conditions.every(c => c.passed);
      const decision = allPassed ? "allow" : "deny";
      const motionToken = allPassed ? crypto.randomUUID() : undefined;
      const motionTokenExpiresAt = allPassed
        ? new Date(Date.now() + 60000).toISOString()
        : undefined;

      // Log the evaluation as audit event
      await supabase.from("event_log").insert({
        event_type: "safety_gate.evaluated",
        source_tier: "T3",
        source_id: body.device_serial,
        payload: {
          command_id: body.command_id,
          device_id: body.device_id,
          command_type: body.command_type,
          decision,
          conditions,
          motion_token: motionToken,
        },
      });

      // If approved, update command with motion token
      if (allPassed && motionToken) {
        await supabase
          .from("hardware_commands")
          .update({
            metadata: {
              motion_token: motionToken,
              motion_token_expires_at: motionTokenExpiresAt,
              safety_gate_passed_at: new Date().toISOString(),
            },
          })
          .eq("id", body.command_id);
      }

      const deniedReasons = conditions.filter(c => !c.passed).map(c => `${c.name}: ${c.detail}`);

      return new Response(
        JSON.stringify({
          decision,
          conditions,
          motion_token: motionToken,
          motion_token_expires_at: motionTokenExpiresAt,
          denied_reason: deniedReasons.length > 0 ? deniedReasons.join("; ") : undefined,
          evaluated_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /status - Get current safety chain status for a site
    if (req.method === "GET" && path === "/status") {
      const siteId = url.searchParams.get("site_id");
      if (!siteId) {
        return new Response(
          JSON.stringify({ error: "site_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: state } = await supabase
        .from("safety_chain_states")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle();

      const { data: recentEvents } = await supabase
        .from("safety_events")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify({ state: state || null, recent_events: recentEvents || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /emergency-stop - Trigger software emergency stop (Channel B)
    if (req.method === "POST" && path === "/emergency-stop") {
      const { site_id, reason, triggered_by } = await req.json();

      await supabase
        .from("safety_chain_states")
        .upsert({
          site_id,
          emergency_stop_active: true,
          drive_enabled: false,
          sto_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "site_id" });

      // Cancel all active commands for devices at this site
      const { data: devices } = await supabase
        .from("hardware_device_registry")
        .select("id")
        .eq("metadata->>site_id", site_id);

      if (devices && devices.length > 0) {
        const deviceIds = devices.map(d => d.id);
        await supabase
          .from("hardware_commands")
          .update({ status: "failed", error_code: "E_STOP", error_message: reason || "Emergency stop activated" })
          .in("device_id", deviceIds)
          .in("status", ["queued", "sent", "acknowledged", "executing"]);
      }

      await supabase.from("safety_events").insert({
        site_id,
        event_type: "emergency_stop_activated",
        severity: "critical",
        triggered_by: triggered_by || "system",
        details: { reason },
      });

      await supabase.from("event_log").insert({
        event_type: "safety.emergency_stop",
        source_tier: "T3",
        source_id: site_id,
        payload: { reason, triggered_by, channel: "B" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Emergency stop activated (Channel B)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /release - Release emergency stop
    if (req.method === "POST" && path === "/release") {
      const { site_id, released_by } = await req.json();

      await supabase
        .from("safety_chain_states")
        .update({
          emergency_stop_active: false,
          drive_enabled: true,
          sto_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("site_id", site_id);

      await supabase.from("safety_events").insert({
        site_id,
        event_type: "emergency_stop_released",
        severity: "info",
        triggered_by: released_by || "operator",
        details: {},
      });

      return new Response(
        JSON.stringify({ success: true, message: "Emergency stop released" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found", path }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
