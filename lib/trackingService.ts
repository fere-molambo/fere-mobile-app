import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

interface TrackingResult {
  sessionId: string;
  cleanup: () => void;
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
    if (status !== 'granted') return null;

    const { data: session, error } = await supabase
      .from('live_tracking_sessions')
      .upsert(
        {
          tracker_id: userId,
          tracker_role: trackerRole,
          reference_type: referenceType,
          reference_id: referenceId,
          is_active: true,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tracker_id,reference_id' }
      )
      .select('id')
      .single();

    if (error || !session) return null;

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location: any) => {
        supabase
          .from('live_tracking_sessions')
          .update({
            current_lat: location.coords.latitude,
            current_lng: location.coords.longitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)
          .then(() => {});
      }
    );

    const cleanup = () => {
      subscription.remove();
      stopTracking(session.id);
    };

    return { sessionId: session.id, cleanup };
  } catch {
    return null;
  }
}

export async function stopTracking(sessionId: string): Promise<void> {
  await supabase
    .from('live_tracking_sessions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}
