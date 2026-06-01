import React, { useState, useEffect, useCallback } from 'react';
import {
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

  useEffect(() => {
    const channel = supabase
      .channel('driver-deliveries')
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
    const { data } = await supabase
      .from('delivery_requests')
      .select('*, delivery_zones(name, city), order:orders!order_id(order_number)')
      .eq('driver_id', userId)
      .in('status', ['assigned', 'in_progress', 'picked_up', 'en_route_client', 'arrived'])
      .order('created_at', { ascending: false });
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
