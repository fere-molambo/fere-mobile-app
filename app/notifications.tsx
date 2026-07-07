import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle, Package, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getConversations, formatRelativeTime, getLastMessagePreview, ConversationWithDetails } from '@/lib/chatUtils';
import { ORDER_STATUS_CONFIG } from '@/components/order/OrderDetailConstants';

interface OrderNotif {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [unreadConvos, setUnreadConvos] = useState<ConversationWithDetails[]>([]);
  const [orders, setOrders] = useState<OrderNotif[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const convos = await getConversations(user.id);
      setUnreadConvos(convos.filter((c) => c.unread_count > 0));

      let orderRows: OrderNotif[] = [];
      if (userRole === 'vendeur' || userRole === 'equipe') {
        const [{ data: shops }, { data: memberships }] = await Promise.all([
          supabase.from('shops').select('id').eq('owner_id', user.id),
          supabase.from('shop_team_members').select('shop_id').eq('user_id', user.id),
        ]);
        const shopIds = [
          ...(shops || []).map((s: any) => s.id),
          ...(memberships || []).map((m: any) => m.shop_id),
        ];
        if (shopIds.length > 0) {
          const { data } = await supabase
            .from('orders')
            .select('id, order_number, status, created_at')
            .in('shop_id', shopIds)
            .order('created_at', { ascending: false })
            .limit(15);
          orderRows = (data as any) || [];
        }
      } else {
        const { data } = await supabase
          .from('orders')
          .select('id, order_number, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15);
        orderRows = (data as any) || [];
      }
      setOrders(orderRows);
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [user, userRole]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color="#003f2f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#003f2f" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text style={styles.sectionTitle}>Messages non lus</Text>
          {unreadConvos.length === 0 ? (
            <Text style={styles.emptyText}>Aucun message non lu</Text>
          ) : (
            unreadConvos.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.row}
                onPress={() => router.push(`/chat/${c.id}` as any)}
              >
                {c.other_participant.photo_profil ? (
                  <Image source={{ uri: c.other_participant.photo_profil }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}><User size={18} color="#999" /></View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{c.other_participant.nom_complet}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{getLastMessagePreview(c.last_message)}</Text>
                </View>
                <View style={styles.rowRight}>
                  {c.last_message_at ? <Text style={styles.timeText}>{formatRelativeTime(c.last_message_at)}</Text> : null}
                  <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{c.unread_count}</Text></View>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.sectionTitle}>Commandes récentes</Text>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>Aucune commande</Text>
          ) : (
            orders.map((o) => {
              const cfg = (ORDER_STATUS_CONFIG as any)[o.status];
              return (
                <TouchableOpacity
                  key={o.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: '/order-detail', params: { id: o.id } } as any)}
                >
                  <View style={styles.orderIcon}><Package size={18} color="#003f2f" /></View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{o.order_number}</Text>
                    <Text style={styles.rowSub}>{cfg?.label || o.status}</Text>
                  </View>
                  <Text style={styles.timeText}>{formatRelativeTime(o.created_at)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  emptyText: { color: '#999', paddingHorizontal: 16, paddingVertical: 8, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f7f7f7',
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  orderIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#e8f3ef',
    justifyContent: 'center', alignItems: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  rowSub: { fontSize: 13, color: '#777', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  timeText: { fontSize: 11, color: '#999' },
  unreadBadge: {
    backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
