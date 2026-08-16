import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

interface PhoneAuthSession {
  access_token: string;
  refresh_token: string;
  user?: any;
}

export interface PhoneAuthResponse {
  success: boolean;
  error?: string;
  session?: PhoneAuthSession;
  sms_sent?: boolean;
  message?: string;
  requested?: boolean;
  blocked_until?: string;
  remaining_seconds?: number;
}

export interface PhoneAuthError {
  error: string;
  blocked_until?: string;
  remaining_seconds?: number;
  message?: string;
  reason?: string;
  support_phone?: string;
  support_email?: string;
}

async function request(body: Record<string, unknown>): Promise<PhoneAuthResponse> {
  let rawData: any = null;

  try {
    // Use direct fetch with apikey only (no Authorization) -- phone-auth is a public endpoint
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/phone-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    try { rawData = JSON.parse(text); } catch { rawData = { error: text }; }

    console.log('[phone-auth]', body.action, 'status:', resp.status, '| data:', JSON.stringify(rawData));

    if (!resp.ok) {
      const err: PhoneAuthError = {
        error: rawData?.error || `Erreur serveur (${resp.status})`,
        blocked_until: rawData?.blocked_until,
        remaining_seconds: rawData?.remaining_seconds,
        message: rawData?.message,
        reason: rawData?.reason,
        support_phone: rawData?.support_phone,
        support_email: rawData?.support_email,
      };
      throw err;
    }
  } catch (e: any) {
    if (e?.error !== undefined) throw e;
    throw { error: e?.message || 'Erreur reseau' } as PhoneAuthError;
  }

  if (rawData?.error && !rawData?.success) {
    const err: PhoneAuthError = {
      error: rawData.error,
      blocked_until: rawData.blocked_until,
      remaining_seconds: rawData.remaining_seconds,
      message: rawData.message,
      reason: rawData.reason,
      support_phone: rawData.support_phone,
      support_email: rawData.support_email,
    };
    throw err;
  }

  // Normalize: edge function returns { access_token, refresh_token, user } at root for login
  if (rawData?.access_token && rawData?.refresh_token) {
    return {
      success: true,
      session: {
        access_token: rawData.access_token,
        refresh_token: rawData.refresh_token,
        user: rawData.user,
      },
    };
  }

  return rawData as PhoneAuthResponse;
}

export async function register(
  phone: string,
  full_name: string,
  pin: string,
  role: string,
  email?: string,
  consents?: Record<string, unknown>,
) {
  return request({
    action: 'register',
    phone,
    full_name,
    pin,
    role,
    email: email || '',
    // Consentement CGU / confidentialite recueilli avant la creation du compte :
    // il est archive avec l'inscription en attente puis horodate a la validation.
    consents: consents ?? null,
  });
}

export async function verifyRegistration(phone: string, otp: string) {
  return request({ action: 'verify-registration', phone, otp });
}

export async function login(phone: string, pin: string) {
  return request({ action: 'login', phone, pin });
}

export async function resetPinRequest(phone: string) {
  return request({ action: 'reset-pin-request', phone });
}

export async function resetPinConfirm(phone: string, otp: string, new_pin: string) {
  return request({ action: 'reset-pin-confirm', phone, otp, new_pin });
}

export async function requestAdminReset(phone: string) {
  return request({ action: 'request-admin-reset', phone });
}
