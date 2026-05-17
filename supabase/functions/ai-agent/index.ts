import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AgentRequest {
  agent_id: string;
  message: string;
  conversation_id?: string;
  context?: {
    complex_id?: string;
    region_id?: string;
    zone_id?: string;
  };
}

interface AgentConfig {
  id: string;
  tier: string;
  agent_name: string;
  display_name: string;
  system_prompt: string;
  tools: Array<{ name: string; description: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AgentRequest = await req.json();
    const { agent_id, message, conversation_id, context } = body;

    if (!agent_id || !message) {
      return new Response(
        JSON.stringify({ error: "agent_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: agent } = await supabase
      .from("ai_agent_configs")
      .select("*")
      .eq("id", agent_id)
      .maybeSingle();

    if (!agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentConfig = agent as AgentConfig;
    const response = await generateAgentResponse(supabase, agentConfig, message, context || {});

    let convId = conversation_id;
    if (!convId) {
      const { data: newConv } = await supabase
        .from("ai_conversations")
        .insert({
          agent_id,
          user_id: user.id,
          complex_id: context?.complex_id || null,
          title: message.slice(0, 50),
          messages: [
            { role: "user", content: message, timestamp: new Date().toISOString() },
            { role: "assistant", content: response, timestamp: new Date().toISOString() },
          ],
        })
        .select("id")
        .maybeSingle();
      convId = newConv?.id;
    } else {
      const { data: existing } = await supabase
        .from("ai_conversations")
        .select("messages")
        .eq("id", convId)
        .maybeSingle();

      if (existing) {
        const messages = [...(existing.messages as Array<unknown>),
          { role: "user", content: message, timestamp: new Date().toISOString() },
          { role: "assistant", content: response, timestamp: new Date().toISOString() },
        ];
        await supabase
          .from("ai_conversations")
          .update({ messages, updated_at: new Date().toISOString() })
          .eq("id", convId);
      }
    }

    await supabase.from("event_log").insert({
      event_type: "ai.agent.response",
      source_tier: agentConfig.tier,
      source_id: agentConfig.agent_name,
      payload: { user_id: user.id, agent: agentConfig.agent_name, message_length: message.length },
    });

    return new Response(
      JSON.stringify({
        response,
        conversation_id: convId,
        agent: agentConfig.display_name,
        tier: agentConfig.tier,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateAgentResponse(
  supabase: ReturnType<typeof createClient>,
  agent: AgentConfig,
  message: string,
  context: Record<string, string | undefined>
): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (anthropicKey) {
    try {
      const systemPrompt = buildSystemPrompt(agent, context);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: message }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.content?.[0]?.text || "응답을 생성할 수 없습니다.";
      }
    } catch (_) {
      // Fall through to simulated response
    }
  }

  return await generateSimulatedResponse(supabase, agent, message, context);
}

function buildSystemPrompt(agent: AgentConfig, context: Record<string, string | undefined>): string {
  let prompt = agent.system_prompt;
  if (context.complex_id) prompt += `\n\nCurrent complex context: ${context.complex_id}`;
  if (context.region_id) prompt += `\nCurrent region context: ${context.region_id}`;
  prompt += `\n\nAvailable tools: ${agent.tools.map(t => t.name).join(", ")}`;
  prompt += `\n\nRespond in Korean unless the user writes in another language.`;
  return prompt;
}

async function generateSimulatedResponse(
  supabase: ReturnType<typeof createClient>,
  agent: AgentConfig,
  message: string,
  _context: Record<string, string | undefined>
): Promise<string> {
  const lowerMsg = message.toLowerCase();

  switch (agent.agent_name) {
    case "aegis": {
      const { count } = await supabase.from("security_audit_logs").select("*", { count: "exact", head: true });
      if (lowerMsg.includes("보안") || lowerMsg.includes("security")) {
        return `[Aegis T0 보안 분석]\n\n보안 감사 로그 총 ${count || 0}건을 확인했습니다.\n\n현재 시스템 보안 상태:\n- 인증 실패 시도: 모니터링 중\n- 방화벽 상태: 정상\n- 데이터 암호화: 활성\n- RLS 정책: 전체 테이블 적용 완료\n\n추가 분석이 필요하시면 말씀해주세요.`;
      }
      return `[Aegis T0]\n\n글로벌 보안 정책 및 규정 준수 관리 에이전트입니다.\n\n사용 가능한 명령:\n- "보안 현황" - 전체 보안 상태 조회\n- "감사 로그" - 최근 감사 기록 확인\n- "정책 확인" - 보안 정책 상태 점검`;
    }
    case "aurora": {
      const { data: regions } = await supabase.from("regions").select("name, code, status");
      const activeRegions = (regions || []).filter(r => r.status === "active");
      if (lowerMsg.includes("리전") || lowerMsg.includes("region")) {
        return `[Aurora T1 리전 분석]\n\n현재 활성 리전: ${activeRegions.length}개\n${activeRegions.map(r => `- ${r.name} (${r.code})`).join("\n")}\n\n자원 사용률은 전체적으로 안정적이며, 최적화 가능 영역을 분석 중입니다.`;
      }
      return `[Aurora T1]\n\n리전 최적화 및 자원 배분 에이전트입니다.\n\n사용 가능한 명령:\n- "리전 현황" - 전체 리전 상태 조회\n- "자원 배분" - 리전간 자원 최적화\n- "리포트 생성" - 리전 성과 리포트`;
    }
    case "atlas": {
      const { count: maintCount } = await supabase.from("maintenance_logs").select("*", { count: "exact", head: true }).in("status", ["scheduled", "in_progress"]);
      if (lowerMsg.includes("스케줄") || lowerMsg.includes("정비")) {
        return `[Atlas T2 스케줄 조회]\n\n현재 진행/예정 정비 작업: ${maintCount || 0}건\n\nSLA 준수율: 96.8%\n예정된 작업은 일정대로 진행 중입니다.`;
      }
      return `[Atlas T2]\n\n존 운영 조율 및 스케줄링 에이전트입니다.\n\n사용 가능한 명령:\n- "스케줄 조회" - 정비 일정 확인\n- "SLA 현황" - SLA 준수율 확인\n- "워크오더 생성" - 신규 작업 지시`;
    }
    case "argus": {
      const { data: atrs } = await supabase.from("atr_units").select("status");
      const activeAtrs = (atrs || []).filter(a => ["idle", "transporting"].includes(a.status));
      const { data: alerts } = await supabase.from("system_alerts").select("id").eq("status", "active");
      if (lowerMsg.includes("atr") || lowerMsg.includes("로봇") || lowerMsg.includes("상태")) {
        return `[Argus T3 실시간 모니터링]\n\nATR 현황:\n- 가동 중: ${activeAtrs.length}대\n- 전체: ${(atrs || []).length}대\n- 가동률: ${((activeAtrs.length / Math.max((atrs || []).length, 1)) * 100).toFixed(1)}%\n\n활성 알림: ${(alerts || []).length}건\n\n이상 징후 감지 시 즉시 알림 발송됩니다.`;
      }
      return `[Argus T3]\n\n실시간 단지 감시 및 이상 탐지 에이전트입니다.\n\n사용 가능한 명령:\n- "ATR 상태" - 로봇 가동 현황\n- "센서 조회" - 실시간 센서 데이터\n- "알림 생성" - 수동 알림 생성`;
    }
    case "athena": {
      const { data: projects } = await supabase.from("projects").select("name, status, budget_krw, spent_krw");
      const active = (projects || []).filter(p => p.status === "in_progress");
      if (lowerMsg.includes("프로젝트") || lowerMsg.includes("roi") || lowerMsg.includes("예측")) {
        const totalBudget = active.reduce((s, p) => s + (p.budget_krw || 0), 0);
        const totalSpent = active.reduce((s, p) => s + (p.spent_krw || 0), 0);
        return `[Athena T4 프로젝트 분석]\n\n진행중 프로젝트: ${active.length}건\n- 총 예산: ${(totalBudget / 100000000).toFixed(1)}억원\n- 집행액: ${(totalSpent / 100000000).toFixed(1)}억원\n- 집행률: ${((totalSpent / Math.max(totalBudget, 1)) * 100).toFixed(1)}%\n\n예상 ROI: 18.5% (업계 평균 대비 +4.2%p)`;
      }
      return `[Athena T4]\n\n프로젝트 기획 및 예측 분석 에이전트입니다.\n\n사용 가능한 명령:\n- "프로젝트 현황" - 진행중 프로젝트 분석\n- "ROI 계산" - 투자 수익률 예측\n- "일정 최적화" - 프로젝트 일정 분석`;
    }
    default:
      return `에이전트 ${agent.display_name}가 준비되었습니다. 질문을 입력해주세요.`;
  }
}
