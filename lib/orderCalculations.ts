import type { CartItem } from '@/contexts/CartContext';
import type { Shop } from '@/types/database';

export interface PlatformFees {
  delivery_base_fee: number;
  delivery_fee_per_km: number;
  delivery_commission_fere: number;
  delivery_commission_driver: number;
  tva_rate: number;
}

export interface ShopOrder {
  shop: Shop;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  deliveryDistanceMeters: number;
  deliveryCommission: number;
  productCommission: number;
  productCommissionRate: number;
}

export interface CheckoutSummary {
  shopOrders: ShopOrder[];
  totalSubtotal: number;
  totalDeliveryFee: number;
  totalDeliveryCommission: number;
  totalProductCommission: number;
  advanceAmount: number;
  balanceAmount: number;
  grandTotal: number;
}

export function calculateShopSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.proposedPrice || item.unitPrice) * item.quantity, 0);
}

export function calculateDeliveryFee(distanceMeters: number, fees: PlatformFees): number {
  const distanceKm = distanceMeters / 1000;
  if (distanceKm <= 0) return fees.delivery_base_fee;
  return Math.round(fees.delivery_base_fee + distanceKm * fees.delivery_fee_per_km);
}

export function buildCheckoutSummary(
  shopOrders: ShopOrder[],
  fees: PlatformFees
): CheckoutSummary {
  let totalSubtotal = 0;
  let totalDeliveryFee = 0;
  let totalDeliveryCommission = 0;
  let totalProductCommission = 0;

  for (const order of shopOrders) {
    totalSubtotal += order.subtotal;
    totalDeliveryFee += order.deliveryFee;
    totalDeliveryCommission += order.deliveryCommission;
    totalProductCommission += order.productCommission;
  }

  const advanceAmount = totalDeliveryFee + totalDeliveryCommission + totalProductCommission;
  const balanceAmount = totalSubtotal;
  const grandTotal = advanceAmount + balanceAmount;

  return {
    shopOrders,
    totalSubtotal,
    totalDeliveryFee,
    totalDeliveryCommission,
    totalProductCommission,
    advanceAmount,
    balanceAmount,
    grandTotal,
  };
}

export function generateOrderNumber(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return `FERE_${ts}_${rand}`;
}
