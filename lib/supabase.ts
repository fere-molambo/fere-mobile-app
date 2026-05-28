import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. ' +
    'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.'
  );
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(key);
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error('[SecureStore] getItem failed:', key, e);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error('[SecureStore] setItem failed:', key, e);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('[SecureStore] removeItem failed:', key, e);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { supabaseUrl as SUPABASE_URL, supabaseAnonKey as SUPABASE_ANON_KEY };

/**
 * Calls a Supabase edge function using explicit fetch with a fresh session token.
 * Bypasses supabase.functions.invoke() which can silently fall back to the anon key on mobile.
 */
export async function invokeWithAuth(
  fn: string,
  body: Record<string, unknown>
): Promise<{ data: any; error: any }> {
  let { data: { session } } = await supabase.auth.getSession();

  const now = Math.floor(Date.now() / 1000);
  if (!session || (session.expires_at && session.expires_at - now < 60)) {
    console.log('[invokeWithAuth] session missing or expiring, refreshing...');
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.log('[invokeWithAuth] refresh error:', refreshError.message);
    }
    session = refreshed?.session ?? null;
  }

  if (!session?.access_token) {
    throw new Error('Session expirée. Déconnecte-toi puis reconnecte-toi.');
  }

  console.log('[invokeWithAuth]', fn, {
    hasSession: true,
    hasAccessToken: !!session.access_token,
    tokenLength: session.access_token.length,
    userId: session.user?.id,
    tokenPreview: session.access_token.slice(0, 20),
  });

  const response = await fetch(
    `${supabaseUrl}/functions/v1/${fn}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
    }
  );

  const responseText = await response.text();
  let result: any;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { error: responseText };
  }

  console.log('[OM-PAYMENT] status:', response.status, '| body:', JSON.stringify(result).slice(0, 200));

  if (!response.ok) {
    return {
      data: null,
      error: new Error(result?.error || result?.message || `Paiement refusé (${response.status})`),
    };
  }

  return { data: result, error: null };
}
