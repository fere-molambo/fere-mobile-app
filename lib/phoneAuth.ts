import { supabase } from '@/lib/supabase';

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
  const { data, error } = await supabase.functions.invoke('phone-auth', { body }) as {
    data: PhoneAuthResponse | null;
    error: any;
  };

  console.log('phone-auth response:', JSON.stringify(data));

  if (error) {
    let errBody: any = null;
    try {
      if (error.context) {
        errBody = await error.context.json();
      }
    } catch {
      // body already consumed or not JSON
    }
    const err: PhoneAuthError = {
      error: errBody?.error || error.message || 'Une erreur est survenue',
      blocked_until: errBody?.blocked_until,
      remaining_seconds: errBody?.remaining_seconds,
      message: errBody?.message,
      reason: errBody?.reason,
      support_phone: errBody?.support_phone,
      support_email: errBody?.support_email,
    };
    throw err;
  }

  if (!data?.success && data?.error) {
    const d = data as any;
    const err: PhoneAuthError = {
      error: d.error || 'Une erreur est survenue',
      blocked_until: d.blocked_until,
      remaining_seconds: d.remaining_seconds,
      message: d.message,
      reason: d.reason,
      support_phone: d.support_phone,
      support_email: d.support_email,
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
    email: email || '',
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
