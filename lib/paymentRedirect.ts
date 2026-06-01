import { Platform } from 'react-native';

const SUPABASE_URL = 'https://jajfuajmkjulujnwfqen.supabase.co';

// HTTPS URLs used as interception points in the WebView.
// Orange Money rejects custom schemes (fere://) -- must be HTTPS.
export const OM_RETURN_URL = `${SUPABASE_URL}/functions/v1/orange-money-payment/return`;
export const OM_CANCEL_URL = `${SUPABASE_URL}/functions/v1/orange-money-payment/cancel`;

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
  return `${OM_RETURN_URL}?reference=${encodeURIComponent(reference)}`;
}

export function getMobileCancelUrl(reference: string): string {
  return `${OM_CANCEL_URL}?reference=${encodeURIComponent(reference)}`;
}

export function isPaymentReturnUrl(url: string): boolean {
  return (
    url.startsWith(OM_RETURN_URL) ||
    url.includes('payment-callback') ||
    url.includes('action=return') ||
    (url.includes('reference=') && url.includes('orange-money-payment/return'))
  );
}

export function isPaymentCancelUrl(url: string): boolean {
  return (
    url.startsWith(OM_CANCEL_URL) ||
    url.includes('payment-cancel') ||
    url.includes('action=cancelled') ||
    url.includes('orange-money-payment/cancel')
  );
}

export function redirectToPayment(paymentUrl: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = paymentUrl;
  }
}
