const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const PHONE_AUTH_URL = `${SUPABASE_URL}/functions/v1/phone-auth`;

interface PhoneAuthSuccess {
  access_token?: string;
  refresh_token?: string;
  user?: any;
  sms_sent?: boolean;
  success?: boolean;
  requested?: boolean;
}

export interface PhoneAuthError {
  error: string;
  blocked_until?: string;
  remaining_seconds?: number;
}

async function request(body: Record<string, unknown>): Promise<PhoneAuthSuccess> {
  const resp = await fetch(PHONE_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();

  if (!resp.ok) {
    const err: PhoneAuthError = {
      error: data.error || 'Une erreur est survenue',
      blocked_until: data.blocked_until,
      remaining_seconds: data.remaining_seconds,
    };
    throw err;
  }

  return data;
}

export async function register(
  phone: string,
  full_name: string,
  pin: string,
  role: string,
  email?: string,
) {
  return request({
    action: 'register',
    phone,
    full_name,
    pin,
    role,
    ...(email ? { email } : {}),
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
