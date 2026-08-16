import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

/** Documents soumis a consentement. */
export type LegalDocument = 'cgu' | 'privacy';

/** Documents consultables : le reglement cookies s'affiche mais ne se signe pas. */
export type LegalDocKey = LegalDocument | 'cookies';

export interface ConsentState {
  cgu_version: string;
  privacy_version: string;
  cgu_accepted: boolean;
  privacy_accepted: boolean;
}

export interface LegalTexts {
  cgu: string;
  privacy: string;
  cookies: string;
}

export const CONSENT_SOURCE = Platform.OS === 'web' ? 'web' : 'mobile';

function appVersion(): string | null {
  return Constants?.expoConfig?.version ?? null;
}

/**
 * Etat du consentement de l'utilisateur connecte compare aux versions
 * en vigueur. Retourne null si la requete echoue : dans ce cas on laisse
 * passer plutot que de bloquer l'app sur une erreur reseau.
 */
export async function fetchConsentState(): Promise<ConsentState | null> {
  const { data, error } = await supabase.rpc('get_consent_state');
  if (error) {
    console.error('[consent] get_consent_state:', error.message);
    return null;
  }
  return (data as ConsentState) ?? null;
}

export function isConsentComplete(state: ConsentState | null): boolean {
  if (!state) return true;
  return state.cgu_accepted && state.privacy_accepted;
}

/** Les versions sont lues en base par la RPC, le client ne peut pas les forcer. */
export async function acceptConsents(): Promise<boolean> {
  const { error } = await supabase.rpc('accept_current_consents', {
    p_source: CONSENT_SOURCE,
    p_app_version: appVersion(),
  });
  if (error) {
    console.error('[consent] accept_current_consents:', error.message);
    return false;
  }
  return true;
}

/** Textes affiches dans les modales : meme source que le site web. */
export async function fetchLegalTexts(): Promise<LegalTexts> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('cgu, privacy_policy, cookies')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[consent] fetchLegalTexts:', error.message);
  }

  return {
    cgu: data?.cgu || '',
    privacy: data?.privacy_policy || '',
    cookies: data?.cookies || '',
  };
}

/** Consentement recueilli avant que la session existe (ecran d'inscription). */
export function buildSignupConsents() {
  return {
    cgu: true,
    privacy: true,
    source: CONSENT_SOURCE,
    app_version: appVersion(),
    accepted_at: new Date().toISOString(),
  };
}
