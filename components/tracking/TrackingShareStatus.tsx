import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { RefreshCw, TriangleAlert, MapPinOff } from 'lucide-react-native';
import {
  STALE_AFTER_MS,
  askToEnableLocationServices,
  getLastSentAt,
  getLocationProblem,
  onPositionSent,
  type LocationProblem,
} from '@/lib/backgroundTracking';
import { fetchLastTrackedAt, refreshTrackingNow } from '@/lib/trackingService';
import BatteryGuideModal from './BatteryGuideModal';

interface Props {
  trackerId: string;
}

const GUIDE_SEEN_KEY = 'fere_battery_guide_seen';

function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

/**
 * Indicateur de partage de position, affiche au livreur (ou au prestataire en
 * route) tant qu'un suivi est en cours.
 *
 * Avant, une panne d'envoi etait invisible : le livreur roulait, le client
 * voyait un repere fige, et personne ne savait pourquoi. Un seul bouton, dont
 * l'action s'adapte a la cause : relancer l'envoi, activer la localisation du
 * telephone, ou autoriser FERE a l'utiliser.
 */
export default function TrackingShareStatus({ trackerId }: Props) {
  const [lastAt, setLastAt] = useState<number | null>(getLastSentAt());
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<LocationProblem>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [busy, setBusy] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  const interruptions = useRef(0);
  const guideShownForRepeat = useRef(false);

  const refresh = useCallback(async () => {
    // La base fait foi : la tache peut avoir envoye depuis un autre contexte
    // (application relancee en arriere-plan par le systeme).
    const [fromDb, diagnosis] = await Promise.all([fetchLastTrackedAt(trackerId), getLocationProblem()]);
    const local = getLastSentAt();
    setLastAt(Math.max(fromDb ?? 0, local ?? 0) || null);
    setProblem(diagnosis.problem);
    setCanAskAgain(diagnosis.canAskAgain);
    setNow(Date.now());
  }, [trackerId]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 15000);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    const unsubscribe = onPositionSent((sentAt) => {
      setLastAt(sentAt);
      setNow(Date.now());
    });
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      unsubscribe();
    };
  }, [refresh]);

  // Guide de batterie montre une fois, a la premiere course : c'est sur
  // Android que les constructeurs coupent les applications en arriere-plan.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    SecureStore.getItemAsync(GUIDE_SEEN_KEY)
      .then((seen) => {
        if (!seen) setGuideVisible(true);
      })
      .catch(() => {});
  }, []);

  const closeGuide = () => {
    setGuideVisible(false);
    SecureStore.setItemAsync(GUIDE_SEEN_KEY, '1').catch(() => {});
  };

  const age = lastAt ? now - lastAt : null;
  const fresh = age !== null && age < STALE_AFTER_MS;
  // Juste apres l'acceptation d'une course ou le retour dans l'application, le
  // GPS met quelques secondes a envoyer : pas d'alerte rouge pendant ce temps.
  const starting = !problem && !fresh && now - mountedAt < 20000;

  const handlePress = async () => {
    setBusy(true);
    try {
      if (problem === 'services_off') {
        if (Platform.OS === 'android') {
          if (!(await askToEnableLocationServices())) return;
        } else {
          await Linking.openSettings();
          return;
        }
      } else if (problem === 'permission_denied') {
        if (canAskAgain) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
        } else {
          // Refus definitif : seul le reglage du telephone peut le lever.
          await Linking.openSettings();
          return;
        }
      } else if (!fresh) {
        interruptions.current += 1;
        // Coupures a repetition : c'est le gestionnaire de batterie. Le
        // bouton relance l'envoi, le guide empeche que ca recommence.
        if (Platform.OS === 'android' && interruptions.current >= 2 && !guideShownForRepeat.current) {
          guideShownForRepeat.current = true;
          setGuideVisible(true);
        }
      }
      await refreshTrackingNow(trackerId);
    } catch {
      // l'etat est rafraichi juste apres, l'indicateur dira ce qu'il en est
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const button = (label: string, variant: 'light' | 'strong') => (
    <TouchableOpacity
      style={variant === 'strong' ? styles.strongBtn : styles.lightBtn}
      onPress={handlePress}
      disabled={busy}
      hitSlop={8}
    >
      {busy ? (
        <ActivityIndicator size="small" color={variant === 'strong' ? '#fff' : '#166534'} />
      ) : (
        <>
          {variant === 'strong' && label === 'Actualiser' && <RefreshCw size={14} color="#fff" />}
          <Text style={variant === 'strong' ? styles.strongText : styles.lightText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  let content: React.ReactNode;

  if (problem === 'services_off') {
    content = (
      <View style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <MapPinOff size={18} color="#b91c1c" />
          <Text style={styles.alertTitle}>Localisation désactivée</Text>
        </View>
        <Text style={styles.alertBody}>
          La localisation de votre téléphone est coupée : le client et le vendeur ne vous voient pas.
        </Text>
        <View style={styles.alertActions}>{button('Activer la localisation', 'strong')}</View>
      </View>
    );
  } else if (problem === 'permission_denied') {
    content = (
      <View style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <MapPinOff size={18} color="#b91c1c" />
          <Text style={styles.alertTitle}>Position non autorisée</Text>
        </View>
        <Text style={styles.alertBody}>
          FERE n'a pas accès à votre position : le client et le vendeur ne vous voient pas.
        </Text>
        <View style={styles.alertActions}>{button('Autoriser la localisation', 'strong')}</View>
      </View>
    );
  } else if (starting) {
    content = (
      <View style={styles.neutralBar}>
        <ActivityIndicator size="small" color="#003f2f" />
        <Text style={styles.neutralText}>Activation du partage de position…</Text>
      </View>
    );
  } else if (fresh) {
    content = (
      <View style={styles.okBar}>
        <View style={styles.okDot} />
        <Text style={styles.okText}>Position partagée · {formatAge(age!)}</Text>
        {button('Actualiser', 'light')}
      </View>
    );
  } else {
    content = (
      <View style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <TriangleAlert size={18} color="#b91c1c" />
          <Text style={styles.alertTitle}>Partage de position interrompu</Text>
        </View>
        <Text style={styles.alertBody}>
          {age === null
            ? "Aucune position envoyée pour l'instant."
            : `Dernière position envoyée ${formatAge(age)}.`}{' '}
          Le client et le vendeur ne vous voient pas bouger.
        </Text>
        <View style={styles.alertActions}>{button('Actualiser', 'strong')}</View>
      </View>
    );
  }

  return (
    <>
      {content}
      <BatteryGuideModal visible={guideVisible} onClose={closeGuide} />
    </>
  );
}

const styles = StyleSheet.create({
  neutralBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f4',
  },
  neutralText: { fontSize: 12.5, fontWeight: '600', color: '#003f2f' },
  okBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  okDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  okText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#166534' },
  lightBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#16a34a',
    minWidth: 86,
    alignItems: 'center',
  },
  lightText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  alertCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#991b1b' },
  alertBody: { fontSize: 12.5, color: '#991b1b', lineHeight: 18 },
  alertActions: { flexDirection: 'row', marginTop: 10 },
  strongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#b91c1c',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 130,
  },
  strongText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
