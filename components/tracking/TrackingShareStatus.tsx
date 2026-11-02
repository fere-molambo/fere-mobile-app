import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { RefreshCw, Settings, TriangleAlert } from 'lucide-react-native';
import { STALE_AFTER_MS, getLastSentAt, onPositionSent } from '@/lib/backgroundTracking';
import { ensureTrackingAlive, fetchLastTrackedAt } from '@/lib/trackingService';
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
 * voyait un repere fige, et personne ne savait pourquoi. Ici l'interruption se
 * voit, avec de quoi la reparer.
 */
export default function TrackingShareStatus({ trackerId }: Props) {
  const [lastAt, setLastAt] = useState<number | null>(getLastSentAt());
  const [now, setNow] = useState(() => Date.now());
  const [restarting, setRestarting] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    // La base fait foi : la tache peut avoir envoye depuis un autre contexte
    // (application relancee en arriere-plan par le systeme).
    const fromDb = await fetchLastTrackedAt(trackerId);
    const local = getLastSentAt();
    setLastAt(Math.max(fromDb ?? 0, local ?? 0) || null);
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

  const handleRestart = async () => {
    setRestarting(true);
    await ensureTrackingAlive(trackerId, true);
    await refresh();
    setRestarting(false);
  };

  const openSettings = () => {
    if (Platform.OS === 'android') setGuideVisible(true);
    else Linking.openSettings().catch(() => {});
  };

  const age = lastAt ? now - lastAt : null;
  const fresh = age !== null && age < STALE_AFTER_MS;
  // Juste apres l'acceptation d'une course ou le retour dans l'application, le
  // GPS met quelques secondes a envoyer : pas d'alerte rouge pendant ce temps.
  const starting = !fresh && now - mountedAt < 20000;

  return (
    <>
      {starting ? (
        <View style={styles.startingBar}>
          <ActivityIndicator size="small" color="#003f2f" />
          <Text style={styles.startingText}>Activation du partage de position…</Text>
        </View>
      ) : fresh ? (
        <View style={styles.okBar}>
          <View style={styles.okDot} />
          <Text style={styles.okText}>Position partagée · {formatAge(age!)}</Text>
        </View>
      ) : (
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
          <View style={styles.alertActions}>
            <TouchableOpacity style={styles.restartBtn} onPress={handleRestart} disabled={restarting}>
              {restarting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <RefreshCw size={14} color="#fff" />
                  <Text style={styles.restartText}>Réactiver</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={openSettings}>
              <Settings size={14} color="#b91c1c" />
              <Text style={styles.settingsText}>Réglages</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <BatteryGuideModal visible={guideVisible} onClose={closeGuide} />
    </>
  );
}

const styles = StyleSheet.create({
  okBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  startingBar: {
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
  startingText: { fontSize: 12.5, fontWeight: '600', color: '#003f2f' },
  okDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  okText: { fontSize: 12.5, fontWeight: '600', color: '#166534' },
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
  alertActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#b91c1c',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 110,
    justifyContent: 'center',
  },
  restartText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#b91c1c',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  settingsText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
});
