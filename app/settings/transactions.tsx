import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { RotateCcw, Clock, CheckCircle, Package } from 'lucide-react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Refund {
  id: string;
  order_id: string | null;
  amount: number;
  net_refund: number;
  status: string;
  refund_status: string;
  created_at: string;
  processed_at: string | null;
  order: { order_number: string } | null;
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

export default function RefundsScreen() {
  const { user } = useAuth();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  const loadRefunds = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('refunds')
        .select(`
          id, order_id, amount, net_refund, status, refund_status,
          created_at, processed_at,
          order:orders(order_number)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefunds((data as any) || []);
    } catch (err) {
      console.error('Error loading refunds:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRefunds();
  }, [loadRefunds]);

  const pendingRefunds = refunds.filter(
    (r) => r.status === 'pending' || r.refund_status === 'pending'
  );
  const processedRefunds = refunds.filter(
    (r) => r.status !== 'pending' && r.refund_status !== 'pending'
  );

  const displayedRefunds = activeTab === 'pending' ? pendingRefunds : processedRefunds;

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
            Traités ({processedRefunds.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      ) : displayedRefunds.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <RotateCcw color="#003f2f" size={36} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === 'pending'
              ? 'Aucun remboursement en attente'
              : 'Aucun remboursement traité'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Les remboursements liés aux commandes annulées apparaîtront ici.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {displayedRefunds.map((refund) => (
            <View key={refund.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                  <Package color="#003f2f" size={18} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardOrderNumber}>
                    {refund.order?.order_number || 'Commande'}
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(refund.created_at)}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    refund.status === 'pending' || refund.refund_status === 'pending'
                      ? styles.statusPending
                      : styles.statusProcessed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      refund.status === 'pending' || refund.refund_status === 'pending'
                        ? styles.statusTextPending
                        : styles.statusTextProcessed,
                    ]}
                  >
                    {refund.status === 'pending' || refund.refund_status === 'pending'
                      ? 'En attente'
                      : 'Remboursé'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Montant</Text>
                  <Text style={styles.amountValue}>{formatPrice(refund.amount)} FCFA</Text>
                </View>
                {refund.net_refund > 0 && refund.net_refund !== refund.amount && (
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Remboursement net</Text>
                    <Text style={[styles.amountValue, { color: '#16a34a' }]}>
                      {formatPrice(refund.net_refund)} FCFA
                    </Text>
                  </View>
                )}
                {refund.processed_at && (
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Traité le</Text>
                    <Text style={styles.amountDate}>{formatDate(refund.processed_at)}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
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
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
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
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusProcessed: {
    backgroundColor: '#dcfce7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextPending: {
    color: '#e67e22',
  },
  statusTextProcessed: {
    color: '#16a34a',
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
});
