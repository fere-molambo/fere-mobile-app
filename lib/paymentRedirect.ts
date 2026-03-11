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
  payToken?: string;
}

export function getPaymentCallbackUrl(): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'https://fere.app';
  return `${origin}/payment-callback`;
}

export async function savePendingPayment(params: PendingPaymentParams) {
  const checkoutData = params.checkoutData || null;
  if (params.payToken && checkoutData) {
    checkoutData.pay_token = params.payToken;
  }

  const { error } = await supabase.from('pending_payments').insert({
    user_id: params.userId,
    reference: params.reference,
    payment_mode: params.paymentMode,
    amount: params.amount,
    booking_id: params.bookingId || null,
    order_id: params.orderId || null,
    completion_type: params.completionType || null,
    checkout_data: params.payToken && !checkoutData
      ? { pay_token: params.payToken }
      : checkoutData,
  });
  if (error) throw error;
}

export function redirectToPayment(paymentUrl: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = paymentUrl;
  }
}
