import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase';

/**
 * Suivi du livreur en arriere-plan.
 *
 * L'ancien suivi reposait sur watchPositionAsync, qui ne recoit plus rien des
 * que l'application passe en arriere-plan. Or c'est FERE elle-meme qui envoie
 * le livreur vers Google Maps pour la navigation : le suivi mourait au moment
 * precis ou la course commencait. En base, les sessions ne duraient qu'une
 * dizaine de secondes.
 *
 * Ici, la position est livree par le systeme a une tache, y compris quand
 * l'application est en arriere-plan. Sur Android, un service de premier plan
 * (notification permanente) le permet avec la seule autorisation « pendant
 * l'utilisation » ; sur iOS, UIBackgroundModes: location suffit.
 */
export const DRIVER_LOCATION_TASK = 'fere-driver-location';

function normalize(value: number | null | undefined): number | null {
  // Android renvoie -1 quand le cap ou la vitesse sont inconnus.
  return value != null && value >= 0 ? value : null;
}

/** Envoie une position a toutes les courses suivies du livreur, en une requete. */
export async function pushDriverPosition(
  driverId: string,
  location: Location.LocationObject,
): Promise<void> {
  const { coords } = location;
  const { error } = await supabase
    .from('live_tracking_sessions')
    .update({
      current_lat: coords.latitude,
      current_lng: coords.longitude,
      heading: normalize(coords.heading),
      speed: normalize(coords.speed),
      updated_at: new Date(location.timestamp || Date.now()).toISOString(),
    })
    .eq('tracker_id', driverId)
    .eq('is_active', true);

  if (error) console.error('[tracking] envoi position:', error.message);
}

// La tache doit etre definie au chargement du module, et non dans un ecran : le
// systeme peut reveiller l'application en arriere-plan pour lui livrer une
// position avant qu'aucun ecran ne soit monte. D'ou l'import dans app/_layout.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(DRIVER_LOCATION_TASK)) {
  TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[tracking] tache arriere-plan:', error.message);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const driverId = sessionData?.session?.user?.id;
    if (!driverId) return;

    await pushDriverPosition(driverId, latest);
  });
}

/**
 * Demarre le suivi s'il ne tourne pas deja. Doit etre appele application
 * ouverte : Android refuse de lancer un service de premier plan depuis
 * l'arriere-plan.
 */
export async function startDriverBackgroundTracking(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[tracking] permission de localisation refusée');
      return false;
    }

    if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
      return true;
    }

    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      // iOS suspend les mises a jour quand il croit l'appareil immobile : un
      // livreur arrete a un feu disparaitrait de la carte.
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'FERE · course en cours',
        notificationBody: 'Votre position est partagée avec le vendeur et le client.',
        notificationColor: '#003f2f',
      },
    });
    return true;
  } catch (err: any) {
    console.error('[tracking] démarrage arrière-plan:', err?.message || err);
    return false;
  }
}

export async function stopDriverBackgroundTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    }
  } catch (err: any) {
    console.warn('[tracking] arrêt arrière-plan:', err?.message || err);
  }
}
