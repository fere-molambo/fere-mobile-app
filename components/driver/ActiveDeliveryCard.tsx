import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MapPin, Navigation, Phone, Package, Clock, CircleCheck as CheckCircle, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { DeliveryRequest, DeliveryStatus } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { formatDistance, formatEarnings, openGPSNavigation, callPhone, getNextAction } from '@/lib/driverUtils';
import { startConversation } from '@/lib/chatUtils';
import { sendNotificationToUser } from '@/lib/notificationService';
import DeliveryStatusBadge from './DeliveryStatusBadge';

const DELIVERY_NOTIFICATION_LABELS: Partial<Record<DeliveryStatus, string>> = {
  in_progress: 'Le livreur se dirige vers le point de collecte',
  picked_up: 'Votre colis a été recupere',
  en_route_client: 'Le livreur est en route vers vous',
  arrived: 'Le livreur est arrive a votre adresse',
};

interface VendorContact {
  vendor_id: string | null;
  shop_name: string | null;
  phone: string | null;
}

interface ActiveDeliveryCardProps {
  delivery: DeliveryRequest;
  userId: string;
  onUpdate: () => void;
}

export default function ActiveDeliveryCard({ delivery, userId, onUpdate }: ActiveDeliveryCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contactingClient, setContactingClient] = useState(false);
  const [contactingVendor, setContactingVendor] = useState(false);
  const [contactingAdmin, setContactingAdmin] = useState(false);
  const [vendorContact, setVendorContact] = useState<VendorContact | null>(null);

  // Le suivi GPS n'est plus lance ici mais dans DriverHomeScreen : une carte
  // qui disparait (changement d'onglet) coupait le suivi chez le vendeur.

  // Le livreur ne peut pas lire les commandes ni le profil du vendeur : une
  // RPC lui renvoie uniquement le nom, l'identifiant et le telephone du
  // vendeur de SA course. Sans elle, le bouton « Vendeur » ne faisait rien et
  // le numero n'apparaissait jamais.
  useEffect(() => {
    let cancelled = false;
    (supabase as any)
      .rpc('get_delivery_vendor_contact', { p_delivery_id: delivery.id })
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error) {
          console.warn('[driver] contact vendeur indisponible:', error.message);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setVendorContact(row as VendorContact);
      });
    return () => {
      cancelled = true;
    };
  }, [delivery.id]);

  const handleContactClient = useCallback(async () => {
    if (!delivery.order_id || contactingClient) return;
    setContactingClient(true);
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', delivery.order_id)
        .maybeSingle();
      if (!order?.user_id) return;
      const convoId = await startConversation(userId, order.user_id);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      console.error('Error contacting client:', err);
    } finally {
      setContactingClient(false);
    }
  }, [delivery.order_id, userId, contactingClient, router]);

  const handleContactVendor = useCallback(async () => {
    if (contactingVendor) return;
    setContactingVendor(true);
    try {
      let vendorId = vendorContact?.vendor_id;
      if (!vendorId) {
        const { data } = await (supabase as any).rpc('get_delivery_vendor_contact', {
          p_delivery_id: delivery.id,
        });
        const row = Array.isArray(data) ? data[0] : data;
        vendorId = row?.vendor_id;
      }
      if (!vendorId) {
        Alert.alert('Vendeur indisponible', 'Impossible de retrouver le vendeur de cette course.');
        return;
      }
      const convoId = await startConversation(userId, vendorId);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      console.error('Error contacting vendor:', err);
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation. Veuillez réessayer.");
    } finally {
      setContactingVendor(false);
    }
  }, [delivery.id, vendorContact, userId, contactingVendor, router]);

  const handleContactAdmin = useCallback(async () => {
    if (contactingAdmin) return;
    setContactingAdmin(true);
    try {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin'])
        .limit(1);
      const adminId = admins?.[0]?.user_id;
      if (!adminId) return;
      const convoId = await startConversation(userId, adminId);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      console.error('Error contacting admin:', err);
    } finally {
      setContactingAdmin(false);
    }
  }, [userId, contactingAdmin, router]);

  const nextAction = getNextAction(
    delivery.status,
    delivery.is_return,
    delivery.return_status ?? undefined
  );

  const handleAdvanceStatus = async () => {
    if (!nextAction) return;
    setLoading(true);
    try {
      const updates: Record<string, any> = { status: nextAction.nextStatus };
      if (nextAction.timestampField) {
        updates[nextAction.timestampField] = new Date().toISOString();
      }
      if (nextAction.nextReturnStatus) {
        updates.return_status = nextAction.nextReturnStatus;
      }

      const { error } = await supabase
        .from('delivery_requests')
        .update(updates)
        .eq('id', delivery.id)
        .eq('driver_id', userId);

      if (error) throw error;
      onUpdate();

      const notifLabel = DELIVERY_NOTIFICATION_LABELS[nextAction.nextStatus as DeliveryStatus];
      if (notifLabel && delivery.order_id) {
        supabase
          .from('orders')
          .select('user_id')
          .eq('id', delivery.order_id)
          .maybeSingle()
          .then(({ data: ord }) => {
            if (ord?.user_id) {
              sendNotificationToUser(ord.user_id, 'Livraison', notifLabel).catch(() => {});
            }
          });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre a jour le statut.');
    } finally {
      setLoading(false);
    }
  };

  const pickupPoints = delivery.pickup_points || (delivery.pickup_point ? [delivery.pickup_point] : []);
  const deliveryPoint = delivery.delivery_point;
  const showPickupNav = delivery.status === 'assigned' || delivery.status === 'in_progress';
  const showDeliveryNav = delivery.status === 'en_route_client' || delivery.status === 'picked_up';
  const isArrived = delivery.status === 'arrived';
  const isReturnArrived = delivery.is_return && delivery.status === 'arrived' && delivery.return_status === 'arrived_vendor';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <DeliveryStatusBadge
          status={delivery.status}
          isReturn={delivery.is_return}
          returnStatus={delivery.return_status ?? undefined}
        />
        {delivery.order?.order_number && (
          <Text style={styles.orderNumber}>#{delivery.order.order_number}</Text>
        )}
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Distance</Text>
          <Text style={styles.infoValue}>{formatDistance(delivery.total_distance_meters)}</Text>
        </View>
        {!delivery.is_return && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Gains</Text>
            <Text style={styles.infoValueGreen}>{formatEarnings(delivery.driver_earnings)}</Text>
          </View>
        )}
      </View>

      {pickupPoints.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Package size={16} color="#003f2f" />
            <Text style={styles.sectionTitle}>
              {delivery.is_return ? 'Retour au vendeur' : 'Points de collecte'}
            </Text>
          </View>
          {pickupPoints.map((point, idx) => (
            <View key={idx} style={styles.pointRow}>
              <View style={styles.pointInfo}>
                <Text style={styles.pointName}>{point.shop_name || point.name}</Text>
                <Text style={styles.pointAddress}>{point.address}</Text>
                {/* Affiche sur toutes les courses : c'est le recours du livreur
                    quand le GPS ne localise pas bien le point de retrait. Avant,
                    il n'apparaissait que sur une course retour. */}
                {(vendorContact?.phone || point.phone) && (
                  <TouchableOpacity
                    style={styles.phoneRow}
                    onPress={() => callPhone((vendorContact?.phone || point.phone)!)}
                  >
                    <Phone size={14} color="#003f2f" />
                    <Text style={styles.phoneText}>
                      Appeler le vendeur · {vendorContact?.phone || point.phone}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {(showPickupNav || delivery.is_return) && point.lat && point.lng && (
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => openGPSNavigation(point.lat, point.lng)}
                >
                  <Navigation size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {deliveryPoint && !delivery.is_return && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={16} color="#003f2f" />
            <Text style={styles.sectionTitle}>Point de livraison</Text>
          </View>
          <View style={styles.pointRow}>
            <View style={styles.pointInfo}>
              <Text style={styles.pointName}>{deliveryPoint.recipient_name}</Text>
              <Text style={styles.pointAddress}>{deliveryPoint.address}</Text>
              {deliveryPoint.recipient_phone && (
                <TouchableOpacity
                  style={styles.phoneRow}
                  onPress={() => callPhone(deliveryPoint.recipient_phone)}
                >
                  <Phone size={14} color="#003f2f" />
                  <Text style={styles.phoneText}>{deliveryPoint.recipient_phone}</Text>
                </TouchableOpacity>
              )}
            </View>
            {showDeliveryNav && deliveryPoint.lat && deliveryPoint.lng && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => openGPSNavigation(deliveryPoint.lat, deliveryPoint.lng)}
              >
                <Navigation size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {isArrived && !delivery.is_return && (
        <View style={styles.waitingBanner}>
          <Clock size={20} color="#92400e" />
          <View style={styles.waitingTextContainer}>
            <Text style={styles.waitingTitle}>En attente de verification par le client</Text>
            <Text style={styles.waitingMessage}>
              Le client doit verifier le colis et payer le solde via Orange Money. La livraison sera automatiquement marquee comme terminee.
            </Text>
          </View>
        </View>
      )}

      {isArrived && !delivery.is_return && (
        <View style={styles.earningsBanner}>
          <CheckCircle size={18} color="#065f46" />
          <Text style={styles.earningsText}>
            Vos gains : {formatEarnings(delivery.driver_earnings)}
          </Text>
        </View>
      )}

      {isReturnArrived && (
        <View style={styles.waitingBanner}>
          <Clock size={20} color="#92400e" />
          <View style={styles.waitingTextContainer}>
            <Text style={styles.waitingTitle}>En attente de confirmation du vendeur</Text>
            <Text style={styles.waitingMessage}>
              Le vendeur doit confirmer la reception du retour.
            </Text>
          </View>
        </View>
      )}

      {delivery.order_id && (
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={handleContactClient}
            disabled={contactingClient}
          >
            {contactingClient ? (
              <ActivityIndicator size="small" color="#003f2f" />
            ) : (
              <>
                <MessageCircle size={14} color="#003f2f" />
                <Text style={styles.contactBtnText}>Client</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={handleContactVendor}
            disabled={contactingVendor}
          >
            {contactingVendor ? (
              <ActivityIndicator size="small" color="#003f2f" />
            ) : (
              <>
                <MessageCircle size={14} color="#003f2f" />
                <Text style={styles.contactBtnText}>Vendeur</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={handleContactAdmin}
            disabled={contactingAdmin}
          >
            {contactingAdmin ? (
              <ActivityIndicator size="small" color="#003f2f" />
            ) : (
              <>
                <MessageCircle size={14} color="#003f2f" />
                <Text style={styles.contactBtnText}>Admin</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actions}>
        {nextAction && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAdvanceStatus}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>{nextAction.label}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  infoValueGreen: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003f2f',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  pointInfo: {
    flex: 1,
    marginRight: 10,
  },
  pointName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  pointAddress: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  phoneText: {
    fontSize: 13,
    color: '#003f2f',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#003f2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingBanner: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  waitingTextContainer: {
    flex: 1,
  },
  waitingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  waitingMessage: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
  },
  earningsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  earningsText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
  },
  actions: {
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#003f2f',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003f2f',
  },
});
