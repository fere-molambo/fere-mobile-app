import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { Package, Clock, CircleCheck as CheckCircle, Truck, Circle as XCircle, Search, ArrowUpDown, MessageCircle, Calendar } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import DriverEarningsScreen from '@/components/driver/DriverEarningsScreen';
import { startConversation } from '@/lib/chatUtils';
import BookingStatusBadge from '@/components/BookingStatusBadge';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import { formatBookingDate, formatBookingTime, formatPrice as formatBookingPrice } from '@/lib/bookingUtils';
import type { BookingStatus, BookingPaymentStatus } from '@/types/database';

interface OrderWithShop {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  advance_amount: number;
  advance_paid: number;
  balance_amount: number;
  delivery_fee: number;
  subtotal: number;
  created_at: string;
  shop: { id: string; name: string; logo_url: string | null } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product: { id: string; name: string; main_media_url: string | null } | null;
  }>;
}

type SortOption = 'recent' | 'oldest' | 'amount_desc' | 'amount_asc';
type ActiveTab = 'ongoing' | 'completed';

const ONGOING_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'in_transit'];
const COMPLETED_STATUSES = ['delivered', 'cancelled'];

function formatPrice(n: number) {
  return n.toLocaleString('fr-FR').replace(/\s/g, ' ');
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'En attente', color: '#e67e22', bg: '#fef3c7', icon: Clock },
  confirmed: { label: 'Confirmée', color: '#3b82f6', bg: '#dbeafe', icon: CheckCircle },
  preparing: { label: 'En préparation', color: '#2d6a4f', bg: '#d8f3dc', icon: Package },
  shipped: { label: 'En livraison', color: '#0891b2', bg: '#cffafe', icon: Truck },
  in_transit: { label: 'En livraison', color: '#0891b2', bg: '#cffafe', icon: Truck },
  delivered: { label: 'Livrée', color: '#16a34a', bg: '#dcfce7', icon: CheckCircle },
  cancelled: { label: 'Annulée', color: '#ef4444', bg: '#fee2e2', icon: XCircle },
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'oldest', label: 'Plus anciennes' },
  { value: 'amount_desc', label: 'Montant décroissant' },
  { value: 'amount_asc', label: 'Montant croissant' },
];

interface BookingListItem {
  id: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  total_price: number;
  travel_fee: number;
  created_at: string;
  service: { name: string; main_media_url: string | null; shop: { name: string } | null } | null;
}

type SectionTab = 'products' | 'services';

export default function OrdersScreen() {
  const { user, userRole } = useAuth();
  const router = useRouter();

  if (userRole === 'livreur' && user) {
    return <DriverEarningsScreen userId={user.id} />;
  }

  if ((userRole === 'vendeur' || userRole === 'equipe') && user) {
    const VendorEarningsScreen = require('@/components/vendor/VendorEarningsScreen').default;
    return <VendorEarningsScreen userId={user.id} userRole={userRole} />;
  }

  const [sectionTab, setSectionTab] = useState<string>('products');
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  useEffect(() => {
    if (sectionTab !== 'services' || !user) return;
    loadBookings();
  }, [sectionTab, user]);

  const loadBookings = async () => {
    if (!user) return;
    setBookingsLoading(true);
    const { data } = await supabase
      .from('service_bookings')
      .select(`
        id, service_id, booking_date, booking_time, status, payment_status,
        total_price, travel_fee, created_at,
        service:services(name, main_media_url, shop:shops(name))
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    setBookings((data || []) as unknown as BookingListItem[]);
    setBookingsLoading(false);
  };

  useEffect(() => {
    if (sectionTab !== 'services' || !user) return;
    const channel = supabase
      .channel(`user-bookings-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_bookings', filter: `customer_id=eq.${user.id}` },
        () => { loadBookings(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sectionTab, user]);

  const [orders, setOrders] = useState<OrderWithShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ongoing');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [contactingVendor, setContactingVendor] = useState<Record<string, boolean>>({});
  const [contactingDriver, setContactingDriver] = useState<Record<string, boolean>>({});
  const [contactingAdmin, setContactingAdmin] = useState<Record<string, boolean>>({});

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, total_amount,
          advance_amount, advance_paid, balance_amount, delivery_fee,
          subtotal, created_at,
          shop:shops(id, name, logo_url),
          order_items(id, quantity, unit_price, total_price,
            product:products(id, name, main_media_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-orders-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => { loadOrders(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleContactVendor = useCallback(async (orderId: string, shopId: string | undefined) => {
    if (!user || !shopId || contactingVendor[orderId]) return;
    setContactingVendor((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { data: shop } = await supabase
        .from('shops')
        .select('owner_id')
        .eq('id', shopId)
        .maybeSingle();
      if (!shop?.owner_id) {
        Alert.alert('Vendeur indisponible', 'Impossible de trouver le vendeur pour cette commande.');
        return;
      }
      const convoId = await startConversation(user.id, shop.owner_id);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation. Veuillez réessayer.");
    } finally {
      setContactingVendor((prev) => ({ ...prev, [orderId]: false }));
    }
  }, [user, contactingVendor, router]);

  const handleContactDriver = useCallback(async (orderId: string) => {
    if (!user || contactingDriver[orderId]) return;
    setContactingDriver((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { data: delivery } = await supabase
        .from('delivery_requests')
        .select('driver_id')
        .eq('order_id', orderId)
        .not('driver_id', 'is', null)
        .maybeSingle();
      if (!delivery?.driver_id) {
        Alert.alert('Livreur indisponible', 'Aucun livreur assigne pour le moment.');
        return;
      }
      const convoId = await startConversation(user.id, delivery.driver_id);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation. Veuillez réessayer.");
    } finally {
      setContactingDriver((prev) => ({ ...prev, [orderId]: false }));
    }
  }, [user, contactingDriver, router]);

  const handleContactAdmin = useCallback(async (orderId: string) => {
    if (!user || contactingAdmin[orderId]) return;
    setContactingAdmin((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { data: adminIdResult } = await supabase.rpc('get_support_admin_id');
      const adminId = adminIdResult as string | null;
      if (!adminId) {
        Alert.alert('Admin indisponible', "Aucun administrateur n'est disponible pour le moment.");
        return;
      }
      const convoId = await startConversation(user.id, adminId);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation. Veuillez réessayer.");
    } finally {
      setContactingAdmin((prev) => ({ ...prev, [orderId]: false }));
    }
  }, [user, contactingAdmin, router]);

  const filteredAndSorted = useMemo(() => {
    const statusFilter = activeTab === 'ongoing' ? ONGOING_STATUSES : COMPLETED_STATUSES;
    let result = orders.filter((o) => statusFilter.includes(o.status));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((o) => {
        const shopMatch = o.shop?.name?.toLowerCase().includes(q);
        const productMatch = o.order_items.some((i) => i.product?.name?.toLowerCase().includes(q));
        const numberMatch = o.order_number.toLowerCase().includes(q);
        return shopMatch || productMatch || numberMatch;
      });
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'amount_desc') return b.total_amount - a.total_amount;
      if (sortBy === 'amount_asc') return a.total_amount - b.total_amount;
      return 0;
    });

    return result;
  }, [orders, activeTab, searchQuery, sortBy]);

  const ongoingCount = useMemo(() => orders.filter((o) => ONGOING_STATUSES.includes(o.status)).length, [orders]);
  const completedCount = useMemo(() => orders.filter((o) => COMPLETED_STATUSES.includes(o.status)).length, [orders]);

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      </View>
    );
  }

  if (sectionTab === 'services') {
    const currentTab = sectionTab as string;
    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.topSection}>
          <View style={styles.sectionTabs}>
            <TouchableOpacity
              style={[styles.sectionTab, currentTab === 'products' && styles.sectionTabActive]}
              onPress={() => setSectionTab('products')}
            >
              <Package size={16} color={currentTab === 'products' ? '#003f2f' : '#999'} />
              <Text style={[styles.sectionTabText, currentTab === 'products' && styles.sectionTabTextActive]}>Produits</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sectionTab, currentTab === 'services' && styles.sectionTabActive]}
              onPress={() => setSectionTab('services')}
            >
              <Calendar size={16} color={currentTab === 'services' ? '#003f2f' : '#999'} />
              <Text style={[styles.sectionTabText, currentTab === 'services' && styles.sectionTabTextActive]}>Prestations</Text>
            </TouchableOpacity>
          </View>
        </View>

        {bookingsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003f2f" />
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar color="#d0d0d0" size={64} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Aucune réservation</Text>
            <Text style={styles.emptyText}>Vos réservations de prestations apparaitront ici</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {bookings.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.orderCard}
                onPress={() => router.push({ pathname: '/booking-detail', params: { id: b.id } } as any)}
              >
                <View style={styles.orderHeader}>
                  <View style={styles.orderShopRow}>
                    {b.service?.main_media_url ? (
                      <Image source={{ uri: b.service.main_media_url }} style={styles.shopLogo} />
                    ) : (
                      <View style={styles.shopLogoPlaceholder}>
                        <Calendar color="#ccc" size={16} />
                      </View>
                    )}
                    <View style={styles.orderHeaderInfo}>
                      <Text style={styles.shopName} numberOfLines={1}>{b.service?.name || 'Prestation'}</Text>
                      <Text style={styles.orderDate}>{b.service?.shop?.name}</Text>
                    </View>
                  </View>
                  <BookingStatusBadge status={b.status} />
                </View>
                <View style={styles.bookingMeta}>
                  <Text style={styles.bookingDateText}>{formatBookingDate(b.booking_date)}</Text>
                  <Text style={styles.bookingTimeText}>{formatBookingTime(b.booking_time)}</Text>
                </View>
                <View style={styles.orderFooter}>
                  <View>
                    <Text style={styles.orderTotalLabel}>Total</Text>
                    <Text style={styles.orderTotalValue}>{formatBookingPrice(b.total_price)} FCFA</Text>
                  </View>
                  <PaymentStatusBadge status={b.payment_status} />
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />

      <View style={styles.topSection}>
        <View style={styles.sectionTabs}>
          <TouchableOpacity
            style={[styles.sectionTab, sectionTab === 'products' && styles.sectionTabActive]}
            onPress={() => setSectionTab('products')}
          >
            <Package size={16} color={sectionTab === 'products' ? '#003f2f' : '#999'} />
            <Text style={[styles.sectionTabText, sectionTab === 'products' && styles.sectionTabTextActive]}>Produits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionTab, sectionTab === 'services' && styles.sectionTabActive]}
            onPress={() => setSectionTab('services')}
          >
            <Calendar size={16} color={sectionTab === 'services' ? '#003f2f' : '#999'} />
            <Text style={[styles.sectionTabText, sectionTab === 'services' && styles.sectionTabTextActive]}>Prestations</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.pageTitle}>Mes commandes</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ongoing' && styles.tabActive]}
            onPress={() => setActiveTab('ongoing')}
          >
            <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>
              En cours
            </Text>
            {ongoingCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'ongoing' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'ongoing' && styles.tabBadgeTextActive]}>
                  {ongoingCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
              Terminées
            </Text>
            {completedCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'completed' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'completed' && styles.tabBadgeTextActive]}>
                  {completedCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search color="#999" size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par boutique, produit..."
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <XCircle color="#ccc" size={18} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.sortBtn, showSortMenu && styles.sortBtnActive]}
            onPress={() => setShowSortMenu((v) => !v)}
          >
            <ArrowUpDown color={showSortMenu ? '#fff' : '#003f2f'} size={18} />
          </TouchableOpacity>
        </View>

        {showSortMenu && (
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortMenuItem, sortBy === opt.value && styles.sortMenuItemActive]}
                onPress={() => { setSortBy(opt.value); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortMenuItemText, sortBy === opt.value && styles.sortMenuItemTextActive]}>
                  {opt.label}
                </Text>
                {sortBy === opt.value && (
                  <View style={styles.sortMenuItemDot} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {filteredAndSorted.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Package color="#d0d0d0" size={64} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'Aucun résultat' : activeTab === 'ongoing' ? 'Aucune commande en cours' : 'Aucune commande terminée'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery ? 'Essayez un autre terme de recherche' : activeTab === 'ongoing' ? 'Vos commandes actives apparaîtront ici' : 'Vos commandes livrées et annulées apparaîtront ici'}
          </Text>
          {!searchQuery && activeTab === 'ongoing' && (
            <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)/offers')}>
              <Text style={styles.browseBtnText}>Parcourir les offres</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#003f2f']} />}
        >
          {filteredAndSorted.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;

            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/order-detail?id=${order.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.orderHeader}>
                  <View style={styles.orderShopRow}>
                    {order.shop?.logo_url ? (
                      <Image source={{ uri: order.shop.logo_url }} style={styles.shopLogo} />
                    ) : (
                      <View style={styles.shopLogoPlaceholder}>
                        <Package color="#ccc" size={16} />
                      </View>
                    )}
                    <View style={styles.orderHeaderInfo}>
                      <Text style={styles.shopName}>{order.shop?.name || 'Boutique'}</Text>
                      <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                    <StatusIcon color={config.color} size={12} />
                    <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </View>

                <View style={styles.orderItems}>
                  {order.order_items.slice(0, 3).map((item) => (
                    <View key={item.id} style={styles.orderItemRow}>
                      {item.product?.main_media_url ? (
                        <Image source={{ uri: item.product.main_media_url }} style={styles.itemThumb} />
                      ) : (
                        <View style={styles.itemThumbPlaceholder} />
                      )}
                      <Text style={styles.orderItemName} numberOfLines={1}>
                        {item.product?.name || 'Produit'} x{item.quantity}
                      </Text>
                      <Text style={styles.orderItemPrice}>{formatPrice(item.total_price)} FCFA</Text>
                    </View>
                  ))}
                  {order.order_items.length > 3 && (
                    <Text style={styles.moreItemsText}>+{order.order_items.length - 3} autres articles</Text>
                  )}
                </View>

                <View style={styles.orderFooter}>
                  <View>
                    <Text style={styles.orderTotalLabel}>Total</Text>
                    <Text style={styles.orderTotalValue}>{formatPrice(order.total_amount)} FCFA</Text>
                  </View>
                  <View style={styles.paymentInfo}>
                    {order.payment_status === 'advance_paid' && (
                      <Text style={styles.paidText}>Acompte payé</Text>
                    )}
                    <Text style={styles.orderNumber}>#{order.order_number.slice(-8)}</Text>
                  </View>
                </View>

                <View style={styles.contactRow}>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={(e) => { e.stopPropagation?.(); handleContactVendor(order.id, order.shop?.id); }}
                    disabled={contactingVendor[order.id]}
                  >
                    {contactingVendor[order.id] ? (
                      <ActivityIndicator size="small" color="#003f2f" />
                    ) : (
                      <>
                        <MessageCircle size={13} color="#003f2f" />
                        <Text style={styles.contactBtnText}>Vendeur</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={(e) => { e.stopPropagation?.(); handleContactDriver(order.id); }}
                    disabled={contactingDriver[order.id]}
                  >
                    {contactingDriver[order.id] ? (
                      <ActivityIndicator size="small" color="#003f2f" />
                    ) : (
                      <>
                        <MessageCircle size={13} color="#003f2f" />
                        <Text style={styles.contactBtnText}>Livreur</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={(e) => { e.stopPropagation?.(); handleContactAdmin(order.id); }}
                    disabled={contactingAdmin[order.id]}
                  >
                    {contactingAdmin[order.id] ? (
                      <ActivityIndicator size="small" color="#003f2f" />
                    ) : (
                      <>
                        <MessageCircle size={13} color="#003f2f" />
                        <Text style={styles.contactBtnText}>Admin</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    zIndex: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 14,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 14,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#003f2f',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#e5e5e5',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    padding: 0,
  },
  sortBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#f0f7f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  sortBtnActive: {
    backgroundColor: '#003f2f',
    borderColor: '#003f2f',
  },
  sortMenu: {
    position: 'absolute',
    top: 130,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
    minWidth: 200,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  sortMenuItemActive: {
    backgroundColor: '#f0f7f5',
  },
  sortMenuItemText: {
    fontSize: 14,
    color: '#333',
  },
  sortMenuItemTextActive: {
    fontWeight: '700',
    color: '#003f2f',
  },
  sortMenuItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#003f2f',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  browseBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  browseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  shopLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  shopLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderHeaderInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderItems: {
    marginBottom: 12,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  itemThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  itemThumbPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    color: '#444',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  moreItemsText: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  orderTotalLabel: {
    fontSize: 12,
    color: '#999',
  },
  orderTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003f2f',
  },
  paymentInfo: {
    alignItems: 'flex-end',
  },
  paidText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 12,
    color: '#999',
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
    gap: 5,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#c8e6c9',
    borderRadius: 8,
    backgroundColor: '#f0f7f5',
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f2f',
  },
  sectionTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  sectionTabActive: {
    backgroundColor: '#e8f5e9',
  },
  sectionTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  sectionTabTextActive: {
    color: '#003f2f',
  },
  bookingMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  bookingDateText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  bookingTimeText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
});
