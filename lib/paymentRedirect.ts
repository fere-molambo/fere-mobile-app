import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

interface PendingPaymentParams {
  userId: string;
  reference: string;
  paymentMode: string;
  amount: number;
  bookingId?: string;
  orderId?: string;
  completionType?: string;
  checkoutData?: any;
}

export function getPaymentCallbackUrl(): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'https://fere.app';
  return `${origin}/payment-callback`;
}

export async function savePendingPayment(params: PendingPaymentParams) {
  const { error } = await supabase.from('pending_payments').insert({
    user_id: params.userId,
    reference: params.reference,
    payment_mode: params.paymentMode,
    amount: params.amount,
    booking_id: params.bookingId || null,
    order_id: params.orderId || null,
    completion_type: params.completionType || null,
    checkout_data: params.checkoutData || null,
  });
  if (error) throw error;
}

export function redirectToPaystack(authorizationUrl: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = authorizationUrl;
  }
}
