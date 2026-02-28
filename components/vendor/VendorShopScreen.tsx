import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Store, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { resolveVendorShopIds } from '@/lib/vendorUtils';
import AppHeader from '@/components/AppHeader';
import ShopInfoTab from '@/components/vendor/ShopInfoTab';
import ShopProductsTab from '@/components/vendor/ShopProductsTab';
import ShopReviewsTab from '@/components/vendor/ShopReviewsTab';
import ProductFormModal from '@/components/vendor/ProductFormModal';
import ServiceFormModal from '@/components/vendor/ServiceFormModal';
import type { AppRole } from '@/types/database';

interface ShopFull {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  support_phone: string | null;
  google_maps_link: string | null;
  whatsapp_catalog_link: string | null;
  opening_time: string | null;
  closing_time: string | null;
  is_active: boolean;
  verification_status: string | null;
  delivery_details: string | null;
  return_policy: string | null;
}

interface ProductItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  price_type: string;
  main_media_url?: string | null;
  media_urls?: string[] | null;
  is_active: boolean;
  quantity_available?: number | null;
  condition?: string | null;
  discount_percent?: number | null;
  includes?: string | null;
  min_quantity?: number | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  product_type?: string | null;
  min_auto_price?: number | null;
  auto_validation?: boolean | null;
  colors?: Array<{ name: string; hex: string }> | null;
  sizes?: string[] | null;
}

interface ServiceItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  price_type?: string | null;
  main_media_url?: string | null;
  media_urls?: string[] | null;
  is_active: boolean;
  requires_booking: boolean;
  discount_percent?: number | null;
  includes?: string | null;
  client_preparation?: string | null;
  duration?: number | null;
  travel_fee_type?: string | null;
  travel_fee_amount?: number | null;
  portfolio_link?: string | null;
  min_auto_price?: number | null;
  auto_validation?: boolean | null;
  weekly_availability?: any | null;
}

interface Props {
  userId: string;
  userRole: AppRole;
}

type ShopTab = 'infos' | 'produits' | 'marketing' | 'avis';

const TABS: { key: ShopTab; label: string }[] = [
  { key: 'infos', label: 'Infos' },
  { key: 'produits', label: 'Produits' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'avis', label: 'Avis' },
];

export default function VendorShopScreen({ userId, userRole }: Props) {
  const [shop, setShop] = useState<ShopFull | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ShopTab>('infos');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [productModal, setProductModal] = useState(false);
  const [serviceModal, setServiceModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      const shopIds = await resolveVendorShopIds(userId, userRole);
      if (shopIds.length === 0) { setLoading(false); return; }
      const shopId = shopIds[0];

      const [shopRes, productsRes, servicesRes] = await Promise.all([
        supabase.from('shops').select('*').eq('id', shopId).maybeSingle(),
        supabase.from('products')
          .select('id, name, description, price, price_type, main_media_url, media_urls, is_active, quantity_available, condition, discount_percent, includes, min_quantity, category_id, subcategory_id, product_type, min_auto_price, auto_validation, colors, sizes')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
        supabase.from('services')
          .select('id, name, description, price, price_type, main_media_url, media_urls, is_active, requires_booking, discount_percent, includes, client_preparation, duration, travel_fee_type, travel_fee_amount, portfolio_link, min_auto_price, auto_validation, weekly_availability')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
      ]);

      if (shopRes.data) setShop(shopRes.data as ShopFull);
      setProducts((productsRes.data || []) as ProductItem[]);
      setServices((servicesRes.data || []) as ServiceItem[]);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChangeLogo = async () => {
    if (!shop) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingLogo(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `${shop.id}/logo_${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      await supabase.storage.from('shop-logos').upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });
      const { data: urlData } = supabase.storage.from('shop-logos').getPublicUrl(fileName);

      await supabase.from('shops').update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('id', shop.id);
      await loadData();
    } catch (err) {
      console.error('Logo upload error:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleEditProduct = (p: ProductItem) => {
    setEditingProduct(p);
    setProductModal(true);
  };

  const handleEditService = (s: ServiceItem) => {
    setEditingService(s);
    setServiceModal(true);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />
        <View style={styles.centered}>
          <Store color="#ccc" size={48} />
          <Text style={styles.emptyTitle}>Aucune boutique</Text>
          <Text style={styles.emptyText}>Aucune boutique active associee a votre compte.</Text>
        </View>
      </View>
    );
  }

  const renderTabContent = () => {
    switch (tab) {
      case 'infos':
        return <ShopInfoTab shop={shop} onUpdate={loadData} />;
      case 'produits':
        return (
          <ShopProductsTab
            products={products}
            services={services}
            onRefresh={loadData}
            onEditProduct={handleEditProduct}
            onEditService={handleEditService}
            onCreateProduct={() => { setEditingProduct(null); setProductModal(true); }}
            onCreateService={() => { setEditingService(null); setServiceModal(true); }}
          />
        );
      case 'marketing':
        return (
          <View style={styles.placeholderTab}>
            <Text style={styles.placeholderTitle}>Marketing</Text>
            <Text style={styles.placeholderText}>Les outils marketing seront disponibles prochainement</Text>
          </View>
        );
      case 'avis':
        return <ShopReviewsTab shopId={shop.id} userId={userId} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader hideCart />

      <View style={styles.shopHeader}>
        {shop.banner_url ? (
          <Image source={{ uri: shop.banner_url }} style={styles.banner} />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]} />
        )}
        <View style={styles.logoArea}>
          {shop.logo_url ? (
            <Image source={{ uri: shop.logo_url }} style={styles.logo} resizeMode="cover" />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Store color="#ccc" size={24} />
            </View>
          )}
          <TouchableOpacity style={styles.cameraBtn} onPress={handleChangeLogo} disabled={uploadingLogo}>
            {uploadingLogo ? (
              <ActivityIndicator size="small" color="#003f2f" />
            ) : (
              <Camera size={14} color="#003f2f" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.shopMeta}>
        <Text style={styles.shopName}>{shop.name}</Text>
        {shop.slug && <Text style={styles.shopSlug}>@{shop.slug}</Text>}
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>

      <ProductFormModal
        visible={productModal}
        shopId={shop.id}
        product={editingProduct}
        onClose={() => { setProductModal(false); setEditingProduct(null); }}
        onSaved={loadData}
      />

      <ServiceFormModal
        visible={serviceModal}
        shopId={shop.id}
        service={editingService}
        onClose={() => { setServiceModal(false); setEditingService(null); }}
        onSaved={loadData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
  shopHeader: { backgroundColor: '#fff', position: 'relative', overflow: 'visible', zIndex: 1 },
  banner: { width: '100%', height: 140 },
  bannerPlaceholder: { backgroundColor: '#d4c5b0' },
  logoArea: { position: 'absolute', bottom: -28, left: 20, zIndex: 2 },
  logo: {
    width: 64, height: 64, borderRadius: 12, borderWidth: 3, borderColor: '#fff',
    backgroundColor: '#f0f0f0', overflow: 'hidden',
  },
  logoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cameraBtn: {
    position: 'absolute', bottom: -4, right: -4,
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
  },
  shopMeta: { backgroundColor: '#fff', paddingTop: 36, paddingBottom: 16, paddingHorizontal: 20 },
  shopName: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  shopSlug: { fontSize: 14, color: '#888', marginTop: 2 },
  tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  tabBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  tabBtnActive: { backgroundColor: '#003f2f', borderColor: '#003f2f' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },
  tabContent: { flex: 1 },
  placeholderTab: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  placeholderText: { fontSize: 14, color: '#999', textAlign: 'center' },
});
