import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptConsents,
  fetchConsentState,
  isConsentComplete,
  type LegalDocument,
} from '@/lib/consentService';
import ConsentCheckbox from './ConsentCheckbox';
import LegalTextModal from './LegalTextModal';

/**
 * Barriere de consentement pour les comptes crees avant la mise en place des
 * CGU, et pour toute nouvelle version des documents. Tant que l'utilisateur
 * n'a pas accepte, la modale ne peut pas etre fermee : refuser deconnecte.
 */
export default function ConsentGate() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [needsConsent, setNeedsConsent] = useState(false);
  const [cguChecked, setCguChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (authLoading || !user) {
      setNeedsConsent(false);
      return;
    }

    let cancelled = false;
    fetchConsentState().then((state) => {
      if (cancelled) return;
      if (!isConsentComplete(state)) {
        setCguChecked(false);
        setPrivacyChecked(false);
        setNeedsConsent(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const handleAccept = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    const ok = await acceptConsents();
    setSubmitting(false);

    if (ok) {
      setNeedsConsent(false);
    } else {
      setError("Impossible d'enregistrer votre acceptation. Vérifiez votre connexion.");
    }
  }, []);

  const handleRefuse = useCallback(async () => {
    setNeedsConsent(false);
    await signOut();
  }, [signOut]);

  if (!needsConsent) return null;

  const canAccept = cguChecked && privacyChecked && !submitting;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginTop: insets.top, marginBottom: insets.bottom }]}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={24} color="#003f2f" />
          </View>

          <Text style={styles.title}>Mise à jour de nos conditions</Text>
          <Text style={styles.intro}>
            Pour continuer à utiliser FERE, vous devez prendre connaissance et accepter nos
            conditions générales d'utilisation ainsi que notre politique de confidentialité.
          </Text>

          <ScrollView style={styles.checkArea} contentContainerStyle={styles.checkAreaContent}>
            <ConsentCheckbox
              checked={cguChecked}
              onToggle={() => setCguChecked((v) => !v)}
              prefix="J'ai lu et j'accepte les "
              linkLabel="conditions générales d'utilisation"
              onPressLink={() => setOpenDoc('cgu')}
              disabled={submitting}
            />
            <ConsentCheckbox
              checked={privacyChecked}
              onToggle={() => setPrivacyChecked((v) => !v)}
              prefix="J'ai lu et j'accepte la "
              linkLabel="politique de confidentialité"
              onPressLink={() => setOpenDoc('privacy')}
              disabled={submitting}
            />
          </ScrollView>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.acceptBtn, !canAccept && styles.acceptBtnDisabled]}
            onPress={handleAccept}
            disabled={!canAccept}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.acceptBtnText}>Accepter et continuer</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRefuse} disabled={submitting} style={styles.refuseBtn}>
            <Text style={styles.refuseBtnText}>Refuser et se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LegalTextModal
        visible={openDoc !== null}
        document={openDoc ?? 'cgu'}
        onClose={() => setOpenDoc(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    maxHeight: '88%',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f2ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 19, fontWeight: '700', color: '#003f2f', marginBottom: 8 },
  intro: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 18 },
  checkArea: { flexGrow: 0 },
  checkAreaContent: { paddingBottom: 4 },
  error: { fontSize: 13, color: '#c0392b', marginBottom: 10 },
  acceptBtn: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  acceptBtnDisabled: { opacity: 0.45 },
  acceptBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  refuseBtn: { alignItems: 'center', paddingVertical: 12 },
  refuseBtnText: { color: '#888', fontSize: 13, fontWeight: '500' },
});
