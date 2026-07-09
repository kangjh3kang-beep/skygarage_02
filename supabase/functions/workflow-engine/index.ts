import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WorkflowStep {
  step: number;
  name: string;
  action: string;
  timeout: number;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  trigger_event: string;
  tier: string;
  steps: WorkflowStep[];
  active: boolean;
}

interface WorkflowExecution {
  id: string;
  definition_id: string;
  complex_id: string | null;
  status: string;
  current_step: number;
  context: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  next_retry_at: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "process";

    switch (action) {
      case "trigger": {
        const body = await req.json();
        const { event_type, complex_id, payload } = body;

        if (!event_type) {
          return new Response(
            JSON.stringify({ error: "event_type is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("event_log").insert({
          event_type,
          source_tier: body.source_tier || "T3",
          source_id: body.source_id || "",
          complex_id: complex_id || null,
          payload: payload || {},
        });

        const { data: definitions } = await supabase
          .from("workflow_definitions")
          .select("*")
          .eq("trigger_event", event_type)
          .eq("active", true);

        const triggered: string[] = [];

        if (definitions && definitions.length > 0) {
          for (const def of definitions as WorkflowDefinition[]) {
            const { data: exec } = await supabase
              .from("workflow_executions")
              .insert({
                definition_id: def.id,
                complex_id: complex_id || null,
                status: "running",
                current_step: 1,
                context: { trigger_payload: payload, event_type },
                started_at: new Date().toISOString(),
              })
              .select("id")
              .maybeSingle();

            if (exec) triggered.push(exec.id);
          }
        }

        return new Response(
          JSON.stringify({
            message: `Event '${event_type}' processed`,
            workflows_triggered: triggered.length,
            execution_ids: triggered,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "process": {
        const { data: executions } = await supabase
          .from("workflow_executions")
          .select("*")
          .in("status", ["running", "waiting"])
          .order("created_at", { ascending: true })
          .limit(20);

        if (!executions || executions.length === 0) {
          return new Response(
            JSON.stringify({ message: "No workflows to process", processed: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let processed = 0;

        for (const exec of executions as WorkflowExecution[]) {
          const { data: def } = await supabase
            .from("workflow_definitions")
            .select("*")
            .eq("id", exec.definition_id)
            .maybeSingle();

          if (!def) continue;

          const definition = def as WorkflowDefinition;
          const steps = definition.steps;
          const currentStepIdx = exec.current_step - 1;

          if (currentStepIdx >= steps.length) {
            await supabase
              .from("workflow_executions")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("id", exec.id);
            processed++;
            continue;
          }

          const step = steps[currentStepIdx];
          const result = await executeStep(step, exec.context);

          if (result.success) {
            const nextStep = exec.current_step + 1;
            const isComplete = nextStep > steps.length;

            await supabase
              .from("workflow_executions")
              .update({
                current_step: nextStep,
                status: isComplete ? "completed" : "running",
                context: { ...exec.context, [`step_${exec.current_step}_result`]: result.data },
                completed_at: isComplete ? new Date().toISOString() : null,
              })
              .eq("id", exec.id);

            await supabase.from("event_log").insert({
              event_type: `workflow.step.completed`,
              source_tier: definition.tier,
              source_id: exec.id,
              complex_id: exec.complex_id,
              payload: { workflow: definition.name, step: step.name, step_number: exec.current_step },
            });
          } else {
            await supabase
              .from("workflow_executions")
              .update({
                status: "failed",
                error_message: result.error || "Step execution failed",
              })
              .eq("id", exec.id);

            await supabase.from("event_log").insert({
              event_type: "workflow.step.failed",
              source_tier: definition.tier,
              source_id: exec.id,
              complex_id: exec.complex_id,
              payload: { workflow: definition.name, step: step.name, error: result.error },
            });
          }

          processed++;
        }

        return new Response(
          JSON.stringify({ message: "Processing complete", processed }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "consume-events": {
        const { data: events } = await supabase
          .from("event_log")
          .select("*")
          .eq("processed", false)
          .order("created_at", { ascending: true })
          .limit(50);

        if (!events || events.length === 0) {
          return new Response(
            JSON.stringify({ message: "No pending events", consumed: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let consumed = 0;
        const workflowsTriggered: string[] = [];

        for (const event of events) {
          const { data: definitions } = await supabase
            .from("workflow_definitions")
            .select("*")
            .eq("trigger_event", event.event_type)
            .eq("active", true);

          if (definitions && definitions.length > 0) {
            for (const def of definitions as WorkflowDefinition[]) {
              const existing = await supabase
                .from("workflow_executions")
                .select("id")
                .eq("definition_id", def.id)
                .eq("complex_id", event.complex_id || "")
                .in("status", ["running", "waiting"])
                .maybeSingle();

              if (!existing?.data) {
                const { data: exec } = await supabase
                  .from("workflow_executions")
                  .insert({
                    definition_id: def.id,
                    complex_id: event.complex_id || null,
                    status: "running",
                    current_step: 1,
                    context: { trigger_payload: event.payload, event_type: event.event_type, event_id: event.id },
                    started_at: new Date().toISOString(),
                  })
                  .select("id")
                  .maybeSingle();

                if (exec) workflowsTriggered.push(exec.id);
              }
            }
          }

          await supabase
            .from("event_log")
            .update({ processed: true })
            .eq("id", event.id);

          consumed++;
        }

        return new Response(
          JSON.stringify({
            message: "Event consumption complete",
            consumed,
            workflows_triggered: workflowsTriggered.length,
            execution_ids: workflowsTriggered,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "generate-recommendations": {
        const recommendations: Array<{
          entity_type: string;
          entity_id?: string;
          type: string;
          priority: string;
          title: string;
          description: string;
          metadata: Record<string, unknown>;
        }> = [];

        // Check data quality across entities
        const entities = [
          { table: "resident_accounts", label: "입주민", type: "residents" },
          { table: "atr_units", label: "ATR 장비", type: "atr" },
          { table: "elevators", label: "엘리베이터", type: "elevators" },
          { table: "contracts", label: "계약", type: "contracts" },
          { table: "partners", label: "파트너", type: "partners" },
          { table: "support_tickets", label: "지원 티켓", type: "tickets" },
          { table: "crm_leads", label: "CRM 리드", type: "crm_leads" },
          { table: "billing_invoices", label: "인보이스", type: "invoices" },
        ];

        for (const entity of entities) {
          const { data } = await supabase
            .from(entity.table)
            .select("id, completeness_score");

          if (!data || data.length === 0) continue;

          const lowQuality = data.filter((d: { completeness_score?: number }) => (d.completeness_score || 0) < 50);
          const avg = Math.round(data.reduce((s: number, d: { completeness_score?: number }) => s + (d.completeness_score || 0), 0) / data.length);

          if (lowQuality.length > 0 && avg < 50) {
            recommendations.push({
              entity_type: entity.type,
              type: "warning",
              priority: "high",
              title: `${entity.label} 데이터 품질 경고`,
              description: `${entity.label} 평균 완성도 ${avg}%. ${lowQuality.length}건의 데이터가 50% 미만입니다. 데이터 보완이 시급합니다.`,
              metadata: { avg_completeness: avg, low_quality_count: lowQuality.length, total: data.length },
            });
          } else if (avg < 70 && data.length > 0) {
            recommendations.push({
              entity_type: entity.type,
              type: "insight",
              priority: "medium",
              title: `${entity.label} 데이터 보완 권장`,
              description: `${entity.label} 평균 완성도 ${avg}%. 80% 이상 달성 시 AI 분석 정확도가 향상됩니다.`,
              metadata: { avg_completeness: avg, total: data.length },
            });
          }
        }

        // Check contract expirations
        const { data: contracts } = await supabase
          .from("contracts")
          .select("id, title, end_date, status")
          .eq("status", "active");

        if (contracts) {
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          const expiring = contracts.filter(c => c.end_date && (new Date(c.end_date).getTime() - Date.now()) < thirtyDays && (new Date(c.end_date).getTime() - Date.now()) > 0);
          if (expiring.length > 0) {
            recommendations.push({
              entity_type: "contracts",
              type: "warning",
              priority: "high",
              title: `${expiring.length}건 계약 갱신 필요`,
              description: `30일 내 만료되는 활성 계약이 있습니다: ${expiring.map(c => c.title).join(", ")}`,
              metadata: { expiring_ids: expiring.map(c => c.id), count: expiring.length },
            });
          }
        }

        // Check SLA overdue tickets
        const { data: tickets } = await supabase
          .from("support_tickets")
          .select("id, ticket_number, sla_due_at, status")
          .not("status", "in", '("resolved","closed")');

        if (tickets) {
          const overdue = tickets.filter(t => t.sla_due_at && new Date(t.sla_due_at) < new Date());
          if (overdue.length > 0) {
            recommendations.push({
              entity_type: "tickets",
              type: "warning",
              priority: "high",
              title: `SLA 초과 티켓 ${overdue.length}건`,
              description: `SLA 기한이 초과된 미해결 티켓이 있습니다. 즉시 에스컬레이션을 검토하세요.`,
              metadata: { overdue_ids: overdue.map(t => t.id), count: overdue.length },
            });
          }
        }

        // Check ATR operating modes
        const { data: atrUnits } = await supabase
          .from("atr_units")
          .select("id, operating_mode");

        if (atrUnits) {
          const unset = atrUnits.filter(a => !a.operating_mode);
          if (unset.length > 0) {
            recommendations.push({
              entity_type: "atr",
              type: "optimization",
              priority: "medium",
              title: `ATR 운영모드 미설정 ${unset.length}대`,
              description: "운영 모드(direct/valet/tower/hybrid)를 설정하면 AI가 최적 스케줄링을 자동 산출합니다.",
              metadata: { unset_ids: unset.map(a => a.id), count: unset.length },
            });
          }
        }

        // Check disconnected partners
        const { data: partners } = await supabase
          .from("partners")
          .select("id, name, integration_status")
          .eq("integration_status", "disconnected");

        if (partners && partners.length > 0) {
          recommendations.push({
            entity_type: "partners",
            type: "insight",
            priority: "medium",
            title: `파트너 연동 해제 ${partners.length}건`,
            description: `연동이 끊긴 파트너: ${partners.map(p => p.name).join(", ")}. 재연결하면 데이터 동기화가 복구됩니다.`,
            metadata: { partner_ids: partners.map(p => p.id), count: partners.length },
          });
        }

        // Check license expirations
        const { data: licenses } = await supabase
          .from("licenses")
          .select("id, license_name, expiry_date, status")
          .eq("status", "active");

        if (licenses) {
          const sixtyDays = 60 * 24 * 60 * 60 * 1000;
          const expiringLicenses = licenses.filter(l => l.expiry_date && (new Date(l.expiry_date).getTime() - Date.now()) < sixtyDays && (new Date(l.expiry_date).getTime() - Date.now()) > 0);
          if (expiringLicenses.length > 0) {
            recommendations.push({
              entity_type: "licenses",
              type: "warning",
              priority: "high",
              title: `라이선스 갱신 필요 ${expiringLicenses.length}건`,
              description: `60일 내 만료 예정 라이선스: ${expiringLicenses.map(l => l.license_name).join(", ")}. 갱신 절차를 시작하세요.`,
              metadata: { expiring_ids: expiringLicenses.map(l => l.id), count: expiringLicenses.length },
            });
          }
        }

        // Check patent deadlines
        const { data: patents } = await supabase
          .from("patents")
          .select("id, title, filing_date, status")
          .in("status", ["pending", "filed"]);

        if (patents) {
          const noFilingDate = patents.filter(p => !p.filing_date);
          if (noFilingDate.length > 0) {
            recommendations.push({
              entity_type: "patents",
              type: "insight",
              priority: "medium",
              title: `특허 출원일 미설정 ${noFilingDate.length}건`,
              description: `출원일이 설정되지 않은 특허: ${noFilingDate.map(p => p.title).slice(0, 3).join(", ")}${noFilingDate.length > 3 ? " 외" : ""}. 출원 기한 관리를 위해 날짜를 설정하세요.`,
              metadata: { patent_ids: noFilingDate.map(p => p.id), count: noFilingDate.length },
            });
          }
        }

        // Check overdue maintenance
        const { data: maintenanceLogs } = await supabase
          .from("maintenance_logs")
          .select("id, entity_code, scheduled_date, status")
          .eq("status", "scheduled");

        if (maintenanceLogs) {
          const overdueMaintenance = maintenanceLogs.filter(m => m.scheduled_date && new Date(m.scheduled_date) < new Date());
          if (overdueMaintenance.length > 0) {
            recommendations.push({
              entity_type: "maintenance",
              type: "warning",
              priority: "high",
              title: `정비 기한 초과 ${overdueMaintenance.length}건`,
              description: `예정일이 지난 정비 작업이 있습니다. 장비 안전을 위해 즉시 처리가 필요합니다.`,
              metadata: { overdue_ids: overdueMaintenance.map(m => m.id), count: overdueMaintenance.length },
            });
          }
          const upcomingWeek = maintenanceLogs.filter(m => {
            if (!m.scheduled_date) return false;
            const diff = new Date(m.scheduled_date).getTime() - Date.now();
            return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
          });
          if (upcomingWeek.length > 0) {
            recommendations.push({
              entity_type: "maintenance",
              type: "optimization",
              priority: "medium",
              title: `금주 예정 정비 ${upcomingWeek.length}건`,
              description: `이번 주 내 예정된 정비 작업이 있습니다. 기술자 배정과 부품 준비를 확인하세요.`,
              metadata: { upcoming_ids: upcomingWeek.map(m => m.id), count: upcomingWeek.length },
            });
          }
        }

        // Check energy anomalies
        const { data: recentEnergy } = await supabase
          .from("energy_metrics")
          .select("total_consumption_kwh, date")
          .order("date", { ascending: false })
          .limit(14);

        if (recentEnergy && recentEnergy.length >= 7) {
          const recent7 = recentEnergy.slice(0, 7);
          const prev7 = recentEnergy.slice(7, 14);
          const recentAvg = recent7.reduce((s, e) => s + (e.total_consumption_kwh || 0), 0) / recent7.length;
          const prevAvg = prev7.length > 0 ? prev7.reduce((s, e) => s + (e.total_consumption_kwh || 0), 0) / prev7.length : recentAvg;
          if (prevAvg > 0 && recentAvg > prevAvg * 1.3) {
            recommendations.push({
              entity_type: "energy",
              type: "warning",
              priority: "high",
              title: "에너지 소비 이상 증가 감지",
              description: `최근 7일 평균 소비량(${Math.round(recentAvg)}kWh)이 이전 7일(${Math.round(prevAvg)}kWh) 대비 30% 이상 증가했습니다.`,
              metadata: { recent_avg: Math.round(recentAvg), prev_avg: Math.round(prevAvg), increase_pct: Math.round(((recentAvg - prevAvg) / prevAvg) * 100) },
            });
          }
        }

        // Check observability metrics gap
        const { count: metricsCount } = await supabase
          .from("observability_metrics")
          .select("*", { count: "exact", head: true });

        if ((metricsCount || 0) === 0) {
          recommendations.push({
            entity_type: "system",
            type: "optimization",
            priority: "low",
            title: "관측성 메트릭 수집 필요",
            description: "시스템 메트릭이 수집되지 않고 있습니다. 메트릭 수집을 활성화하면 성능 추이 분석이 가능합니다.",
            metadata: {},
          });
        }

        // Clear old pending recommendations before inserting fresh ones
        await supabase
          .from("ai_recommendations")
          .update({ status: "dismissed" })
          .eq("status", "pending");

        // Insert new recommendations
        if (recommendations.length > 0) {
          await supabase.from("ai_recommendations").insert(recommendations);
        }

        return new Response(
          JSON.stringify({
            message: "Recommendations generated",
            count: recommendations.length,
            recommendations: recommendations.map(r => ({ title: r.title, priority: r.priority, type: r.type })),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "escalate": {
        const body = await req.json();
        const { source_agent_id, target_agent_id, reason, context: escContext, conversation_id } = body;

        if (!source_agent_id || !target_agent_id || !reason) {
          return new Response(
            JSON.stringify({ error: "source_agent_id, target_agent_id, and reason are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: sourceAgent } = await supabase
          .from("ai_agent_configs")
          .select("tier, agent_name")
          .eq("id", source_agent_id)
          .maybeSingle();

        const { data: targetAgent } = await supabase
          .from("ai_agent_configs")
          .select("tier, agent_name")
          .eq("id", target_agent_id)
          .maybeSingle();

        if (!sourceAgent || !targetAgent) {
          return new Response(
            JSON.stringify({ error: "Agent not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: escalation } = await supabase
          .from("ai_escalations")
          .insert({
            source_agent_id,
            target_agent_id,
            source_tier: sourceAgent.tier,
            target_tier: targetAgent.tier,
            reason,
            context: escContext || {},
            status: "pending",
            conversation_id: conversation_id || null,
          })
          .select("id")
          .maybeSingle();

        await supabase.from("event_log").insert({
          event_type: "ai.escalation.created",
          source_tier: sourceAgent.tier,
          source_id: sourceAgent.agent_name,
          payload: {
            escalation_id: escalation?.id,
            from: sourceAgent.agent_name,
            to: targetAgent.agent_name,
            reason,
          },
        });

        return new Response(
          JSON.stringify({
            message: "Escalation created",
            escalation_id: escalation?.id,
            from: `${sourceAgent.agent_name} (${sourceAgent.tier})`,
            to: `${targetAgent.agent_name} (${targetAgent.tier})`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "collect-metrics": {
        const metrics: Array<{
          tier: string;
          metric_name: string;
          metric_value: number;
          unit: string;
          complex_id?: string;
        }> = [];

        // ATR metrics
        const { data: atrs } = await supabase.from("atr_units").select("status, total_cycles");
        if (atrs) {
          const onlineCount = atrs.filter(a => a.status !== 'offline' && a.status !== 'error').length;
          const totalCycles = atrs.reduce((s, a) => s + (a.total_cycles || 0), 0);
          metrics.push(
            { tier: "T3", metric_name: "atr_online_count", metric_value: onlineCount, unit: "units" },
            { tier: "T3", metric_name: "atr_total_cycles", metric_value: totalCycles, unit: "cycles" },
            { tier: "T3", metric_name: "atr_uptime_pct", metric_value: atrs.length > 0 ? Math.round((onlineCount / atrs.length) * 100) : 0, unit: "percent" },
          );
        }

        // Parking metrics
        const { count: activeParking } = await supabase
          .from("parking_sessions")
          .select("*", { count: "exact", head: true })
          .is("exit_time", null);
        metrics.push({ tier: "T3", metric_name: "active_parking_sessions", metric_value: activeParking || 0, unit: "sessions" });

        // Energy metrics
        const { data: energy } = await supabase
          .from("energy_metrics")
          .select("total_consumption_kwh, solar_generation_kwh")
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (energy) {
          metrics.push(
            { tier: "T3", metric_name: "energy_consumption_kwh", metric_value: energy.total_consumption_kwh || 0, unit: "kwh" },
            { tier: "T3", metric_name: "solar_generation_kwh", metric_value: energy.solar_generation_kwh || 0, unit: "kwh" },
          );
        }

        // Ticket metrics
        const { count: openTickets } = await supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "waiting"]);
        metrics.push({ tier: "T2", metric_name: "open_tickets", metric_value: openTickets || 0, unit: "tickets" });

        // Workflow metrics
        const { count: runningWorkflows } = await supabase
          .from("workflow_executions")
          .select("*", { count: "exact", head: true })
          .in("status", ["running", "waiting"]);
        metrics.push({ tier: "T2", metric_name: "running_workflows", metric_value: runningWorkflows || 0, unit: "workflows" });

        // Data quality overall
        const entityTables = ["resident_accounts", "atr_units", "elevators", "contracts", "partners", "support_tickets"];
        let totalScore = 0;
        let totalEntities = 0;
        for (const table of entityTables) {
          const { data } = await supabase.from(table).select("completeness_score");
          if (data) {
            totalScore += data.reduce((s: number, d: { completeness_score?: number }) => s + (d.completeness_score || 0), 0);
            totalEntities += data.length;
          }
        }
        const overallDQ = totalEntities > 0 ? Math.round(totalScore / totalEntities) : 0;
        metrics.push({ tier: "T0", metric_name: "data_quality_index", metric_value: overallDQ, unit: "percent" });

        // Insert all metrics
        if (metrics.length > 0) {
          await supabase.from("observability_metrics").insert(metrics);
        }

        return new Response(
          JSON.stringify({ message: "Metrics collected", count: metrics.length, metrics }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        const execId = url.searchParams.get("id");
        if (!execId) {
          return new Response(
            JSON.stringify({ error: "id parameter required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: exec } = await supabase
          .from("workflow_executions")
          .select("*, workflow_definitions(*)")
          .eq("id", execId)
          .maybeSingle();

        return new Response(
          JSON.stringify(exec || { error: "Not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action. Use: trigger, process, consume-events, generate-recommendations, escalate, collect-metrics, status" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeStep(
  step: WorkflowStep,
  _context: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const HARDWARE_ACTIONS = [
    "atr_dispatch", "vehicle_transport", "emergency_stop",
    "vehicle_retrieve", "exit_preparation",
  ];

  if (HARDWARE_ACTIONS.includes(step.action)) {
    return await dispatchHardwareCommand(step);
  }

  switch (step.action) {
    case "rfid_auth":
      return { success: true, data: { authenticated: true, method: "rfid" } };
    case "slot_assignment":
      return { success: true, data: { slot_id: `S-${Math.floor(Math.random() * 200) + 1}`, floor: Math.floor(Math.random() * 10) + 1 } };
    case "parking_confirm":
      return { success: true, data: { parked: true, timestamp: new Date().toISOString() } };
    case "request_validation":
      return { success: true, data: { valid: true } };
    case "exit_confirm":
      return { success: true, data: { exited: true, fee: Math.floor(Math.random() * 5000) + 2000 } };
    case "notification_create":
      return { success: true, data: { notification_id: crypto.randomUUID() } };
    case "technician_assign":
      return { success: true, data: { technician: "Tech-A" } };
    case "work_start":
      return { success: true, data: { started: true } };
    case "report_submit":
      return { success: true, data: { report_id: crypto.randomUUID() } };
    case "verification":
      return { success: true, data: { verified: true, quality_score: 95 } };
    case "energy_analysis":
      return { success: true, data: { consumption_kwh: 450, peak_demand_kw: 120 } };
    case "solar_prediction":
      return { success: true, data: { predicted_kwh: 180, confidence: 0.87 } };
    case "v2g_optimization":
      return { success: true, data: { discharge_schedule: "18:00-21:00", savings_krw: 45000 } };
    case "ev_charging_schedule":
      return { success: true, data: { optimized: true, vehicles: 8 } };
    case "event_detection":
      return { success: true, data: { detected: true, severity: "warning" } };
    case "situation_assessment":
      return { success: true, data: { assessment: "minor", requires_intervention: false } };
    case "corrective_action":
      return { success: true, data: { action_taken: "sensor_reset" } };
    case "system_recovery":
      return { success: true, data: { recovered: true, downtime_seconds: 180 } };
    case "incident_report":
      return { success: true, data: { report_filed: true } };
    case "account_creation":
      return { success: true, data: { account_id: crypto.randomUUID() } };
    case "vehicle_registration":
      return { success: true, data: { registered: true } };
    case "card_issuance":
      return { success: true, data: { card_id: `CARD-${Date.now()}` } };
    case "app_onboarding":
      return { success: true, data: { onboarded: true } };
    case "account_activation":
      return { success: true, data: { active: true } };
    case "usage_aggregation":
      return { success: true, data: { total_sessions: 450, total_kwh: 1200 } };
    case "invoice_generation":
      return { success: true, data: { invoice_count: 120, total_amount: 15000000 } };
    case "invoice_delivery":
      return { success: true, data: { sent: 120, failed: 0 } };
    case "payment_confirmation":
      return { success: true, data: { paid: 115, pending: 5 } };
    case "overdue_processing":
      return { success: true, data: { overdue: 3, reminders_sent: 3 } };
    case "primary_notification":
      return { success: true, data: { sent: true, channel: "push" } };
    case "response_wait":
      return { success: true, data: { responded: false } };
    case "secondary_notification":
      return { success: true, data: { sent: true, channel: "sms" } };
    case "manager_notification":
      return { success: true, data: { escalated: true } };
    case "automated_response":
      return { success: true, data: { auto_action: "system_restart" } };
    default:
      return { success: true, data: { action: step.action, simulated: true } };
  }
}

async function dispatchHardwareCommand(
  step: WorkflowStep
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const commandTypeMap: Record<string, string> = {
    atr_dispatch: "dispatch",
    vehicle_transport: "transport",
    emergency_stop: "emergency_stop",
    vehicle_retrieve: "retrieve",
    exit_preparation: "prepare_exit",
  };

  const deviceType = step.action === "atr_dispatch" || step.action === "vehicle_retrieve"
    ? "atr"
    : "vehicle_elevator";

  const { data: device } = await supabase
    .from("hardware_device_registry")
    .select("id, device_serial, adapter_id, connection_status")
    .eq("device_type", deviceType)
    .eq("connection_status", "online")
    .order("last_heartbeat_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!device) {
    return { success: false, error: `No online ${deviceType} device available` };
  }

  const { data: command, error: insertError } = await supabase
    .from("hardware_commands")
    .insert({
      device_id: device.id,
      command_type: commandTypeMap[step.action] || step.action,
      priority: step.action === "emergency_stop" ? 1 : 3,
      payload: step.config || {},
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  try {
    const gatewayRes = await fetch(`${supabaseUrl}/functions/v1/hardware-gateway`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        action: "dispatch-command",
        command_id: command.id,
        device_serial: device.device_serial,
      }),
    });

    if (!gatewayRes.ok) {
      const errBody = await gatewayRes.text();
      await supabase.from("hardware_commands").update({ status: "failed", error_code: `HTTP_${gatewayRes.status}` }).eq("id", command.id);
      return { success: false, error: `Gateway returned ${gatewayRes.status}: ${errBody}` };
    }

    const result = await gatewayRes.json();
    return {
      success: true,
      data: {
        command_id: command.id,
        device_serial: device.device_serial,
        device_type: deviceType,
        gateway_response: result,
      },
    };
  } catch (err) {
    await supabase.from("hardware_commands").update({ status: "failed", error_code: "GATEWAY_UNREACHABLE" }).eq("id", command.id);
    return { success: false, error: `Gateway call failed: ${String(err)}` };
  }
}
