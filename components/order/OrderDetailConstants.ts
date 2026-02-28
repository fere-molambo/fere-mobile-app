import {
  Clock,
  CheckCircle,
  Truck,
  MapPin,
  BoxSelect,
  Send,
} from 'lucide-react-native';

export interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  delivery_type: string;
  total_amount: number;
  advance_amount: number;
  advance_paid: number;
  balance_amount: number;
  delivery_fee: number;
  subtotal: number;
  created_at: string;
  shop_id: string;
  delivery_address_id: string | null;
  shop: { id: string; name: string; logo_url: string | null; contact_phone: string | null; address: string | null; geolocation_lat: number | null; geolocation_lng: number | null } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product: { id: string; name: string; main_media_url: string | null } | null;
  }>;
  delivery_address: {
    id: string;
    label: string;
    address: string;
    city: string;
  } | null;
}

export interface DeliveryRequest {
  id: string;
  status: string;
  driver_id: string | null;
  driver_earnings: number;
  is_return: boolean;
  assigned_at: string | null;
  started_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  arrived_at_client_at: string | null;
  en_route_client_at: string | null;
  created_at: string;
  zone_id?: string | null;
  pickup_point?: { shop_name: string; lat: number; lng: number; address: string } | null;
  pickup_points?: Array<{ shop_name: string; lat: number; lng: number; address: string }> | null;
  total_distance_meters?: number;
}

export interface CancellationReason {
  id: string;
  label: string;
}

export function formatPrice(n: number) {
  return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, '\u00a0');
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export const ORDER_STEPS = [
  { key: 'created', label: 'Créée' },
  { key: 'confirmed', label: 'Confirmée' },
  { key: 'shipped', label: 'En transit' },
  { key: 'delivered', label: 'Livrée' },
];

export function getOrderStepIndex(status: string): number {
  if (status === 'pending') return 0;
  if (status === 'confirmed' || status === 'preparing') return 1;
  if (status === 'shipped' || status === 'in_transit') return 2;
  if (status === 'delivered') return 3;
  return 0;
}

export const DELIVERY_STEPS = [
  { key: 'pending', label: 'En attente', subtitle: "Recherche d'un livreur", Icon: Clock },
  { key: 'assigned', label: 'Acceptée', subtitle: null, Icon: CheckCircle },
  { key: 'in_progress', label: 'Vers pickup', subtitle: null, Icon: Truck },
  { key: 'picked_up', label: 'Récupérée', subtitle: null, Icon: BoxSelect },
  { key: 'en_route_client', label: 'En route', subtitle: null, Icon: Send },
  { key: 'arrived', label: 'Arrivé', subtitle: null, Icon: MapPin },
  { key: 'delivered', label: 'Livrée', subtitle: null, Icon: CheckCircle },
];

export function getDeliveryStepIndex(status: string): number {
  const idx = DELIVERY_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export function getDeliveryTimestamp(step: string, delivery: DeliveryRequest): string | null {
  switch (step) {
    case 'pending': return formatTime(delivery.created_at);
    case 'assigned': return formatTime(delivery.assigned_at);
    case 'in_progress': return formatTime(delivery.started_at);
    case 'picked_up': return formatTime(delivery.picked_up_at);
    case 'en_route_client': return formatTime(delivery.en_route_client_at);
    case 'arrived': return formatTime(delivery.arrived_at_client_at);
    case 'delivered': return formatTime(delivery.delivered_at);
    default: return null;
  }
}

export const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Paiement en attente', color: '#e67e22', bg: '#fef3c7' },
  advance_paid: { label: 'Acompte payé', color: '#e67e22', bg: '#fef3c7' },
  paid: { label: 'Payé', color: '#16a34a', bg: '#dcfce7' },
  failed: { label: 'Paiement échoué', color: '#ef4444', bg: '#fee2e2' },
  refunded: { label: 'Remboursé', color: '#0891b2', bg: '#cffafe' },
};

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#e67e22', bg: '#fef3c7' },
  confirmed: { label: 'Confirmée', color: '#3b82f6', bg: '#dbeafe' },
  preparing: { label: 'En préparation', color: '#ca8a04', bg: '#fef9c3' },
  shipped: { label: 'En livraison', color: '#0891b2', bg: '#cffafe' },
  in_transit: { label: 'En livraison', color: '#0891b2', bg: '#cffafe' },
  delivered: { label: 'Livrée', color: '#16a34a', bg: '#dcfce7' },
  cancelled: { label: 'Annulée', color: '#ef4444', bg: '#fee2e2' },
};

export function canCancelBeforePickup(orderStatus: string, deliveryStatus: string | null): boolean {
  const cancelableOrderStatuses = ['pending', 'confirmed', 'preparing'];
  const cancelableDeliveryStatuses = ['pending', 'assigned', 'in_progress', null];
  return (
    cancelableOrderStatuses.includes(orderStatus) &&
    cancelableDeliveryStatuses.includes(deliveryStatus)
  );
}
