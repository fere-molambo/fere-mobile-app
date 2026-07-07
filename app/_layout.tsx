import 'react-native-get-random-values';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { AuthFlowProvider } from '@/contexts/AuthFlowContext';
import CartModal from '@/components/CartModal';
import NotificationHandler from '@/components/NotificationHandler';

SplashScreen.preventAutoHideAsync();

function SplashHider() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  return null;
}

function RootLayoutInner() {
  return (
    <>
      <SplashHider />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/otp-verification" />
        <Stack.Screen name="auth/reset-pin" />
        <Stack.Screen name="auth/admin-reset" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
        <Stack.Screen name="payment-webview" options={{ headerShown: false }} />
        <Stack.Screen name="payment-callback" options={{ headerShown: false }} />
        <Stack.Screen name="order-confirmation" options={{ headerShown: false }} />
        <Stack.Screen name="order-detail" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[serviceId]" options={{ headerShown: false }} />
        <Stack.Screen name="booking-detail" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="chat/new" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <CartModal />
      <NotificationHandler />
      <StatusBar style="auto" />
    </>
  );
}

function usePaymentCacheCleanup() {
  const didClean = useRef(false);
  useEffect(() => {
    if (didClean.current) return;
    didClean.current = true;

    const staleKeys = [
      'om_order_id',
      'om_pay_token',
      'om_payment_type',
      'om_related_id',
      'paystack_reference',
    ];

    (async () => {
      if (Platform.OS === 'web') {
        staleKeys.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
      } else {
        for (const key of staleKeys) {
          try { await SecureStore.deleteItemAsync(key); } catch {}
        }
      }
    })();
  }, []);
}

export default function RootLayout() {
  useFrameworkReady();
  usePaymentCacheCleanup();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthFlowProvider>
          <CartProvider>
            <ChatProvider>
              <RootLayoutInner />
            </ChatProvider>
          </CartProvider>
        </AuthFlowProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
