import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ClipboardList, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { DeliveryRequest, PendingPayout } from '@/types/database';
import { formatDate, formatEarnings } from '@/lib/driverUtils';
import DeliveryStatusBadge from './DeliveryStatusBadge';
import { supabase } from '@/lib/supabase';
import { startConversation } from '@/lib/chatUtils';

interface DeliveryHistoryProps {
  deliveries: DeliveryRequest[];
  payouts: Record<string, PendingPayout>;
  loading: boolean;
  userId: string;
}

function PayoutBadge({ status }: { status?: string }) {
  if (!status) return null;
  const config: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'En attente', color: '#666', bg: '#f0f0f0' },
    processing: { label: 'En cours', color: '#2563eb', bg: '#dbeafe' },
    paid: { label: 'Paye', color: '#16a34a', bg: '#dcfce7' },
  };
  const c = config[status] || config.pending;
  return (
    <View style={[payoutStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[payoutStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const payoutStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  text: { fontSize: 11, fontWeight: '600' },
});

export default function DeliveryHistory({ deliveries, payouts, loading, userId }: DeliveryHistoryProps) {
  const router = useRouter();
  const [contactingClient, setContactingClient] = useState<Record<string, boolean>>({});
  const [contactingVendor, setContactingVendor] = useState<Record<string, boolean>>({});
  const [contactingAdmin, setContactingAdmin] = useState<Record<string, boolean>>({});

  const handleContactClient = useCallback(async (deliveryId: string, orderId: string | null | undefined) => {
    if (!orderId || contactingClient[deliveryId]) return;
    setContactingClient((prev) => ({ ...prev, [deliveryId]: true }));
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .maybeSingle();
      if (!order?.user_id) return;
      const convoId = await startConversation(userId, order.user_id);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      console.error('Error contacting client:', err);
    } finally {
      setContactingClient((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }, [userId, contactingClient, router]);

  const handleContactVendor = useCallback(async (deliveryId: string, orderId: string | null | undefined) => {
    if (!orderId || contactingVendor[deliveryId]) return;
    setContactingVendor((prev) => ({ ...prev, [deliveryId]: true }));
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('shop_id')
        .eq('id', orderId)
        .maybeSingle();
      if (!order?.shop_id) return;
      const { data: shop } = await supabase
        .from('shops')
        .select('owner_id')
        .eq('id', order.shop_id)
        .maybeSingle();
      if (!shop?.owner_id) return;
      const convoId = await startConversation(userId, shop.owner_id);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      console.error('Error contacting vendor:', err);
    } finally {
      setContactingVendor((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }, [userId, contactingVendor, router]);

  const handleContactAdmin = useCallback(async (deliveryId: string) => {
    if (contactingAdmin[deliveryId]) return;
    setContactingAdmin((prev) => ({ ...prev, [deliveryId]: true }));
    try {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin'])
        .limit(1);
      const adminId = admins?.[0]?.user_id;
      if (!adminId) return;
      const convoId = await startConversation(userId, adminId);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      console.error('Error contacting admin:', err);
    } finally {
      setContactingAdmin((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }, [userId, contactingAdmin, router]);
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
        <ClipboardList size={60} color="#d0d0d0" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Aucun historique</Text>
        <Text style={styles.emptySubtitle}>Vos livraisons terminees apparaitront ici</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {deliveries.map((delivery) => {
        const payout = payouts[delivery.id];
        const showEarnings = !delivery.is_return && delivery.status === 'delivered';
        const isReturnComplete = delivery.is_return && delivery.return_status === 'returned';

        return (
          <View key={delivery.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.badgeRow}>
                {isReturnComplete ? (
                  <View style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.statusText, { color: '#16a34a' }]}>Retourne</Text>
                  </View>
                ) : (
                  <DeliveryStatusBadge
                    status={delivery.status}
                    isReturn={delivery.is_return}
                    returnStatus={delivery.return_status ?? undefined}
                  />
                )}
                {payout && <PayoutBadge status={payout.status} />}
              </View>
              <Text style={styles.date}>
                {formatDate(delivery.delivered_at || delivery.created_at)}
              </Text>
            </View>

            {delivery.order?.order_number && (
              <Text style={styles.orderNumber}>Commande #{delivery.order.order_number}</Text>
            )}

            {showEarnings && (
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Gains</Text>
                <Text style={styles.earningsValue}>{formatEarnings(delivery.driver_earnings)}</Text>
              </View>
            )}

            {delivery.delivery_point && (
              <Text style={styles.address} numberOfLines={1}>
                {delivery.delivery_point.address}
              </Text>
            )}

            {delivery.order_id && (
              <View style={styles.contactRow}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleContactClient(delivery.id, delivery.order_id)}
                  disabled={contactingClient[delivery.id]}
                >
                  {contactingClient[delivery.id] ? (
                    <ActivityIndicator size="small" color="#003f2f" />
                  ) : (
                    <>
                      <MessageCircle size={12} color="#003f2f" />
                      <Text style={styles.contactBtnText}>Client</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleContactVendor(delivery.id, delivery.order_id)}
                  disabled={contactingVendor[delivery.id]}
                >
                  {contactingVendor[delivery.id] ? (
                    <ActivityIndicator size="small" color="#003f2f" />
                  ) : (
                    <>
                      <MessageCircle size={12} color="#003f2f" />
                      <Text style={styles.contactBtnText}>Vendeur</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleContactAdmin(delivery.id)}
                  disabled={contactingAdmin[delivery.id]}
                >
                  {contactingAdmin[delivery.id] ? (
                    <ActivityIndicator size="small" color="#003f2f" />
                  ) : (
                    <>
                      <MessageCircle size={12} color="#003f2f" />
                      <Text style={styles.contactBtnText}>Admin</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
    gap: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  earningsLabel: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '500',
  },
  earningsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
  },
  address: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: '#c8e6c9',
    borderRadius: 8,
    backgroundColor: '#f0f7f5',
  },
  contactBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#003f2f',
  },
});
