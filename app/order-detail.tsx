import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { X, Clock, CircleCheck as CheckCircle, Truck, MapPin, Package, Circle as XCircle, ChevronLeft, Send, ShieldCheck, Paperclip, Info, MessageCircle } from 'lucide-react-native';
import Constants from 'expo-constants';
import { supabase, invokeWithAuth } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { startConversation } from '@/lib/chatUtils';
import { getPaymentCallbackUrl, getMobileReturnUrl, getMobileCancelUrl, redirectToPayment } from '@/lib/paymentRedirect';
import {
  OrderDetail,
  DeliveryRequest,
  CancellationReason,
  formatPrice,
  formatDate,
  ORDER_STEPS,
  getOrderStepIndex,
  DELIVERY_STEPS,
  getDeliveryStepIndex,
  getDeliveryTimestamp,
  PAYMENT_STATUS_CONFIG,
  ORDER_STATUS_CONFIG,
  canCancelBeforePickup,
} from '@/components/order/OrderDetailConstants';
import { styles } from '@/components/order/OrderDetailStyles';
import TrackingMap from '@/components/tracking/TrackingMap';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [delivery, setDelivery] = useState<DeliveryRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReasons, setCancelReasons] = useState<CancellationReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [payingBalance, setPayingBalance] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [contactingDriver, setContactingDriver] = useState(false);
  const [contactingVendor, setContactingVendor] = useState(false);

  const handleContactDriver = useCallback(async () => {
    if (!user || !delivery?.driver_id || contactingDriver) return;
    setContactingDriver(true);
    try {
      const convoId = await startConversation(user.id, delivery.driver_id);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation. Veuillez reessayer.");
    } finally {
      setContactingDriver(false);
    }
  }, [user, delivery, contactingDriver, router]);

  const handleContactVendor = useCallback(async () => {
    if (!user || !order?.shop_id || contactingVendor) return;
    setContactingVendor(true);
    try {
      const { data: shop } = await supabase
        .from('shops')
        .select('owner_id')
        .eq('id', order.shop_id)
        .maybeSingle();
      if (!shop?.owner_id) {
        Alert.alert('Vendeur indisponible', 'Impossible de trouver le vendeur pour cette commande.');
        return;
      }
      const convoId = await startConversation(user.id, shop.owner_id);
      router.push(`/chat/${convoId}` as any);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation. Veuillez reessayer.");
    } finally {
      setContactingVendor(false);
    }
  }, [user, order, contactingVendor, router]);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, delivery_type,
          total_amount, advance_amount, advance_paid, balance_amount,
          delivery_fee, subtotal, created_at, shop_id, delivery_address_id,
          shop:shops(id, name, logo_url, contact_phone, address, geolocation_lat, geolocation_lng),
          order_items(
            id, quantity, unit_price, total_price,
            product:products(id, name, main_media_url)
          ),
          delivery_address:delivery_addresses(id, label, address, city, geolocation_lat, geolocation_lng)
        `)
        .eq('id', id as string)
        .maybeSingle();

      if (error) throw error;
      setOrder(data as any);

      const { data: deliveryData } = await supabase
        .from('delivery_requests')
        .select(`
          id, status, driver_id, driver_earnings, is_return,
          assigned_at, started_at, picked_up_at, delivered_at,
          arrived_at_client_at, en_route_client_at, created_at,
          zone_id, pickup_point, pickup_points, delivery_point, total_distance_meters
        `)
        .eq('order_id', id as string)
        .eq('is_return', false)
        .maybeSingle();

      setDelivery(deliveryData as any);
    } catch (err) {
      console.error('Error loading order detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadCancelReasons = useCallback(async () => {
    const { data } = await supabase
      .from('cancellation_reasons')
      .select('id, label')
      .eq('is_active', true)
      .order('display_order');
    setCancelReasons((data as any) || []);
  }, []);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!id) return;

    const ordersChannel = supabase
      .channel(`order-detail-orders-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => { loadOrder(); }
      )
      .subscribe();

    const deliveryChannel = supabase
      .channel(`order-detail-delivery-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'delivery_requests', filter: `order_id=eq.${id}` },
        () => { loadOrder(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(deliveryChannel);
    };
  }, [id, loadOrder]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  const openCancelModal = useCallback(() => {
    loadCancelReasons();
    setSelectedReasonId(null);
    setCancelError(null);
    setAttachmentUri(null);
    setCancelModalVisible(true);
  }, [loadCancelReasons]);

  const handleCancelOrder = useCallback(async () => {
    if (!order || !user || !selectedReasonId) return;
    setCancelling(true);
    setCancelError(null);

    const deliveryStatus = delivery?.status ?? null;
    const isBeforePickup = canCancelBeforePickup(order.status, deliveryStatus);
    const isDriverArrived = deliveryStatus === 'arrived';

    try {
      if (!isBeforePickup && !isDriverArrived) {
        setCancelError("Cette commande ne peut plus être annulée.");
        setCancelling(false);
        return;
      }

      if (isDriverArrived && delivery) {
        const { error: cancellationError } = await supabase
          .from('cancellations')
          .insert({
            order_id: order.id,
            cancelled_by: user.id,
            canceller_role: 'client',
            reason_id: selectedReasonId,
            status_at_cancellation: order.status,
            refund_amount: 0,
            delivery_fee_kept: true,
            requires_return: true,
            attachment_url: attachmentUri || null,
          });

        if (cancellationError) throw cancellationError;

        const { data: origDelivery } = await supabase
          .from('delivery_requests')
          .select('id, driver_id, driver_earnings, pickup_point, pickup_points, delivery_point, total_distance_meters, zone_id')
          .eq('order_id', order.id)
          .eq('is_return', false)
          .maybeSingle();

        if (origDelivery && origDelivery.driver_id) {
          const vendorPoint = origDelivery.pickup_point || origDelivery.pickup_points?.[0];
          await supabase.from('delivery_requests').insert({
            order_id: order.id,
            zone_id: origDelivery.zone_id || null,
            driver_id: origDelivery.driver_id,
            status: 'assigned',
            is_return: true,
            return_status: 'en_route_vendor',
            original_delivery_id: origDelivery.id,
            pickup_point: origDelivery.delivery_point || null,
            pickup_points: origDelivery.delivery_point ? [origDelivery.delivery_point] : [],
            delivery_point: vendorPoint || null,
            total_distance_meters: origDelivery.total_distance_meters || 0,
            delivery_fee: 0,
            driver_earnings: 0,
            assigned_at: new Date().toISOString(),
          });

        }

        await supabase
          .from('delivery_requests')
          .update({ status: 'cancelled' })
          .eq('id', delivery.id);

        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id);

        if (orderUpdateError) throw orderUpdateError;
      } else {
        const { data: cancellationData, error: cancellationError } = await supabase
          .from('cancellations')
          .insert({
            order_id: order.id,
            cancelled_by: user.id,
            canceller_role: 'client',
            reason_id: selectedReasonId,
            status_at_cancellation: order.status,
            refund_amount: order.advance_amount || 0,
            delivery_fee_kept: false,
            requires_return: false,
            attachment_url: attachmentUri || null,
          })
          .select('id')
          .single();

        if (cancellationError) throw cancellationError;

        if (delivery) {
          await supabase
            .from('delivery_requests')
            .update({ status: 'cancelled' })
            .eq('order_id', order.id)
            .eq('is_return', false);
        }

        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id);

        if (orderUpdateError) throw orderUpdateError;

        if (order.advance_amount && order.advance_amount > 0) {
          await supabase.from('refunds').insert({
            order_id: order.id,
            user_id: user.id,
            cancellation_id: cancellationData.id,
            amount: order.advance_amount,
            status: 'pending',
            refund_status: 'pending',
          });
        }
      }

      setCancelModalVisible(false);
      await loadOrder();
    } catch (err: any) {
      setCancelError(err.message || "Une erreur est survenue.");
    } finally {
      setCancelling(false);
    }
  }, [order, user, delivery, selectedReasonId, attachmentUri, loadOrder]);

  const handlePayBalance = useCallback(async () => {
    if (!order || !user || payingBalance) return;
    setPayingBalance(true);
    setPaymentError(null);

    try {
      const balanceRef = `BAL_${order.id.substring(0, 8)}_${Date.now()}`;
      const isWeb = Platform.OS === 'web';
      const returnUrl = isWeb ? getPaymentCallbackUrl(balanceRef) : getMobileReturnUrl(balanceRef);
      const cancelUrl = isWeb ? getPaymentCallbackUrl(balanceRef) : getMobileCancelUrl(balanceRef);

      const omBody = {
        action: 'initialize',
        payment_type: 'order_balance',
        amount: order.balance_amount,
        reference: balanceRef,
        related_id: order.id,
        metadata: {
          payment_type: 'order_balance',
          order_id: order.id,
          user_id: user.id,
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      };
      console.log('[OM initialize debug]', {
        bodyKeys: Object.keys(omBody),
        payment_type: omBody.payment_type,
        return_url: omBody.return_url,
        cancel_url: omBody.cancel_url,
      });
      const { data: result, error: invokeError } = await invokeWithAuth('orange-money-payment', omBody);
      console.log('[OM initialize response]', {
        hasPaymentUrl: !!result?.payment_url,
        hasOrderId: !!result?.order_id,
        hasPayToken: !!result?.pay_token,
        error: invokeError?.message,
      });

      if (invokeError) throw new Error(invokeError.message || 'Erreur de paiement');

      if (result.payment_url) {
        const effectiveRef = result.order_id || result.reference || balanceRef;

        if (isWeb) {
          redirectToPayment(result.payment_url);
          return;
        }

        router.push({
          pathname: '/payment-webview',
          params: {
            url: result.payment_url,
            reference: effectiveRef,
            amount: String(order.balance_amount),
            paymentMode: 'balance',
            orderId: order.id,
            payToken: result.pay_token,
          },
        });
      } else {
        setPaymentError(result.error || "Impossible d'initialiser le paiement.");
      }
    } catch (err: any) {
      setPaymentError(err.message || "Erreur lors de l'initialisation du paiement.");
    } finally {
      setPayingBalance(false);
    }
  }, [order, user, payingBalance, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Commande introuvable.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const orderStatusConfig = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.pending;
  const paymentStatusConfig = PAYMENT_STATUS_CONFIG[order.payment_status] || PAYMENT_STATUS_CONFIG.pending;
  const currentOrderStep = getOrderStepIndex(order.status);
  const deliveryStepIndex = delivery ? getDeliveryStepIndex(delivery.status) : -1;
  const deliveryStatus = delivery?.status ?? null;
  const isArrived = deliveryStatus === 'arrived' && order.status !== 'cancelled' && order.status !== 'delivered' && order.payment_status !== 'paid';
  const isArrivedCancel = deliveryStatus === 'arrived' && order.status !== 'cancelled' && order.status !== 'delivered';
  const showCancelButton =
    order.status !== 'cancelled' &&
    order.status !== 'delivered' &&
    (canCancelBeforePickup(order.status, deliveryStatus) || isArrivedCancel);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }}>
          <ChevronLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Commande {order.order_number}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.statusBadgeRow}>
          <View style={[styles.badge, { backgroundColor: orderStatusConfig.bg }]}>
            <Text style={[styles.badgeText, { color: orderStatusConfig.color }]}>
              {orderStatusConfig.label}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: paymentStatusConfig.bg }]}>
            <Text style={[styles.badgeText, { color: paymentStatusConfig.color }]}>
              {paymentStatusConfig.label}
            </Text>
          </View>
          {order.delivery_type === 'delivery' && (
            <View style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
              <Truck color="#64748b" size={12} />
              <Text style={[styles.badgeText, { color: '#64748b' }]}>Livraison</Text>
            </View>
          )}
        </View>

        {order.status !== 'cancelled' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suivi de votre commande</Text>
            <View style={styles.progressBar}>
              {ORDER_STEPS.map((step, index) => {
                const isCompleted = index < currentOrderStep;
                const isActive = index === currentOrderStep;
                const isLast = index === ORDER_STEPS.length - 1;
                return (
                  <View key={step.key} style={styles.progressStep}>
                    <View style={[
                      styles.progressCircle,
                      isCompleted && styles.progressCircleCompleted,
                      isActive && styles.progressCircleActive,
                    ]}>
                      {isCompleted ? (
                        <CheckCircle color="#fff" size={16} />
                      ) : isActive ? (
                        <Clock color="#fff" size={16} />
                      ) : (
                        <View style={styles.progressCircleInner} />
                      )}
                    </View>
                    <Text style={[
                      styles.progressLabel,
                      isActive && styles.progressLabelActive,
                      isCompleted && styles.progressLabelCompleted,
                    ]}>
                      {step.label}
                    </Text>
                    {!isLast && (
                      <View style={[styles.progressLine, isCompleted && styles.progressLineCompleted]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {order.status === 'cancelled' && (
          <View style={styles.cancelledBanner}>
            <XCircle color="#ef4444" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cancelledBannerTitle}>Commande annulee</Text>
              <Text style={styles.cancelledBannerText}>
                Cette commande a ete annulee. Aucune livraison n'est en cours.
              </Text>
            </View>
          </View>
        )}

        {delivery && order.status !== 'cancelled' && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Truck color="#333" size={18} />
              <Text style={styles.sectionTitle}>Suivi de livraison</Text>
            </View>
            <View style={styles.deliverySteps}>
              {DELIVERY_STEPS.map((step, index) => {
                const isActive = index === deliveryStepIndex;
                const isCompleted = index < deliveryStepIndex;
                const StepIcon = step.Icon;
                const timestamp = isCompleted || isActive ? getDeliveryTimestamp(step.key, delivery) : null;
                return (
                  <View key={step.key} style={[styles.deliveryStep, isActive && styles.deliveryStepActive]}>
                    <View style={[
                      styles.deliveryStepIcon,
                      isActive && styles.deliveryStepIconActive,
                      isCompleted && styles.deliveryStepIconCompleted,
                    ]}>
                      <StepIcon
                        color={isActive ? '#fff' : isCompleted ? '#003f2f' : '#aaa'}
                        size={16}
                      />
                    </View>
                    <View style={styles.deliveryStepContent}>
                      <Text style={[
                        styles.deliveryStepLabel,
                        isActive && styles.deliveryStepLabelActive,
                        isCompleted && styles.deliveryStepLabelCompleted,
                      ]}>
                        {step.label}
                      </Text>
                      {isActive && step.subtitle && (
                        <Text style={styles.deliveryStepSubtitle}>{step.subtitle}</Text>
                      )}
                    </View>
                    {timestamp && (
                      <Text style={styles.deliveryStepTime}>{timestamp}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {delivery && ['in_progress', 'picked_up', 'en_route_client', 'arrived'].includes(delivery.status) && (
          <TrackingMap
            referenceId={delivery.id}
            referenceType="delivery"
            destinationLat={order.delivery_address?.geolocation_lat ?? undefined}
            destinationLng={order.delivery_address?.geolocation_lng ?? undefined}
          />
        )}

        {order.delivery_address && (
          <View style={styles.section}>
            <Text style={styles.addressLabel}>{order.delivery_address.label}</Text>
            <View style={styles.addressRow}>
              <MapPin color="#888" size={14} />
              <Text style={styles.addressText}>
                {order.delivery_address.address}
                {order.delivery_address.city ? `, ${order.delivery_address.city}` : ''}
              </Text>
            </View>
          </View>
        )}

        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <View style={styles.contactBtnsRow}>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={handleContactVendor}
                disabled={contactingVendor}
              >
                {contactingVendor ? (
                  <ActivityIndicator size="small" color="#003f2f" />
                ) : (
                  <>
                    <MessageCircle color="#003f2f" size={16} />
                    <Text style={styles.contactBtnText}>Contacter le vendeur</Text>
                  </>
                )}
              </TouchableOpacity>
              {delivery && delivery.driver_id && !['delivered', 'cancelled'].includes(delivery.status) && (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={handleContactDriver}
                  disabled={contactingDriver}
                >
                  {contactingDriver ? (
                    <ActivityIndicator size="small" color="#003f2f" />
                  ) : (
                    <>
                      <MessageCircle color="#003f2f" size={16} />
                      <Text style={styles.contactBtnText}>Contacter le livreur</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {isArrived && (
          <View style={styles.arrivedSection}>
            <View style={styles.arrivedBanner}>
              <Info color="#0369a1" size={18} />
              <Text style={styles.arrivedBannerText}>
                Le livreur est arrivé. Vérifiez votre colis et payez le solde pour finaliser la livraison.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.payBalanceBtn, payingBalance && styles.payBalanceBtnDisabled]}
              onPress={handlePayBalance}
              disabled={payingBalance}
            >
              {payingBalance ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <ShieldCheck color="#fff" size={18} />
                  <Text style={styles.payBalanceBtnText}>
                    Vérifier et payer le solde ({formatPrice(order.balance_amount)} FCFA)
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {paymentError && (
              <View style={styles.paymentErrorBox}>
                <Text style={styles.paymentErrorText}>{paymentError}</Text>
              </View>
            )}
          </View>
        )}

        {showCancelButton && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.cancelButton} onPress={openCancelModal}>
              <XCircle color="#ef4444" size={18} />
              <Text style={styles.cancelButtonText}>Annuler la commande</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produits ({order.order_items.length})</Text>
          {order.order_items.map((item) => (
            <View key={item.id} style={styles.productRow}>
              {item.product?.main_media_url ? (
                <Image
                  source={{ uri: item.product.main_media_url }}
                  style={styles.productThumb}
                />
              ) : (
                <View style={[styles.productThumb, styles.productThumbPlaceholder]}>
                  <Package color="#ccc" size={20} />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.product?.name || 'Produit'}
                </Text>
                <Text style={styles.productQty}>x{item.quantity}</Text>
              </View>
              <Text style={styles.productPrice}>{formatPrice(item.total_price)} FCFA</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total produits</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal)} FCFA</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de livraison</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.delivery_fee || 0)} FCFA</Text>
          </View>
          {(order.advance_paid || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>Acompte payé</Text>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                {formatPrice(order.advance_paid)} FCFA
              </Text>
            </View>
          )}
          {(order.balance_amount || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#e67e22', fontWeight: '700' }]}>
                Solde à payer à la livraison
              </Text>
              <Text style={[styles.summaryValue, { color: '#e67e22', fontWeight: '700' }]}>
                {formatPrice(order.balance_amount)} FCFA
              </Text>
            </View>
          )}
          <Text style={styles.orderDateText}>
            Commandé le {formatDate(order.created_at)}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={cancelModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Annuler la commande</Text>
              <TouchableOpacity
                onPress={() => setCancelModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X color="#333" size={20} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Sélectionnez un motif d'annulation</Text>

            {isArrivedCancel && (
              <View style={styles.arrivedCancelWarning}>
                <Info color="#b45309" size={16} />
                <Text style={styles.arrivedCancelWarningText}>
                  Le livreur est deja arrive. L'acompte de {formatPrice(order.advance_amount || 0)} FCFA ne sera pas rembourse et le colis sera retourne au vendeur.
                </Text>
              </View>
            )}

            <ScrollView style={styles.reasonsList}>
              {cancelReasons.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonItem,
                    selectedReasonId === reason.id && styles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReasonId(reason.id)}
                >
                  <View style={[
                    styles.reasonRadio,
                    selectedReasonId === reason.id && styles.reasonRadioSelected,
                  ]}>
                    {selectedReasonId === reason.id && <View style={styles.reasonRadioDot} />}
                  </View>
                  <Text style={[
                    styles.reasonText,
                    selectedReasonId === reason.id && styles.reasonTextSelected,
                  ]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.attachmentBtn}
              onPress={async () => {
                try {
                  const DocumentPicker = require('expo-document-picker');
                  const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
                  if (!result.canceled && result.assets?.[0]) {
                    setAttachmentUri(result.assets[0].uri);
                  }
                } catch {}
              }}
            >
              <Paperclip color="#666" size={16} />
              <Text style={styles.attachmentBtnText}>
                {attachmentUri ? 'Pièce jointe ajoutée' : 'Ajouter une pièce jointe (optionnel)'}
              </Text>
            </TouchableOpacity>

            {cancelError && (
              <View style={styles.cancelErrorBox}>
                <Text style={styles.cancelErrorText}>{cancelError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.confirmCancelBtn,
                (!selectedReasonId || cancelling) && styles.confirmCancelBtnDisabled,
              ]}
              onPress={handleCancelOrder}
              disabled={!selectedReasonId || cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmCancelBtnText}>Confirmer l'annulation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
