import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Truck,
  Info,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import AddressModal from '@/components/modals/AddressModal';
import { generateOrderNumber } from '@/lib/orderCalculations';
import type { Service, DeliveryAddress, FlashSale } from '@/types/database';
import {
  parseWeeklyAvailability,
  generateTimeSlots,
  getDayKeyFromDate,
  calculateBookingPrices,
  formatPrice,
  getDurationLabel,
  type DayAvailability,
  type BookingPriceBreakdown,
} from '@/lib/bookingUtils';
import { savePendingPayment, getPaymentCallbackUrl, redirectToPaystack } from '@/lib/paymentRedirect';

export default function BookingScreen() {
  const { serviceId, proposedPrice: proposedPriceParam } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [service, setService] = useState<Service | null>(null);
  const [flashSale, setFlashSale] = useState<FlashSale | null>(null);
  const [commissionRate, setCommissionRate] = useState(10);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [existingBookingTimes, setExistingBookingTimes] = useState<string[]>([]);

  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    if (!serviceId || !user) return;
    loadData();
  }, [serviceId, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [serviceRes, flashRes, addressRes, commRes] = await Promise.all([
        supabase
          .from('services')
          .select('*, shop:shops(*)')
          .eq('id', serviceId)
          .maybeSingle(),
        supabase
          .from('flash_sales')
          .select('*')
          .eq('service_id', serviceId)
          .eq('is_active', true)
          .gt('ends_at', new Date().toISOString())
          .maybeSingle(),
        supabase
          .from('delivery_addresses')
          .select('*')
          .eq('user_id', user!.id)
          .order('is_default', { ascending: false }),
        supabase
          .from('category_commissions')
          .select('commission_rate')
          .eq('commission_type', 'service')
          .limit(1)
          .maybeSingle(),
      ]);

      if (serviceRes.error) throw serviceRes.error;
      if (!serviceRes.data) throw new Error('Service introuvable');
      setService(serviceRes.data as unknown as Service);

      if (flashRes.data) setFlashSale(flashRes.data as FlashSale);
      if (commRes.data) setCommissionRate(commRes.data.commission_rate);

      setAddresses((addressRes.data || []) as DeliveryAddress[]);
      const defaultAddr = (addressRes.data || []).find((a: any) => a.is_default);
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const availability = useMemo(() => {
    if (!service?.weekly_availability) return [];
    return parseWeeklyAvailability(service.weekly_availability);
  }, [service]);

  const availableDays = useMemo(() => {
    return new Set(availability.map((a) => a.day));
  }, [availability]);

  const proposedPrice = proposedPriceParam ? Number(proposedPriceParam) : undefined;

  const priceBreakdown = useMemo<BookingPriceBreakdown | null>(() => {
    if (!service) return null;
    const effectiveFlashPrice = flashSale?.flash_price;
    if (service.price_type === 'negoce' && proposedPrice && proposedPrice > 0) {
      return calculateBookingPrices(
        { ...service, price: proposedPrice, discount_percent: 0 },
        undefined,
        commissionRate
      );
    }
    return calculateBookingPrices(service, effectiveFlashPrice, commissionRate);
  }, [service, flashSale, commissionRate, proposedPrice]);

  useEffect(() => {
    if (!selectedDate || !serviceId) return;
    const dateStr = selectedDate.toISOString().split('T')[0];
    supabase
      .from('service_bookings')
      .select('booking_time')
      .eq('service_id', serviceId)
      .eq('booking_date', dateStr)
      .not('status', 'in', '("cancelled","expired")')
      .then(({ data }) => {
        setExistingBookingTimes((data || []).map((b: any) => b.booking_time?.substring(0, 5)));
      });
  }, [selectedDate, serviceId]);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !service?.duration) return [];
    const dayKey = getDayKeyFromDate(selectedDate);
    const dayAvail = availability.find((a) => a.day === dayKey);
    if (!dayAvail) return [];
    return generateTimeSlots(dayAvail.slots, service.duration, existingBookingTimes);
  }, [selectedDate, service, availability, existingBookingTimes]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [calendarMonth]);

  const isDayAvailable = useCallback(
    (date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return false;
      const dayKey = getDayKeyFromDate(date);
      return availableDays.has(dayKey);
    },
    [availableDays]
  );

  const handleSubmit = async () => {
    if (!service || !selectedDate || !selectedTime || !user || !priceBreakdown) return;
    if (!selectedAddressId) {
      setError('Veuillez selectionner une adresse');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const bookingDate = selectedDate.toISOString().split('T')[0];

      const { data: booking, error: insertErr } = await supabase
        .from('service_bookings')
        .insert({
          service_id: service.id,
          customer_id: user.id,
          booking_date: bookingDate,
          booking_time: selectedTime,
          total_price: priceBreakdown.effectivePrice,
          travel_fee: priceBreakdown.travelFee,
          commission_amount: priceBreakdown.commissionAmount,
          tva_amount: priceBreakdown.tvaAmount,
          delivery_address_id: selectedAddressId,
          notes: notes || null,
          payment_method: 'paystack',
          payment_status: 'pending',
          ...(service.price_type === 'negoce' && proposedPrice
            ? { partial_payment_amount: proposedPrice }
            : {}),
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      if (priceBreakdown.travelFee > 0) {
        const paymentReference = generateOrderNumber();
        const isWeb = Platform.OS === 'web';
        const callbackUrl = isWeb ? getPaymentCallbackUrl() : undefined;

        let paystackResult: any;
        try {
          const paystackResp = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/paystack-payment`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                action: 'initialize',
                email: user.email,
                amount: priceBreakdown.travelFee,
                reference: paymentReference,
                currency: 'XOF',
                metadata: {
                  booking_id: booking.id,
                  payment_type: 'service_booking_advance',
                  user_id: user.id,
                },
                ...(callbackUrl ? { callback_url: callbackUrl } : {}),
              }),
            }
          );
          paystackResult = await paystackResp.json();
        } catch (payErr: any) {
          await supabase
            .from('service_bookings')
            .update({ status: 'cancelled', payment_status: 'cancelled' })
            .eq('id', booking.id);
          throw new Error('Erreur reseau lors de l\'initialisation du paiement. Aucune reservation n\'a ete conservee.');
        }

        if (!paystackResult.authorization_url) {
          await supabase
            .from('service_bookings')
            .update({ status: 'cancelled', payment_status: 'cancelled' })
            .eq('id', booking.id);
          throw new Error(paystackResult.message || paystackResult.error || 'Impossible de lancer le paiement');
        }

        const effectiveRef = paystackResult.reference || paymentReference;

        await savePendingPayment({
          userId: user.id,
          reference: effectiveRef,
          paymentMode: 'service_booking_advance',
          amount: priceBreakdown.travelFee,
          bookingId: booking.id,
        });

        if (isWeb) {
          redirectToPaystack(paystackResult.authorization_url);
          return;
        }

        router.push({
          pathname: '/payment-webview',
          params: {
            url: paystackResult.authorization_url,
            reference: effectiveRef,
            paymentMode: 'service_booking_advance',
            bookingId: booking.id,
            amount: String(priceBreakdown.travelFee),
          },
        });
      } else {
        router.replace({
          pathname: '/booking-detail',
          params: { id: booking.id },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la creation de la reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddressCreated = async () => {
    setAddressModalVisible(false);
    const { data } = await supabase
      .from('delivery_addresses')
      .select('*')
      .eq('user_id', user!.id)
      .order('is_default', { ascending: false });
    const addrs = (data || []) as DeliveryAddress[];
    setAddresses(addrs);
    if (addrs.length > 0 && !selectedAddressId) {
      setSelectedAddressId(addrs[0].id);
    }
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Service introuvable</Text>
      </View>
    );
  }

  const monthLabel = calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reservation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.serviceCard}>
          {service.main_media_url && (
            <Image source={{ uri: service.main_media_url }} style={styles.serviceImage} />
          )}
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName} numberOfLines={2}>{service.name}</Text>
            {service.shop && (
              <Text style={styles.shopName}>{service.shop.name}</Text>
            )}
            <Text style={styles.serviceDuration}>
              <Clock color="#666" size={14} /> {getDurationLabel(service.duration)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar color="#003f2f" size={20} />
            <Text style={styles.sectionTitle}>Choisir une date</Text>
          </View>

          <View style={styles.calendarContainer}>
            <View style={styles.calendarNav}>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))
                }
              >
                <ChevronLeft color="#333" size={24} />
              </TouchableOpacity>
              <Text style={styles.calendarMonth}>{monthLabel}</Text>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))
                }
              >
                <ChevronRight color="#333" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekDays}>
              {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
                <Text key={d} style={styles.calendarWeekDay}>{d}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, i) => {
                if (!day) return <View key={`pad-${i}`} style={styles.calendarCell} />;
                const available = isDayAvailable(day);
                const isSelected =
                  selectedDate &&
                  day.toDateString() === selectedDate.toDateString();

                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[
                      styles.calendarCell,
                      available && styles.calendarCellAvailable,
                      isSelected && styles.calendarCellSelected,
                    ]}
                    disabled={!available}
                    onPress={() => {
                      setSelectedDate(day);
                      setSelectedTime(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        !available && styles.calendarDayDisabled,
                        isSelected && styles.calendarDaySelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {selectedDate && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock color="#003f2f" size={20} />
              <Text style={styles.sectionTitle}>Choisir un creneau</Text>
            </View>

            {timeSlots.length > 0 ? (
              <View style={styles.timeSlotsGrid}>
                {timeSlots.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeSlot,
                      selectedTime === time && styles.timeSlotSelected,
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        selectedTime === time && styles.timeSlotTextSelected,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noSlotsText}>Aucun creneau disponible pour cette date</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin color="#003f2f" size={20} />
            <Text style={styles.sectionTitle}>Adresse d'intervention</Text>
          </View>

          {addresses.map((addr) => (
            <TouchableOpacity
              key={addr.id}
              style={[
                styles.addressCard,
                selectedAddressId === addr.id && styles.addressCardSelected,
              ]}
              onPress={() => setSelectedAddressId(addr.id)}
            >
              <View style={[styles.radioOuter, selectedAddressId === addr.id && styles.radioSelected]}>
                {selectedAddressId === addr.id && <View style={styles.radioInner} />}
              </View>
              <View style={styles.addressInfo}>
                <Text style={styles.addressLabel}>{addr.label}</Text>
                <Text style={styles.addressText}>{addr.address}, {addr.city}</Text>
                <Text style={styles.addressRecipient}>
                  {addr.recipient_name} - {addr.recipient_phone}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.addAddressBtn}
            onPress={() => setAddressModalVisible(true)}
          >
            <Plus color="#003f2f" size={20} />
            <Text style={styles.addAddressText}>Ajouter une adresse</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optionnel)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Instructions particulieres..."
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {priceBreakdown && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recapitulatif</Text>
            <View style={styles.priceBlock}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  {service.price_type === 'negoce' ? 'Prix propose' : 'Prix prestation'}
                </Text>
                <Text style={styles.priceValue}>{formatPrice(priceBreakdown.basePrice)} FCFA</Text>
              </View>
              {priceBreakdown.discountAmount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: '#16a34a' }]}>
                    {flashSale ? 'Vente flash' : 'Remise'}
                  </Text>
                  <Text style={[styles.priceValue, { color: '#16a34a' }]}>
                    -{formatPrice(priceBreakdown.discountAmount)} FCFA
                  </Text>
                </View>
              )}
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceLabelBold}>Total prestation</Text>
                <Text style={styles.priceValueBold}>
                  {formatPrice(priceBreakdown.effectivePrice)} FCFA
                </Text>
              </View>
              {priceBreakdown.travelFee > 0 && (
                <>
                  <View style={styles.priceDivider} />
                  <View style={styles.priceRow}>
                    <View style={styles.priceRowWithIcon}>
                      <Truck color="#666" size={16} />
                      <Text style={styles.priceLabel}>Frais de deplacement</Text>
                    </View>
                    <Text style={styles.priceValue}>
                      {formatPrice(priceBreakdown.travelFee)} FCFA
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Info color="#2563eb" size={14} />
                    <Text style={styles.infoText}>
                      L'acompte de {formatPrice(priceBreakdown.travelFee)} FCFA (frais de deplacement) sera paye maintenant. Le solde sera paye a la fin de la prestation.
                    </Text>
                  </View>
                </>
              )}
              {priceBreakdown.travelFee === 0 && (
                <View style={styles.infoRow}>
                  <Info color="#2563eb" size={14} />
                  <Text style={styles.infoText}>
                    Le paiement se fera a la fin de la prestation.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorRow}>
            <AlertTriangle color="#dc2626" size={16} />
            <Text style={styles.errorRowText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedDate || !selectedTime || !selectedAddressId || submitting) &&
              styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedDate || !selectedTime || !selectedAddressId || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {priceBreakdown && priceBreakdown.travelFee > 0
                ? `Payer l'acompte (${formatPrice(priceBreakdown.travelFee)} FCFA)`
                : 'Confirmer la reservation'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddressModal
        visible={addressModalVisible}
        onClose={() => setAddressModalVisible(false)}
        onSave={handleAddressCreated}
        userId={user?.id || ''}
      />
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scroll: {
    flex: 1,
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  serviceImage: {
    width: 90,
    height: 90,
  },
  serviceInfo: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  shopName: {
    fontSize: 13,
    color: '#666',
  },
  serviceDuration: {
    fontSize: 13,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  calendarContainer: {},
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarMonth: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarCellAvailable: {
    borderRadius: 20,
  },
  calendarCellSelected: {
    backgroundColor: '#003f2f',
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  calendarDayDisabled: {
    color: '#ddd',
  },
  calendarDaySelected: {
    color: '#fff',
    fontWeight: '700',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  timeSlotSelected: {
    backgroundColor: '#003f2f',
    borderColor: '#003f2f',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timeSlotTextSelected: {
    color: '#fff',
  },
  noSlotsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 8,
  },
  addressCardSelected: {
    borderColor: '#003f2f',
    backgroundColor: '#f0faf7',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#003f2f',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#003f2f',
  },
  addressInfo: {
    flex: 1,
    gap: 2,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addressText: {
    fontSize: 13,
    color: '#666',
  },
  addressRecipient: {
    fontSize: 12,
    color: '#999',
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#003f2f',
    borderStyle: 'dashed',
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  priceBlock: {
    marginTop: 8,
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceRowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  priceLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  priceValueBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#003f2f',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#2563eb',
    lineHeight: 20,
  },
  errorRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorRowText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
  },
  submitBtn: {
    backgroundColor: '#003f2f',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 15,
    color: '#999',
  },
});
