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
import { Package, Clock, CircleCheck as CheckCircle, Truck, Circle as XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SettingsSubHeader from '@/components/SettingsSubHeader';

function formatPrice(n: number) {
  return n.toLocaleString('fr-FR').replace(/\s/g, ' ');
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'En attente', color: '#e67e22', bg: '#fef3c7', icon: Clock },
  confirmed: { label: 'Confirmée', color: '#3b82f6', bg: '#dbeafe', icon: CheckCircle },
  preparing: { label: 'En préparation', color: '#8b5cf6', bg: '#ede9fe', icon: Package },
  shipped: { label: 'En livraison', color: '#0891b2', bg: '#cffafe', icon: Truck },
  delivered: { label: 'Livrée', color: '#16a34a', bg: '#dcfce7', icon: CheckCircle },
  cancelled: { label: 'Annulée', color: '#ef4444', bg: '#fee2e2', icon: XCircle },
};

export default function OrdersSettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, total_amount,
          advance_amount, advance_paid, balance_amount, created_at,
          shop:shops(id, name, logo_url),
          order_items(id, quantity, total_price,
            product:products(id, name, main_media_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
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

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Commandes" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Package color="#003f2f" size={40} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Aucune commande</Text>
          <Text style={styles.emptySubtitle}>
            Retrouvez ici l'historique et le suivi de toutes vos commandes passées sur Fere.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} colors={['#003f2f']} />}
        >
          {orders.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;

            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/order-detail?id=${order.id}` as any)}
              >
                <View style={styles.orderHeader}>
                  <View style={styles.shopRow}>
                    {order.shop?.logo_url && (
                      <Image source={{ uri: order.shop.logo_url }} style={styles.shopLogo} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shopName}>{order.shop?.name || 'Boutique'}</Text>
                      <Text style={styles.dateText}>{formatDate(order.created_at)}</Text>
                    </View>
                  </View>
                  <View style={[styles.badge, { backgroundColor: config.bg }]}>
                    <StatusIcon color={config.color} size={12} />
                    <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.totalAmount}>{formatPrice(order.total_amount)} FCFA</Text>
                  <Text style={styles.orderNumber}>#{order.order_number.slice(-8)}</Text>
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
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e8f3f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  shopLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: '#003f2f',
  },
  orderNumber: {
    fontSize: 12,
    color: '#999',
  },
});
