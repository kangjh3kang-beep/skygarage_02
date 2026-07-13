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

const ALIGO_API_KEY = (Deno.env.get("ALIGO_API_KEY") || "").trim();
const ALIGO_USER_ID = (Deno.env.get("ALIGO_USER_ID") || "").trim();
const ALIGO_SENDER = (Deno.env.get("ALIGO_SENDER") || "").trim();

const COOLSMS_API_KEY = (Deno.env.get("COOLSMS_API_KEY") || "").trim();
const COOLSMS_API_SECRET = (Deno.env.get("COOLSMS_API_SECRET") || "").trim();
const COOLSMS_SENDER = (Deno.env.get("COOLSMS_SENDER") || "").trim();

// Startup diagnostic - check which secrets are actually populated
console.log("[SMS-VERIFY BOOT] Env check:", JSON.stringify({
  ALIGO_API_KEY: ALIGO_API_KEY ? `set (${ALIGO_API_KEY.length} chars)` : "EMPTY",
  ALIGO_USER_ID: ALIGO_USER_ID ? `set (${ALIGO_USER_ID.length} chars)` : "EMPTY",
  ALIGO_SENDER: ALIGO_SENDER ? `set (${ALIGO_SENDER.length} chars)` : "EMPTY",
  COOLSMS_API_KEY: COOLSMS_API_KEY ? `set (${COOLSMS_API_KEY.length} chars)` : "EMPTY",
  COOLSMS_API_SECRET: COOLSMS_API_SECRET ? `set (${COOLSMS_API_SECRET.length} chars)` : "EMPTY",
  COOLSMS_SENDER: COOLSMS_SENDER ? `set (${COOLSMS_SENDER.length} chars)` : "EMPTY",
}));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

// --- Aligo SMS API ---
async function sendAligo(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sender = cleanPhone(ALIGO_SENDER);
  const receiver = cleanPhone(phone);

  console.log(`[ALIGO] Attempting send: sender=${sender}, receiver=${receiver}`);

  if (!sender || sender.length < 9) {
    return { success: false, error: `ALIGO_SENDER is empty or invalid after cleanup. Raw value length: ${ALIGO_SENDER.length}` };
  }

  const formData = new FormData();
  formData.append("key", ALIGO_API_KEY);
  formData.append("user_id", ALIGO_USER_ID);
  formData.append("sender", sender);
  formData.append("receiver", receiver);
  formData.append("msg", message);

  const response = await fetch("https://apis.aligo.in/send/", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  console.log(`[ALIGO] Response:`, JSON.stringify(result));

  if (result.result_code === "1" || result.result_code === 1) {
    return { success: true, messageId: String(result.msg_id || "") };
  }
  return { success: false, error: result.message || `Aligo code: ${result.result_code}` };
}

// --- CoolSMS/Solapi API ---
function generateSalt(length = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => chars[b % chars.length]).join("");
}

async function generateHmacSignature(date: string, salt: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(date + salt));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendCoolSms(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sender = cleanPhone(COOLSMS_SENDER);
  const receiver = cleanPhone(phone);

  console.log(`[SOLAPI] Attempting send: sender=${sender}, receiver=${receiver}`);

  if (!sender || sender.length < 9) {
    return { success: false, error: `COOLSMS_SENDER is empty or invalid. Raw value length: ${COOLSMS_SENDER.length}` };
  }

  const date = new Date().toISOString();
  const salt = generateSalt();
  const signature = await generateHmacSignature(date, salt, COOLSMS_API_SECRET);
  const authorization = `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;

  const response = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authorization,
    },
    body: JSON.stringify({
      message: { to: receiver, from: sender, text: message, type: "SMS" },
    }),
  });

  const result = await response.json();
  console.log(`[SOLAPI] status=${response.status}:`, JSON.stringify(result));

  if (response.ok && result.groupId) {
    return { success: true, messageId: result.groupId };
  }
  return { success: false, error: result.errorMessage || result.message || "Solapi fail" };
}

// --- Unified: Aligo first, CoolSMS fallback ---
async function sendSms(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string; provider?: string }> {
  const aligoReady = !!(ALIGO_API_KEY && ALIGO_USER_ID && ALIGO_SENDER);
  const coolsmsReady = !!(COOLSMS_API_KEY && COOLSMS_API_SECRET && COOLSMS_SENDER);

  console.log(`[SMS] aligoReady=${aligoReady}, coolsmsReady=${coolsmsReady}`);

  if (aligoReady) {
    try {
      const result = await sendAligo(phone, message);
      if (result.success) return { ...result, provider: "aligo" };
      console.log(`[SMS] Aligo failed: ${result.error}`);
    } catch (err) {
      console.log(`[SMS] Aligo exception: ${(err as Error).message}`);
    }
  }

  if (coolsmsReady) {
    try {
      const result = await sendCoolSms(phone, message);
      return { ...result, provider: "coolsms" };
    } catch (err) {
      return { success: false, error: (err as Error).message, provider: "coolsms" };
    }
  }

  if (!aligoReady && !coolsmsReady) {
    return {
      success: false,
      error: "SMS 발송 설정이 되어있지 않습니다. ALIGO 또는 COOLSMS Secret 값을 확인해주세요.",
      provider: "none",
    };
  }

  return { success: false, error: "모든 SMS 발송이 실패했습니다.", provider: "none" };
}

async function handleSend(body: { phone: string }): Promise<Response> {
  const { phone } = body;

  if (!phone || phone.replace(/[^0-9]/g, "").length < 10) {
    return new Response(
      JSON.stringify({ error: "올바른 전화번호를 입력하세요." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const phoneClean = cleanPhone(phone);

  // Rate limit
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("sgp_phone_verifications")
    .select("*", { count: "exact", head: true })
    .eq("phone", phoneClean)
    .gte("created_at", fiveMinAgo);

  if ((count || 0) >= 3) {
    return new Response(
      JSON.stringify({ error: "너무 많은 요청입니다. 5분 후 다시 시도하세요." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

  const smsMessage = `[SGP] 인증코드: ${code}\n3분 이내 입력해주세요.`;
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
