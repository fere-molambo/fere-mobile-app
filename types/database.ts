export type AppRole = 'super_admin' | 'admin' | 'equipe' | 'vendeur' | 'livreur' | 'membre';

export type Sexe = 'homme' | 'femme';
export type TrancheAge = '18-25' | '26-35' | '36-45' | '46-55' | '55+';
export type StatutMatrimonial = 'celibataire' | 'marie' | 'divorce' | 'veuf';
export type StatutProfessionnel = 'etudiant' | 'salarie' | 'entrepreneur' | 'sans_emploi' | 'retraite';
export type PieceIdentiteClientType = 'carte_etudiant' | 'cni' | 'passeport' | 'permis_conduire';
export type VehicleType = 'velo' | 'moto' | 'vehicule' | 'minivan' | 'camion';
export type StatutLegalType = 'particulier' | 'entreprise';
export type TypeOffreType = 'produits' | 'services' | 'les_deux';

export interface Profile {
  id: string;
  nom_complet: string;
  email: string;
  contact: string;
  photo_profil?: string;
  adresse?: string;
  sexe?: Sexe;
  tranche_age?: TrancheAge;
  statut_matrimonial?: StatutMatrimonial;
  statut_professionnel?: StatutProfessionnel;
  statut_legal?: StatutLegalType;
  type_offre?: TypeOffreType;
  piece_identite_client_type?: PieceIdentiteClientType;
  piece_identite_client_url?: string;
  vehicle_type?: string;
  vehicle_plate?: string;
  vehicle_color?: string;
  driver_license_url?: string;
  is_available?: boolean;
  is_online?: boolean;
  current_lat?: number;
  current_lng?: number;
  geolocalisation_lat?: number;
  geolocalisation_lng?: number;
  last_location_update?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role: AppRole;
  assigned_at: string;
  assigned_by?: string;
}

export interface DeliveryAddress {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  city: string;
  country: string;
  geolocation_lat?: number;
  geolocation_lng?: number;
  google_maps_link?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  city: string;
  commune: string;
  country: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  tags?: string[];
  google_maps_link?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface DriverZone {
  id: string;
  driver_id: string;
  zone_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  shop_type?: string;
  statut_legal?: string;
  address?: string;
  geolocation_lat?: number;
  geolocation_lng?: number;
  opening_time?: string;
  closing_time?: string;
  contact_phone?: string;
  contact_email?: string;
  support_phone?: string;
  whatsapp_catalog_link?: string;
  is_official?: boolean;
  responsible_admin_id?: string;
  verification_status?: string;
  creation_reason?: string;
  created_by?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  delivery_details?: string;
  return_policy?: string;
  guide_url?: string;
  guide_name?: string;
  delivery_zone_id?: string;
  google_maps_link?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  is_active: boolean;
  display_order?: number;
  created_at: string;
  created_by?: string;
}

export interface Product {
  id: string;
  shop_id: string;
  name: string;
  description?: string;
  includes?: string;
  category_id?: string;
  subcategory_id?: string;
  main_media_url?: string;
  hover_media_url?: string;
  video_url?: string;
  media_urls?: string[];
  price_type: 'unitaire' | 'negoce' | 'en_gros';
  price: number;
  discount_percent?: number;
  quantity_available?: number;
  min_quantity?: number;
  condition?: string;
  colors?: Array<{ name: string; hex: string }>;
  sizes?: string[];
  product_type?: string;
  quantity_intervals?: Array<{ min: number; max: number; price: number }>;
  min_auto_price?: number;
  auto_validation?: boolean;
  is_negotiable?: boolean;
  is_wholesale?: boolean;
  sales_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shop?: Shop;
  category?: ProductCategory;
  subcategory?: ProductCategory;
}

export interface ServiceType {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  shop_id: string;
  name: string;
  description?: string;
  includes?: string;
  client_preparation?: string;
  main_media_url?: string;
  hover_media_url?: string;
  video_url?: string;
  media_urls?: string[];
  portfolio_link?: string;
  price_type?: string;
  price: number;
  discount_percent?: number;
  requires_booking: boolean;
  weekly_availability?: any;
  duration?: number;
  travel_fee_type?: string;
  travel_fee_amount?: number;
  min_auto_price?: number;
  auto_validation?: boolean;
  bookings_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shop?: Shop;
}

export interface Story {
  id: string;
  shop_id: string;
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url?: string;
  duration?: number;
  link_url?: string;
  link_text?: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  shop?: Shop;
  views_count?: number;
  has_viewed?: boolean;
}

export interface StoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at: string;
}

export interface HeroCard {
  title: string;
  text: string;
  image_url: string;
  button_text: string;
  button_link: string;
}

export interface PlatformSettings {
  id: string;
  app_name: string;
  app_description: string;
  logo_principal?: string;
  hero_cards?: HeroCard[];
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  product_id?: string;
  service_id?: string;
  created_at: string;
  product?: Product;
  service?: Service;
}

export interface Order {
  id: string;
  client_id: string;
  shop_id: string;
  status: string;
  total_amount: number;
  delivery_fee?: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  service_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  product?: Product;
  service?: Service;
}

export type MessageType = 'text' | 'image' | 'audio';
export type MessageStatus = 'failed' | 'pending' | 'sent' | 'read';

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  is_muted: boolean;
  last_read_at?: string;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url?: string;
  media_type: MessageType;
  status: MessageStatus;
  read_at?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  blocked_at: string;
  blocked_by_admin: boolean;
  reason?: string;
}

export type DeliveryStatus = 'pending' | 'assigned' | 'in_progress' | 'picked_up' | 'en_route_client' | 'arrived' | 'delivered' | 'cancelled';
export type ReturnStatus = 'en_route_vendor' | 'arrived_vendor' | 'returned';
export type PayoutStatus = 'pending' | 'processing' | 'paid';

export interface PickupPoint {
  shop_name?: string;
  name?: string;
  lat: number;
  lng: number;
  address: string;
  phone?: string;
  contact_name?: string;
}

export interface DeliveryPoint {
  address: string;
  lat: number;
  lng: number;
  recipient_name: string;
  recipient_phone: string;
}

export interface DeliveryRequest {
  id: string;
  order_id?: string;
  zone_id?: string;
  driver_id?: string;
  status: DeliveryStatus;
  pickup_points?: PickupPoint[];
  pickup_point?: PickupPoint;
  delivery_point?: DeliveryPoint;
  total_distance_meters: number;
  delivery_fee: number;
  driver_earnings: number;
  assigned_at?: string;
  started_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  arrived_at_client_at?: string;
  en_route_client_at?: string;
  client_verified: boolean;
  delivery_payment_status: string;
  is_return: boolean;
  return_status?: ReturnStatus;
  original_delivery_id?: string;
  created_at: string;
  updated_at: string;
  delivery_zones?: DeliveryZone;
  order?: { order_number?: string };
}

export interface PendingPayout {
  id: string;
  recipient_id: string;
  recipient_type: string;
  order_id?: string;
  booking_id?: string;
  delivery_request_id?: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  eligible_at?: string;
  processed_at?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CancellationReason {
  id: string;
  label: string;
  applies_to?: string[];
  is_active: boolean;
  display_order: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_order' | 'new_message' | 'promotion' | 'order_update' | 'delivery_update';
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export interface ShopReview {
  id: string;
  shop_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, 'id' | 'nom_complet' | 'photo_profil'>;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, 'id' | 'nom_complet' | 'photo_profil'>;
}

export interface ServiceReview {
  id: string;
  service_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, 'id' | 'nom_complet' | 'photo_profil'>;
}

export type ReviewTargetType = 'shop' | 'product' | 'service';
export type AnyReview = ShopReview | ProductReview | ServiceReview;

export interface ReviewReply {
  id: string;
  review_id?: string;
  product_review_id?: string;
  service_review_id?: string;
  user_id: string;
  reply: string;
  created_at: string;
  updated_at?: string;
  profile?: Pick<Profile, 'id' | 'nom_complet' | 'photo_profil'>;
}

export type BookingStatus = 'pending' | 'accepted' | 'on_the_way' | 'arrived' | 'completed' | 'partial' | 'cancelled' | 'expired';
export type BookingPaymentStatus = 'pending' | 'partial' | 'paid' | 'not_required';
export type CompletionType = 'full' | 'partial';

export interface ServiceBooking {
  id: string;
  service_id: string;
  slot_id?: string;
  customer_id: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  total_price: number;
  advance_paid: number;
  notes?: string;
  delivery_address_id?: string;
  payment_method: string;
  payment_status: BookingPaymentStatus;
  payment_reference?: string;
  commission_amount: number;
  tva_amount: number;
  vendor_confirmed_at?: string;
  client_confirmed_at?: string;
  client_rating?: number;
  client_review?: string;
  vendor_arrived_at?: string;
  travel_fee: number;
  travel_fee_paid: boolean;
  vendor_on_the_way_at?: string;
  accepted_by?: string;
  accepted_at?: string;
  started_at?: string;
  arrived_at?: string;
  completed_at?: string;
  completion_type?: CompletionType;
  partial_payment_amount?: number;
  cancellation_reason_id?: string;
  cancellation_comment?: string;
  cancellation_proof_url?: string;
  vendor_dispute_comment?: string;
  balance_payment_reference?: string;
  balance_payment_status: string;
  auto_cancel_at?: string;
  created_at: string;
  updated_at: string;
  service?: Service;
  customer?: Pick<Profile, 'id' | 'nom_complet' | 'contact' | 'email' | 'photo_profil'>;
  delivery_address?: DeliveryAddress;
  cancellation_reason?: CancellationReason;
}

export interface FlashSale {
  id: string;
  product_id?: string;
  service_id?: string;
  flash_price: number;
  ends_at: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface UserToken {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  balance_after?: number;
  payment_reference?: string;
  created_at: string;
}

export interface CategoryCommission {
  id: string;
  category_id?: string;
  service_type_id?: string;
  commission_rate: number;
  commission_type?: string;
  created_at: string;
  updated_at: string;
}

export interface Refund {
  id: string;
  order_id?: string;
  booking_id?: string;
  cancellation_id?: string;
  amount: number;
  transaction_fee_deducted: number;
  net_refund: number;
  user_id: string;
  status: string;
  refund_status: string;
  original_payment_reference?: string;
  processed_at?: string;
  processed_by?: string;
  failure_reason?: string;
  created_at: string;
}

export interface Cancellation {
  id: string;
  order_id?: string;
  booking_id?: string;
  cancelled_by: string;
  canceller_role: string;
  reason_id?: string;
  custom_reason?: string;
  attachment_url?: string;
  status_at_cancellation: string;
  refund_amount: number;
  penalty_amount: number;
  delivery_fee_kept: boolean;
  requires_return: boolean;
  notes?: string;
  processed_at?: string;
  processed_by?: string;
  created_at: string;
}

export interface ShopTeamMember {
  id: string;
  shop_id: string;
  member_id: string;
  assignment_type?: string;
  is_active: boolean;
  assigned_at: string;
  assigned_by?: string;
}

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  order_status_updates?: boolean;
  delivery_tracking?: boolean;
  promotions?: boolean;
  messages?: boolean;
  booking_reminders?: boolean;
  new_orders?: boolean;
  order_cancellations?: boolean;
  new_reviews?: boolean;
  new_bookings?: boolean;
  low_stock?: boolean;
  new_delivery_available?: boolean;
  delivery_status_changes?: boolean;
  payout_updates?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LiveTrackingSession {
  id: string;
  tracker_id: string;
  tracker_role: string;
  reference_type: string;
  reference_id: string;
  current_lat?: number;
  current_lng?: number;
  heading?: number;
  speed?: number;
  is_active: boolean;
  started_at: string;
  updated_at: string;
}
