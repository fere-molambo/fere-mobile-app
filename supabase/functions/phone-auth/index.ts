import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const IKODDI_API_KEY = Deno.env.get("IKODDI_API_KEY") || "";
const IKODDI_ORGANIZATION_ID = Deno.env.get("IKODDI_ORGANIZATION_ID") || "";

const IKODDI_BASE = "https://api.ikoddi.com/api/v1/groups";
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RATE_LIMIT_SECONDS = 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MINUTES = 15;

const COUNTRY_MAP: Record<string, { phoneCode: string; isoCode: string }> = {
  "223": { phoneCode: "223", isoCode: "ML" },
  "225": { phoneCode: "225", isoCode: "CI" },
  "221": { phoneCode: "221", isoCode: "SN" },
  "226": { phoneCode: "226", isoCode: "BF" },
  "228": { phoneCode: "228", isoCode: "TG" },
  "229": { phoneCode: "229", isoCode: "BJ" },
  "227": { phoneCode: "227", isoCode: "NE" },
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractCountryInfo(phone: string) {
  const cleaned = phone.replace(/^\+/, "");
  for (const code of Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length)) {
    if (cleaned.startsWith(code)) {
      return {
        ...COUNTRY_MAP[code],
        localNumber: cleaned.slice(code.length),
        fullNumber: cleaned,
      };
    }
  }
  return {
    phoneCode: "223",
    isoCode: "ML",
    localNumber: cleaned,
    fullNumber: cleaned,
  };
}

function generateOtp(): string {
  const digits = new Uint8Array(6);
  crypto.getRandomValues(digits);
  return Array.from(digits, (d) => (d % 10).toString()).join("");
}

async function sendSmsViaIkoddi(
  fullNumber: string,
  message: string,
  phoneCode: string,
  isoCode: string,
): Promise<boolean> {
  const url = `${IKODDI_BASE}/${IKODDI_ORGANIZATION_ID}/sms`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": IKODDI_API_KEY,
    },
    body: JSON.stringify({
      sentTo: [fullNumber],
      message,
      from: "Ikoddi",
      smsBroadCast: "OTP",
      countryNumberCode: phoneCode,
      countryStringCode: isoCode,
    }),
  });
  return resp.ok;
}

async function checkOtpRateLimit(
  supabase: ReturnType<typeof createClient>,
  phone: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("otp_rate_limits")
    .select("sent_at")
    .eq("phone", phone)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    const elapsed = (Date.now() - new Date(data.sent_at).getTime()) / 1000;
    if (elapsed < OTP_RATE_LIMIT_SECONDS) {
      const remaining = Math.ceil(OTP_RATE_LIMIT_SECONDS - elapsed);
      return `Veuillez patienter ${remaining}s avant de renvoyer un code`;
    }
  }
  return null;
}

async function recordOtpSent(
  supabase: ReturnType<typeof createClient>,
  phone: string,
) {
  await supabase.from("otp_rate_limits").insert({ phone });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function hashPin(pin: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes.buffer);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(salt + pin),
  );
  return `${salt}:${toHex(hashBuffer)}`;
}

async function verifyPin(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  pin: string,
): Promise<boolean> {
  const { data: userPin } = await supabase
    .from("user_pins")
    .select("pin_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (!userPin) return false;

  const stored = userPin.pin_hash;
  const sepIndex = stored.indexOf(":");
  if (sepIndex === -1) return false;

  const salt = stored.slice(0, sepIndex);
  const expectedHash = stored.slice(sepIndex + 1);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(salt + pin),
  );
  return toHex(hashBuffer) === expectedHash;
}

async function handleRegister(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const { phone, full_name, pin, role, email } = body as {
    phone: string;
    full_name: string;
    pin: string;
    role: string;
    email?: string;
  };

  if (!phone || !full_name || !pin || !role) {
    return jsonResponse({ error: "Champs requis manquants" }, 400);
  }

  if (String(pin).length !== 6) {
    return jsonResponse({ error: "Le PIN doit contenir 6 chiffres" }, 400);
  }

  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("contact", phone)
    .maybeSingle();

  if (existingUser) {
    return jsonResponse({ error: "Ce numero est deja enregistre" }, 409);
  }

  const rateLimitMsg = await checkOtpRateLimit(supabase, phone);
  if (rateLimitMsg) {
    return jsonResponse({ error: rateLimitMsg }, 429);
  }

  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const pinHash = await hashPin(pin);

  await supabase
    .from("pending_registrations")
    .delete()
    .eq("phone", phone);

  await supabase.from("pending_registrations").insert({
    phone,
    full_name: String(full_name),
    email: email ? String(email) : null,
    role,
    pin_hash: pinHash,
    otp_code: otp,
    otp_expires_at: otpExpires,
    otp_attempts: 0,
  });

  const country = extractCountryInfo(phone);
  const message = `Votre code de verification Fere est : ${otp}. Valable ${OTP_EXPIRY_MINUTES} minutes.`;
  await sendSmsViaIkoddi(country.fullNumber, message, country.phoneCode, country.isoCode);
  await recordOtpSent(supabase, phone);

  return jsonResponse({ sms_sent: true });
}

async function handleVerifyRegistration(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const { phone, otp } = body as { phone: string; otp: string };

  if (!phone || !otp) {
    return jsonResponse({ error: "Telephone et code requis" }, 400);
  }

  const { data: pending } = await supabase
    .from("pending_registrations")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (!pending) {
    return jsonResponse({ error: "Aucune inscription en attente pour ce numero" }, 404);
  }

  if (new Date(pending.otp_expires_at) < new Date()) {
    return jsonResponse({ error: "Le code a expire. Veuillez en demander un nouveau." }, 410);
  }

  if (pending.otp_attempts >= MAX_OTP_ATTEMPTS) {
    return jsonResponse({ error: "Trop de tentatives. Veuillez recommencer l'inscription." }, 429);
  }

  if (pending.otp_code !== otp) {
    await supabase
      .from("pending_registrations")
      .update({ otp_attempts: pending.otp_attempts + 1 })
      .eq("id", pending.id);
    return jsonResponse({ error: "Code incorrect" }, 401);
  }

  const internalPassword = crypto.randomUUID();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    phone: pending.phone,
    phone_confirm: true,
    password: internalPassword,
    user_metadata: {
      full_name: pending.full_name,
      role: pending.role,
    },
  });

  if (authError || !authUser?.user) {
    return jsonResponse({ error: authError?.message || "Erreur lors de la creation du compte" }, 500);
  }

  const userId = authUser.user.id;

  await supabase.from("profiles").upsert({
    id: userId,
    nom_complet: pending.full_name,
    contact: pending.phone,
    email: pending.email,
  });

  await supabase.from("user_roles").insert({
    user_id: userId,
    role: pending.role,
  });

  await supabase.from("user_pins").insert({
    user_id: userId,
    pin_hash: pending.pin_hash,
    internal_password: internalPassword,
  });

  await supabase
    .from("pending_registrations")
    .delete()
    .eq("id", pending.id);

  return jsonResponse({ success: true });
}

async function handleLogin(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const { phone, pin } = body as { phone: string; pin: string };

  if (!phone || !pin) {
    return jsonResponse({ error: "Telephone et PIN requis" }, 400);
  }

  const { data: attempt } = await supabase
    .from("login_attempts")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (attempt?.blocked_until && new Date(attempt.blocked_until) > new Date()) {
    const remaining = Math.ceil(
      (new Date(attempt.blocked_until).getTime() - Date.now()) / 1000,
    );
    return jsonResponse(
      {
        error: "Compte temporairement bloque suite a trop de tentatives",
        blocked_until: attempt.blocked_until,
        remaining_seconds: remaining,
      },
      429,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("contact", phone)
    .maybeSingle();

  if (!profile) {
    return jsonResponse({ error: "Numero non enregistre" }, 404);
  }

  const pinValid = await verifyPin(supabase, profile.id, pin);

  if (!pinValid) {
    const newAttempts = (attempt?.attempts || 0) + 1;
    const blocked =
      newAttempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOGIN_BLOCK_MINUTES * 60 * 1000).toISOString()
        : null;

    if (attempt) {
      await supabase
        .from("login_attempts")
        .update({
          attempts: newAttempts,
          last_attempt_at: new Date().toISOString(),
          blocked_until: blocked,
        })
        .eq("id", attempt.id);
    } else {
      await supabase.from("login_attempts").insert({
        phone,
        attempts: newAttempts,
        last_attempt_at: new Date().toISOString(),
        blocked_until: blocked,
      });
    }

    const remaining = blocked
      ? LOGIN_BLOCK_MINUTES * 60
      : 0;

    return jsonResponse(
      {
        error: blocked
          ? "Trop de tentatives. Compte bloque temporairement."
          : "Code PIN incorrect",
        ...(blocked ? { blocked_until: blocked, remaining_seconds: remaining } : {}),
      },
      401,
    );
  }

  if (attempt) {
    await supabase
      .from("login_attempts")
      .update({ attempts: 0, blocked_until: null })
      .eq("id", attempt.id);
  }

  const { data: userPin } = await supabase
    .from("user_pins")
    .select("internal_password")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!userPin?.internal_password) {
    return jsonResponse({ error: "Erreur de configuration du compte" }, 500);
  }

  const { data: session, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: `${phone}@phone.fere.app`,
      password: userPin.internal_password,
    });

  if (signInError || !session?.session) {
    return jsonResponse(
      { error: signInError?.message || "Erreur de connexion" },
      500,
    );
  }

  return jsonResponse({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    user: session.session.user,
  });
}

async function handleResetPinRequest(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const { phone } = body as { phone: string };

  if (!phone) {
    return jsonResponse({ error: "Numero de telephone requis" }, 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("contact", phone)
    .maybeSingle();

  if (!profile) {
    return jsonResponse({ error: "Numero non enregistre" }, 404);
  }

  const rateLimitMsg = await checkOtpRateLimit(supabase, phone);
  if (rateLimitMsg) {
    return jsonResponse({ error: rateLimitMsg }, 429);
  }

  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await supabase
    .from("pending_pin_resets")
    .delete()
    .eq("phone", phone);

  await supabase.from("pending_pin_resets").insert({
    phone,
    otp_token: otp,
    otp_expires_at: otpExpires,
    otp_attempts: 0,
  });

  const country = extractCountryInfo(phone);
  const message = `Votre code de reinitialisation Fere est : ${otp}. Valable ${OTP_EXPIRY_MINUTES} minutes.`;
  await sendSmsViaIkoddi(country.fullNumber, message, country.phoneCode, country.isoCode);
  await recordOtpSent(supabase, phone);

  return jsonResponse({ sms_sent: true });
}

async function handleResetPinConfirm(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const { phone, otp, new_pin } = body as {
    phone: string;
    otp: string;
    new_pin: string;
  };

  if (!phone || !otp || !new_pin) {
    return jsonResponse({ error: "Champs requis manquants" }, 400);
  }

  if (String(new_pin).length !== 6) {
    return jsonResponse({ error: "Le PIN doit contenir 6 chiffres" }, 400);
  }

  const { data: pending } = await supabase
    .from("pending_pin_resets")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (!pending) {
    return jsonResponse({ error: "Aucune demande de reinitialisation en cours" }, 404);
  }

  if (new Date(pending.otp_expires_at) < new Date()) {
    return jsonResponse({ error: "Le code a expire" }, 410);
  }

  if (pending.otp_attempts >= MAX_OTP_ATTEMPTS) {
    return jsonResponse({ error: "Trop de tentatives" }, 429);
  }

  if (pending.otp_token !== otp) {
    await supabase
      .from("pending_pin_resets")
      .update({ otp_attempts: pending.otp_attempts + 1 })
      .eq("id", pending.id);
    return jsonResponse({ error: "Code incorrect" }, 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("contact", phone)
    .maybeSingle();

  if (!profile) {
    return jsonResponse({ error: "Compte introuvable" }, 404);
  }

  const newPinHash = await hashPin(new_pin);
  const newInternalPassword = crypto.randomUUID();

  await supabase
    .from("user_pins")
    .update({
      pin_hash: newPinHash,
      internal_password: newInternalPassword,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", profile.id);

  await supabase.auth.admin.updateUserById(profile.id, {
    password: newInternalPassword,
  });

  await supabase
    .from("pending_pin_resets")
    .delete()
    .eq("id", pending.id);

  await supabase
    .from("login_attempts")
    .update({ attempts: 0, blocked_until: null })
    .eq("phone", phone);

  return jsonResponse({ success: true });
}

async function handleAdminResetRequest(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const { phone } = body as { phone: string };

  if (!phone) {
    return jsonResponse({ error: "Numero de telephone requis" }, 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("contact", phone)
    .maybeSingle();

  if (!profile) {
    return jsonResponse({ error: "Numero non enregistre" }, 404);
  }

  const { data: existing } = await supabase
    .from("pin_reset_requests")
    .select("id")
    .eq("user_phone", phone)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return jsonResponse({ requested: true });
  }

  await supabase.from("pin_reset_requests").insert({
    user_phone: phone,
    user_id: profile.id,
    status: "pending",
  });

  return jsonResponse({ requested: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      case "register":
        return await handleRegister(supabase, body);
      case "verify-registration":
        return await handleVerifyRegistration(supabase, body);
      case "login":
        return await handleLogin(supabase, body);
      case "reset-pin-request":
        return await handleResetPinRequest(supabase, body);
      case "reset-pin-confirm":
        return await handleResetPinConfirm(supabase, body);
      case "request-admin-reset":
        return await handleAdminResetRequest(supabase, body);
      default:
        return jsonResponse({ error: "Action non reconnue" }, 400);
    }
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Erreur interne" },
      500,
    );
  }
});
