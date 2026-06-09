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
import { RotateCcw, Clock, CircleCheck as CheckCircle, Package, Briefcase, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Refund {
  id: string;
  order_id: string | null;
  booking_id: string | null;
  amount: number;
  net_refund: number;
  transaction_fee_deducted: number | null;
  status: string;
  refund_status: string;
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
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

function getStatusConfig(refund: Refund) {
  const s = refund.refund_status || refund.status;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'En attente', color: '#e67e22', bg: '#fef3c7' },
    processing: { label: 'En cours', color: '#2563eb', bg: '#dbeafe' },
    processed: { label: 'Rembourse', color: '#16a34a', bg: '#dcfce7' },
    failed: { label: 'Echoue', color: '#dc2626', bg: '#fee2e2' },
  };
  return map[s] || map.pending;
}

function isPending(refund: Refund) {
  return refund.status === 'pending' || refund.refund_status === 'pending';
}

export default function RefundsScreen() {
  const { user } = useAuth();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  const loadRefunds = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('refunds')
        .select(`
          id, order_id, booking_id, amount, net_refund, transaction_fee_deducted,
          status, refund_status, failure_reason, created_at, processed_at,
          order:orders(order_number),
          booking:service_bookings(id, service:services(id, name))
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefunds((data as any) || []);
    } catch (err) {
      console.error('Error loading refunds:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadRefunds();
  }, [loadRefunds]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`client-refunds-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'refunds',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadRefunds();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadRefunds]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRefunds();
  }, [loadRefunds]);

  const pendingRefunds = refunds.filter(isPending);
  const processedRefunds = refunds.filter((r) => !isPending(r));
  const displayedRefunds = activeTab === 'pending' ? pendingRefunds : processedRefunds;

  const getRefundTitle = (refund: Refund) => {
    if (refund.booking_id && refund.booking?.service?.name) {
      return refund.booking.service.name;
    }
    return refund.order?.order_number || 'Commande';
  };

  const isBookingRefund = (refund: Refund) => !!refund.booking_id;

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Remboursements" />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Clock color={activeTab === 'pending' ? '#003f2f' : '#999'} size={16} />
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            En attente ({pendingRefunds.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'processed' && styles.tabActive]}
          onPress={() => setActiveTab('processed')}
        >
          <CheckCircle color={activeTab === 'processed' ? '#003f2f' : '#999'} size={16} />
          <Text style={[styles.tabText, activeTab === 'processed' && styles.tabTextActive]}>
            Traites ({processedRefunds.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      ) : displayedRefunds.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#003f2f" />
          }
        >
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <RotateCcw color="#003f2f" size={36} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending'
                ? 'Aucun remboursement en attente'
                : 'Aucun remboursement traite'}
            </Text>
            <Text style={styles.emptySubtitle}>
              Les remboursements lies aux commandes et prestations annulees apparaitront ici.
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

          {displayedRefunds.map((refund) => {
            const statusCfg = getStatusConfig(refund);
            return (
              <View key={refund.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    {isBookingRefund(refund) ? (
                      <Briefcase color="#003f2f" size={18} />
                    ) : (
                      <Package color="#003f2f" size={18} />
                    )}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardOrderNumber}>{getRefundTitle(refund)}</Text>
                    <Text style={styles.cardDate}>{formatDate(refund.created_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Montant initial</Text>
                    <Text style={styles.amountValue}>{formatPrice(refund.amount)} FCFA</Text>
                  </View>
                  {refund.transaction_fee_deducted != null && refund.transaction_fee_deducted > 0 && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Frais conserves</Text>
                      <Text style={[styles.amountValue, { color: '#d97706' }]}>
                        -{formatPrice(refund.transaction_fee_deducted)} FCFA
                      </Text>
                    </View>
                  )}
                  {refund.net_refund > 0 && refund.net_refund !== refund.amount && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Montant rembourse</Text>
                      <Text style={[styles.amountValue, { color: '#16a34a' }]}>
                        {formatPrice(refund.net_refund)} FCFA
                      </Text>
                    </View>
                  )}
                  {refund.processed_at && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Traite le</Text>
                      <Text style={styles.amountDate}>{formatDate(refund.processed_at)}</Text>
                    </View>
                  )}
                  {refund.failure_reason && (
                    <View style={styles.failureRow}>
                      <AlertCircle color="#dc2626" size={14} />
                      <Text style={styles.failureText}>{refund.failure_reason}</Text>
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
  cardOrderNumber: {
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
    color: '#1a1a1a',
  },
  amountDate: {
    fontSize: 13,
    color: '#888',
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
