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

export async function invokeWithAuth(fn: string, body: Record<string, unknown>) {
  let { data: { session }, error: sessionErr } = await supabase.auth.getSession();

  console.log('[invokeWithAuth]', {
    fn,
    hasSession: !!session,
    userId: session?.user?.id ?? null,
    expiresAt: session?.expires_at,
    now: Math.floor(Date.now() / 1000),
    sessionErr: sessionErr?.message,
  });

  const now = Math.floor(Date.now() / 1000);
  if (!session || (session.expires_at && session.expires_at - now < 60)) {
    console.log('[invokeWithAuth] refreshing session...');
    const { data: refreshed, error: rErr } = await supabase.auth.refreshSession();
    if (rErr) {
      console.error('[invokeWithAuth] refreshSession failed:', rErr.message);
    }
    session = refreshed?.session ?? null;
  }

  if (!session?.access_token) {
    throw new Error('Session expirée, reconnectez-vous');
  }

  console.log('[invokeWithAuth] calling', fn, 'with token prefix:', session.access_token.slice(0, 20));

  return supabase.functions.invoke(fn, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}
