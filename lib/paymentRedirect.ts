import { Platform } from 'react-native';

export function getPaymentCallbackUrl(reference?: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'https://fere.app';
  const base = `${origin}/payment-callback`;
  if (reference) {
    return `${base}?reference=${encodeURIComponent(reference)}`;
  }
  return base;
}

export function redirectToPayment(paymentUrl: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = paymentUrl;
  }
}
