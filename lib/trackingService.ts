import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  pushDriverPosition,
  startDriverBackgroundTracking,
  stopDriverBackgroundTracking,
} from '@/lib/backgroundTracking';

interface TrackingResult {
  sessionId: string;
  cleanup: () => void;
}

// La table impose CHECK (reference_type IN ('delivery_request','service_booking')).
// Les écrans passent les noms courts : on les traduit ici.
const REFERENCE_TYPES: Record<string, string> = {
  delivery: 'delivery_request',
  delivery_request: 'delivery_request',
  booking: 'service_booking',
  service_booking: 'service_booking',
};

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

/**
 * Aligne le suivi du livreur sur ses courses en cours : une session active par
 * course suivie, aucune pour les autres, et la tache d'arriere-plan qui tourne
 * tant qu'il en reste une.
 *
 * Le suivi depend de l'etat des courses, plus d'un ecran : avant, chaque carte
 * de course lancait son propre GPS et le coupait en disparaissant, si bien que
 * changer d'onglet suffisait a faire disparaitre le livreur chez le vendeur.
 */
export async function syncDriverTracking(driverId: string, deliveryIds: string[]): Promise<void> {
  if (Platform.OS === 'web' || !driverId) return;

  try {
    let deactivate = supabase
      .from('live_tracking_sessions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('tracker_id', driverId)
      .eq('tracker_role', 'driver')
      .eq('is_active', true);
    if (deliveryIds.length > 0) {
      deactivate = deactivate.not('reference_id', 'in', `(${deliveryIds.join(',')})`);
    }
    const { error: deactivateError } = await deactivate;
    if (deactivateError) console.error('[tracking] désactivation:', deactivateError.message);

    if (deliveryIds.length === 0) {
      await stopDriverBackgroundTracking();
      return;
    }

    for (const deliveryId of deliveryIds) {
      await ensureSession(driverId, deliveryId, 'delivery', 'driver');
    }

    const started = await startDriverBackgroundTracking();
    if (!started) return;

    // Premiere position tout de suite : la tache n'en livre une qu'apres
    // quelques secondes, et une course qui vient d'etre acceptee doit
    // apparaitre sur la carte du vendeur sans attendre.
    const Location = require('expo-location');
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await pushDriverPosition(driverId, current);
  } catch (err: any) {
    console.error('[tracking] syncDriverTracking:', err?.message || err);
  }
}

export async function startTracking(
  userId: string,
  referenceId: string,
  referenceType: string,
  trackerRole: string
): Promise<TrackingResult | null> {
  if (Platform.OS === 'web') return null;

  try {
    const Location = require('expo-location');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[tracking] permission de localisation refusée');
      return null;
    }

    const sessionId = await ensureSession(userId, referenceId, referenceType, trackerRole);
    if (!sessionId) return null;

    const pushPosition = (coords: any) => {
      supabase
        .from('live_tracking_sessions')
        .update({
          current_lat: coords.latitude,
          current_lng: coords.longitude,
          // Android renvoie -1 quand le cap est inconnu
          heading: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
          speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .then(({ error }: any) => {
          if (error) console.error('[tracking] update position:', error.message);
        });
    };

    // Première position immédiate : sans ça la carte reste vide jusqu'au premier
    // déplacement de 10 m.
    try {
      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      pushPosition(first.coords);
    } catch (e) {
      console.warn('[tracking] position initiale indisponible');
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location: any) => pushPosition(location.coords)
    );

    const cleanup = () => {
      subscription.remove();
      if (sessionId) stopTracking(sessionId);
    };

    return { sessionId: sessionId!, cleanup };
  } catch (err: any) {
    console.error('[tracking] startTracking:', err?.message || err);
    return null;
  }
}

export async function stopTracking(sessionId: string): Promise<void> {
  await supabase
    .from('live_tracking_sessions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}
