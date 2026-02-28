import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BOOKING_STATUS_CONFIGS } from '@/lib/bookingUtils';
import type { BookingStatus } from '@/types/database';

interface Props {
  status: BookingStatus;
}

export default function BookingStatusBadge({ status }: Props) {
  const config = BOOKING_STATUS_CONFIGS[status] || BOOKING_STATUS_CONFIGS.pending;

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
