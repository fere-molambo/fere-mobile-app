import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

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

    const dbReferenceType = REFERENCE_TYPES[referenceType] || referenceType;

    // Pas d'upsert : aucune contrainte UNIQUE sur (tracker_id, reference_id),
    // ON CONFLICT échouerait. On cherche la session existante puis update/insert.
    const { data: existing } = await supabase
      .from('live_tracking_sessions')
      .select('id')
      .eq('tracker_id', userId)
      .eq('reference_id', referenceId)
      .limit(1)
      .maybeSingle();

    let sessionId: string | null = null;

    if (existing?.id) {
      const { error } = await supabase
        .from('live_tracking_sessions')
        .update({
          tracker_role: trackerRole,
          reference_type: dbReferenceType,
          is_active: true,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) {
        console.error('[tracking] update session:', error.message);
        return null;
      }
      sessionId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from('live_tracking_sessions')
        .insert({
          tracker_id: userId,
          tracker_role: trackerRole,
          reference_type: dbReferenceType,
          reference_id: referenceId,
          is_active: true,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error || !created) {
        console.error('[tracking] insert session:', error?.message);
        return null;
      }
      sessionId = created.id;
    }

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
