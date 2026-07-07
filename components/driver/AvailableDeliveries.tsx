import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MapPin, Navigation, Package } from 'lucide-react-native';
import { DeliveryRequest } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { formatDistance, formatEarnings } from '@/lib/driverUtils';
import DeliveryStatusBadge from './DeliveryStatusBadge';

interface AvailableDeliveriesProps {
  deliveries: DeliveryRequest[];
  loading: boolean;
  userId: string;
  onRefresh: () => void;
}

export default function AvailableDeliveries({ deliveries, loading, userId, onRefresh }: AvailableDeliveriesProps) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleAccept = async (requestId: string) => {
    setAcceptingId(requestId);
    try {
      const { error } = await supabase
        .from('delivery_requests')
        .update({
          driver_id: userId,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'pending');

      if (error) throw error;
      onRefresh();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accepter cette livraison. Elle a peut-etre déjà été prise.');
    } finally {
      setAcceptingId(null);
    }
  };

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
        <Package size={60} color="#d0d0d0" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Aucune livraison disponible</Text>
        <Text style={styles.emptySubtitle}>Les nouvelles livraisons apparaitront ici</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {deliveries.map((delivery) => {
        const pickupPoints = delivery.pickup_points || (delivery.pickup_point ? [delivery.pickup_point] : []);
        const zoneName = delivery.delivery_zones?.name;
        const zoneCity = delivery.delivery_zones?.city;
        const isAccepting = acceptingId === delivery.id;

        return (
          <View key={delivery.id} style={styles.card}>
            <View style={styles.cardHeader}>
              {zoneName && (
                <View style={styles.zoneBadge}>
                  <MapPin size={13} color="#003f2f" />
                  <Text style={styles.zoneText}>{zoneName}{zoneCity ? `, ${zoneCity}` : ''}</Text>
                </View>
              )}
              <DeliveryStatusBadge status="pending" />
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Distance</Text>
                <Text style={styles.infoValue}>{formatDistance(delivery.total_distance_meters)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Gains</Text>
                <Text style={styles.infoValueGreen}>{formatEarnings(delivery.driver_earnings)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Frais total</Text>
                <Text style={styles.infoValue}>{formatEarnings(delivery.delivery_fee)}</Text>
              </View>
            </View>

            {pickupPoints.length > 0 && (
              <View style={styles.pointsSection}>
                <Text style={styles.pointsLabel}>Collecte :</Text>
                {pickupPoints.map((p, i) => (
                  <View key={i} style={styles.pointItem}>
                    <Navigation size={12} color="#666" />
                    <Text style={styles.pointText} numberOfLines={1}>{p.shop_name || p.name} - {p.address}</Text>
                  </View>
                ))}
              </View>
            )}

            {delivery.delivery_point && (
              <View style={styles.pointsSection}>
                <Text style={styles.pointsLabel}>Livraison :</Text>
                <View style={styles.pointItem}>
                  <MapPin size={12} color="#666" />
                  <Text style={styles.pointText} numberOfLines={1}>
                    {delivery.delivery_point.recipient_name} - {delivery.delivery_point.address}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
              onPress={() => handleAccept(delivery.id)}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.acceptButtonText}>Accepter cette livraison</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f3f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f2f',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  infoValueGreen: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  pointsSection: {
    marginBottom: 10,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f2f',
    marginBottom: 4,
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  pointText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
  },
  acceptButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
