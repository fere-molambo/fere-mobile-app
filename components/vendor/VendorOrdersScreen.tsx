import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native';
import { Package, Calendar, Phone, Store, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import BookingStatusBadge from '@/components/BookingStatusBadge';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import VendorBookingDetailSheet from '@/components/vendor/VendorBookingDetailSheet';
import OrderFilters, { getDateRangeStart, type DatePreset } from '@/components/vendor/OrderFilters';
import { resolveVendorShopIds, getVendorServiceIds } from '@/lib/vendorUtils';
import { formatBookingDate, formatBookingTime, formatPrice } from '@/lib/bookingUtils';
import { sendNotificationToUser } from '@/lib/notificationService';
import type { AppRole, BookingStatus, BookingPaymentStatus } from '@/types/database';

interface Props {
  userId: string;
  userRole: AppRole;
}

const ORDER_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#e67e22', bg: '#fef3c7' },
  confirmed: { label: 'Confirmee', color: '#3b82f6', bg: '#dbeafe' },
  preparing: { label: 'En preparation', color: '#ca8a04', bg: '#fef9c3' },
  shipped: { label: 'En livraison', color: '#0891b2', bg: '#cffafe' },
  delivered: { label: 'Livree', color: '#16a34a', bg: '#dcfce7' },
  cancelled: { label: 'Annulee', color: '#ef4444', bg: '#fee2e2' },
};

const ORDER_STATUS_OPTIONS = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmee' },
  { key: 'preparing', label: 'En preparation' },
  { key: 'shipped', label: 'En livraison' },
  { key: 'delivered', label: 'Livree' },
  { key: 'cancelled', label: 'Annulee' },
];

const BOOKING_STATUS_OPTIONS = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptee' },
  { key: 'on_the_way', label: 'En route' },
  { key: 'arrived', label: 'Sur place' },
  { key: 'completed', label: 'Terminee' },
  { key: 'partial', label: 'Partielle' },
  { key: 'cancelled', label: 'Annulee' },
];

const ORDER_PAYMENT_OPTIONS = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'advance_paid', label: 'Acompte paye' },
  { key: 'paid', label: 'Paye' },
];

const BOOKING_PAYMENT_OPTIONS = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'Non paye' },
  { key: 'partial', label: 'Acompte paye' },
  { key: 'paid', label: 'Paye' },
];

type Tab = 'products' | 'services';

interface VendorOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  subtotal: number;
  delivery_fee: number;
  created_at: string;
  user_id: string;
  order_items: Array<{
    id: string; quantity: number; unit_price: number;
    product: { name: string; main_media_url: string | null } | null;
  }>;
  customer?: { nom_complet: string; contact: string } | null;
}

interface VendorBooking {
  id: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  total_price: number;
  travel_fee: number;
  travel_fee_paid: boolean;
  commission_amount: number;
  tva_amount: number;
  created_at: string;
  customer_id: string;
  service: { name: string; main_media_url: string | null } | null;
  customer: { id: string; nom_complet: string; contact: string; email: string } | null;
  delivery_address: { label: string; address: string; city: string; geolocation_lat: number | null; geolocation_lng: number | null } | null;
}

export default function VendorOrdersScreen({ userId, userRole }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('products');
  const [shopIds, setShopIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<VendorBooking | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const resetFilters = () => {
    setSearchQuery('');
    setDatePreset('all');
    setStatusFilter('all');
    setPaymentFilter('all');
  };

  const loadData = useCallback(async () => {
    const ids = await resolveVendorShopIds(userId, userRole);
    setShopIds(ids);
    if (ids.length === 0) { setLoading(false); return; }

    const [ordersRes, bookingsRes] = await Promise.all([
      loadOrders(ids),
      loadBookings(ids),
    ]);
    setOrders(ordersRes);
    setBookings(bookingsRes);
    setLoading(false);
  }, [userId, userRole]);

  const loadOrders = async (ids: string[]): Promise<VendorOrder[]> => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, payment_status, total_amount, subtotal,
        delivery_fee, created_at, user_id,
        order_items(id, quantity, unit_price, product:products(name, main_media_url))
      `)
      .in('shop_id', ids)
      .order('created_at', { ascending: false })
      .limit(50);

    const items = (data || []) as unknown as VendorOrder[];
    const customerIds = [...new Set(items.map((o) => o.user_id))];
    if (customerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nom_complet, contact')
        .in('id', customerIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      items.forEach((o) => { o.customer = profileMap.get(o.user_id) || null; });
    }
    return items;
  };

  const loadBookings = async (ids: string[]): Promise<VendorBooking[]> => {
    const serviceIds = await getVendorServiceIds(ids);
    if (serviceIds.length === 0) return [];
    const { data } = await supabase
      .from('service_bookings')
      .select(`
        id, service_id, booking_date, booking_time, status, payment_status,
        total_price, travel_fee, travel_fee_paid, commission_amount, tva_amount,
        created_at, customer_id,
        service:services(name, main_media_url),
        customer:profiles!service_bookings_customer_id_fkey(id, nom_complet, contact, email),
        delivery_address:delivery_addresses(label, address, city, geolocation_lat, geolocation_lng)
      `)
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []) as unknown as VendorBooking[];
  };

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (shopIds.length === 0) return;
    const channel = supabase
      .channel(`vendor-orders-bookings-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders(shopIds).then(setOrders); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_bookings' }, () => { loadBookings(shopIds).then(setBookings); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopIds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleBookingAction = async (bookingId: string, action: string) => {
    const updates: any = {};
    const now = new Date().toISOString();
    if (action === 'accept') { updates.status = 'accepted'; updates.accepted_by = userId; updates.accepted_at = now; }
    if (action === 'on_the_way') { updates.status = 'on_the_way'; updates.started_at = now; updates.vendor_on_the_way_at = now; }
    if (action === 'arrived') { updates.status = 'arrived'; updates.arrived_at = now; updates.vendor_arrived_at = now; }

    await supabase.from('service_bookings').update(updates).eq('id', bookingId);

    const target = bookings.find((b) => b.id === bookingId);
    if (target?.customer?.id) {
      const notifMap: Record<string, string> = {
        accept: 'Votre reservation a ete acceptee',
        on_the_way: 'Le prestataire est en route vers vous',
        arrived: 'Le prestataire est arrive sur place',
      };
      const msg = notifMap[action];
      if (msg) {
        sendNotificationToUser(target.customer.id, 'Reservation', msg).catch(() => {});
      }
    }

    const updated = await loadBookings(shopIds);
    setBookings(updated);
    const fresh = updated.find((b) => b.id === bookingId);
    if (fresh) setSelectedBooking(fresh);
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    const rangeStart = getDateRangeStart(datePreset);
    if (rangeStart) {
      result = result.filter((o) => new Date(o.created_at) >= rangeStart);
    }
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (paymentFilter !== 'all') {
      result = result.filter((o) => o.payment_status === paymentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((o) => {
        const orderNum = o.order_number?.toLowerCase() || '';
        const customerName = o.customer?.nom_complet?.toLowerCase() || '';
        const productNames = o.order_items.map((i) => i.product?.name?.toLowerCase() || '').join(' ');
        return orderNum.includes(q) || customerName.includes(q) || productNames.includes(q);
      });
    }
    return result;
  }, [orders, datePreset, statusFilter, paymentFilter, searchQuery]);

  const filteredBookings = useMemo(() => {
    let result = bookings;
    const rangeStart = getDateRangeStart(datePreset);
    if (rangeStart) {
      result = result.filter((b) => new Date(b.created_at) >= rangeStart);
    }
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (paymentFilter !== 'all') {
      result = result.filter((b) => b.payment_status === paymentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((b) => {
        const serviceName = b.service?.name?.toLowerCase() || '';
        const customerName = b.customer?.nom_complet?.toLowerCase() || '';
        return serviceName.includes(q) || customerName.includes(q);
      });
    }
    return result;
  }, [bookings, datePreset, statusFilter, paymentFilter, searchQuery]);

  const pendingBookings = useMemo(() => {
    return filteredBookings.filter((b) => b.status === 'pending');
  }, [filteredBookings]);

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      </View>
    );
  }

  if (shopIds.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />
        <View style={styles.emptyFull}>
          <Store color="#ccc" size={48} />
          <Text style={styles.emptyTitle}>Aucune boutique</Text>
          <Text style={styles.emptyText}>Aucune boutique active associee a votre compte.</Text>
        </View>
      </View>
    );
  }

  const allPendingBookings = bookings.filter((b) => b.status === 'pending');

  return (
    <View style={styles.container}>
      <AppHeader hideCart />
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'products' && styles.tabBtnActive]}
          onPress={() => { setTab('products'); resetFilters(); }}
        >
          <Package size={16} color={tab === 'products' ? '#003f2f' : '#999'} />
          <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>
            Produits ({tab === 'products' ? filteredOrders.length : orders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'services' && styles.tabBtnActive]}
          onPress={() => { setTab('services'); resetFilters(); }}
        >
          <Calendar size={16} color={tab === 'services' ? '#003f2f' : '#999'} />
          <Text style={[styles.tabText, tab === 'services' && styles.tabTextActive]}>
            Prestations ({tab === 'services' ? filteredBookings.length : bookings.length})
          </Text>
          {allPendingBookings.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{allPendingBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <OrderFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={tab === 'products' ? 'Rechercher par nom, numero...' : 'Rechercher par service, client...'}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={tab === 'products' ? ORDER_STATUS_OPTIONS : BOOKING_STATUS_OPTIONS}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
        paymentOptions={tab === 'products' ? ORDER_PAYMENT_OPTIONS : BOOKING_PAYMENT_OPTIONS}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {tab === 'products' && (
          <>
            {filteredOrders.length > 0 ? filteredOrders.map((order) => {
              const st = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.pending;
              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/order-detail', params: { id: order.id } } as any)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.orderNumber}>#{order.order_number}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  {order.order_items.slice(0, 2).map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      {item.product?.main_media_url ? (
                        <Image source={{ uri: item.product.main_media_url }} style={styles.itemThumb} />
                      ) : (
                        <View style={[styles.itemThumb, { backgroundColor: '#f0f0f0' }]} />
                      )}
                      <Text style={styles.itemName} numberOfLines={1}>{item.product?.name || 'Produit'}</Text>
                      <Text style={styles.itemQty}>x{item.quantity}</Text>
                    </View>
                  ))}
                  {order.customer && (
                    <View style={styles.customerRow}>
                      <Phone size={13} color="#666" />
                      <Text style={styles.customerText}>{order.customer.nom_complet}</Text>
                    </View>
                  )}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardTotal}>{formatPrice(order.total_amount)} FCFA</Text>
                    <Text style={styles.cardDate}>
                      {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <View style={styles.emptySection}>
                <Package color="#ccc" size={36} />
                <Text style={styles.emptySectionText}>
                  {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || datePreset !== 'all'
                    ? 'Aucun resultat pour ces filtres'
                    : 'Aucune commande produit'}
                </Text>
              </View>
            )}
          </>
        )}

        {tab === 'services' && (
          <>
            {pendingBookings.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={18} color="#c2410c" />
                  <Text style={styles.sectionTitleOrange}>A accepter ({pendingBookings.length})</Text>
                </View>
              </View>
            )}
            {filteredBookings.length > 0 ? filteredBookings.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.card, b.status === 'pending' && styles.cardPending]}
                onPress={() => setSelectedBooking(b)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.serviceName} numberOfLines={1}>{b.service?.name || 'Prestation'}</Text>
                  <BookingStatusBadge status={b.status} />
                </View>
                {b.customer && (
                  <View style={styles.customerRow}>
                    <Phone size={13} color="#666" />
                    <Text style={styles.customerText}>{b.customer.nom_complet} - {b.customer.contact}</Text>
                  </View>
                )}
                <View style={styles.bookingMeta}>
                  <Calendar size={14} color="#666" />
                  <Text style={styles.bookingMetaText}>{formatBookingDate(b.booking_date)}</Text>
                  <Text style={styles.bookingMetaTime}>{formatBookingTime(b.booking_time)}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardTotal}>{formatPrice(b.total_price)} FCFA</Text>
                  <PaymentStatusBadge status={b.payment_status} />
                </View>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptySection}>
                <Calendar color="#ccc" size={36} />
                <Text style={styles.emptySectionText}>
                  {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || datePreset !== 'all'
                    ? 'Aucun resultat pour ces filtres'
                    : 'Aucune reservation de prestation'}
                </Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {selectedBooking && (
        <VendorBookingDetailSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAction={handleBookingAction}
          vendorUserId={userId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyFull: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f5f5f5',
  },
  tabBtnActive: { backgroundColor: '#e8f5e9' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#999' },
  tabTextActive: { color: '#003f2f' },
  tabBadge: {
    backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  scrollView: { flex: 1, padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  cardPending: { borderColor: '#fed7aa', borderWidth: 1.5 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  orderNumber: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  serviceName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemThumb: { width: 30, height: 30, borderRadius: 6 },
  itemName: { flex: 1, fontSize: 13, color: '#333' },
  itemQty: { fontSize: 12, color: '#888', fontWeight: '600' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 4 },
  customerText: { fontSize: 13, color: '#666' },
  bookingMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 4 },
  bookingMetaText: { fontSize: 13, color: '#333' },
  bookingMetaTime: { fontSize: 13, color: '#003f2f', fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  cardTotal: { fontSize: 15, fontWeight: '700', color: '#003f2f' },
  cardDate: { fontSize: 12, color: '#aaa' },
  sectionBlock: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleOrange: { fontSize: 16, fontWeight: '700', color: '#c2410c' },
  emptySection: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptySectionText: { fontSize: 15, color: '#999', textAlign: 'center' },
});
