import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator,
  Linking, TextInput,
} from 'react-native';
import {
  X, Calendar, Clock, MapPin, Phone, Mail, User, Truck, CheckCircle,
  Navigation, MessageCircle, AlertTriangle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BookingStatusBadge from '@/components/BookingStatusBadge';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import { formatBookingDate, formatBookingTime, formatPrice } from '@/lib/bookingUtils';
import { startConversation } from '@/lib/chatUtils';
import { supabase } from '@/lib/supabase';
import type { BookingStatus, BookingPaymentStatus } from '@/types/database';

interface BookingData {
  id: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  total_price: number;
  travel_fee: number;
  travel_fee_paid: boolean;
  commission_amount: number;
  tva_amount: number;
  vendor_dispute_comment?: string;
  service: { name: string; main_media_url: string | null } | null;
  customer: { id: string; nom_complet: string; contact: string; email: string } | null;
  delivery_address: {
    label: string; address: string; city: string;
    geolocation_lat: number | null; geolocation_lng: number | null;
  } | null;
}

interface Props {
  booking: BookingData;
  onClose: () => void;
  onAction: (bookingId: string, action: string) => Promise<void>;
  vendorUserId: string;
}

export default function VendorBookingDetailSheet({ booking, onClose, onAction, vendorUserId }: Props) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [disputeComment, setDisputeComment] = useState(booking.vendor_dispute_comment || '');
  const [savingComment, setSavingComment] = useState(false);

  const handleAction = async (action: string) => {
    setActing(true);
    try { await onAction(booking.id, action); } finally { setActing(false); }
  };

  const handleContact = async () => {
    if (!booking.customer) return;
    try {
      const convoId = await startConversation(vendorUserId, booking.customer.id);
      onClose();
      router.push({ pathname: '/chat/[id]', params: { id: convoId } });
    } catch {}
  };

  const handleSaveComment = async () => {
    setSavingComment(true);
    await supabase
      .from('service_bookings')
      .update({ vendor_dispute_comment: disputeComment })
      .eq('id', booking.id);
    setSavingComment(false);
  };

  const netVendor = booking.total_price - booking.commission_amount - booking.tva_amount;
  const isTerminal = booking.status === 'completed' || booking.status === 'partial' || booking.status === 'cancelled' || booking.status === 'expired';
  const addr = booking.delivery_address;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Detail de la reservation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#666" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.statusRow}>
              <BookingStatusBadge status={booking.status} />
              <PaymentStatusBadge status={booking.payment_status} />
            </View>

            <Text style={styles.svcName}>{booking.service?.name || 'Prestation'}</Text>

            {booking.customer && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Client</Text>
                <View style={styles.infoRow}>
                  <User size={15} color="#666" />
                  <Text style={styles.infoText}>{booking.customer.nom_complet}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Phone size={15} color="#666" />
                  <Text style={styles.infoText}>{booking.customer.contact}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Mail size={15} color="#666" />
                  <Text style={styles.infoText}>{booking.customer.email}</Text>
                </View>
                <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
                  <MessageCircle size={16} color="#003f2f" />
                  <Text style={styles.contactBtnText}>Contacter le client</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Rendez-vous</Text>
              <View style={styles.infoRow}>
                <Calendar size={15} color="#666" />
                <Text style={styles.infoText}>{formatBookingDate(booking.booking_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Clock size={15} color="#666" />
                <Text style={styles.infoText}>{formatBookingTime(booking.booking_time)}</Text>
              </View>
            </View>

            {addr && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Adresse d'intervention</Text>
                <View style={styles.infoRow}>
                  <MapPin size={15} color="#666" />
                  <Text style={styles.infoText}>{addr.label} - {addr.address}, {addr.city}</Text>
                </View>
                {addr.geolocation_lat && addr.geolocation_lng && (
                  <TouchableOpacity
                    style={styles.mapsBtn}
                    onPress={() => Linking.openURL(`https://www.google.com/maps?q=${addr.geolocation_lat},${addr.geolocation_lng}`)}
                  >
                    <Navigation size={14} color="#2563eb" />
                    <Text style={styles.mapsBtnText}>Google Maps</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Recapitulatif financier</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Prix prestation</Text>
                <Text style={styles.priceValue}>{formatPrice(booking.total_price)} FCFA</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Commission</Text>
                <Text style={[styles.priceValue, { color: '#dc2626' }]}>-{formatPrice(booking.commission_amount)} FCFA</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>TVA</Text>
                <Text style={[styles.priceValue, { color: '#dc2626' }]}>-{formatPrice(booking.tva_amount)} FCFA</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceLabelBold}>Net vendeur</Text>
                <Text style={styles.priceValueBold}>{formatPrice(netVendor)} FCFA</Text>
              </View>
              {booking.travel_fee > 0 && (
                <View style={styles.priceRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Truck size={14} color="#666" />
                    <Text style={styles.priceLabel}>Deplacement</Text>
                  </View>
                  <Text style={styles.priceValue}>
                    {formatPrice(booking.travel_fee)} FCFA {booking.travel_fee_paid ? '(paye)' : ''}
                  </Text>
                </View>
              )}
            </View>

            {booking.status === 'pending' && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleAction('accept')}
                disabled={acting}
              >
                {acting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckCircle color="#fff" size={20} />
                    <Text style={styles.actionBtnText}>Accepter la prestation</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {booking.status === 'accepted' && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleAction('on_the_way')}
                disabled={acting}
              >
                {acting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Truck color="#fff" size={20} />
                    <Text style={styles.actionBtnText}>Demarrer vers client</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {booking.status === 'on_the_way' && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleAction('arrived')}
                disabled={acting}
              >
                {acting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <MapPin color="#fff" size={20} />
                    <Text style={styles.actionBtnText}>Je suis arrive</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {booking.status === 'arrived' && (
              <View style={styles.waitingBox}>
                <AlertTriangle color="#c2410c" size={18} />
                <Text style={styles.waitingText}>
                  En attente de l'action du client. Le client doit effectuer le paiement pour terminer la prestation.
                </Text>
              </View>
            )}

            {isTerminal && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Commentaire vendeur</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Ajouter un commentaire..."
                  placeholderTextColor="#aaa"
                  multiline
                  numberOfLines={3}
                  value={disputeComment}
                  onChangeText={setDisputeComment}
                />
                <TouchableOpacity
                  style={styles.saveCommentBtn}
                  onPress={handleSaveComment}
                  disabled={savingComment}
                >
                  {savingComment ? (
                    <ActivityIndicator color="#003f2f" size="small" />
                  ) : (
                    <Text style={styles.saveCommentBtnText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  sheetContent: { padding: 16 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  svcName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  section: { marginBottom: 16, gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#333' },
  contactBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#003f2f', marginTop: 4,
  },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: '#003f2f' },
  mapsBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: '#eff6ff', borderRadius: 8, alignSelf: 'flex-start', marginTop: 4,
  },
  mapsBtnText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  priceDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 6 },
  priceLabelBold: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  priceValueBold: { fontSize: 15, fontWeight: '700', color: '#003f2f' },
  actionBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, backgroundColor: '#003f2f', marginBottom: 12,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  waitingBox: {
    flexDirection: 'row', gap: 10, backgroundColor: '#fff7ed', padding: 14, borderRadius: 12,
    alignItems: 'flex-start', marginBottom: 12,
  },
  waitingText: { flex: 1, fontSize: 13, color: '#c2410c', lineHeight: 20 },
  commentInput: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, padding: 12,
    fontSize: 14, color: '#333', minHeight: 70, textAlignVertical: 'top',
  },
  saveCommentBtn: {
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#003f2f', alignItems: 'center',
  },
  saveCommentBtnText: { fontSize: 14, fontWeight: '600', color: '#003f2f' },
});
