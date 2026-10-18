import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { generateCode, sendSolapi, checkSolapiAuthentication, resolveSolapiSender, readSmsConfig } from "./solapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const config = readSmsConfig(name => Deno.env.get(name));
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const cleanPhone = (value: string) => value.replace(/\D/g, "");
let senderHealth: { until: number; result: Awaited<ReturnType<typeof resolveSolapiSender>> } | undefined;
async function getSender() {
  if (!senderHealth || senderHealth.until < Date.now()) {
    const result = await resolveSolapiSender(config);
    senderHealth = { result, until: Date.now() + (result.sender ? 60000 : 10000) };
  }
  return senderHealth.result;
}
async function sendSms(phone: string, message: string) {
  const result = await getSender();
  if (!result.sender) return { success: false as const, error: result.error, provider: "solapi" };
  return sendSolapi({ ...config, sender: result.sender }, phone, message);
}
let authHealth: { until: number; authenticated: boolean } | undefined;

async function handleSend(body: { phone: string }): Promise<Response> {
  const { phone } = body;

  if (typeof phone !== "string" || !/^010\d{8}$/.test(cleanPhone(phone))) {
    return new Response(
      JSON.stringify({ error: "올바른 전화번호를 입력하세요." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const phoneClean = cleanPhone(phone);

  // Rate limit
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count, error: rateLimitError } = await supabase
    .from("sgp_phone_verifications")
    .select("*", { count: "exact", head: true })
    .eq("phone", phoneClean)
    .gte("created_at", fiveMinAgo);

  if (rateLimitError) {
    return new Response(JSON.stringify({ error: "문자 요청을 확인하지 못했습니다. 잠시 후 다시 시도해주세요." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if ((count || 0) >= 3) {
    return new Response(
      JSON.stringify({ error: "너무 많은 요청입니다. 5분 후 다시 시도하세요." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

  const smsMessage = `[SkyGarage] 인증번호 ${code} (3분 이내 입력)`;
  const smsResult = await sendSms(phoneClean, smsMessage);

  if (!smsResult.success) {
    return new Response(
      JSON.stringify({ error: smsResult.error || "SMS 발송에 실패했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data, error: insertError } = await supabase
    .from("sgp_phone_verifications")
    .insert({
      phone: phoneClean,
      code,
      expires_at: expiresAt,
      sent_via: smsResult.provider || "unknown",
      message_id: smsResult.messageId || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: "인증코드 저장에 실패했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      verification_id: data.id,
      expires_at: expiresAt,
      message: "인증코드가 발송되었습니다.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleConfirm(body: {
  verification_id: string;
  code: string;
}): Promise<Response> {
  const { verification_id, code } = body;

  if (!verification_id || !code || code.length !== 6) {
    return new Response(
      JSON.stringify({ error: "인증 ID와 6자리 코드를 입력하세요." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data, error: fetchError } = await supabase
    .from("sgp_phone_verifications")
    .select("*")
    .eq("id", verification_id)
    .maybeSingle();

  if (fetchError || !data) {
    return new Response(
      JSON.stringify({ error: "인증 정보를 찾을 수 없습니다." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (data.verified) {
    return new Response(
      JSON.stringify({ error: "이미 인증 완료된 코드입니다." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (data.attempts >= 5) {
    return new Response(
      JSON.stringify({ error: "시도 횟수를 초과했습니다. 새 코드를 요청하세요." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (new Date(data.expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: "인증코드가 만료되었습니다. 재발송 해주세요." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await supabase
    .from("sgp_phone_verifications")
    .update({ attempts: data.attempts + 1 })
    .eq("id", verification_id);

  if (data.code !== code) {
    const remaining = 4 - data.attempts;
    return new Response(
      JSON.stringify({
        error: `인증코드가 일치하지 않습니다. (${remaining}회 남음)`,
        remaining,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await supabase
    .from("sgp_phone_verifications")
    .update({ verified: true })
    .eq("id", verification_id);

  return new Response(
    JSON.stringify({
      verified: true,
      phone: data.phone,
      message: "인증이 완료되었습니다.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    if (new URL(req.url).searchParams.get("verify") === "1") {
      if (!authHealth || authHealth.until < Date.now()) {
        authHealth = { authenticated: await checkSolapiAuthentication(config), until: Date.now() + 60000 };
      }
      const sender = await getSender();
      return new Response(JSON.stringify({ provider: "solapi", configured: Boolean(config.apiKey && config.apiSecret), authenticated: authHealth.authenticated,
        senderConfigured: /^\d{8,11}$/.test(cleanPhone(config.sender)), senderReady: Boolean(sender.sender), activeSenderCount: sender.activeCount,
        senderError: sender.error || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    return new Response(JSON.stringify({ provider: "solapi", configured: Boolean(config.apiKey && config.apiSecret && config.sender) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST 요청만 지원합니다." }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" } });
  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    const body = await req.json();

    if (path === "send") {
      return await handleSend(body);
    } else if (path === "confirm") {
      return await handleConfirm(body);
    }

    return new Response(
      JSON.stringify({ error: "Invalid endpoint. Use /send or /confirm" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "요청을 처리하지 못했습니다. 입력값을 확인해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
