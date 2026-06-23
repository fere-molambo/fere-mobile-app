import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, MapPin, Phone, MessageCircle, CircleCheck as CheckCircle, Circle as XCircle, Truck, TriangleAlert as AlertTriangle, Calendar } from 'lucide-react-native';
import Constants from 'expo-constants';
import { supabase, invokeWithAuth } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BookingStatusBadge from '@/components/BookingStatusBadge';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import BookingCancellationModal from '@/components/modals/BookingCancellationModal';
import PartialPaymentModal from '@/components/modals/PartialPaymentModal';
import { startConversation } from '@/lib/chatUtils';
import {
  formatBookingDate,
  formatBookingTime,
  formatPrice,
} from '@/lib/bookingUtils';
import { generateOrderNumber } from '@/lib/orderCalculations';
import { getPaymentCallbackUrl, getMobileReturnUrl, getMobileCancelUrl, redirectToPayment } from '@/lib/paymentRedirect';
import type { ServiceBooking, BookingStatus, BookingPaymentStatus } from '@/types/database';
import TrackingMap from '@/components/tracking/TrackingMap';

const PROGRESS_STEPS: { key: BookingStatus; label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptee' },
  { key: 'on_the_way', label: 'En route' },
  { key: 'arrived', label: 'Sur place' },
  { key: 'completed', label: 'Terminee' },
];

function getStepIndex(status: BookingStatus): number {
  const idx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  if (status === 'partial') return 4;
  if (status === 'cancelled' || status === 'expired') return -1;
  return idx;
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [partialModalVisible, setPartialModalVisible] = useState(false);
  const [payingBalance, setPayingBalance] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('service_bookings')
      .select(`
        *,
        service:services(*, shop:shops(*)),
        customer:profiles!service_bookings_customer_id_fkey(id, nom_complet, contact, email, photo_profil),
        delivery_address:delivery_addresses(*),
        cancellation_reason:cancellation_reasons(label)
      `)
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setBooking(data as unknown as ServiceBooking);
      setPayingBalance(false);

      const shopOwnerId = (data as any).service?.shop?.owner_id;
      if (shopOwnerId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, nom_complet, contact, photo_profil')
          .eq('id', shopOwnerId)
          .maybeSingle();
        setVendorProfile(profile);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`booking-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_bookings', filter: `id=eq.${id}` },
        () => { loadBooking(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadBooking]);

  const handleContact = async () => {
    if (!user || !vendorProfile) return;
    try {
      const convoId = await startConversation(user.id, vendorProfile.id);
      router.push({ pathname: '/chat/[id]', params: { id: convoId } });
    } catch {}
  };

  const handleCancelBooking = async (data: { reasonId: string; comment: string; proofUrl?: string }) => {
    if (!booking || !user) return;
    const isArrived = booking.status === 'arrived';

    const { error: cancellationError } = await supabase.from('cancellations').insert({
      booking_id: booking.id,
      cancelled_by: user.id,
      canceller_role: 'client',
      reason_id: data.reasonId,
      custom_reason: data.comment || null,
      attachment_url: data.proofUrl || null,
      status_at_cancellation: booking.status,
      refund_amount: 0,
      penalty_amount: 0,
      delivery_fee_kept: isArrived,
    });

    if (cancellationError) throw cancellationError;

    await supabase
      .from('service_bookings')
      .update({
        status: 'cancelled',
        cancellation_reason_id: data.reasonId,
        cancellation_comment: data.comment,
        cancellation_proof_url: data.proofUrl || null,
      })
      .eq('id', booking.id);

    if (!isArrived && booking.travel_fee_paid && booking.advance_paid > 0) {
      await supabase.from('refunds').insert({
        booking_id: booking.id,
        user_id: user.id,
        amount: booking.advance_paid,
        net_refund: booking.advance_paid,
        original_payment_reference: booking.payment_reference,
        status: 'pending',
        refund_status: 'pending',
      });
    }

    setCancelModalVisible(false);
    loadBooking();
  };

  const launchBalancePayment = async (completionType: 'full' | 'partial') => {
    if (!booking || !user) return;
    setPayingBalance(true);
    setPaymentError(null);

    try {
      const payAmount = completionType === 'full'
        ? booking.total_price
        : Math.round(booking.total_price * 0.5);

      const paymentReference = generateOrderNumber();
      const isWeb = Platform.OS === 'web';
      const returnUrl = isWeb ? getPaymentCallbackUrl(paymentReference) : getMobileReturnUrl(paymentReference);
      const cancelUrl = isWeb ? getPaymentCallbackUrl(paymentReference) : getMobileCancelUrl(paymentReference);

      const omBody = {
        action: 'initialize',
        payment_type: 'service_booking',
        amount: payAmount,
        reference: paymentReference,
        email: user.email,
        related_id: booking.id,
        metadata: {
          payment_type: 'service_booking',
          booking_id: booking.id,
          completion_type: completionType,
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
      const { data: omResult, error: omError } = await invokeWithAuth('orange-money-payment', omBody);
      console.log('[OM initialize response]', {
        hasPaymentUrl: !!omResult?.payment_url,
        hasOrderId: !!omResult?.order_id,
        hasPayToken: !!omResult?.pay_token,
        error: omError?.message,
      });

      if (omError) throw new Error(omError.message || 'Impossible de lancer le paiement');

      if (!omResult.payment_url) {
        throw new Error(omResult.error || 'Impossible de lancer le paiement');
      }

      const effectiveRef = omResult.order_id || omResult.reference || paymentReference;

      if (isWeb) {
        redirectToPayment(omResult.payment_url);
        return;
      }

      router.push({
        pathname: '/payment-webview',
        params: {
          url: omResult.payment_url,
          reference: effectiveRef,
          paymentMode: 'service_booking_balance',
          bookingId: booking.id,
          amount: String(payAmount),
          payToken: omResult.pay_token,
        },
      });
    } catch (err: any) {
      setPaymentError(err.message || 'Erreur lors du paiement');
      setPayingBalance(false);
    }
  };

  const handlePayFull = () => launchBalancePayment('full');

  const handlePayPartial = () => {
    setPartialModalVisible(true);
  };

  const confirmPartialPayment = async (data: { reasonId: string; comment: string; proofUrl?: string }) => {
    if (!booking) return;
    await supabase
      .from('service_bookings')
      .update({
        vendor_dispute_comment: data.comment,
        cancellation_reason_id: data.reasonId,
        cancellation_proof_url: data.proofUrl || null,
      })
      .eq('id', booking.id);
    setPartialModalVisible(false);
    launchBalancePayment('partial');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.emptyText}>Reservation introuvable</Text>
      </View>
    );
  }

  const status = booking.status as BookingStatus;
  const currentStepIndex = getStepIndex(status);
  const canCancel = status === 'pending' || status === 'accepted' || status === 'arrived';
  const isArrivedForPayment = status === 'arrived';
  const isTerminal = status === 'completed' || status === 'partial' || status === 'cancelled' || status === 'expired';
  const service = booking.service;
  const address = booking.delivery_address;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }} style={styles.backBtn}>
          <ArrowLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suivi de reservation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {status !== 'cancelled' && status !== 'expired' && (
          <View style={styles.progressContainer}>
            {PROGRESS_STEPS.map((step, i) => {
              const isActive = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <View key={step.key} style={styles.progressStep}>
                  <View style={[styles.progressDot, isActive && styles.progressDotActive, isCurrent && styles.progressDotCurrent]} />
                  {i < PROGRESS_STEPS.length - 1 && (
                    <View style={[styles.progressLine, isActive && styles.progressLineActive]} />
                  )}
                  <Text style={[styles.progressLabel, isActive && styles.progressLabelActive]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.statusRow}>
          <BookingStatusBadge status={status} />
          <PaymentStatusBadge status={booking.payment_status as BookingPaymentStatus} />
        </View>

        {status === 'on_the_way' && (
          <View style={styles.liveInfoBox}>
            <Truck color="#0f766e" size={20} />
            <Text style={styles.liveInfoText}>Le prestataire est en route vers vous</Text>
          </View>
        )}

        {(status === 'on_the_way' || status === 'arrived') && booking.id && (
          <TrackingMap
            referenceId={booking.id}
            referenceType="booking"
            destinationLat={address?.geolocation_lat ?? undefined}
            destinationLng={address?.geolocation_lng ?? undefined}
          />
        )}

        {service && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              {service.main_media_url && (
                <Image source={{ uri: service.main_media_url }} style={styles.serviceThumb} />
              )}
              <View style={styles.cardRowInfo}>
                <Text style={styles.cardTitle}>{service.name}</Text>
                {service.shop && <Text style={styles.cardSubtitle}>{service.shop.name}</Text>}
              </View>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <Calendar color="#003f2f" size={18} />
            <Text style={styles.cardLabel}>Date et heure</Text>
          </View>
          <Text style={styles.cardValue}>{formatBookingDate(booking.booking_date)}</Text>
          <Text style={styles.cardValue}>{formatBookingTime(booking.booking_time)}</Text>
        </View>

        {address && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <MapPin color="#003f2f" size={18} />
              <Text style={styles.cardLabel}>Adresse d'intervention</Text>
            </View>
            <Text style={styles.cardValue}>{address.label}</Text>
            <Text style={styles.cardSubvalue}>{address.address}, {address.city}</Text>
            <Text style={styles.cardSubvalue}>{address.recipient_name} - {address.recipient_phone}</Text>
            {address.geolocation_lat && address.geolocation_lng && (
              <TouchableOpacity
                style={styles.mapsLink}
                onPress={() =>
                  Linking.openURL(`https://www.google.com/maps?q=${address.geolocation_lat},${address.geolocation_lng}`)
                }
              >
                <MapPin color="#2563eb" size={14} />
                <Text style={styles.mapsLinkText}>Ouvrir dans Google Maps</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recapitulatif financier</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Prestation</Text>
            <Text style={styles.priceValue}>{formatPrice(booking.total_price)} FCFA</Text>
          </View>
          {booking.travel_fee > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                Deplacement {booking.travel_fee_paid ? '(paye)' : ''}
              </Text>
              <Text style={styles.priceValue}>{formatPrice(booking.travel_fee)} FCFA</Text>
            </View>
          )}
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabelBold}>Total</Text>
            <Text style={styles.priceValueBold}>
              {formatPrice(booking.total_price + booking.travel_fee)} FCFA
            </Text>
          </View>
        </View>

        {vendorProfile && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Prestataire</Text>
            <View style={styles.vendorRow}>
              {vendorProfile.photo_profil ? (
                <Image source={{ uri: vendorProfile.photo_profil }} style={styles.vendorAvatar} />
              ) : (
                <View style={[styles.vendorAvatar, styles.vendorAvatarPlaceholder]}>
                  <Phone color="#999" size={16} />
                </View>
              )}
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{vendorProfile.nom_complet}</Text>
                {vendorProfile.contact && (
                  <Text style={styles.vendorContact}>{vendorProfile.contact}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
              <MessageCircle color="#003f2f" size={18} />
              <Text style={styles.contactBtnText}>Contacter le prestataire</Text>
            </TouchableOpacity>
          </View>
        )}

        {isArrivedForPayment && (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Prestation terminee ?</Text>

            {paymentError && (
              <View style={styles.paymentErrorRow}>
                <AlertTriangle color="#dc2626" size={16} />
                <Text style={styles.paymentErrorText}>{paymentError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.payFullBtn}
              onPress={handlePayFull}
              disabled={payingBalance}
            >
              {payingBalance ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <CheckCircle color="#fff" size={20} />
                  <Text style={styles.payFullBtnText}>
                    Payer 100% - Prestation satisfaisante
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.payPartialBtn}
              onPress={handlePayPartial}
              disabled={payingBalance}
            >
              <AlertTriangle color="#c2410c" size={20} />
              <Text style={styles.payPartialBtnText}>Payer 50% - Insatisfait</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelArrivalBtn}
              onPress={() => setCancelModalVisible(true)}
            >
              <XCircle color="#dc2626" size={20} />
              <Text style={styles.cancelArrivalBtnText}>Annuler a l'arrivee</Text>
            </TouchableOpacity>
          </View>
        )}

        {canCancel && !isArrivedForPayment && (
          <TouchableOpacity
            style={styles.cancelBookingBtn}
            onPress={() => setCancelModalVisible(true)}
          >
            <XCircle color="#dc2626" size={20} />
            <Text style={styles.cancelBookingBtnText}>Annuler la reservation</Text>
          </TouchableOpacity>
        )}

        {(status === 'completed' || status === 'partial') && (
          <View style={styles.completedCard}>
            <CheckCircle color="#16a34a" size={24} />
            <Text style={styles.completedTitle}>
              {status === 'partial' ? 'Prestation terminee a 50%' : 'Prestation terminee'}
            </Text>
            {booking.completed_at && (
              <Text style={styles.completedDate}>
                {new Date(booking.completed_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        )}

        {status === 'cancelled' && (
          <View style={styles.cancelledCard}>
            <XCircle color="#dc2626" size={24} />
            <Text style={styles.cancelledTitle}>Reservation annulee</Text>
            {booking.cancellation_reason && (
              <Text style={styles.cancelledReason}>
                Motif : {(booking.cancellation_reason as any).label}
              </Text>
            )}
            {booking.cancellation_comment && (
              <Text style={styles.cancelledComment}>{booking.cancellation_comment}</Text>
            )}
          </View>
        )}

        {booking.notes && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Notes</Text>
            <Text style={styles.cardSubvalue}>{booking.notes}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <BookingCancellationModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={handleCancelBooking}
        bookingStatus={booking.status}
      />

      <PartialPaymentModal
        visible={partialModalVisible}
        onClose={() => setPartialModalVisible(false)}
        onConfirm={confirmPartialPayment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  emptyText: { fontSize: 15, color: '#999' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  scroll: { flex: 1 },
  progressContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: '#fff', padding: 20, margin: 16, marginBottom: 0, borderRadius: 14,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  progressStep: { alignItems: 'center', flex: 1 },
  progressDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#e5e5e5', zIndex: 1,
  },
  progressDotActive: { backgroundColor: '#003f2f' },
  progressDotCurrent: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#003f2f', backgroundColor: '#fff',
  },
  progressLine: {
    position: 'absolute', top: 7, left: '50%', right: '-50%', height: 2, backgroundColor: '#e5e5e5',
  },
  progressLineActive: { backgroundColor: '#003f2f' },
  progressLabel: { fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' },
  progressLabelActive: { color: '#003f2f', fontWeight: '600' },
  statusRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
  },
  liveInfoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: '#f0fdfa', margin: 16, marginBottom: 0,
    padding: 14, borderRadius: 12, alignItems: 'center',
  },
  liveInfoText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f766e' },
  card: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  serviceThumb: { width: 60, height: 60, borderRadius: 10 },
  cardRowInfo: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  cardSubtitle: { fontSize: 13, color: '#666' },
  cardIconRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  cardValue: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  cardSubvalue: { fontSize: 13, color: '#666', marginTop: 2 },
  mapsLink: {
    flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10,
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#eff6ff', borderRadius: 8, alignSelf: 'flex-start',
  },
  mapsLinkText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  priceDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  priceLabelBold: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  priceValueBold: { fontSize: 15, fontWeight: '700', color: '#003f2f' },
  vendorRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  vendorAvatar: { width: 44, height: 44, borderRadius: 22 },
  vendorAvatarPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  vendorInfo: { flex: 1, gap: 2 },
  vendorName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  vendorContact: { fontSize: 13, color: '#666' },
  contactBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#003f2f',
  },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: '#003f2f' },
  actionsCard: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#f0f0f0', gap: 10,
  },
  actionsTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  paymentErrorRow: {
    flexDirection: 'row', gap: 8, backgroundColor: '#fef2f2',
    padding: 12, borderRadius: 10, alignItems: 'flex-start',
  },
  paymentErrorText: { flex: 1, fontSize: 13, color: '#dc2626' },
  payFullBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, backgroundColor: '#003f2f',
  },
  payFullBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  payPartialBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa',
  },
  payPartialBtnText: { fontSize: 14, fontWeight: '700', color: '#c2410c' },
  cancelArrivalBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca',
  },
  cancelArrivalBtnText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  cancelBookingBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    margin: 16, marginBottom: 0, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff',
  },
  cancelBookingBtnText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  completedCard: {
    backgroundColor: '#f0fdf4', margin: 16, marginBottom: 0, borderRadius: 14, padding: 20,
    alignItems: 'center', gap: 8,
  },
  completedTitle: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  completedDate: { fontSize: 13, color: '#666' },
  cancelledCard: {
    backgroundColor: '#fef2f2', margin: 16, marginBottom: 0, borderRadius: 14, padding: 20,
    alignItems: 'center', gap: 8,
  },
  cancelledTitle: { fontSize: 16, fontWeight: '700', color: '#dc2626' },
  cancelledReason: { fontSize: 14, color: '#666' },
  cancelledComment: { fontSize: 13, color: '#999', textAlign: 'center' },
});
