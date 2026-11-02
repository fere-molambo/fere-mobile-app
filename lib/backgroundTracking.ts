import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase';

/**
 * Suivi GPS en arriere-plan, pour le livreur comme pour le prestataire en route.
 *
 * watchPositionAsync ne recoit plus rien des que l'application passe en
 * arriere-plan, or FERE envoie elle-meme le livreur vers Google Maps pour
 * naviguer. Ici, le systeme livre les positions a une tache, application
 * ouverte ou non. Sur Android, un service de premier plan (notification
 * permanente) le permet avec la seule autorisation « pendant l'utilisation » ;
 * sur iOS, UIBackgroundModes: location suffit.
 *
 * Les constructeurs (Tecno, Infinix, itel, Samsung...) peuvent malgre tout
 * tuer ce service pour economiser la batterie : d'ou le chien de garde et
 * l'indicateur d'envoi exposes plus bas.
 */
export const LOCATION_TASK = 'fere-driver-location';

// Au-dela, le partage est considere comme interrompu : a 5 s d'intervalle,
// une minute sans envoi ne s'explique pas par un simple arret a un feu.
export const STALE_AFTER_MS = 60_000;

type SentListener = (sentAt: number) => void;
const listeners = new Set<SentListener>();
let lastSentAt: number | null = null;

/** Heure du dernier envoi reussi par cet appareil, pour l'indicateur du livreur. */
export function getLastSentAt(): number | null {
  return lastSentAt;
}

export function onPositionSent(listener: SentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalize(value: number | null | undefined): number | null {
  // Android renvoie -1 quand le cap ou la vitesse sont inconnus.
  return value != null && value >= 0 ? value : null;
}

/** Envoie une position a toutes les sessions actives de l'utilisateur, en une requete. */
export async function pushTrackerPosition(
  trackerId: string,
  location: Location.LocationObject,
): Promise<boolean> {
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
    .eq('tracker_id', trackerId)
    .eq('is_active', true);

  if (error) {
    console.error('[tracking] envoi position:', error.message);
    return false;
  }

  lastSentAt = Date.now();
  listeners.forEach((listener) => listener(lastSentAt!));
  return true;
}

// La tache doit etre definie au chargement du module, et non dans un ecran : le
// systeme peut relancer l'application en arriere-plan pour lui livrer une
// position avant qu'aucun ecran ne soit monte. D'ou l'import dans index.js.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[tracking] tache arriere-plan:', error.message);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const trackerId = sessionData?.session?.user?.id;
    if (!trackerId) return;

    await pushTrackerPosition(trackerId, latest);
  });
}

/**
 * Demarre le suivi s'il ne tourne pas deja. Doit etre appele application
 * ouverte : Android refuse de lancer un service de premier plan depuis
 * l'arriere-plan.
 */
export async function startBackgroundTracking(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[tracking] permission de localisation refusée');
      return false;
    }

    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      return true;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      // iOS suspend les mises a jour quand il croit l'appareil immobile : un
      // livreur arrete a un feu disparaitrait de la carte.
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'FERE · suivi en cours',
        notificationBody: 'Votre position est partagée tant que la course est en cours.',
        notificationColor: '#003f2f',
      },
    });
    return true;
  } catch (err: any) {
    console.error('[tracking] démarrage arrière-plan:', err?.message || err);
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (err: any) {
    console.warn('[tracking] arrêt arrière-plan:', err?.message || err);
  }
}

/**
 * Relance complete. Quand le systeme tue le service, la tache reste
 * enregistree : hasStartedLocationUpdatesAsync repond « oui » alors que plus
 * rien n'arrive. Seul un arret suivi d'un redemarrage le remet en route.
 */
export async function restartBackgroundTracking(): Promise<boolean> {
  await stopBackgroundTracking();
  return startBackgroundTracking();
}
