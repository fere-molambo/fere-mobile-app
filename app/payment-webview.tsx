import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { X, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').default;
  } catch {}
}

export default function PaymentWebViewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();

  const url = params.url as string;
  const reference = params.reference as string;
  const paymentMode = (params.paymentMode as string) || 'checkout';
  const bookingId = params.bookingId as string;
  const orderId = params.orderId as string;
  const amount = params.amount as string;
  const payToken = params.payToken as string;

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  const handleNavigationChange = async (navState: any) => {
    const currentUrl = navState.url || '';
    if (
      currentUrl.includes('payment-callback') ||
      currentUrl.includes('return') ||
      currentUrl.includes('reference=')
    ) {
      await verifyAndComplete();
    }
    if (currentUrl.includes('cancel') || currentUrl.includes('close')) {
      handleCancel();
    }
  };

  const verifyAndComplete = useCallback(async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setVerifyError(null);

    try {
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/orange-money-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'complete_payment',
            reference,
            pay_token: payToken,
          }),
        }
      );

      const result = await resp.json();

      if (result.success) {
        if (result.payment_mode === 'checkout') {
          clearCart();
        }

        if (
          (result.payment_mode === 'service_booking_advance' || result.payment_mode === 'service_booking_balance') &&
          result.booking_id
        ) {
          router.replace({
            pathname: '/booking-detail',
            params: { id: result.booking_id },
          });
        } else if (result.payment_mode === 'balance' && result.order_id) {
          router.replace({
            pathname: '/order-detail',
            params: { id: result.order_id },
          });
        } else {
          router.replace({
            pathname: '/order-confirmation',
            params: {
              reference,
              amount,
              success: 'true',
              orderIds: JSON.stringify(result.order_ids || []),
            },
          });
        }
      } else {
        if ((paymentMode === 'service_booking_advance' || paymentMode === 'service_booking_balance') && bookingId) {
          router.replace({
            pathname: '/booking-detail',
            params: { id: bookingId },
          });
        } else if (paymentMode === 'balance' && orderId) {
          router.replace({
            pathname: '/order-detail',
            params: { id: orderId },
          });
        } else {
          router.replace({
            pathname: '/order-confirmation',
            params: { reference, amount, success: 'false' },
          });
        }
      }
    } catch (err: any) {
      verifyingRef.current = false;
      setVerifying(false);
      setVerifyError(err?.message || 'Une erreur est survenue lors de la verification');
    }
  }, [reference, payToken, paymentMode, bookingId, orderId, amount]);

  const handleCancel = async () => {
    router.back();
  };

  if (verifying) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.verifyingScreen}>
          <ActivityIndicator size="large" color="#003f2f" />
          <Text style={styles.verifyingTitle}>Verification du paiement...</Text>
          <Text style={styles.verifyingSubtitle}>Veuillez patienter, ne fermez pas cette page</Text>
          {verifyError && (
            <View style={styles.errorRow}>
              <AlertTriangle color="#dc2626" size={16} />
              <Text style={styles.errorRowText}>{verifyError}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.verifyingScreen}>
          <Text style={styles.verifyingTitle}>Redirection vers le paiement...</Text>
          <Text style={styles.verifyingSubtitle}>Si vous n'etes pas redirige, retournez a l'accueil.</Text>
          <TouchableOpacity style={styles.verifyPayBtn} onPress={handleCancel}>
            <Text style={styles.verifyPayBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!WebView) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text>WebView non disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.webHeader}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
          <X color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.webHeaderTitle}>Paiement securise</Text>
        <View style={{ width: 40 }} />
      </View>

      <WebView
        source={{ uri: url }}
        onNavigationStateChange={handleNavigationChange}
        onLoadEnd={() => setLoading(false)}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#003f2f" />
          <Text style={styles.loadingText}>Chargement du paiement...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  verifyingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  verifyingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  verifyingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  cancelBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  verifyPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#003f2f',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  verifyPayBtnText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
  errorRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorRowText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
  },
});
