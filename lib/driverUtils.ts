import { Linking, Platform } from 'react-native';
import { DeliveryStatus, ReturnStatus } from '@/types/database';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

export const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, StatusConfig> = {
  pending: { label: 'En attente', color: '#e67e22', bgColor: '#fef3c7' },
  assigned: { label: 'Acceptee', color: '#3b82f6', bgColor: '#dbeafe' },
  in_progress: { label: 'En cours', color: '#0891b2', bgColor: '#cffafe' },
  picked_up: { label: 'Recuperee', color: '#7c3aed', bgColor: '#ede9fe' },
  en_route_client: { label: 'En route', color: '#2563eb', bgColor: '#dbeafe' },
  arrived: { label: 'Arrivee', color: '#059669', bgColor: '#d1fae5' },
  delivered: { label: 'Livree', color: '#16a34a', bgColor: '#dcfce7' },
  cancelled: { label: 'Annulee', color: '#ef4444', bgColor: '#fee2e2' },
};

export const RETURN_STATUS_CONFIG: Record<ReturnStatus, StatusConfig> = {
  en_route_vendor: { label: 'En route vendeur', color: '#d97706', bgColor: '#fef3c7' },
  arrived_vendor: { label: 'Arrive vendeur', color: '#d97706', bgColor: '#fef3c7' },
  returned: { label: 'Retourne', color: '#16a34a', bgColor: '#dcfce7' },
};

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatEarnings(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function openGPSNavigation(lat: number, lng: number) {
  const url = Platform.select({
    ios: `maps:0,0?q=${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  if (url) Linking.openURL(url);
}

export function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`);
}

export function getNextAction(status: DeliveryStatus, isReturn: boolean, returnStatus?: ReturnStatus): {
  label: string;
  nextStatus: DeliveryStatus;
  nextReturnStatus?: ReturnStatus;
  timestampField?: string;
} | null {
  if (isReturn) {
    if (status === 'assigned' && returnStatus === 'en_route_vendor') {
      return {
        label: 'Demarrer vers vendeur',
        nextStatus: 'in_progress',
        timestampField: 'started_at',
      };
    }
    if (status === 'in_progress' && returnStatus === 'en_route_vendor') {
      return {
        label: 'Arrive chez vendeur',
        nextStatus: 'arrived',
        nextReturnStatus: 'arrived_vendor',
        timestampField: 'arrived_at_client_at',
      };
    }
    return null;
  }

  switch (status) {
    case 'assigned':
      return { label: 'Demarrer vers vendeur', nextStatus: 'in_progress', timestampField: 'started_at' };
    case 'in_progress':
      return { label: 'Colis recupere', nextStatus: 'picked_up', timestampField: 'picked_up_at' };
    case 'picked_up':
      return { label: 'En route vers client', nextStatus: 'en_route_client', timestampField: 'en_route_client_at' };
    case 'en_route_client':
      return { label: 'Arrive chez client', nextStatus: 'arrived', timestampField: 'arrived_at_client_at' };
    default:
      return null;
  }
}
