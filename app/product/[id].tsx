import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Share2,
  Star,
  Package,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Store,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react-native';
import { useProductDetail } from '@/hooks/useProductDetail';
import { useSimilarProducts } from '@/hooks/useSimilarProducts';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import ProductCard from '@/components/ProductCard';
import ReviewsSection from '@/components/ReviewsSection';
import { fetchAverageRating } from '@/lib/reviewsUtils';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { product, loading } = useProductDetail(id as string);
  const { products: similarProducts } = useSimilarProducts(
    id as string,
    product?.category_id || '',
    6
  );

  const { addToCart } = useCart();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [proposedPrice, setProposedPrice] = useState('');
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [liveRating, setLiveRating] = useState<{ average: number; count: number } | null>(null);

  const [shopStatsData, setShopStatsData] = useState<{ avg: number; count: number; total: number } | null>(null);

  useEffect(() => {
    if (id) {
      fetchAverageRating('product', id as string)
        .then(setLiveRating)
        .catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    const shopId = (product as any)?.shop?.id;
    if (!shopId) return;
    let cancel = false;
    (async () => {
      try {
        const [reviewsRes, productsRes] = await Promise.all([
          supabase.from('shop_reviews').select('rating').eq('shop_id', shopId),
          supabase.from('products').select('sales_count', { count: 'exact' }).eq('shop_id', shopId).eq('is_active', true),
        ]);
        if (cancel) return;
        const ratings = (reviewsRes.data || []).map((r: any) => r.rating);
        const avg = ratings.length ? ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length : 0;
        const count = productsRes.count || 0;
        const total = (productsRes.data || []).reduce((s: number, p: any) => s + (p.sales_count || 0), 0);
        setShopStatsData({ avg, count, total });
      } catch {}
    })();
    return () => { cancel = true; };
  }, [(product as any)?.shop?.id]);

  if (loading || !product) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  const images = [
    product.main_media_url,
    product.hover_media_url,
    ...(product.media_urls || []),
  ].filter(Boolean);

  const discountedPrice = product.discount_percent
    ? product.price * (1 - product.discount_percent / 100)
    : product.price;

  const getPriceForQuantity = () => {
    if (product.price_type !== 'en_gros' || !product.quantity_intervals) {
      return discountedPrice;
    }

    const intervals = product.quantity_intervals as Array<{
      min: number;
      max: number;
      price: number;
    }>;

    for (const interval of intervals) {
      if (quantity >= interval.min && quantity <= interval.max) {
        return interval.price;
      }
    }

    return discountedPrice;
  };

  const currentPrice = getPriceForQuantity();

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(1, quantity + delta);
    if (newQuantity <= (product.quantity_available || 0)) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    setValidationError(null);

    if (product.colors && product.colors.length > 0 && !selectedColor) {
      setValidationError('Veuillez sélectionner une couleur');
      return;
    }
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      setValidationError('Veuillez sélectionner une taille');
      return;
    }

    const minQty = product.min_quantity || 1;
    if (quantity < minQty) {
      setValidationError(`Quantité minimum: ${minQty}`);
      return;
    }

    if (product.price_type === 'negoce' && proposedPrice) {
      const minPrice = product.min_auto_price ?? product.price;
      if (Number(proposedPrice) < minPrice) {
        setValidationError(`Le prix minimum accepté par le vendeur est ${minPrice.toLocaleString()} FCFA`);
        return;
      }
    }

    if (!product.shop) return;

    addToCart({
      product,
      shop: product.shop,
      quantity,
      selectedColor,
      selectedSize,
      proposedPrice: proposedPrice ? Number(proposedPrice) : null,
      unitPrice: currentPrice,
    });

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }} style={styles.headerButton}>
              <ArrowLeft color="#333" size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton}>
                <Heart color="#333" size={24} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Share2 color="#333" size={24} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.imageCarousel}>
          <Image
            source={{ uri: images[currentImageIndex] || 'https://via.placeholder.com/400' }}
            style={styles.mainImage}
            resizeMode="cover"
          />

          {images.length > 1 && (
            <>
              <TouchableOpacity style={styles.prevButton} onPress={handlePrevImage}>
                <ChevronLeft color="#fff" size={24} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextButton} onPress={handleNextImage}>
                <ChevronRight color="#fff" size={24} />
              </TouchableOpacity>

              <View style={styles.dotsContainer}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.dot, index === currentImageIndex && styles.activeDot]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailContainer}
          >
            {images.map((image, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setCurrentImageIndex(index)}
                style={[
                  styles.thumbnail,
                  index === currentImageIndex && styles.activeThumbnail,
                ]}
              >
                <Image
                  source={{ uri: image || 'https://via.placeholder.com/80' }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.contentContainer}>
          <Text style={styles.productName}>{product.name}</Text>

          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  color="#FFB800"
                  size={16}
                  fill={star <= Math.round(liveRating?.average || 0) ? '#FFB800' : 'transparent'}
                />
              ))}
            </View>
            {liveRating && liveRating.count > 0 && (
              <Text style={styles.ratingText}>
                {liveRating.average.toFixed(1)} • {liveRating.count} avis • {product.sales_count || 0} vendus
              </Text>
            )}
          </View>

          {product.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category.name}</Text>
            </View>
          )}

          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>{currentPrice.toFixed(0)} FCFA</Text>
            {product.discount_percent && product.discount_percent > 0 && (
              <Text style={styles.originalPrice}>{product.price.toFixed(0)} FCFA</Text>
            )}
          </View>

          <View style={styles.priceTypeBadge}>
            <Text style={styles.priceTypeText}>
              {product.price_type === 'unitaire'
                ? 'Prix unitaire'
                : product.price_type === 'negoce'
                ? 'Prix négociable'
                : 'Prix en gros'}
            </Text>
          </View>

          {product.price_type === 'en_gros' && product.quantity_intervals && (
            <View style={styles.wholesalePricingContainer}>
              <Text style={styles.wholesalePricingTitle}>Tarifs en gros :</Text>
              {(
                product.quantity_intervals as Array<{ min: number; max: number; price: number }>
              ).map((interval, index) => (
                <Text key={index} style={styles.wholesalePricingItem}>
                  {interval.min} - {interval.max} unités : {interval.price.toFixed(0)} FCFA
                </Text>
              ))}
            </View>
          )}

          {product.price_type === 'negoce' && (
            <View style={styles.negotiablePriceContainer}>
              <Text style={styles.negotiablePriceLabel}>Prix proposé (FCFA) :</Text>
              <TextInput
                style={[
                  styles.priceInput,
                  proposedPrice &&
                    Number(proposedPrice) < (product.min_auto_price ?? product.price) &&
                    styles.priceInputError,
                ]}
                placeholder={`Minimum: ${(product.min_auto_price ?? product.price).toLocaleString()} FCFA`}
                placeholderTextColor="#999"
                value={proposedPrice}
                onChangeText={setProposedPrice}
                keyboardType="numeric"
              />
              {proposedPrice !== '' &&
                Number(proposedPrice) < (product.min_auto_price ?? product.price) && (
                  <Text style={styles.priceHintError}>
                    Prix minimum accepté par le vendeur :{' '}
                    {(product.min_auto_price ?? product.price).toLocaleString()} FCFA
                  </Text>
                )}
            </View>
          )}

          <View style={styles.conditionContainer}>
            <Package color="#003f2f" size={20} />
            <Text style={styles.conditionText}>
              {product.condition === 'neuf' ? 'Neuf' : 'Occasion'}
            </Text>
            <Text style={styles.availabilityText}>
              {product.quantity_available} disponible(s)
            </Text>
          </View>

          {product.colors && Array.isArray(product.colors) && product.colors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Couleur :</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorsContainer}
              >
                {product.colors.map((color: any, index: number) => {
                  const isSelected = selectedColor?.hex === color.hex;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.colorOption,
                        isSelected && styles.colorOptionSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                    >
                      <View style={[styles.colorCircleWrapper, isSelected && styles.colorCircleWrapperSelected]}>
                        <View
                          style={[styles.colorCircle, { backgroundColor: color.hex || '#ccc' }]}
                        />
                        {isSelected && (
                          <View style={styles.colorCheckOverlay}>
                            <Check color="#fff" size={14} strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      {color.name && (
                        <Text style={[styles.colorName, isSelected && styles.colorNameSelected]}>
                          {color.name}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Taille :</Text>
              <View style={styles.sizesContainer}>
                {product.sizes.map((size: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.sizeOption,
                      selectedSize === size && styles.sizeOptionSelected,
                    ]}
                    onPress={() => setSelectedSize(size)}
                  >
                    <Text
                      style={[
                        styles.sizeText,
                        selectedSize === size && styles.sizeTextSelected,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantité :</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(-1)}
              >
                <Minus color="#333" size={20} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(1)}
              >
                <Plus color="#333" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {validationError && (
            <View style={styles.validationErrorContainer}>
              <Text style={styles.validationErrorText}>{validationError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.addToCartButton, addedFeedback && styles.addToCartButtonSuccess]}
            onPress={handleAddToCart}
          >
            <ShoppingCart color="#fff" size={20} />
            <Text style={styles.addToCartText}>
              {addedFeedback ? 'Ajouté !' : 'Ajouter au panier'}
            </Text>
          </TouchableOpacity>

          {product.shop && (
            <View style={styles.shopContainer}>
              <Image
                source={{ uri: product.shop.logo_url || 'https://via.placeholder.com/60' }}
                style={styles.shopAvatar}
              />
              <View style={styles.shopInfo}>
                <Text style={styles.shopName}>{product.shop.name}</Text>
                <View style={styles.shopStats}>
                  <View style={styles.shopStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} color="#FFB800" size={14}
                        fill={star <= Math.round(shopStatsData?.avg || 0) ? "#FFB800" : "transparent"} />
                    ))}
                  </View>
                  <Text style={styles.shopStatsText}>
                    {shopStatsData
                      ? `${shopStatsData.avg > 0 ? shopStatsData.avg.toFixed(1) + ' • ' : ''}${shopStatsData.count} produit${shopStatsData.count > 1 ? 's' : ''}${shopStatsData.total > 0 ? ' • ' + shopStatsData.total + ' vendu' + (shopStatsData.total > 1 ? 's' : '') : ''}`
                      : '...'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.shopActions}>
            <TouchableOpacity style={styles.shopActionButton}>
              <MessageCircle color="#003f2f" size={20} />
              <Text style={styles.shopActionText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shopActionButton}>
              <Store color="#003f2f" size={20} />
              <Text style={styles.shopActionText}>Boutique</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'description' && styles.activeTab]}
              onPress={() => setActiveTab('description')}
            >
              <Text
                style={[styles.tabText, activeTab === 'description' && styles.activeTabText]}
              >
                Description
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
              onPress={() => setActiveTab('reviews')}
            >
              <Text
                style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}
              >
                Avis
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'description' ? (
            <View style={styles.tabContent}>
              <Text style={styles.descriptionText}>
                {product.description || 'Aucune description disponible'}
              </Text>
              {product.includes && (
                <View style={styles.includesContainer}>
                  <Text style={styles.includesTitle}>Inclus :</Text>
                  <Text style={styles.includesText}>{product.includes}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.tabContent}>
              <ReviewsSection
                targetType="product"
                targetId={product.id}
                currentUserId={user?.id}
              />
            </View>
          )}

          {similarProducts.length > 0 && (
            <View style={styles.similarProductsContainer}>
              <Text style={styles.similarProductsTitle}>Produits similaires</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarProductsScroll}
              >
                {similarProducts.map((similarProduct) => (
                  <ProductCard
                    key={similarProduct.id}
                    product={similarProduct}
                    onPress={() => router.push(`/product/${similarProduct.id}`)}
                  />
                ))}
              </ScrollView>
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
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  imageCarousel: {
    width: width,
    height: width * 0.8,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  prevButton: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeDot: {
    backgroundColor: '#fff',
  },
  thumbnailContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  activeThumbnail: {
    borderColor: '#003f2f',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    padding: 16,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#003f2f',
  },
  originalPrice: {
    fontSize: 18,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  priceTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#003f2f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  priceTypeText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  wholesalePricingContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  wholesalePricingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  wholesalePricingItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  negotiablePriceContainer: {
    marginBottom: 16,
  },
  negotiablePriceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  priceInputError: {
    borderColor: '#e53935',
  },
  priceHintError: {
    fontSize: 12,
    color: '#e53935',
    marginTop: 6,
  },
  conditionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  conditionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  availabilityText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  colorsContainer: {
    gap: 12,
  },
  colorOption: {
    alignItems: 'center',
    gap: 6,
  },
  colorOptionSelected: {
    opacity: 1,
  },
  colorCircleWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  colorCircleWrapperSelected: {
    borderColor: '#003f2f',
    backgroundColor: '#f0f7f5',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  colorCheckOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  colorName: {
    fontSize: 12,
    color: '#666',
  },
  colorNameSelected: {
    color: '#003f2f',
    fontWeight: '700',
  },
  sizesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizeOption: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  sizeOptionSelected: {
    borderColor: '#003f2f',
    borderWidth: 2,
    backgroundColor: '#003f2f',
  },
  sizeText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  sizeTextSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    alignSelf: 'flex-start',
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    minWidth: 40,
    textAlign: 'center',
  },
  validationErrorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  validationErrorText: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
    fontWeight: '500',
  },
  addToCartButton: {
    flexDirection: 'row',
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  addToCartButtonSuccess: {
    backgroundColor: '#16a34a',
  },
  addToCartText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  shopContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  shopAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  shopStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shopStars: {
    flexDirection: 'row',
    gap: 2,
  },
  shopStatsText: {
    fontSize: 13,
    color: '#666',
  },
  shopActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  shopActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003f2f',
  },
  shopActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#003f2f',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#003f2f',
  },
  tabContent: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  includesContainer: {
    marginTop: 16,
  },
  includesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  includesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  similarProductsContainer: {
    marginTop: 16,
  },
  similarProductsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  similarProductsScroll: {
    gap: 12,
  },
  bottomSpacer: {
    height: 24,
  },
});
