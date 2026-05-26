import { Platform } from 'react-native';

const MOBILE_CALLBACK_BASE = 'https://fere.app/payment-callback';
const MOBILE_CANCEL_BASE = 'https://fere.app/payment-cancel';

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

export function getMobileReturnUrl(reference: string): string {
  return `${MOBILE_CALLBACK_BASE}?reference=${encodeURIComponent(reference)}`;
}

export function getMobileCancelUrl(reference: string): string {
  return `${MOBILE_CANCEL_BASE}?reference=${encodeURIComponent(reference)}`;
}

export function isPaymentReturnUrl(url: string): boolean {
  return url.includes('payment-callback') ||
    url.includes('fere.app/payment') ||
    url.includes('action=return') ||
    (url.includes('reference=') && (url.includes('orange-money') || url.includes('functions/v1')));
}

export function isPaymentCancelUrl(url: string): boolean {
  return url.includes('payment-cancel') ||
    url.includes('action=cancelled') ||
    url.includes('cancel');
}

export function redirectToPayment(paymentUrl: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = paymentUrl;
  }
}
