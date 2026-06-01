import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DeliveryStatus, ReturnStatus } from '@/types/database';
import { DELIVERY_STATUS_CONFIG, RETURN_STATUS_CONFIG } from '@/lib/driverUtils';

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
  isReturn?: boolean;
  returnStatus?: ReturnStatus;
}

export default function DeliveryStatusBadge({ status, isReturn, returnStatus }: DeliveryStatusBadgeProps) {
  if (isReturn && status === 'assigned') {
    return (
      <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
        <Text style={[styles.badgeText, { color: '#d97706' }]}>Retour colis au vendeur</Text>
      </View>
    );
  }

  if (isReturn && returnStatus) {
    const config = RETURN_STATUS_CONFIG[returnStatus];
    return (
      <View style={[styles.badge, { backgroundColor: config.bgColor }]}>
        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  }

  if (isReturn) {
    return (
      <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
        <Text style={[styles.badgeText, { color: '#d97706' }]}>Retour</Text>
      </View>
    );
  }

  const config = DELIVERY_STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <View style={[styles.badge, { backgroundColor: config.bgColor }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
