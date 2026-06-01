import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Share2,
  Star,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Store,
  Minus,
  Plus,
  Clock,
  ExternalLink,
  Truck,
  RotateCcw,
} from 'lucide-react-native';
import { useServiceDetail } from '@/hooks/useServiceDetail';
import { useSimilarServices } from '@/hooks/useSimilarServices';
import { useAuth } from '@/contexts/AuthContext';
import ServiceCard from '@/components/ServiceCard';
import ReviewsSection from '@/components/ReviewsSection';
import { fetchAverageRating } from '@/lib/reviewsUtils';

const { width } = Dimensions.get('window');

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { service, loading } = useServiceDetail(id as string);
  const { services: similarServices } = useSimilarServices(
    id as string,
    service?.shop_id || '',
    6
  );

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');
  const [liveRating, setLiveRating] = useState<{ average: number; count: number } | null>(null);
  const [proposedPrice, setProposedPrice] = useState<string>('');
  const [proposedPriceError, setProposedPriceError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchAverageRating('service', id as string)
        .then(setLiveRating)
        .catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    if (service?.price_type === 'negoce') {
      setProposedPrice(String(service.price));
    }
  }, [service]);

  if (loading || !service) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  const images = [
    service.main_media_url,
    service.hover_media_url,
    ...(service.media_urls || []),
  ].filter(Boolean);

  const discountedPrice = service.discount_percent
    ? service.price * (1 - service.discount_percent / 100)
    : service.price;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(1, quantity + delta);
    setQuantity(newQuantity);
  };

  const handlePortfolioPress = () => {
    if (service.portfolio_link) {
      Linking.openURL(service.portfolio_link);
    }
  };

  const handleProposedPriceChange = (val: string) => {
    setProposedPriceError(null);
    setProposedPrice(val);
  };

  const validateAndBook = () => {
    if (service.price_type === 'negoce') {
      const parsed = Number(proposedPrice);
      if (!proposedPrice || isNaN(parsed) || parsed <= 0) {
        setProposedPriceError('Veuillez entrer un montant valide.');
        return;
      }
      if (service.min_auto_price && parsed < service.min_auto_price) {
        setProposedPriceError(`Le montant minimum est ${service.min_auto_price.toFixed(0)} FCFA.`);
        return;
      }
      if (parsed > service.price) {
        setProposedPriceError(`Le montant maximum est ${service.price.toFixed(0)} FCFA.`);
        return;
      }
      router.push(`/booking/${service.id}?proposedPrice=${parsed}`);
    } else {
      router.push(`/booking/${service.id}`);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
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
          <Text style={styles.serviceName}>{service.name}</Text>

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
                {liveRating.average.toFixed(1)} • {liveRating.count} avis • {service.bookings_count || 0} réservations
              </Text>
            )}
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>{discountedPrice.toFixed(0)} FCFA</Text>
            {service.discount_percent && service.discount_percent > 0 && (
              <Text style={styles.originalPrice}>{service.price.toFixed(0)} FCFA</Text>
            )}
            {service.price_type && (
              <Text style={styles.priceTypeText}>/{service.price_type}</Text>
            )}
          </View>

          {service.duration && (
            <View style={styles.durationContainer}>
              <Clock color="#003f2f" size={20} />
              <Text style={styles.durationText}>Durée : {service.duration} min</Text>
            </View>
          )}

          {service.travel_fee_amount && service.travel_fee_amount > 0 && (
            <View style={styles.travelFeeContainer}>
              <Truck color="#666" size={20} />
              <Text style={styles.travelFeeText}>
                Frais de déplacement : {service.travel_fee_amount.toFixed(0)} FCFA
                {service.travel_fee_type && ` (${service.travel_fee_type})`}
              </Text>
            </View>
          )}

          {service.portfolio_link && (
            <TouchableOpacity style={styles.portfolioButton} onPress={handlePortfolioPress}>
              <ExternalLink color="#003f2f" size={20} />
              <Text style={styles.portfolioText}>Voir le portfolio</Text>
            </TouchableOpacity>
          )}

          {service.price_type === 'negoce' && (
            <View style={styles.negoceContainer}>
              <Text style={styles.negoceTitle}>Proposer un prix</Text>
              <Text style={styles.negoceHint}>
                {service.min_auto_price
                  ? `Fourchette acceptee : ${service.min_auto_price.toFixed(0)} – ${service.price.toFixed(0)} FCFA`
                  : `Prix maximum : ${service.price.toFixed(0)} FCFA`}
              </Text>
              <TextInput
                style={[styles.negoceInput, proposedPriceError ? styles.negoceInputError : null]}
                keyboardType="numeric"
                placeholder={`Prix propose (FCFA)`}
                placeholderTextColor="#aaa"
                value={proposedPrice}
                onChangeText={handleProposedPriceChange}
              />
              {proposedPriceError && (
                <Text style={styles.negoceError}>{proposedPriceError}</Text>
              )}
            </View>
          )}

          {!service.requires_booking && (
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
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (service.requires_booking) {
                validateAndBook();
              }
            }}
          >
            <Text style={styles.actionButtonText}>
              {service.requires_booking ? 'Réserver' : 'Commander'}
            </Text>
          </TouchableOpacity>

          {service.includes && (
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Ce qui est inclus :</Text>
              <Text style={styles.infoText}>{service.includes}</Text>
            </View>
          )}

          {service.client_preparation && (
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Préparation client :</Text>
              <Text style={styles.infoText}>{service.client_preparation}</Text>
            </View>
          )}

          {service.shop && (
            <View style={styles.shopContainer}>
              <Image
                source={{ uri: service.shop.logo_url || 'https://via.placeholder.com/60' }}
                style={styles.shopAvatar}
              />
              <View style={styles.shopInfo}>
                <Text style={styles.shopName}>{service.shop.name}</Text>
                <View style={styles.shopStats}>
                  <View style={styles.shopStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} color="#FFB800" size={14} fill="#FFB800" />
                    ))}
                  </View>
                  <Text style={styles.shopStatsText}>
                    4.8 • 156 services • 1.2k réservations
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
                {service.description || 'Aucune description disponible'}
              </Text>
            </View>
          ) : (
            <View style={styles.tabContent}>
              <ReviewsSection
                targetType="service"
                targetId={service.id}
                currentUserId={user?.id}
              />
            </View>
          )}

          {similarServices.length > 0 && (
            <View style={styles.similarServicesContainer}>
              <Text style={styles.similarServicesTitle}>Prestations similaires</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarServicesScroll}
              >
                {similarServices.map((similarService) => (
                  <ServiceCard
                    key={similarService.id}
                    service={similarService}
                    onPress={() => router.push(`/service/${similarService.id}`)}
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
  serviceName: {
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
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
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
  priceTypeText: {
    fontSize: 16,
    color: '#666',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  durationText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  travelFeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  travelFeeText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  portfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003f2f',
    marginBottom: 24,
  },
  portfolioText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
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
  actionButton: {
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
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
  noReviewsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  similarServicesContainer: {
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: -16,
  },
  similarServicesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  similarServicesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bottomSpacer: {
    height: 24,
  },
  negoceContainer: {
    backgroundColor: '#f8fdf8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8e6c0',
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  negoceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  negoceHint: {
    fontSize: 13,
    color: '#555',
  },
  negoceInput: {
    borderWidth: 1,
    borderColor: '#c8e6c0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fff',
    marginTop: 4,
  },
  negoceInputError: {
    borderColor: '#dc2626',
  },
  negoceError: {
    fontSize: 13,
    color: '#dc2626',
  },
});
