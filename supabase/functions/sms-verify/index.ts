import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALIGO_API_KEY = Deno.env.get("ALIGO_API_KEY") || "";
const ALIGO_USER_ID = Deno.env.get("ALIGO_USER_ID") || "";
const ALIGO_SENDER = Deno.env.get("ALIGO_SENDER") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendAligoSms(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!ALIGO_API_KEY || !ALIGO_USER_ID || !ALIGO_SENDER) {
    console.log("[DEV MODE] Aligo credentials not configured, skipping SMS send");
    return { success: true, messageId: "dev-mode-no-send" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("key", ALIGO_API_KEY);
    formData.append("user_id", ALIGO_USER_ID);
    formData.append("sender", ALIGO_SENDER);
    formData.append("receiver", phone);
    formData.append("msg", message);
    formData.append("msg_type", "SMS");

    const response = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const result = await response.json();

    if (result.result_code === "1") {
      return { success: true, messageId: result.msg_id || "" };
    }
    return { success: false, error: result.message || "SMS 발송 실패" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function handleSend(body: {
  phone: string;
}): Promise<Response> {
  const { phone } = body;

  if (!phone || phone.replace(/[^0-9]/g, "").length < 10) {
    return new Response(
      JSON.stringify({ error: "올바른 전화번호를 입력하세요." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const cleanPhone = phone.replace(/[^0-9]/g, "");

  // Rate limit: max 3 requests per phone per 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("sgp_phone_verifications")
    .select("*", { count: "exact", head: true })
    .eq("phone", cleanPhone)
    .gte("created_at", fiveMinAgo);

  if ((count || 0) >= 3) {
    return new Response(
      JSON.stringify({ error: "너무 많은 요청입니다. 5분 후 다시 시도하세요." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

  // Send SMS via Aligo
  const smsMessage = `[SGP] 인증코드: ${code}\n3분 이내 입력해주세요.`;
  const smsResult = await sendAligoSms(cleanPhone, smsMessage);

  if (!smsResult.success) {
    return new Response(
      JSON.stringify({ error: smsResult.error || "SMS 발송에 실패했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Store verification record
  const { data, error: insertError } = await supabase
    .from("sgp_phone_verifications")
    .insert({
      phone: cleanPhone,
      code,
      expires_at: expiresAt,
      sent_via: "aligo",
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

  // Increment attempts
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

  // Mark as verified
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
