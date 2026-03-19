import { supabase } from '@/lib/supabase';

interface PhoneAuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: any;
  sms_sent?: boolean;
  success?: boolean;
  requested?: boolean;
  error?: string;
  blocked_until?: string;
  remaining_seconds?: number;
}

export interface PhoneAuthError {
  error: string;
  blocked_until?: string;
  remaining_seconds?: number;
}

async function request(body: Record<string, unknown>): Promise<PhoneAuthResponse> {
  const { data, error, response } = await supabase.functions.invoke('phone-auth', { body }) as {
    data: PhoneAuthResponse | null;
    error: any;
    response?: Response;
  };

  if (error) {
    let errBody: PhoneAuthResponse | null = null;
    if (response) {
      try {
        errBody = await response.json();
      } catch {
        // response body already consumed or not JSON
      }
    }
    const err: PhoneAuthError = {
      error: errBody?.error || error.message || 'Une erreur est survenue',
      blocked_until: errBody?.blocked_until,
      remaining_seconds: errBody?.remaining_seconds,
    };
    throw err;
  }

  if (data?.error) {
    const err: PhoneAuthError = {
      error: data.error,
      blocked_until: data.blocked_until,
      remaining_seconds: data.remaining_seconds,
    };
    throw err;
  }

  return data as PhoneAuthResponse;
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
