import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ChatProvider } from '@/contexts/ChatContext';
import CartModal from '@/components/CartModal';
import NotificationHandler from '@/components/NotificationHandler';

function RootLayoutInner() {
  return (
    <>
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
        <Stack.Screen name="chat/new" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <CartModal />
      <NotificationHandler />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <CartProvider>
        <ChatProvider>
          <RootLayoutInner />
        </ChatProvider>
      </CartProvider>
    </AuthProvider>
  );
}
