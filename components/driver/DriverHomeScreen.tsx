import React, { useState, useEffect, useCallback } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { DeliveryRequest, PendingPayout } from '@/types/database';
import AppHeader from '@/components/AppHeader';
import AvailableDeliveries from './AvailableDeliveries';
import ActiveDeliveries from './ActiveDeliveries';
import DeliveryHistory from './DeliveryHistory';
import DriverStatusBanner from './DriverStatusBanner';
import { ensureTrackingAlive, syncTracking } from '@/lib/trackingService';
import TrackingShareStatus from '@/components/tracking/TrackingShareStatus';
import { TRACKED_DELIVERY_STATUSES } from '@/components/order/OrderDetailConstants';

type DriverTab = 'available' | 'active' | 'history';

interface DriverHomeScreenProps {
  userId: string;
}

export default function DriverHomeScreen({ userId }: DriverHomeScreenProps) {
  const [activeTab, setActiveTab] = useState<DriverTab>('available');
  const [availableDeliveries, setAvailableDeliveries] = useState<DeliveryRequest[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryRequest[]>([]);
  const [historyDeliveries, setHistoryDeliveries] = useState<DeliveryRequest[]>([]);
  const [payouts, setPayouts] = useState<Record<string, PendingPayout>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      await Promise.all([fetchAvailable(), fetchActive(), fetchHistory()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Cle stable : la liste est rechargee a chaque rafraichissement, on ne
  // resynchronise que si l'ensemble des courses suivies change vraiment.
  const trackedKey = activeDeliveries
    .filter((d) => TRACKED_DELIVERY_STATUSES.includes(d.status))
    .map((d) => d.id)
    .sort()
    .join(',');

  // Le suivi vit ici, et non dans chaque carte de course : il doit continuer
  // quand le livreur change d'onglet ou ouvre Google Maps pour naviguer.
  // Attendre la fin du premier chargement, sinon la liste encore vide
  // couperait le suivi de toutes les courses au demarrage.
  useEffect(() => {
    if (!userId || loading) return;
    syncTracking(userId, 'driver', 'delivery', trackedKey ? trackedKey.split(',') : []);
  }, [userId, trackedKey, loading]);

  // Chien de garde : a chaque retour dans FERE, si le systeme a coupe le GPS
  // pendant que l'application etait en arriere-plan, on le relance.
  useEffect(() => {
    if (!userId || !trackedKey) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ensureTrackingAlive(userId);
    });
    return () => sub.remove();
  }, [userId, trackedKey]);

  useEffect(() => {
    const channel = supabase
      .channel(`driver-deliveries-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delivery_requests',
      }, (payload: any) => {
        if (payload.eventType === 'UPDATE' && payload.new.driver_id === userId) {
          fetchAll();
        }
        if (payload.eventType === 'INSERT') {
          if (payload.new.status === 'pending') {
            fetchAvailable();
          }
          if (payload.new.driver_id === userId) {
            fetchAll();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAll]);

  const fetchAvailable = async () => {
    const { data: driverZones } = await supabase
      .from('driver_zones')
      .select('zone_id')
      .eq('driver_id', userId)
      .eq('is_active', true);

    const zoneIds = driverZones?.map(z => z.zone_id) || [];

    let query = supabase
      .from('delivery_requests')
      .select('*, delivery_zones(name, city)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (zoneIds.length > 0) {
      query = query.or(`zone_id.in.(${zoneIds.join(',')}),zone_id.is.null`);
    } else {
      query = query.is('zone_id', null);
    }

    const { data } = await query;
    setAvailableDeliveries((data as DeliveryRequest[]) || []);
  };

  const fetchActive = async () => {
    const { data, error } = await supabase
      .from('delivery_requests')
      .select('*, delivery_zones(name, city), order:orders!order_id(order_number)')
      .eq('driver_id', userId)
      .in('status', TRACKED_DELIVERY_STATUSES)
      .order('created_at', { ascending: false });
    // Le suivi GPS se cale sur cette liste : une coupure reseau qui la viderait
    // arreterait le suivi de toutes les courses. On garde la liste precedente.
    if (error) {
      console.warn('[driver] courses actives non rafraichies:', error.message);
      return;
    }
    setActiveDeliveries((data as DeliveryRequest[]) || []);
  };

  const fetchHistory = async () => {
    const { data: history } = await supabase
      .from('delivery_requests')
      .select('*, delivery_zones(name, city), order:orders!order_id(order_number)')
      .eq('driver_id', userId)
      .in('status', ['delivered', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(50);

    const deliveries = (history as DeliveryRequest[]) || [];
    setHistoryDeliveries(deliveries);

    if (deliveries.length > 0) {
      const ids = deliveries.map(d => d.id);
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
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const tabs: { key: DriverTab; label: string; count: number }[] = [
    { key: 'available', label: 'Disponibles', count: availableDeliveries.length },
    { key: 'active', label: 'Actives', count: activeDeliveries.length },
    { key: 'history', label: 'Historique', count: historyDeliveries.length },
  ];

  return (
    <View style={styles.container}>
      <AppHeader hideCart notificationCount={0} />

      {/* Sans ce bandeau, un livreur non valide voit simplement une liste vide
          sans comprendre pourquoi : les courses lui sont masquees cote base. */}
      <DriverStatusBanner userId={userId} />

      {/* Visible tant qu'une course est suivie : une panne d'envoi du GPS ne
          doit plus passer inapercue. */}
      {trackedKey ? <TrackingShareStatus trackerId={userId} /> : null}

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.countBadge, activeTab === tab.key && styles.countBadgeActive]}>
                <Text style={[styles.countText, activeTab === tab.key && styles.countTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#003f2f" />
        }
      >
        {activeTab === 'available' && (
          <AvailableDeliveries
            deliveries={availableDeliveries}
            loading={loading}
            userId={userId}
            onRefresh={fetchAll}
          />
        )}
        {activeTab === 'active' && (
          <ActiveDeliveries
            deliveries={activeDeliveries}
            loading={loading}
            userId={userId}
            onUpdate={fetchAll}
          />
        )}
        {activeTab === 'history' && (
          <DeliveryHistory
            deliveries={historyDeliveries}
            payouts={payouts}
            loading={loading}
            userId={userId}
          />
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
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
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#003f2f',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  countBadge: {
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  countTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
});
