import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Serial, X-Adapter-Key",
};

interface TelemetryPayload {
  device_serial: string;
  metrics: Array<{
    type: string;
    value_numeric?: number;
    value_text?: string;
    unit?: string;
    floor?: number;
    recorded_at?: string;
  }>;
}

interface CommandAckPayload {
  command_id: string;
  status: "acknowledged" | "executing" | "completed" | "failed";
  error_code?: string;
  error_message?: string;
}

interface HealthEventPayload {
  device_serial: string;
  event_type: string;
  severity: string;
  title: string;
  description?: string;
  diagnostic_data?: Record<string, unknown>;
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
    const path = url.pathname.replace("/hardware-gateway", "");

    // POST /telemetry - Receive telemetry data from partner devices
    if (req.method === "POST" && path === "/telemetry") {
      const body: TelemetryPayload = await req.json();
      const { device_serial, metrics } = body;

      // Look up device by serial
      const { data: device, error: deviceErr } = await supabase
        .from("hardware_device_registry")
        .select("id")
        .eq("device_serial", device_serial)
        .maybeSingle();

      if (deviceErr || !device) {
        return new Response(
          JSON.stringify({ error: "Device not found", serial: device_serial }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert telemetry records
      const records = metrics.map((m) => ({
        device_id: device.id,
        metric_type: m.type,
        value_numeric: m.value_numeric ?? null,
        value_text: m.value_text ?? "",
        unit: m.unit ?? "",
        floor: m.floor ?? null,
        recorded_at: m.recorded_at ?? new Date().toISOString(),
        received_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await supabase
        .from("hardware_telemetry")
        .insert(records);

      if (insertErr) {
        return new Response(
          JSON.stringify({ error: "Failed to store telemetry", detail: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update device heartbeat
      await supabase
        .from("hardware_device_registry")
        .update({ last_heartbeat_at: new Date().toISOString(), connection_status: "online" })
        .eq("id", device.id);

      return new Response(
        JSON.stringify({ success: true, recorded: records.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /command-ack - Receive command acknowledgments from devices
    if (req.method === "POST" && path === "/command-ack") {
      const body: CommandAckPayload = await req.json();

      const updateData: Record<string, unknown> = { status: body.status };
      if (body.status === "acknowledged") updateData.ack_at = new Date().toISOString();
      if (body.status === "completed" || body.status === "failed") {
        updateData.completed_at = new Date().toISOString();
      }
      if (body.error_code) updateData.error_code = body.error_code;
      if (body.error_message) updateData.error_message = body.error_message;

      const { error } = await supabase
        .from("hardware_commands")
        .update(updateData)
        .eq("id", body.command_id);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to update command", detail: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /health-event - Receive health/alert events from devices
    if (req.method === "POST" && path === "/health-event") {
      const body: HealthEventPayload = await req.json();

      const { data: device } = await supabase
        .from("hardware_device_registry")
        .select("id")
        .eq("device_serial", body.device_serial)
        .maybeSingle();

      if (!device) {
        return new Response(
          JSON.stringify({ error: "Device not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("hardware_health_events")
        .insert({
          device_id: device.id,
          event_type: body.event_type,
          severity: body.severity,
          title: body.title,
          description: body.description ?? "",
          diagnostic_data: body.diagnostic_data ?? {},
        });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to store health event", detail: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If critical severity, update device connection status to degraded
      if (body.severity === "critical" || body.event_type === "emergency") {
        await supabase
          .from("hardware_device_registry")
          .update({ connection_status: "degraded" })
          .eq("id", device.id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /dispatch-command - Platform sends command to device (called by admin UI)
    if (req.method === "POST" && path === "/dispatch-command") {
      const { device_id, command_type, priority, payload, correlation_id, issued_by } =
        await req.json();

      // Insert command into queue
      const { data: command, error: cmdErr } = await supabase
        .from("hardware_commands")
        .insert({
          device_id,
          command_type,
          priority: priority ?? 3,
          payload: payload ?? {},
          correlation_id: correlation_id ?? "",
          issued_by: issued_by ?? null,
          status: "queued",
        })
        .select()
        .single();

      if (cmdErr) {
        return new Response(
          JSON.stringify({ error: "Failed to queue command", detail: cmdErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up device and adapter to forward command
      const { data: device } = await supabase
        .from("hardware_device_registry")
        .select("id, device_serial, network_address, adapter_id, hardware_adapters(api_endpoint, protocol_type, auth_method, timeout_ms)")
        .eq("id", device_id)
        .maybeSingle();

      if (device?.hardware_adapters) {
        const adapter = device.hardware_adapters as unknown as {
          api_endpoint: string;
          protocol_type: string;
          timeout_ms: number;
        };

        // For REST API adapters, forward the command
        if (adapter.protocol_type === "rest_api" && adapter.api_endpoint) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), adapter.timeout_ms);

            const response = await fetch(`${adapter.api_endpoint}/commands`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                command_id: command.id,
                device_serial: device.device_serial,
                command_type,
                priority,
                payload,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Log the protocol exchange
            await supabase.from("hardware_protocol_logs").insert({
              device_id,
              direction: "outbound",
              method: "POST",
              endpoint: `${adapter.api_endpoint}/commands`,
              request_body: { command_type, payload },
              response_body: response.ok ? { status: "forwarded" } : { error: "delivery_failed" },
              status_code: response.status,
              latency_ms: 0,
              success: response.ok,
            });

            if (response.ok) {
              await supabase
                .from("hardware_commands")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("id", command.id);
            }
          } catch (e) {
            // Command remains queued for retry
            await supabase.from("hardware_protocol_logs").insert({
              device_id,
              direction: "outbound",
              method: "POST",
              endpoint: `${adapter.api_endpoint}/commands`,
              request_body: { command_type, payload },
              response_body: {},
              status_code: 0,
              latency_ms: 0,
              success: false,
              error_detail: e instanceof Error ? e.message : "Unknown error",
            });
          }
        }

        // For MQTT adapters, publish to topic (logged only, actual MQTT handled by separate service)
        if (adapter.protocol_type === "mqtt") {
          await supabase
            .from("hardware_commands")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", command.id);

          await supabase.from("hardware_protocol_logs").insert({
            device_id,
            direction: "outbound",
            method: "PUBLISH",
            endpoint: `devices/${device.device_serial}/commands`,
            request_body: { command_type, payload },
            response_body: {},
            status_code: 200,
            latency_ms: 0,
            success: true,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, command_id: command.id, status: command.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /device-status/:serial - Get current device status
    if (req.method === "GET" && path.startsWith("/device-status/")) {
      const serial = path.replace("/device-status/", "");

      const { data: device } = await supabase
        .from("hardware_device_registry")
        .select(`
          *,
          hardware_adapters(vendor_name, device_type, protocol_type, status),
          hardware_health_events(id, event_type, severity, title, created_at, resolution_status)
        `)
        .eq("device_serial", serial)
        .maybeSingle();

      if (!device) {
        return new Response(
          JSON.stringify({ error: "Device not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get latest telemetry
      const { data: telemetry } = await supabase
        .from("hardware_telemetry")
        .select("metric_type, value_numeric, value_text, unit, recorded_at")
        .eq("device_id", device.id)
        .order("recorded_at", { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({ device, telemetry }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 404 for unmatched routes
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
