import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CircleCheck, CircleX, RefreshCw, ArrowLeft } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase';

function extractReference(params: Record<string, any>): string {
  const fromParams = params.reference || params.trxref || '';
  const ref = Array.isArray(fromParams) ? fromParams[0] : (fromParams as string);
  if (ref) return ref;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    return url.searchParams.get('reference') || url.searchParams.get('trxref') || '';
  }
  return '';
}

const MAX_RETRIES = 4;
const RETRY_DELAYS = [0, 3000, 5000, 8000];

export default function PaymentCallbackScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const processedRef = useRef(false);

  const reference = extractReference(params);

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'not_found'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [completedMode, setCompletedMode] = useState<string | null>(null);
  const [completedBookingId, setCompletedBookingId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!reference || processedRef.current) return;
    processedRef.current = true;
    processPaymentWithRetries();
  }, [reference]);

  const callCompletePayment = async (): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('orange-money-payment', {
      body: { action: 'complete_payment', reference },
    });
    if (error) throw new Error(error.message || 'Erreur de verification');
    return data;
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const processPaymentWithRetries = async () => {
    setStatus('loading');
    setErrorMessage('');

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      setRetryCount(attempt);

      if (RETRY_DELAYS[attempt] > 0) {
        await delay(RETRY_DELAYS[attempt]);
      }

      try {
        const result = await callCompletePayment();

        if (result.error) {
          setStatus('not_found');
          setErrorMessage(result.error);
          return;
        }

        if (result.success) {
          if (result.payment_mode === 'checkout') {
            clearCart();
          }
          setCompletedMode(result.payment_mode);
          if (result.booking_id) setCompletedBookingId(result.booking_id);
          setStatus('success');
          return;
        }

        if (attempt === MAX_RETRIES - 1) {
          const normalized = ['failed', 'abandoned'].includes(result.status)
            ? result.status
            : 'error';

          if (normalized === 'failed') {
            setErrorMessage('Le paiement n\'a pas abouti. Veuillez reessayer.');
          } else if (normalized === 'abandoned') {
            setErrorMessage('Le paiement a ete abandonne. Vous pouvez reessayer.');
          } else {
            setErrorMessage('Statut de paiement inconnu. Veuillez verifier dans vos reservations ou commandes.');
          }
          setStatus('failed');
          setCompletedMode(result.payment_mode);
          if (result.booking_id) setCompletedBookingId(result.booking_id);
          return;
        }
      } catch (err: any) {
        if (attempt === MAX_RETRIES - 1) {
          setErrorMessage(err.message || 'Une erreur est survenue.');
          setStatus('failed');
          return;
        }
      }
    }
  };

  const navigateAfterSuccess = () => {
    if (
      (completedMode === 'service_booking_advance' || completedMode === 'service_booking_balance') &&
      completedBookingId
    ) {
      router.replace({
        pathname: '/booking-detail',
        params: { id: completedBookingId },
      });
    } else {
      router.replace('/(tabs)/orders');
    }
  };

  const navigateBack = () => {
    router.replace('/(tabs)');
  };

  const handleRetry = () => {
    processedRef.current = false;
    processPaymentWithRetries();
  };

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#003f2f" />
          <Text style={styles.loadingTitle}>Verification du paiement...</Text>
          <Text style={styles.loadingSubtitle}>
            {retryCount > 0
              ? `Tentative ${retryCount + 1}/${MAX_RETRIES} - Veuillez patienter...`
              : 'Veuillez patienter, ne fermez pas cette page'}
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'success') {
    let successMessage = 'Votre paiement a ete traite avec succes.';
    let btnLabel = 'Voir mes commandes';

    if (completedMode === 'service_booking_advance') {
      successMessage = 'Vos frais de deplacement ont ete payes. En attente d\'acceptation du prestataire.';
      btnLabel = 'Voir ma reservation';
    } else if (completedMode === 'service_booking_balance') {
      successMessage = 'Le solde de la prestation a ete paye avec succes.';
      btnLabel = 'Voir ma reservation';
    } else if (completedMode === 'balance') {
      successMessage = 'Le solde de votre commande a ete paye avec succes.';
    } else if (completedMode === 'checkout') {
      successMessage = 'Votre acompte a ete paye. Vous paierez le solde a la livraison.';
    }

    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerContent}>
          <CircleCheck color="#16a34a" size={72} strokeWidth={1.5} />
          <Text style={styles.successTitle}>Paiement confirme</Text>
          <Text style={styles.successSubtitle}>{successMessage}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={navigateAfterSuccess}>
            <Text style={styles.primaryBtnText}>{btnLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={navigateBack}>
            <Text style={styles.secondaryBtnText}>Retour a l'accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.centerContent}>
        <CircleX color="#ef4444" size={72} strokeWidth={1.5} />
        <Text style={styles.failedTitle}>
          {status === 'not_found' ? 'Session introuvable' : 'Paiement non abouti'}
        </Text>
        <Text style={styles.failedSubtitle}>{errorMessage}</Text>
        {status === 'failed' && (
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <RefreshCw color="#003f2f" size={18} />
            <Text style={styles.retryBtnText}>Reverifier</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={navigateBack}>
          <ArrowLeft color="#fff" size={18} />
          <Text style={styles.primaryBtnText}>Retour a l'accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#16a34a',
    textAlign: 'center',
    marginTop: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  failedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
  },
  failedSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 360,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#003f2f',
    marginBottom: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
});
