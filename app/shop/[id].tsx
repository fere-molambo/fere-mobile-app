import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, MapPin, Phone, Clock, Star, Package, Wrench, MessageSquare } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ProductCard from '@/components/ProductCard';
import ServiceCard from '@/components/ServiceCard';
import ReviewsSection from '@/components/ReviewsSection';
import { fetchAverageRating } from '@/lib/reviewsUtils';

const { width } = Dimensions.get('window');

type Tab = 'products' | 'services' | 'reviews';

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [shop, setShop] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopRating, setShopRating] = useState<{ average: number; count: number } | null>(null);

  useEffect(() => {
    if (id) {
      fetchShopData();
      fetchAverageRating('shop', id as string)
        .then(setShopRating)
        .catch(() => {});
    }
  }, [id]);

  const fetchShopData = async () => {
    try {
      setLoading(true);

      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .eq('verification_status', 'verified')
        .maybeSingle();

      if (shopError) throw shopError;
      if (!shopData) throw new Error('Shop not found');

      setShop(shopData);

      const { data: storiesData } = await supabase
        .from('shop_stories')
        .select('*')
        .eq('shop_id', id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      setStories(storiesData || []);

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      setProducts(productsData || []);

      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('shop_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      setServices(servicesData || []);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !shop) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  const renderProductItem = ({ item }: any) => (
    <View style={styles.cardWrapper}>
      <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} fullWidth />
    </View>
  );

  const renderServiceItem = ({ item }: any) => (
    <View style={styles.cardWrapper}>
      <ServiceCard service={item} onPress={() => router.push(`/service/${item.id}`)} fullWidth />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerTransparent: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }} style={styles.headerButton}>
              <ArrowLeft color="#fff" size={24} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.coverImage}>
          <Image
            source={{ uri: shop.banner_url || 'https://via.placeholder.com/400x200' }}
            style={styles.bannerImage}
          />
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: shop.logo_url || 'https://via.placeholder.com/100' }}
              style={styles.shopLogo}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.shopHeader}>
            <Text style={styles.shopName}>{shop.name}</Text>
            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    color="#FFB800"
                    size={16}
                    fill={star <= Math.round(shopRating?.average || 0) ? '#FFB800' : 'transparent'}
                  />
                ))}
              </View>
              {shopRating && shopRating.count > 0 ? (
                <Text style={styles.ratingText}>
                  {shopRating.average.toFixed(1)} ({shopRating.count} avis)
                </Text>
              ) : (
                <Text style={styles.ratingText}>Aucun avis</Text>
              )}
            </View>
          </View>

          <Text style={styles.shopDescription}>{shop.description || 'Aucune description'}</Text>

          <View style={styles.shopInfo}>
            {shop.address && (
              <View style={styles.infoRow}>
                <MapPin color="#666" size={20} />
                <Text style={styles.infoText}>{shop.address}</Text>
              </View>
            )}
            {shop.phone_number && (
              <View style={styles.infoRow}>
                <Phone color="#666" size={20} />
                <Text style={styles.infoText}>{shop.phone_number}</Text>
              </View>
            )}
            {shop.operating_hours && (
              <View style={styles.infoRow}>
                <Clock color="#666" size={20} />
                <Text style={styles.infoText}>{shop.operating_hours}</Text>
              </View>
            )}
          </View>

          {stories.length > 0 && (
            <View style={styles.storiesSection}>
              <Text style={styles.storiesTitle}>Stories</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesScroll}
              >
                {stories.map((story) => (
                  <TouchableOpacity key={story.id} style={styles.storyCircle}>
                    <Image
                      source={{ uri: story.media_url || 'https://via.placeholder.com/70' }}
                      style={styles.storyImage}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'products' && styles.tabActive]}
              onPress={() => setActiveTab('products')}
            >
              <Package color={activeTab === 'products' ? '#003f2f' : '#666'} size={20} />
              <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
                Produits ({products.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'services' && styles.tabActive]}
              onPress={() => setActiveTab('services')}
            >
              <Wrench color={activeTab === 'services' ? '#003f2f' : '#666'} size={20} />
              <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
                Services ({services.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
              onPress={() => setActiveTab('reviews')}
            >
              <MessageSquare color={activeTab === 'reviews' ? '#003f2f' : '#666'} size={20} />
              <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
                Avis {shopRating && shopRating.count > 0 ? `(${shopRating.count})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'products' ? (
            products.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucun produit disponible</Text>
              </View>
            ) : (
              <FlatList
                data={products}
                renderItem={renderProductItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.listContent}
                scrollEnabled={false}
              />
            )
          ) : activeTab === 'services' ? (
            services.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucun service disponible</Text>
              </View>
            ) : (
              <FlatList
                data={services}
                renderItem={renderServiceItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.listContent}
                scrollEnabled={false}
              />
            )
          ) : (
            <View style={styles.reviewsContainer}>
              <ReviewsSection
                targetType="shop"
                targetId={id as string}
                currentUserId={user?.id}
              />
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  coverImage: {
    width: width,
    height: 200,
    position: 'relative',
    overflow: 'visible',
    zIndex: 1,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    position: 'absolute',
    bottom: -50,
    left: 16,
    zIndex: 2,
  },
  shopLogo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  shopHeader: {
    marginBottom: 12,
  },
  shopName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
  },
  shopDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  shopInfo: {
    gap: 12,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  storiesSection: {
    marginBottom: 24,
  },
  storiesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  storiesScroll: {
    gap: 12,
  },
  storyCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#003f2f',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#003f2f',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#003f2f',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardWrapper: {
    width: '48%',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  reviewsContainer: {
    padding: 24,
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 14,
    color: '#999',
  },
  bottomSpacer: {
    height: 24,
  },
});
