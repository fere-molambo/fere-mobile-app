import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Search, Circle as XCircle, Wallet, TrendingUp, Clock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { DeliveryRequest, PendingPayout } from '@/types/database';
import { formatDate, formatEarnings } from '@/lib/driverUtils';
import AppHeader from '@/components/AppHeader';
import DeliveryStatusBadge from './DeliveryStatusBadge';

type FilterTab = 'all' | 'pending' | 'paid';
type DatePreset = 'today' | 'week' | 'month' | 'all';

interface DriverEarningsScreenProps {
  userId: string;
}

export default function DriverEarningsScreen({ userId }: DriverEarningsScreenProps) {
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [payouts, setPayouts] = useState<Record<string, PendingPayout>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');

  const fetchData = useCallback(async () => {
    try {
      const { data: history } = await supabase
        .from('delivery_requests')
        .select('*, delivery_zones(name, city), order:orders!order_id(order_number)')
        .eq('driver_id', userId)
        .in('status', ['delivered', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(100);

      const items = (history as DeliveryRequest[]) || [];
      setDeliveries(items);

      if (items.length > 0) {
        const ids = items.map(d => d.id);
        const { data: payoutData } = await supabase
          .from('pending_payouts')
          .select('*')
          .in('delivery_request_id', ids)
          .eq('recipient_id', userId);

        const map: Record<string, PendingPayout> = {};
        (payoutData || []).forEach((p: any) => {
          if (p.delivery_request_id) map[p.delivery_request_id] = p;
        });
        setPayouts(map);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`driver-payouts-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pending_payouts',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  const getDateRangeStart = useCallback((preset: DatePreset): Date | null => {
    const now = new Date();
    if (preset === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (preset === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (preset === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }
    return null;
  }, []);

  const deliveriesInPeriod = useMemo(() => {
    const start = getDateRangeStart(datePreset);
    return deliveries.filter(d => {
      if (!start) return true;
      const date = new Date(d.delivered_at || d.created_at);
      return date >= start;
    });
  }, [deliveries, datePreset, getDateRangeStart]);

  const earningDeliveries = useMemo(() => {
    return deliveriesInPeriod.filter(d =>
      !d.is_return && (d.status === 'delivered' || (d.status === 'cancelled' && payouts[d.id]))
    );
  }, [deliveriesInPeriod, payouts]);

  const periodEarnings = useMemo(() => {
    return earningDeliveries.reduce((sum, d) => sum + (d.driver_earnings || 0), 0);
  }, [earningDeliveries]);

  const totalPending = useMemo(() => {
    const fromPayouts = earningDeliveries
      .map(d => payouts[d.id])
      .filter((p): p is PendingPayout => !!p && p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
    const fromUntracked = earningDeliveries
      .filter(d => !payouts[d.id])
      .reduce((sum, d) => sum + (d.driver_earnings || 0), 0);
    return fromPayouts + fromUntracked;
  }, [payouts, earningDeliveries]);

  const totalPaid = useMemo(() => {
    return earningDeliveries
      .map(d => payouts[d.id])
      .filter((p): p is PendingPayout => !!p && p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payouts, earningDeliveries]);

  const filteredDeliveries = useMemo(() => {
    let result = [...earningDeliveries];

    if (filterTab === 'pending') {
      result = result.filter(d => {
        const payout = payouts[d.id];
        return !payout || payout.status === 'pending';
      });
    } else if (filterTab === 'paid') {
      result = result.filter(d => {
        const payout = payouts[d.id];
        return payout?.status === 'paid';
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d => {
        const orderMatch = d.order?.order_number?.toLowerCase().includes(q);
        const zoneMatch = d.delivery_zones?.name?.toLowerCase().includes(q);
        return orderMatch || zoneMatch;
      });
    }

    return result;
  }, [earningDeliveries, payouts, filterTab, searchQuery]);

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'pending', label: 'En attente' },
    { key: 'paid', label: 'Payees' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader hideCart />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor="#003f2f"
          />
        }
      >
        <View style={styles.presetSection}>
          {([
            { key: 'today', label: "Aujourd'hui" },
            { key: 'week', label: 'Semaine' },
            { key: 'month', label: 'Mois' },
            { key: 'all', label: 'Tout' },
          ] as { key: DatePreset; label: string }[]).map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.presetBtn, datePreset === p.key && styles.presetBtnActive]}
              onPress={() => setDatePreset(p.key)}
            >
              <Text style={[styles.presetBtnText, datePreset === p.key && styles.presetBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconContainer}>
              <TrendingUp size={22} color="#065f46" />
            </View>
            <Text style={styles.summaryLabel}>
              {datePreset === 'today' ? 'Gains du jour' : datePreset === 'week' ? 'Gains de la semaine' : datePreset === 'month' ? 'Gains du mois' : 'Gains totaux'}
            </Text>
            <Text style={styles.summaryValue}>{formatEarnings(periodEarnings)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summarySmallCard}>
              <Clock size={16} color="#d97706" />
              <Text style={styles.smallLabel}>En attente</Text>
              <Text style={styles.smallValue}>{formatEarnings(totalPending)}</Text>
            </View>
            <View style={styles.summarySmallCard}>
              <CheckCircle size={16} color="#16a34a" />
              <Text style={styles.smallLabel}>Total paye</Text>
              <Text style={styles.smallValueGreen}>{formatEarnings(totalPaid)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Search color="#999" size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par commande, zone..."
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <XCircle color="#ccc" size={18} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
            {filters.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, filterTab === f.key && styles.filterTabActive]}
                onPress={() => setFilterTab(f.key)}
              >
                <Text style={[styles.filterTabText, filterTab === f.key && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.listSection}>
          {filteredDeliveries.length === 0 ? (
            <View style={styles.centered}>
              <Wallet size={50} color="#d0d0d0" strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Aucune recette</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Aucun resultat pour cette recherche' : 'Vos recettes apparaitront ici'}
              </Text>
            </View>
          ) : (
            filteredDeliveries.map((delivery) => {
              const payout = payouts[delivery.id];
              return (
                <View key={delivery.id} style={styles.earningsCard}>
                  <View style={styles.earningsHeader}>
                    <View>
                      {delivery.order?.order_number && (
                        <Text style={styles.orderNumber}>#{delivery.order.order_number}</Text>
                      )}
                      <Text style={styles.earningsDate}>
                        {formatDate(delivery.delivered_at || delivery.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.earningsAmount}>
                      {formatEarnings(delivery.driver_earnings)}
                    </Text>
                  </View>

                  {delivery.delivery_zones?.name && (
                    <Text style={styles.zoneName}>
                      {delivery.delivery_zones.name}{delivery.delivery_zones.city ? `, ${delivery.delivery_zones.city}` : ''}
                    </Text>
                  )}

                  <View style={styles.earningsFooter}>
                    {delivery.status === 'cancelled' && payouts[delivery.id] ? (
                      <View style={cancelledBadgeStyles.badge}>
                        <Text style={cancelledBadgeStyles.text}>Annulee a l'arrivee</Text>
                      </View>
                    ) : (
                      <DeliveryStatusBadge status={delivery.status} />
                    )}
                    <View style={styles.footerRight}>
                      <PayoutBadge status={payout?.status || 'pending'} />
                      {payout?.status === 'paid' && payout.processed_at ? (
                        <Text style={styles.dateHint}>
                          Paye le {formatDate(payout.processed_at)}
                        </Text>
                      ) : payout?.eligible_at ? (
                        <Text style={styles.dateHint}>
                          Eligible le {formatDate(payout.eligible_at)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function PayoutBadge({ status }: { status: string }) {
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
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  text: { fontSize: 12, fontWeight: '600' },
});

const cancelledBadgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
  },
  text: { fontSize: 12, fontWeight: '700', color: '#d97706' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  presetSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  presetBtnActive: {
    backgroundColor: '#003f2f',
    borderColor: '#003f2f',
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  presetBtnTextActive: {
    color: '#fff',
  },
  summarySection: {
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#065f46',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summarySmallCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  smallLabel: {
    fontSize: 12,
    color: '#888',
  },
  smallValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#d97706',
  },
  smallValueGreen: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
  filterSection: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    padding: 0,
  },
  filterTabs: {
    gap: 6,
    paddingVertical: 2,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  filterTabActive: {
    backgroundColor: '#003f2f',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  listSection: {
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#666',
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  earningsDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  earningsAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#065f46',
  },
  zoneName: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
  },
  earningsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dateHint: {
    fontSize: 11,
    color: '#888',
  },
});
