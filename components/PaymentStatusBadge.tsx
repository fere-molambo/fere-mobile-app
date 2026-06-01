import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PAYMENT_STATUS_CONFIGS } from '@/lib/bookingUtils';
import type { BookingPaymentStatus } from '@/types/database';

interface Props {
  status: BookingPaymentStatus;
}

export default function PaymentStatusBadge({ status }: Props) {
  const config = PAYMENT_STATUS_CONFIGS[status] || PAYMENT_STATUS_CONFIGS.pending;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
