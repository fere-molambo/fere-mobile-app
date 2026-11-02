import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  STALE_AFTER_MS,
  pushTrackerPosition,
  restartBackgroundTracking,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '@/lib/backgroundTracking';

// La table impose CHECK (reference_type IN ('delivery_request','service_booking')).
// Les écrans passent les noms courts : on les traduit ici.
const REFERENCE_TYPES: Record<string, string> = {
  delivery: 'delivery_request',
  delivery_request: 'delivery_request',
  booking: 'service_booking',
  service_booking: 'service_booking',
};

export type TrackerRole = 'driver' | 'vendor';

/**
 * Garantit une session active pour ce suivi. Pas d'upsert : aucune contrainte
 * UNIQUE sur (tracker_id, reference_id), ON CONFLICT echouerait.
 */
async function ensureSession(
  userId: string,
  referenceId: string,
  referenceType: string,
  trackerRole: string,
): Promise<string | null> {
  const dbReferenceType = REFERENCE_TYPES[referenceType] || referenceType;

  const { data: existing } = await supabase
    .from('live_tracking_sessions')
    .select('id, is_active')
    .eq('tracker_id', userId)
    .eq('reference_id', referenceId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    // Une session deja active n'est pas touchee : la reecrire a chaque
    // rafraichissement de la liste reinitialiserait started_at pour rien.
    if (existing.is_active) return existing.id;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('live_tracking_sessions')
      .update({
        tracker_role: trackerRole,
        reference_type: dbReferenceType,
        is_active: true,
        started_at: now,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[tracking] update session:', error.message);
      return null;
    }
    return existing.id;
  }

  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from('live_tracking_sessions')
    .insert({
      tracker_id: userId,
      tracker_role: trackerRole,
      reference_type: dbReferenceType,
      reference_id: referenceId,
      is_active: true,
      started_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('[tracking] insert session:', error?.message);
    return null;
  }
  return created.id;
}

async function pushCurrentPosition(trackerId: string): Promise<void> {
  try {
    const Location = require('expo-location');
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await pushTrackerPosition(trackerId, current);
  } catch (err: any) {
    console.warn('[tracking] position immédiate indisponible:', err?.message || err);
  }
}

/**
 * Aligne le suivi sur ce qui est reellement en cours : les courses du livreur,
 * ou les prestations ou le prestataire est en route. Une session active par
 * element suivi, aucune pour les autres, et la tache d'arriere-plan qui tourne
 * tant qu'il en reste une.
 *
 * Le suivi depend de l'etat des courses, plus d'un ecran : avant, chaque carte
 * ou fiche lancait son propre GPS et le coupait en disparaissant, si bien que
 * changer d'onglet ou fermer une fiche suffisait a figer le repere.
 */
export async function syncTracking(
  trackerId: string,
  role: TrackerRole,
  referenceType: 'delivery' | 'booking',
  referenceIds: string[],
): Promise<void> {
  if (Platform.OS === 'web' || !trackerId) return;

  try {
    let deactivate = supabase
      .from('live_tracking_sessions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('tracker_id', trackerId)
      .eq('tracker_role', role)
      .eq('is_active', true);
    if (referenceIds.length > 0) {
      deactivate = deactivate.not('reference_id', 'in', `(${referenceIds.join(',')})`);
    }
    const { error: deactivateError } = await deactivate;
    if (deactivateError) console.error('[tracking] désactivation:', deactivateError.message);

    if (referenceIds.length === 0) {
      await stopBackgroundTracking();
      return;
    }

    for (const referenceId of referenceIds) {
      await ensureSession(trackerId, referenceId, referenceType, role);
    }

    const started = await startBackgroundTracking();
    // Premiere position tout de suite : la tache n'en livre une qu'apres
    // quelques secondes, et une course qui vient d'etre acceptee doit
    // apparaitre sur la carte sans attendre.
    if (started) await pushCurrentPosition(trackerId);
  } catch (err: any) {
    console.error('[tracking] syncTracking:', err?.message || err);
  }
}

/** Heure de la derniere position enregistree en base pour cet utilisateur. */
export async function fetchLastTrackedAt(trackerId: string): Promise<number | null> {
  const { data } = await supabase
    .from('live_tracking_sessions')
    .select('updated_at')
    .eq('tracker_id', trackerId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.updated_at ? new Date(data.updated_at).getTime() : null;
}

/**
 * Chien de garde, appele a chaque retour dans l'application et depuis le
 * bouton « Reactiver ». Quand le systeme tue le service, la tache reste
 * enregistree mais plus rien n'arrive : si la derniere position date de plus
 * d'une minute, on relance tout.
 */
export async function ensureTrackingAlive(trackerId: string, force = false): Promise<boolean> {
  if (Platform.OS === 'web' || !trackerId) return false;

  const lastAt = await fetchLastTrackedAt(trackerId);
  if (lastAt === null) return false;
  if (!force && Date.now() - lastAt < STALE_AFTER_MS) return true;

  const restarted = await restartBackgroundTracking();
  if (restarted) await pushCurrentPosition(trackerId);
  return restarted;
}
