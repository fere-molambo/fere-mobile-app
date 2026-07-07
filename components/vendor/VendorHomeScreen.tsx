import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import {
  Package,
  RotateCcw,
  CheckCircle,
  Clock,
  Truck,
  AlertTriangle,
  Store,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface ReturnDelivery {
  id: string;
  status: string;
  return_status: string;
  driver_id: string | null;
  order_id: string;
  created_at: string;
  pickup_points: any[] | null;
  pickup_point: any | null;
  order: {
    order_number: string;
    user_id: string;
    order_items: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      product: { name: string; main_media_url: string | null } | null;
    }>;
  } | null;
  driver: { nom_complet: string; contact: string } | null;
}

interface VendorOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  delivery_fee: number;
  created_at: string;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    product: { name: string; main_media_url: string | null } | null;
  }>;
}

interface VendorHomeScreenProps {
  userId: string;
}

function formatPrice(n: number) {
  return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, '\u00a0');
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RETURN_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  en_route_vendor: { label: 'En route', color: '#b45309', bg: '#fef3c7' },
  arrived_vendor: { label: 'Arrive - A confirmer', color: '#c2410c', bg: '#ffedd5' },
  returned: { label: 'Retourne', color: '#16a34a', bg: '#dcfce7' },
};

export default function VendorHomeScreen({ userId }: VendorHomeScreenProps) {
  const router = useRouter();
  const [shopIds, setShopIds] = useState<string[]>([]);
  const [pendingReturns, setPendingReturns] = useState<ReturnDelivery[]>([]);
  const [activeReturns, setActiveReturns] = useState<ReturnDelivery[]>([]);
  const [recentOrders, setRecentOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'returns' | 'orders'>('returns');

  const loadShops = useCallback(async () => {
    const { data } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', userId);
    const ids = (data || []).map((s) => s.id);
    setShopIds(ids);
    return ids;
  }, [userId]);

  const loadReturns = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const { data: orderIds } = await supabase
      .from('orders')
      .select('id')
      .in('shop_id', ids);

    if (!orderIds || orderIds.length === 0) {
      setPendingReturns([]);
      setActiveReturns([]);
      return;
    }

    const oids = orderIds.map((o) => o.id);

    const { data: returns } = await supabase
      .from('delivery_requests')
      .select(`
        id, status, return_status, driver_id, order_id, created_at,
        pickup_points, pickup_point,
        order:orders(
          order_number, user_id,
          order_items(id, quantity, unit_price, product:products(name, main_media_url))
        ),
        driver:profiles!delivery_requests_driver_id_fkey(nom_complet, contact)
      `)
      .in('order_id', oids)
      .eq('is_return', true)
      .order('created_at', { ascending: false });

    const allReturns = (returns || []) as unknown as ReturnDelivery[];
    setPendingReturns(allReturns.filter((r) => r.return_status === 'arrived_vendor'));
    setActiveReturns(allReturns.filter((r) => r.return_status !== 'arrived_vendor'));
  }, []);

  const loadOrders = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, total_amount, subtotal, delivery_fee, created_at,
        order_items(id, quantity, unit_price, product:products(name, main_media_url))
      `)
      .in('shop_id', ids)
      .order('created_at', { ascending: false })
      .limit(20);

    setRecentOrders((data || []) as unknown as VendorOrder[]);
  }, []);

  const loadAll = useCallback(async () => {
    const ids = await loadShops();
    await Promise.all([loadReturns(ids), loadOrders(ids)]);
    setLoading(false);
  }, [loadShops, loadReturns, loadOrders]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (shopIds.length === 0) return;

    const channel = supabase
      .channel(`vendor-returns-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_requests' },
        () => { loadReturns(shopIds); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shopIds, loadReturns]);

  const handleConfirmReturn = useCallback(async (deliveryId: string) => {
    setConfirmingId(deliveryId);
    try {
      const { error } = await supabase
        .from('delivery_requests')
        .update({
          return_status: 'returned',
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);

      if (error) throw error;
      await loadReturns(shopIds);
    } catch (err) {
      console.error('Error confirming return:', err);
    } finally {
      setConfirmingId(null);
    }
  }, [shopIds, loadReturns]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  if (shopIds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Store color="#ccc" size={48} />
        <Text style={styles.emptyTitle}>Aucune boutique</Text>
        <Text style={styles.emptyText}>
          Vous n'avez pas de boutique active associee a votre compte.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ma boutique</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'returns' && styles.tabBtnActive]}
          onPress={() => setTab('returns')}
        >
          <RotateCcw size={16} color={tab === 'returns' ? '#003f2f' : '#999'} />
          <Text style={[styles.tabText, tab === 'returns' && styles.tabTextActive]}>
            Retours
          </Text>
          {pendingReturns.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingReturns.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'orders' && styles.tabBtnActive]}
          onPress={() => setTab('orders')}
        >
          <Package size={16} color={tab === 'orders' ? '#003f2f' : '#999'} />
          <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>
            Commandes
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {tab === 'returns' && (
          <>
            {pendingReturns.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={18} color="#c2410c" />
                  <Text style={styles.sectionTitleOrange}>
                    A confirmer ({pendingReturns.length})
                  </Text>
                </View>
                {pendingReturns.map((ret) => (
                  <ReturnCard
                    key={ret.id}
                    delivery={ret}
                    onConfirm={() => handleConfirmReturn(ret.id)}
                    confirming={confirmingId === ret.id}
                  />
                ))}
              </View>
            )}

            {activeReturns.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  Historique des retours ({activeReturns.length})
                </Text>
                {activeReturns.map((ret) => (
                  <ReturnCard key={ret.id} delivery={ret} />
                ))}
              </View>
            )}

            {pendingReturns.length === 0 && activeReturns.length === 0 && (
              <View style={styles.emptySection}>
                <RotateCcw color="#ccc" size={36} />
                <Text style={styles.emptySectionText}>Aucun retour pour le moment</Text>
              </View>
            )}
          </>
        )}

        {tab === 'orders' && (
          <>
            {recentOrders.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Commandes recentes</Text>
                {recentOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onPress={() => router.push({ pathname: '/order-detail', params: { id: order.id } } as any)} />
                ))}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Package color="#ccc" size={36} />
                <Text style={styles.emptySectionText}>Aucune commande pour le moment</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function ReturnCard({
  delivery,
  onConfirm,
  confirming,
}: {
  delivery: ReturnDelivery;
  onConfirm?: () => void;
  confirming?: boolean;
}) {
  const statusConf = RETURN_STATUS_LABELS[delivery.return_status] || RETURN_STATUS_LABELS.en_route_vendor;
  const isPending = delivery.return_status === 'arrived_vendor';
  const items = delivery.order?.order_items || [];

  return (
    <View style={[styles.returnCard, isPending && styles.returnCardPending]}>
      <View style={styles.returnCardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusConf.color }]}>
            {statusConf.label}
          </Text>
        </View>
        {delivery.order?.order_number && (
          <Text style={styles.returnOrderNumber}>#{delivery.order.order_number}</Text>
        )}
      </View>

      {items.length > 0 && (
        <View style={styles.returnItems}>
          {items.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.returnItemRow}>
              {item.product?.main_media_url ? (
                <Image source={{ uri: item.product.main_media_url }} style={styles.returnItemThumb} />
              ) : (
                <View style={[styles.returnItemThumb, styles.returnItemThumbPlaceholder]}>
                  <Package color="#ccc" size={14} />
                </View>
              )}
              <Text style={styles.returnItemName} numberOfLines={1}>
                {item.product?.name || 'Produit'}
              </Text>
              <Text style={styles.returnItemQty}>x{item.quantity}</Text>
            </View>
          ))}
          {items.length > 3 && (
            <Text style={styles.returnItemsMore}>+{items.length - 3} autre(s)</Text>
          )}
        </View>
      )}

      {delivery.driver && (
        <View style={styles.driverRow}>
          <Truck size={14} color="#666" />
          <Text style={styles.driverText}>
            Livreur : {delivery.driver.nom_complet}
          </Text>
        </View>
      )}

      <Text style={styles.returnDate}>{formatDate(delivery.created_at)}</Text>

      {isPending && onConfirm && (
        <TouchableOpacity
          style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
          onPress={onConfirm}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <CheckCircle color="#fff" size={18} />
              <Text style={styles.confirmBtnText}>Confirmer la reception du retour</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function OrderCard({ order, onPress }: { order: VendorOrder; onPress: () => void }) {
  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'En attente', color: '#e67e22', bg: '#fef3c7' },
    confirmed: { label: 'Confirmee', color: '#3b82f6', bg: '#dbeafe' },
    preparing: { label: 'En preparation', color: '#ca8a04', bg: '#fef9c3' },
    shipped: { label: 'En livraison', color: '#0891b2', bg: '#cffafe' },
    delivered: { label: 'Livrée', color: '#16a34a', bg: '#dcfce7' },
    cancelled: { label: 'Annulée', color: '#ef4444', bg: '#fee2e2' },
  };
  const st = STATUS_MAP[order.status] || STATUS_MAP.pending;

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderCardHeader}>
        <Text style={styles.orderNumber}>#{order.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <View style={styles.orderCardItems}>
        {order.order_items.slice(0, 2).map((item) => (
          <Text key={item.id} style={styles.orderItemText} numberOfLines={1}>
            {item.quantity}x {item.product?.name || 'Produit'}
          </Text>
        ))}
        {order.order_items.length > 2 && (
          <Text style={styles.orderItemMore}>+{order.order_items.length - 2} autre(s)</Text>
        )}
      </View>
      <View style={styles.orderCardFooter}>
        <Text style={styles.orderTotal}>{formatPrice(order.total_amount)} FCFA</Text>
        <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  tabBtnActive: {
    backgroundColor: '#e8f5e9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#003f2f',
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  sectionBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  sectionTitleOrange: {
    fontSize: 16,
    fontWeight: '700',
    color: '#c2410c',
  },
  emptySection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptySectionText: {
    fontSize: 15,
    color: '#999',
  },
  returnCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  returnCardPending: {
    borderColor: '#fed7aa',
    borderWidth: 1.5,
  },
  returnCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  returnOrderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  returnItems: {
    gap: 6,
    marginBottom: 10,
  },
  returnItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  returnItemThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  returnItemThumbPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  returnItemName: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  returnItemQty: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  returnItemsMore: {
    fontSize: 12,
    color: '#888',
    marginLeft: 40,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  driverText: {
    fontSize: 13,
    color: '#666',
  },
  returnDate: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 10,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#003f2f',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  orderCardItems: {
    gap: 4,
    marginBottom: 10,
  },
  orderItemText: {
    fontSize: 13,
    color: '#555',
  },
  orderItemMore: {
    fontSize: 12,
    color: '#888',
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#003f2f',
  },
  orderDate: {
    fontSize: 12,
    color: '#aaa',
  },
});
