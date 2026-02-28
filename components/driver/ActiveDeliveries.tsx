import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Truck } from 'lucide-react-native';
import { DeliveryRequest } from '@/types/database';
import ActiveDeliveryCard from './ActiveDeliveryCard';

interface ActiveDeliveriesProps {
  deliveries: DeliveryRequest[];
  loading: boolean;
  userId: string;
  onUpdate: () => void;
}

export default function ActiveDeliveries({ deliveries, loading, userId, onUpdate }: ActiveDeliveriesProps) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  if (deliveries.length === 0) {
    return (
      <View style={styles.centered}>
        <Truck size={60} color="#d0d0d0" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Aucune livraison active</Text>
        <Text style={styles.emptySubtitle}>Acceptez une livraison pour commencer</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {deliveries.map((delivery) => (
        <ActiveDeliveryCard
          key={delivery.id}
          delivery={delivery}
          userId={userId}
          onUpdate={onUpdate}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    gap: 12,
  },
});
