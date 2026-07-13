/**
 * ============================================================================
 * SkyGarage Palatria - Hardware Gateway Edge Function
 * ============================================================================
 *
 * 이 Edge Function은 협력업체의 ATR 자율주행주차로봇 및 차량 엘리베이터 시스템과
 * Palatria 플랫폼 간의 통신 게이트웨이 역할을 합니다.
 *
 * ■ 엔드포인트 (협력업체 → 플랫폼)
 *   POST /hardware-gateway/telemetry     - 장비 텔레메트리 데이터 수신
 *   POST /hardware-gateway/command-ack   - 명령 실행 상태 콜백
 *   POST /hardware-gateway/health-event  - 헬스/장애 이벤트 보고
 *
 * ■ 엔드포인트 (플랫폼 → 협력업체)
 *   POST /hardware-gateway/dispatch-command - 장비에 명령 전송 (move, call, stop 등)
 *   GET  /hardware-gateway/device-status/:serial - 장비 현재 상태 조회
 *
 * ■ 협력업체에서 제공받아야 하는 것:
 *   1. API 엔드포인트 URL (운영/테스트 환경)
 *   2. 인증 자격 증명 (API Key, OAuth2 Client ID/Secret, 또는 mTLS 인증서)
 *   3. Webhook 콜백 등록 기능 (당사 Gateway URL을 콜백으로 등록)
 *   4. 디바이스 시리얼 넘버 목록 (사전 등록용)
 *   5. 에러 코드 참조표
 *   6. 텔레메트리 전송 주기 설정 가능 여부 확인
 *
 * ■ 당사(SkyGarage)에서 협력업체에 제공하는 것:
 *   1. 이 Gateway의 공개 URL (HTTPS)
 *   2. 인증 헤더: X-Adapter-Key (어댑터별 발급)
 *   3. 메시지 포맷 JSON Schema (아래 interface 참조)
 *   4. Rate Limit: 1000 req/min per device
 *   5. Sandbox 테스트 환경 URL
 *
 * ■ 통신 흐름도:
 *   [ATR Robot/Elevator] --(telemetry/event)--> [이 Gateway] --> [Supabase DB]
 *   [Admin UI] --> [이 Gateway] --(command)--> [Partner API] --> [Device]
 *   [Device] --(command-ack)--> [이 Gateway] --> [Supabase DB] --> [Admin UI 실시간 반영]
 *
 * ============================================================================
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Serial, X-Adapter-Key",
};

/**
 * ■ 텔레메트리 페이로드 (협력업체 → 플랫폼)
 *
 * 협력업체 장비가 주기적으로 전송하는 센서 데이터.
 * 협력업체는 이 포맷에 맞춰 JSON을 POST /hardware-gateway/telemetry 로 전송해야 합니다.
 *
 * 제공받아야 할 것:
 * - 장비별 device_serial 넘버 (사전 등록 필요)
 * - 전송 주기 설정 인터페이스 (기본 10초, 긴급 시 1초)
 * - metric type별 단위(unit) 및 범위 문서
 */
interface TelemetryPayload {
  device_serial: string;
  metrics: Array<{
    type: string;       // 'position' | 'speed' | 'battery' | 'temperature' | 'vibration' | 'load' | 'door_status' | 'motor_current'
    value_numeric?: number;
    value_text?: string;
    unit?: string;      // 'm', 'm/s', '%', 'celsius', 'kg', 'A'
    floor?: number;
    recorded_at?: string; // ISO 8601 (장비 측 타임스탬프)
  }>;
}

/**
 * ■ 명령 응답 콜백 (협력업체 → 플랫폼)
 *
 * 플랫폼이 발행한 명령에 대해 장비가 상태를 보고합니다.
 * 협력업체는 명령 수신 후 반드시 이 콜백을 호출하여 진행 상태를 알려야 합니다.
 *
 * 제공받아야 할 것:
 * - 명령 수신 확인(ACK) 응답 시간 보장 (3초 이내)
 * - 상태 전이: acknowledged → executing → completed/failed
 * - 실패 시 error_code + error_message (에러 코드표 필요)
 */
interface CommandAckPayload {
  command_id: string;
  status: "acknowledged" | "executing" | "completed" | "failed";
  error_code?: string;    // 협력업체 에러 코드표에 정의된 코드
  error_message?: string; // 사람이 읽을 수 있는 에러 설명
}

/**
 * ■ 헬스 이벤트 보고 (협력업체 → 플랫폼)
 *
 * 장비에서 비정상 상태나 경고가 발생하면 이 엔드포인트로 즉시 전송합니다.
 *
 * 제공받아야 할 것:
 * - 이벤트 유형별 severity 매핑 기준 문서
 * - diagnostic_data에 포함할 원시 센서 데이터 스키마
 * - 긴급 이벤트(emergency) 발생 시 즉시 전송 보장 (1초 이내)
 */
interface HealthEventPayload {
  device_serial: string;
  event_type: string;     // 'heartbeat_miss' | 'error' | 'warning' | 'recovery' | 'firmware_alert' | 'calibration_drift' | 'overload' | 'emergency'
  severity: string;       // 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string;
  description?: string;
  diagnostic_data?: Record<string, unknown>; // 제조사별 진단 원시 데이터
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

        // For OPC UA adapters (Vehicle Elevators) - forward via REST bridge to OPC UA gateway
        if (adapter.protocol_type === "opc_ua" && adapter.api_endpoint) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), adapter.timeout_ms);

            const opcNodeId = `ns=2;s=Device.${device.device_serial}.Command`;
            const opcPayload = {
              node_id: opcNodeId,
              method: "Call",
              input_arguments: [
                { type: "String", value: command.id },
                { type: "String", value: command_type },
                { type: "Int32", value: priority },
                { type: "String", value: JSON.stringify(payload) },
              ],
            };

            const response = await fetch(`${adapter.api_endpoint}/opc/method-call`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(opcPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            await supabase.from("hardware_protocol_logs").insert({
              device_id,
              direction: "outbound",
              method: "OPC_UA_CALL",
              endpoint: `${adapter.api_endpoint}/opc/method-call`,
              request_body: opcPayload,
              response_body: response.ok ? { status: "forwarded" } : { error: "opc_call_failed" },
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
            await supabase.from("hardware_protocol_logs").insert({
              device_id,
              direction: "outbound",
              method: "OPC_UA_CALL",
              endpoint: `${adapter.api_endpoint}/opc/method-call`,
              request_body: { command_type, payload },
              response_body: {},
              status_code: 0,
              latency_ms: 0,
              success: false,
              error_detail: e instanceof Error ? e.message : "Unknown error",
            });
          }
        }

        // For Modbus TCP adapters (Mechanical Parking Towers) - forward via REST bridge to Modbus gateway
        if (adapter.protocol_type === "modbus_tcp" && adapter.api_endpoint) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), adapter.timeout_ms);

            const commandRegisterMap: Record<string, number> = {
              move_pallet: 100,
              retrieve_vehicle: 110,
              emergency_stop: 1,
              status_query: 200,
              door_open: 120,
              door_close: 121,
            };

            const registerAddr = commandRegisterMap[command_type] ?? 999;
            const modbusPayload = {
              unit_id: parseInt(device.network_address?.split(":")[1] || "1"),
              function_code: 16, // Write Multiple Registers
              register_address: registerAddr,
              values: [
                1, // execute flag
                priority,
                ...(payload?.floor ? [payload.floor as number] : [0]),
                ...(payload?.slot ? [payload.slot as number] : [0]),
              ],
              metadata: { command_id: command.id, command_type },
            };

            const response = await fetch(`${adapter.api_endpoint}/modbus/write-registers`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(modbusPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            await supabase.from("hardware_protocol_logs").insert({
              device_id,
              direction: "outbound",
              method: "MODBUS_WRITE",
              endpoint: `${adapter.api_endpoint}/modbus/write-registers`,
              request_body: modbusPayload,
              response_body: response.ok ? { status: "registers_written" } : { error: "modbus_write_failed" },
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
            await supabase.from("hardware_protocol_logs").insert({
              device_id,
              direction: "outbound",
              method: "MODBUS_WRITE",
              endpoint: `${adapter.api_endpoint}/modbus/write-registers`,
              request_body: { command_type, payload },
              response_body: {},
              status_code: 0,
              latency_ms: 0,
              success: false,
              error_detail: e instanceof Error ? e.message : "Unknown error",
            });
          }
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

    // POST /bay-occupancy - Parking bay sensor reports occupancy change
    if (req.method === "POST" && path === "/bay-occupancy") {
      const { device_serial, spot_id, event_type, confidence, detected_plate } = await req.json();

      const { data: device } = await supabase
        .from("hardware_device_registry")
        .select("id")
        .eq("device_serial", device_serial)
        .maybeSingle();

      if (!device) {
        return new Response(
          JSON.stringify({ error: "Device not found", serial: device_serial }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record the occupancy event
      await supabase.from("parking_bay_occupancy_events").insert({
        spot_id,
        device_id: device.id,
        event_type,
        confidence: confidence ?? 1.0,
        detected_plate: detected_plate ?? null,
      });

      // Update parking spot occupancy
      const isOccupied = event_type === "vehicle_entered" || event_type === "occupied";
      await supabase
        .from("parking_spots")
        .update({ is_occupied: isOccupied })
        .eq("id", spot_id);

      // Update device heartbeat
      await supabase
        .from("hardware_device_registry")
        .update({ last_heartbeat_at: new Date().toISOString(), connection_status: "online" })
        .eq("id", device.id);

      return new Response(
        JSON.stringify({ success: true, spot_id, is_occupied: isOccupied }),
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
