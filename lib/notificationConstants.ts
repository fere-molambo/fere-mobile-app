export const ROLE_PREFERENCE_FIELDS: Record<string, string[]> = {
  membre: ['order_status_updates', 'delivery_tracking', 'promotions', 'messages', 'booking_reminders'],
  vendeur: ['new_orders', 'order_cancellations', 'new_reviews', 'new_bookings', 'messages', 'low_stock'],
  equipe: ['new_orders', 'new_bookings', 'messages'],
  livreur: ['new_delivery_available', 'delivery_status_changes', 'payout_updates', 'messages'],
  admin: ['new_orders', 'order_cancellations', 'new_reviews', 'new_bookings', 'new_delivery_available', 'messages'],
  super_admin: ['new_orders', 'order_cancellations', 'new_reviews', 'new_bookings', 'new_delivery_available', 'messages'],
};

export const PREFERENCE_LABELS: Record<string, { label: string; description: string }> = {
  order_status_updates: { label: 'Statut des commandes', description: 'Mises a jour sur vos commandes' },
  delivery_tracking: { label: 'Suivi de livraison', description: 'Position du livreur en temps reel' },
  promotions: { label: 'Promotions', description: 'Offres et promotions' },
  messages: { label: 'Messages', description: 'Nouveaux messages dans vos conversations' },
  booking_reminders: { label: 'Rappels réservation', description: 'Rappels avant vos réservations' },
  new_orders: { label: 'Nouvelles commandes', description: 'Alertes pour chaque nouvelle commande' },
  order_cancellations: { label: 'Annulations', description: 'Alertes d\'annulation de commande' },
  new_reviews: { label: 'Nouveaux avis', description: 'Quand un client laisse un avis' },
  new_bookings: { label: 'Nouvelles réservations', description: 'Alertes pour chaque nouvelle réservation' },
  low_stock: { label: 'Stock faible', description: 'Alertes quand le stock est bas' },
  new_delivery_available: { label: 'Livraisons disponibles', description: 'Nouvelles livraisons a prendre' },
  delivery_status_changes: { label: 'Statut livraison', description: 'Changements de statut de vos livraisons' },
  payout_updates: { label: 'Paiements', description: 'Mises a jour sur vos paiements' },
};

export type NotificationType =
  | 'new_order'
  | 'order_update'
  | 'delivery_update'
  | 'new_booking'
  | 'booking_update'
  | 'new_message'
  | 'new_review'
  | 'new_delivery_available'
  | 'promotion';

export const NOTIFICATION_ROUTES: Record<NotificationType, (data: any) => string> = {
  new_order: (d) => d.order_id ? `/order-detail?id=${d.order_id}` : '/(tabs)/orders',
  order_update: (d) => d.order_id ? `/order-detail?id=${d.order_id}` : '/(tabs)/orders',
  delivery_update: (d) => d.order_id ? `/order-detail?id=${d.order_id}` : '/(tabs)/orders',
  new_booking: (d) => d.booking_id ? `/booking-detail?id=${d.booking_id}` : '/(tabs)/orders',
  booking_update: (d) => d.booking_id ? `/booking-detail?id=${d.booking_id}` : '/(tabs)/orders',
  new_message: (d) => d.conversation_id ? `/chat/${d.conversation_id}` : '/(tabs)/chat',
  new_review: () => '/(tabs)/shop',
  new_delivery_available: () => '/(tabs)/orders',
  promotion: () => '/(tabs)/offers',
};
