import type { BookingStatus, BookingPaymentStatus, Service } from '@/types/database';

export interface StatusConfig {
  label: string;
  color: string;
  bg: string;
}

export const BOOKING_STATUS_CONFIGS: Record<BookingStatus, StatusConfig> = {
  pending: { label: 'En attente', color: '#ca8a04', bg: '#fef9c3' },
  accepted: { label: 'Acceptee', color: '#2563eb', bg: '#dbeafe' },
  on_the_way: { label: 'En route', color: '#0f766e', bg: '#ccfbf1' },
  arrived: { label: 'Sur place', color: '#c2410c', bg: '#ffedd5' },
  completed: { label: 'Terminée', color: '#16a34a', bg: '#dcfce7' },
  partial: { label: 'Partielle', color: '#c2410c', bg: '#ffedd5' },
  cancelled: { label: 'Annulée', color: '#dc2626', bg: '#fee2e2' },
  expired: { label: 'Expiree', color: '#6b7280', bg: '#f3f4f6' },
};

export const PAYMENT_STATUS_CONFIGS: Record<BookingPaymentStatus, StatusConfig> = {
  pending: { label: 'Non payé', color: '#ca8a04', bg: '#fef9c3' },
  partial: { label: 'Acompte payé', color: '#c2410c', bg: '#ffedd5' },
  paid: { label: 'Paye', color: '#16a34a', bg: '#dcfce7' },
  not_required: { label: 'N/A', color: '#6b7280', bg: '#f3f4f6' },
};

export const DAY_NAMES: Record<string, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

export const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const FRENCH_TO_ENGLISH: Record<string, string> = {
  lundi: 'monday',
  mardi: 'tuesday',
  mercredi: 'wednesday',
  jeudi: 'thursday',
  vendredi: 'friday',
  samedi: 'saturday',
  dimanche: 'sunday',
};

export function normalizeAvailabilityKeys(availability: any): Record<string, any> {
  if (!availability || typeof availability !== 'object') return {};
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(availability)) {
    const normalizedKey = FRENCH_TO_ENGLISH[key.toLowerCase()] || key.toLowerCase();
    normalized[normalizedKey] = value;
  }
  return normalized;
}

export const DURATION_OPTIONS = [
  { label: '1h ou plus', value: 60 },
  { label: '3h ou plus', value: 180 },
  { label: '24h ou plus', value: 1440 },
  { label: '2 jours ou plus', value: 2880 },
  { label: 'Autre', value: 0 },
];

export function getDurationLabel(minutes?: number): string {
  if (!minutes) return 'Non definie';
  const opt = DURATION_OPTIONS.find((o) => o.value === minutes);
  if (opt) return opt.label;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DayAvailability {
  day: string;
  dayLabel: string;
  slots: TimeSlot[];
}

export function parseWeeklyAvailability(availability: any): DayAvailability[] {
  if (!availability || typeof availability !== 'object') return [];
  const normalized = normalizeAvailabilityKeys(availability);
  const result: DayAvailability[] = [];
  for (const day of DAY_ORDER) {
    const slots = normalized[day];
    if (Array.isArray(slots) && slots.length > 0) {
      result.push({
        day,
        dayLabel: DAY_NAMES[day] || day,
        slots: slots.map((s: any) => ({ start: s.start || '', end: s.end || '' })),
      });
    }
  }
  return result;
}

export function generateTimeSlots(
  daySlots: TimeSlot[],
  durationMinutes: number,
  existingBookingTimes: string[]
): string[] {
  const available: string[] = [];
  const bookedSet = new Set(existingBookingTimes);

  for (const slot of daySlots) {
    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const step = Math.max(durationMinutes, 30);

    for (let t = startTotal; t + step <= endTotal; t += step) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      if (!bookedSet.has(timeStr)) {
        available.push(timeStr);
      }
    }
  }
  return available;
}

export function getDayKeyFromDate(date: Date): string {
  const jsDay = date.getDay();
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[jsDay];
}

export interface BookingPriceBreakdown {
  basePrice: number;
  flashPrice?: number;
  discountAmount: number;
  effectivePrice: number;
  commissionAmount: number;
  tvaAmount: number;
  travelFee: number;
  totalPrice: number;
  advanceAmount: number;
}

export function calculateBookingPrices(
  service: Service,
  flashPrice?: number,
  commissionRate: number = 10,
  tvaRate: number = 0
): BookingPriceBreakdown {
  const basePrice = service.price;
  const discountPercent = service.discount_percent || 0;

  let effectivePrice = basePrice;
  if (flashPrice && flashPrice < basePrice) {
    effectivePrice = flashPrice;
  } else if (discountPercent > 0) {
    effectivePrice = Math.round(basePrice * (1 - discountPercent / 100));
  }

  const discountAmount = basePrice - effectivePrice;
  const commissionAmount = Math.round(effectivePrice * (commissionRate / 100));
  const tvaAmount = Math.round(effectivePrice * (tvaRate / 100));
  const travelFee = service.travel_fee_type === 'paid' ? (service.travel_fee_amount || 0) : 0;
  const totalPrice = effectivePrice;
  const advanceAmount = travelFee;

  return {
    basePrice,
    flashPrice,
    discountAmount,
    effectivePrice,
    commissionAmount,
    tvaAmount,
    travelFee,
    totalPrice,
    advanceAmount,
  };
}

export function formatBookingDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatBookingTime(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

export function formatPrice(amount: number): string {
  return amount.toLocaleString('fr-FR');
}
