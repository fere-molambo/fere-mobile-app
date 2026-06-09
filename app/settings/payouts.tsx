import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Wallet, Clock, CircleCheck as CheckCircle, Package, Briefcase, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface PayoutItem {
  id: string;
  amount: number;
  recipient_type: string;
  status: string;
  order_id: string | null;
  booking_id: string | null;
  delivery_request_id: string | null;
  created_at: string;
  eligible_at: string | null;
  processed_at: string | null;
  failure_reason: string | null;
  order: { order_number: string } | null;
  booking: {
    id: string;
    service: { id: string; name: string } | null;
  } | null;
}

type FilterTab = 'pending' | 'processed';

function formatPrice(n: number) {
  return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, '\u00a0');
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getStatusConfig(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'En attente', color: '#e67e22', bg: '#fef3c7' },
    processing: { label: 'En cours', color: '#2563eb', bg: '#dbeafe' },
    paid: { label: 'Paye', color: '#16a34a', bg: '#dcfce7' },
  };
  return map[status] || map.pending;
}

export default function PayoutsScreen() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  const fetchPayouts = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pending_payouts')
        .select(`
          id, amount, recipient_type, status, order_id, booking_id, delivery_request_id,
          created_at, eligible_at, processed_at, failure_reason,
          order:orders(order_number),
          booking:service_bookings(id, service:services(id, name))
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayouts((data as any) || []);
    } catch (err) {
      console.error('Error loading payouts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-payouts-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pending_payouts',
        filter: `recipient_id=eq.${user.id}`,
      }, () => {
        fetchPayouts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchPayouts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPayouts();
  }, [fetchPayouts]);

  const pendingPayouts = payouts.filter((p) => p.status === 'pending');
  const processedPayouts = payouts.filter((p) => p.status !== 'pending');
  const displayedPayouts = activeTab === 'pending' ? pendingPayouts : processedPayouts;

  const getPayoutTitle = (payout: PayoutItem) => {
    if (payout.booking_id && payout.booking?.service?.name) {
      return payout.booking.service.name;
    }
    if (payout.order_id && payout.order?.order_number) {
      return `#${payout.order.order_number}`;
    }
    if (payout.delivery_request_id) {
      return 'Livraison';
    }
    return 'Versement';
  };

  const getPayoutIcon = (payout: PayoutItem) => {
    if (payout.booking_id) return <Briefcase color="#003f2f" size={18} />;
    return <Package color="#003f2f" size={18} />;
  };

  const getRecipientLabel = (type: string) => {
    if (type === 'vendor') return 'Vendeur';
    if (type === 'driver') return 'Livreur';
    return type;
  };

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Mes versements" />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Clock color={activeTab === 'pending' ? '#003f2f' : '#999'} size={16} />
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            En attente ({pendingPayouts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'processed' && styles.tabActive]}
          onPress={() => setActiveTab('processed')}
        >
          <CheckCircle color={activeTab === 'processed' ? '#003f2f' : '#999'} size={16} />
          <Text style={[styles.tabText, activeTab === 'processed' && styles.tabTextActive]}>
            Traites ({processedPayouts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      ) : displayedPayouts.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#003f2f" />
          }
        >
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Wallet color="#003f2f" size={36} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending'
                ? 'Aucun versement en attente'
                : 'Aucun versement traite'}
            </Text>
            <Text style={styles.emptySubtitle}>
              Vos versements apparaitront ici.
            </Text>
          </View>
          <TouchableOpacity style={styles.manualRefreshBtn} onPress={onRefresh}>
            <RefreshCw color="#003f2f" size={16} />
            <Text style={styles.manualRefreshText}>Actualiser</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#003f2f" />
          }
        >
          <TouchableOpacity style={styles.manualRefreshBtn} onPress={onRefresh}>
            <RefreshCw color="#003f2f" size={16} />
            <Text style={styles.manualRefreshText}>Actualiser</Text>
          </TouchableOpacity>

          {displayedPayouts.map((payout) => {
            const statusCfg = getStatusConfig(payout.status);
            return (
              <View key={payout.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    {getPayoutIcon(payout)}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{getPayoutTitle(payout)}</Text>
                    <Text style={styles.cardDate}>{formatDate(payout.created_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Montant</Text>
                    <Text style={styles.amountValue}>{formatPrice(payout.amount)} FCFA</Text>
                  </View>

                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Type</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {getRecipientLabel(payout.recipient_type)}
                      </Text>
                    </View>
                  </View>

                  {payout.eligible_at && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Eligible le</Text>
                      <Text style={styles.amountDate}>{formatDate(payout.eligible_at)}</Text>
                    </View>
                  )}

                  {payout.processed_at && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Traite le</Text>
                      <Text style={styles.amountDate}>{formatDate(payout.processed_at)}</Text>
                    </View>
                  )}

                  {payout.failure_reason && (
                    <View style={styles.failureRow}>
                      <AlertCircle color="#dc2626" size={14} />
                      <Text style={styles.failureText}>{payout.failure_reason}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#e8f3f0',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#003f2f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f3f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  manualRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  manualRefreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003f2f',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f3f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13,
    color: '#666',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  amountDate: {
    fontSize: 13,
    color: '#888',
  },
  typeBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  failureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
  },
  failureText: {
    fontSize: 12,
    color: '#dc2626',
    flex: 1,
  },
});
