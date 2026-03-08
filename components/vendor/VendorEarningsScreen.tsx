import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native';
import { Search, Circle as XCircle, Wallet, TrendingUp, Clock, CircleCheck as CheckCircle, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { resolveVendorShopIds, getVendorServiceIds } from '@/lib/vendorUtils';
import { formatPrice } from '@/lib/bookingUtils';
import AppHeader from '@/components/AppHeader';
import type { AppRole, PayoutStatus } from '@/types/database';

type FilterTab = 'all' | 'pending' | 'paid';
type DatePreset = 'today' | 'week' | 'month' | 'all';
type SourceTab = 'products' | 'services';

interface VendorPayout {
  id: string;
  amount: number;
  status: PayoutStatus;
  order_id: string | null;
  booking_id: string | null;
  recipient_type: string;
  failure_reason: string | null;
  created_at: string;
  eligible_at: string | null;
  processed_at: string | null;
  order: { order_number: string } | null;
  booking: {
    id: string;
    service: { id: string; name: string } | null;
  } | null;
}

interface Props {
  userId: string;
  userRole: AppRole;
}

export default function VendorEarningsScreen({ userId, userRole }: Props) {
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [sourceTab, setSourceTab] = useState<SourceTab>('products');

  const fetchData = useCallback(async () => {
    try {
      const shopIds = await resolveVendorShopIds(userId, userRole);
      if (shopIds.length === 0) { setLoading(false); return; }

      const { data: payoutData } = await supabase
        .from('pending_payouts')
        .select(`
          id, amount, status, order_id, booking_id, recipient_type, failure_reason,
          created_at, eligible_at, processed_at,
          order:orders(order_number),
          booking:service_bookings(id, service:services(id, name))
        `)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      setPayouts((payoutData || []) as VendorPayout[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, userRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`vendor-payouts-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pending_payouts',
        filter: `recipient_id=eq.${userId}`,
      }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  const payoutsInPeriod = useMemo(() => {
    const start = getDateRangeStart(datePreset);
    return payouts.filter((p) => {
      if (!start) return true;
      return new Date(p.created_at) >= start;
    });
  }, [payouts, datePreset, getDateRangeStart]);

  const sourcePayouts = useMemo(() => {
    return payoutsInPeriod.filter((p) => {
      if (sourceTab === 'products') return !!p.order_id;
      return !!p.booking_id;
    });
  }, [payoutsInPeriod, sourceTab]);

  const periodEarnings = useMemo(() => {
    return sourcePayouts.reduce((sum, p) => sum + p.amount, 0);
  }, [sourcePayouts]);

  const totalPending = useMemo(() => {
    return sourcePayouts
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [sourcePayouts]);

  const totalPaid = useMemo(() => {
    return sourcePayouts
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [sourcePayouts]);

  const filteredPayouts = useMemo(() => {
    let result = sourcePayouts;
    if (filterTab === 'pending') result = result.filter((p) => p.status === 'pending');
    else if (filterTab === 'paid') result = result.filter((p) => p.status === 'paid');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const orderMatch = p.order?.order_number?.toLowerCase().includes(q);
        const serviceMatch = p.booking?.service?.name?.toLowerCase().includes(q);
        return orderMatch || serviceMatch || p.id.toLowerCase().includes(q);
      });
    }
    return result;
  }, [sourcePayouts, filterTab, searchQuery]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

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
        <View style={styles.sourceTabs}>
          <TouchableOpacity
            style={[styles.sourceTab, sourceTab === 'products' && styles.sourceTabActive]}
            onPress={() => setSourceTab('products')}
          >
            <Text style={[styles.sourceTabText, sourceTab === 'products' && styles.sourceTabTextActive]}>Produits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sourceTab, sourceTab === 'services' && styles.sourceTabActive]}
            onPress={() => setSourceTab('services')}
          >
            <Text style={[styles.sourceTabText, sourceTab === 'services' && styles.sourceTabTextActive]}>Prestations</Text>
          </TouchableOpacity>
        </View>

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
            <Text style={styles.summaryValue}>{formatPrice(periodEarnings)} FCFA</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summarySmallCard}>
              <Clock size={16} color="#d97706" />
              <Text style={styles.smallLabel}>En attente</Text>
              <Text style={styles.smallValue}>{formatPrice(totalPending)} FCFA</Text>
            </View>
            <View style={styles.summarySmallCard}>
              <CheckCircle size={16} color="#16a34a" />
              <Text style={styles.smallLabel}>Total paye</Text>
              <Text style={styles.smallValueGreen}>{formatPrice(totalPaid)} FCFA</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Search color="#999" size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par commande, service..."
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
          {filteredPayouts.length === 0 ? (
            <View style={styles.centered}>
              <Wallet size={50} color="#d0d0d0" strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Aucune recette</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Aucun resultat pour cette recherche' : 'Vos recettes apparaitront ici'}
              </Text>
            </View>
          ) : (
            filteredPayouts.map((payout) => {
              const title = payout.booking_id && payout.booking?.service?.name
                ? payout.booking.service.name
                : payout.order?.order_number
                  ? `#${payout.order.order_number}`
                  : payout.order_id ? 'Commande produit' : 'Prestation';
              return (
                <View key={payout.id} style={styles.earningsCard}>
                  <View style={styles.earningsHeader}>
                    <View>
                      <Text style={styles.earningsType}>{title}</Text>
                      <Text style={styles.earningsDate}>{formatDate(payout.created_at)}</Text>
                    </View>
                    <Text style={styles.earningsAmount}>{formatPrice(payout.amount)} FCFA</Text>
                  </View>
                  <View style={styles.earningsFooter}>
                    <PayoutBadge status={payout.status} />
                    {payout.status === 'paid' && payout.processed_at ? (
                      <Text style={styles.eligibleText}>
                        Paye le {formatDate(payout.processed_at)}
                      </Text>
                    ) : payout.eligible_at ? (
                      <Text style={styles.eligibleText}>
                        Eligible le {formatDate(payout.eligible_at)}
                      </Text>
                    ) : null}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 50, gap: 8,
  },
  sourceTabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
  },
  sourceTab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#e5e5e5',
  },
  sourceTabActive: { backgroundColor: '#003f2f', borderColor: '#003f2f' },
  sourceTabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  sourceTabTextActive: { color: '#fff' },
  presetSection: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2, gap: 8,
  },
  presetBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff',
    alignItems: 'center', borderWidth: 1, borderColor: '#e5e5e5',
  },
  presetBtnActive: { backgroundColor: '#003f2f', borderColor: '#003f2f' },
  presetBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },
  presetBtnTextActive: { color: '#fff' },
  summarySection: { padding: 16, gap: 12 },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryIconContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#d1fae5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  summaryLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
  summaryValue: { fontSize: 28, fontWeight: '800', color: '#065f46' },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summarySmallCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  smallLabel: { fontSize: 12, color: '#888' },
  smallValue: { fontSize: 16, fontWeight: '700', color: '#d97706' },
  smallValueGreen: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  filterSection: { paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a', padding: 0 },
  filterTabs: { gap: 6, paddingVertical: 2 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff',
  },
  filterTabActive: { backgroundColor: '#003f2f' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTabTextActive: { color: '#fff' },
  listSection: { paddingHorizontal: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: '#666' },
  earningsCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  earningsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10,
  },
  earningsType: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  earningsDate: { fontSize: 12, color: '#999', marginTop: 2 },
  earningsAmount: { fontSize: 17, fontWeight: '800', color: '#065f46' },
  earningsFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  eligibleText: { fontSize: 11, color: '#888' },
});
