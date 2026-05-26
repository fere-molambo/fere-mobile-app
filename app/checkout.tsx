import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Plus, MapPin, Phone, TriangleAlert as AlertTriangle, Info, Store, Package, Truck } from 'lucide-react-native';
import { supabase, ensureValidSession } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

import AddressModal from '@/components/modals/AddressModal';
import type { DeliveryAddress } from '@/types/database';
import {
  calculateShopSubtotal,
  calculateDeliveryFee,
  buildCheckoutSummary,
  generateOrderNumber,
  type PlatformFees,
  type ShopOrder,
  type CheckoutSummary,
} from '@/lib/orderCalculations';
import { getPaymentCallbackUrl, redirectToPayment } from '@/lib/paymentRedirect';

function formatPrice(n: number) {
  return n.toLocaleString('fr-FR').replace(/\s/g, ' ');
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, getItemsByShop } = useCart();

  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [platformFees, setPlatformFees] = useState<PlatformFees | null>(null);
  const [commissionRates, setCommissionRates] = useState<Map<string, number>>(new Map());
  const [shopDistances, setShopDistances] = useState<Map<string, number>>(new Map());
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);

  const shopMap = getItemsByShop();
  const shopCount = shopMap.size;
  const isMultiVendor = shopCount > 1;

  useEffect(() => {
    if (!user || items.length === 0) return;
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAddresses(), loadPlatformFees(), loadCommissionRates()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAddresses = async () => {
    const { data, error: addrError } = await supabase
      .from('delivery_addresses')
      .select('*')
      .eq('user_id', user!.id)
      .order('is_default', { ascending: false });

    if (addrError) throw addrError;
    setAddresses(data || []);
    const def = data?.find((a: DeliveryAddress) => a.is_default);
    if (def) setSelectedAddressId(def.id);
    else if (data && data.length > 0) setSelectedAddressId(data[0].id);
  };

  const loadPlatformFees = async () => {
    const { data, error: feesError } = await supabase
      .from('platform_settings')
      .select('delivery_base_fee, delivery_fee_per_km, delivery_commission_fere, delivery_commission_driver, tva_rate')
      .limit(1)
      .maybeSingle();

    if (feesError) throw feesError;
    if (data) {
      setPlatformFees({
        delivery_base_fee: Number(data.delivery_base_fee) || 500,
        delivery_fee_per_km: Number(data.delivery_fee_per_km) || 100,
        delivery_commission_fere: Number(data.delivery_commission_fere) || 20,
        delivery_commission_driver: Number(data.delivery_commission_driver) || 80,
        tva_rate: Number(data.tva_rate) || 18,
      });
    }
  };

  const loadCommissionRates = async () => {
    const { data, error: commError } = await supabase
      .from('category_commissions')
      .select('category_id, commission_rate');

    if (commError) throw commError;
    const map = new Map<string, number>();
    for (const row of data || []) {
      if (row.category_id) map.set(row.category_id, Number(row.commission_rate));
    }
    setCommissionRates(map);
  };

  const calculateDistances = useCallback(async (addressId: string) => {
    const address = addresses.find((a) => a.id === addressId);
    if (!address || !address.geolocation_lat || !address.geolocation_lng) {
      const defaultDistances = new Map<string, number>();
      for (const [shopId] of shopMap) {
        defaultDistances.set(shopId, 0);
      }
      setShopDistances(defaultDistances);
      return defaultDistances;
    }

    const newDistances = new Map<string, number>();
    const destLat = address.geolocation_lat;
    const destLng = address.geolocation_lng;

    for (const [shopId, { shop }] of shopMap) {
      if (shop.geolocation_lat && shop.geolocation_lng) {
        try {
          const resp = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calculate-distance`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                origin_lat: shop.geolocation_lat,
                origin_lng: shop.geolocation_lng,
                dest_lat: destLat,
                dest_lng: destLng,
              }),
            }
          );
          const result = await resp.json();
          newDistances.set(shopId, result.distance_meters || 0);
        } catch {
          newDistances.set(shopId, 0);
        }
      } else {
        newDistances.set(shopId, 0);
      }
    }

    setShopDistances(newDistances);
    return newDistances;
  }, [addresses, shopMap]);

  useEffect(() => {
    if (!selectedAddressId || !platformFees) return;

    (async () => {
      const distances = await calculateDistances(selectedAddressId);
      buildSummary(distances);
    })();
  }, [selectedAddressId, platformFees, commissionRates, items]);

  const buildSummary = (distances: Map<string, number>) => {
    if (!platformFees) return;

    const shopOrders: ShopOrder[] = [];

    for (const [shopId, { shop, items: shopItems }] of shopMap) {
      const subtotal = calculateShopSubtotal(shopItems);
      const distanceMeters = distances.get(shopId) || 0;
      const deliveryFee = calculateDeliveryFee(distanceMeters, platformFees);
      const deliveryCommission = Math.round(deliveryFee * (platformFees.delivery_commission_fere / 100));

      let productCommissionRate = 10;
      for (const item of shopItems) {
        if (item.product.category_id && commissionRates.has(item.product.category_id)) {
          productCommissionRate = commissionRates.get(item.product.category_id)!;
          break;
        }
      }
      const productCommission = Math.round(subtotal * (productCommissionRate / 100));

      shopOrders.push({
        shop,
        items: shopItems,
        subtotal,
        deliveryFee,
        deliveryDistanceMeters: distanceMeters,
        deliveryCommission,
        productCommission,
        productCommissionRate,
      });
    }

    const result = buildCheckoutSummary(shopOrders, platformFees);
    setSummary(result);
  };

  const handleSelectAddress = async (addressId: string) => {
    setSelectedAddressId(addressId);
  };

  const handleAddressModalClose = (shouldRefresh: boolean) => {
    setAddressModalVisible(false);
    if (shouldRefresh) loadAddresses();
  };

  const handlePay = async () => {
    if (!summary || !user || !selectedAddressId || !platformFees) return;

    setSubmitting(true);
    setError(null);

    try {
      const paymentGroupId = uuidv4();
      const paymentReference = generateOrderNumber();
      const isWeb = Platform.OS === 'web';
      const callbackUrl = isWeb ? getPaymentCallbackUrl(paymentReference) : undefined;

      const deliveryAddr = addresses.find((a) => a.id === selectedAddressId);

      const checkoutSnapshot = {
        userId: user.id,
        userEmail: user.email,
        selectedAddressId,
        isMultiVendor,
        paymentGroupId,
        deliveryAddress: deliveryAddr ? {
          recipient_name: deliveryAddr.recipient_name,
          recipient_phone: deliveryAddr.recipient_phone,
          address: deliveryAddr.address,
          city: deliveryAddr.city,
          geolocation_lat: deliveryAddr.geolocation_lat || null,
          geolocation_lng: deliveryAddr.geolocation_lng || null,
        } : null,
        platformFees: {
          delivery_commission_driver: platformFees.delivery_commission_driver,
        },
        summary: {
          advanceAmount: summary.advanceAmount,
          balanceAmount: summary.balanceAmount,
          grandTotal: summary.grandTotal,
          shopOrders: summary.shopOrders.map((so) => ({
            shop: {
              id: so.shop.id,
              name: so.shop.name,
              logo_url: so.shop.logo_url || null,
              address: so.shop.address || null,
              geolocation_lat: so.shop.geolocation_lat || null,
              geolocation_lng: so.shop.geolocation_lng || null,
              delivery_zone_id: so.shop.delivery_zone_id || null,
            },
            subtotal: so.subtotal,
            deliveryFee: so.deliveryFee,
            deliveryDistanceMeters: so.deliveryDistanceMeters,
            deliveryCommission: so.deliveryCommission,
            productCommission: so.productCommission,
            productCommissionRate: so.productCommissionRate,
            items: so.items.map((item) => ({
              product: {
                id: item.product.id,
                name: item.product.name,
                category_id: item.product.category_id || null,
              },
              shopId: so.shop.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              selectedColor: item.selectedColor || null,
              selectedSize: item.selectedSize || null,
              proposedPrice: item.proposedPrice || null,
            })),
          })),
        },
      };

      await ensureValidSession();

      const { data: omResult, error: omError } = await supabase.functions.invoke('orange-money-payment', {
        body: {
          action: 'initialize',
          amount: summary.advanceAmount,
          reference: paymentReference,
          metadata: {
            payment_group_id: paymentGroupId,
            user_id: user.id,
            payment_type: 'order',
          },
          checkout_data: checkoutSnapshot,
          return_url: callbackUrl || undefined,
          cancel_url: callbackUrl || undefined,
        },
      });

      if (omError) throw new Error(omError.message || 'Erreur de paiement');

      if (!omResult.payment_url) {
        throw new Error(omResult.error || 'Erreur de paiement');
      }

      const effectiveRef = omResult.reference || paymentReference;

      if (isWeb) {
        redirectToPayment(omResult.payment_url);
        return;
      }

      router.push({
        pathname: '/payment-webview',
        params: {
          url: omResult.payment_url,
          reference: effectiveRef,
          amount: summary.advanceAmount.toString(),
          payToken: omResult.pay_token,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Votre panier est vide</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#003f2f" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <ArrowLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finaliser ma commande</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isMultiVendor && (
          <View style={styles.infoCard}>
            <AlertTriangle color="#e67e22" size={20} />
            <View style={styles.infoCardContent}>
              <Text style={styles.infoCardTitle}>{shopCount} commandes seront créées</Text>
              <Text style={styles.infoCardText}>
                Votre panier contient des produits de {shopCount} boutiques différentes. Chaque boutique recevra sa propre commande avec sa livraison dédiée.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <Info color="#3b82f6" size={20} />
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardTitle}>Paiement en 2 étapes</Text>
            <Text style={styles.infoCardText}>
              Vous payez d'abord un acompte (frais de livraison + commissions). Le solde (montant des produits) sera payé à la livraison, après vérification de votre colis.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionNumber}>1.</Text>
          <Text style={styles.sectionTitle}>Adresse de livraison</Text>
        </View>

        <View style={styles.addressSection}>
          <View style={styles.addressHeader}>
            <Text style={styles.addressLabel}>Adresse de livraison</Text>
            <TouchableOpacity style={styles.addAddressBtn} onPress={() => setAddressModalVisible(true)}>
              <Plus color="#003f2f" size={18} />
              <Text style={styles.addAddressText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {addresses.length === 0 ? (
            <View style={styles.noAddressCard}>
              <MapPin color="#999" size={24} />
              <Text style={styles.noAddressText}>Aucune adresse enregistrée</Text>
              <TouchableOpacity style={styles.addFirstAddressBtn} onPress={() => setAddressModalVisible(true)}>
                <Text style={styles.addFirstAddressText}>Ajouter une adresse</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addressCard, selectedAddressId === addr.id && styles.addressCardSelected]}
                onPress={() => handleSelectAddress(addr.id)}
              >
                <View style={[styles.radioOuter, selectedAddressId === addr.id && styles.radioOuterSelected]}>
                  {selectedAddressId === addr.id && <View style={styles.radioInner} />}
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressName}>{addr.label}</Text>
                  <Text style={styles.addressDetail}>{addr.address}</Text>
                  <Text style={styles.addressCity}>{addr.city}, {addr.country}</Text>
                  <View style={styles.addressContactRow}>
                    <MapPin color="#ef4444" size={12} />
                    <Text style={styles.addressContact}>{addr.recipient_name}</Text>
                    <Phone color="#666" size={12} />
                    <Text style={styles.addressContact}>{addr.recipient_phone}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {summary && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Récapitulatif</Text>
            </View>

            <View style={styles.recapHeader}>
              <Truck color="#333" size={20} />
              <Text style={styles.recapHeaderText}>{summary.shopOrders.length} commande{summary.shopOrders.length > 1 ? 's' : ''} à créer</Text>
              {isMultiVendor && (
                <View style={styles.vendorBadge}>
                  <Text style={styles.vendorBadgeText}>{shopCount} vendeurs</Text>
                </View>
              )}
            </View>

            {summary.shopOrders.map((shopOrder, index) => (
              <View key={shopOrder.shop.id} style={styles.shopOrderCard}>
                <View style={styles.shopOrderHeader}>
                  <Image
                    source={{ uri: shopOrder.shop.logo_url || 'https://via.placeholder.com/32' }}
                    style={styles.shopLogo}
                  />
                  <Text style={styles.shopOrderName}>{shopOrder.shop.name}</Text>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>Commande {index + 1}</Text>
                  </View>
                </View>

                {shopOrder.items.map((item) => (
                  <View key={item.id} style={styles.orderItemRow}>
                    <Package color="#666" size={14} />
                    <Text style={styles.orderItemName}>{item.product.name} x{item.quantity}</Text>
                    <Text style={styles.orderItemPrice}>{formatPrice(item.unitPrice * item.quantity)} FCFA</Text>
                  </View>
                ))}

                <View style={styles.orderItemRow}>
                  <Truck color="#666" size={14} />
                  <Text style={styles.orderItemName}>Livraison</Text>
                  <Text style={styles.orderItemPrice}>{formatPrice(shopOrder.deliveryFee)} FCFA</Text>
                </View>
              </View>
            ))}

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sous-total produits</Text>
                <Text style={styles.summaryValue}>{formatPrice(summary.totalSubtotal)} FCFA</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Frais de livraison</Text>
                <Text style={styles.summaryValue}>{formatPrice(summary.totalDeliveryFee)} FCFA</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelSmall}>Commission livraison</Text>
                <Text style={styles.summaryValueSmall}>{formatPrice(summary.totalDeliveryCommission)} FCFA</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelSmall}>Commission produit</Text>
                <Text style={styles.summaryValueSmall}>{formatPrice(summary.totalProductCommission)} FCFA</Text>
              </View>
            </View>

            <View style={styles.advanceCard}>
              <Text style={styles.advanceTitle}>Acompte à payer maintenant</Text>
              <Text style={styles.advanceAmount}>{formatPrice(summary.advanceAmount)} FCFA</Text>
              <Text style={styles.advanceSubtitle}>Livraison + commissions</Text>
            </View>

            <View style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <Info color="#666" size={16} />
                <View style={styles.balanceContent}>
                  <Text style={styles.balanceTitle}>Solde à payer à la livraison</Text>
                  <Text style={styles.balanceAmount}>{formatPrice(summary.balanceAmount)} FCFA</Text>
                  <Text style={styles.balanceSubtitle}>Montant des produits</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {summary && selectedAddressId && (
        <View style={styles.payFooter}>
          <TouchableOpacity
            style={[styles.payBtn, submitting && styles.payBtnDisabled]}
            onPress={handlePay}
            disabled={submitting || !selectedAddressId}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payBtnText}>
                Payer l'acompte : {formatPrice(summary.advanceAmount)} FCFA
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <AddressModal
        visible={addressModalVisible}
        address={null}
        userId={user?.id || ''}
        onClose={handleAddressModalClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addressSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#003f2f',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003f2f',
  },
  noAddressCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noAddressText: {
    fontSize: 14,
    color: '#999',
  },
  addFirstAddressBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  addFirstAddressText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 10,
    gap: 12,
  },
  addressCardSelected: {
    borderColor: '#003f2f',
    backgroundColor: '#f0f7f5',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioOuterSelected: {
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
  },
  addressName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  addressDetail: {
    fontSize: 13,
    color: '#666',
  },
  addressCity: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  addressContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addressContact: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  recapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  recapHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  vendorBadge: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  vendorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  shopOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  shopOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shopLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  shopOrderName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  orderBadge: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    color: '#444',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#333',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  summaryLabelSmall: {
    fontSize: 13,
    color: '#888',
  },
  summaryValueSmall: {
    fontSize: 13,
    color: '#888',
  },
  advanceCard: {
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  advanceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  advanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  advanceSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  balanceContent: {
    flex: 1,
  },
  balanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  balanceSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
  },
  payFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  payBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
