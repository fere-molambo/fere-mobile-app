import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, Star, ExternalLink, Clock } from 'lucide-react-native';
import { Service } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAverageRating } from '@/lib/reviewsUtils';

interface ServiceCardProps {
  service: Service;
  onPress?: () => void;
  fullWidth?: boolean;
}

export default function ServiceCard({ service, onPress, fullWidth = false }: ServiceCardProps) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [liveRating, setLiveRating] = useState<{ average: number; count: number } | null>(null);

  useEffect(() => {
    fetchAverageRating('service', service.id)
      .then(setLiveRating)
      .catch(() => {});
  }, [service.id]);

  const discountedPrice = service.discount_percent
    ? service.price * (1 - service.discount_percent / 100)
    : service.price;

  const handleFavoriteToggle = async () => {
    if (!user) return;

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('service_id', service.id);
      } else {
        await supabase.from('favorites').insert({
          user_id: user.id,
          service_id: service.id,
        });
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const getServiceBadges = () => {
    const badges = [];
    if (service.requires_booking) badges.push('Réservation requise');
    if (service.travel_fee_amount && service.travel_fee_amount > 0) {
      badges.push('Frais déplacement');
    }
    return badges;
  };

  return (
    <TouchableOpacity style={[styles.card, fullWidth && styles.cardFullWidth]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: service.main_media_url || 'https://via.placeholder.com/300',
          }}
          style={styles.image}
          resizeMode="cover"
        />

        {service.discount_percent != null && service.discount_percent > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{service.discount_percent}%</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleFavoriteToggle}
          activeOpacity={0.7}
        >
          <Heart
            color={isFavorite ? '#ff4444' : '#fff'}
            size={20}
            fill={isFavorite ? '#ff4444' : 'transparent'}
          />
        </TouchableOpacity>

        {service.portfolio_link && (
          <View style={styles.portfolioBadge}>
            <ExternalLink color="#fff" size={16} />
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {service.name}
        </Text>

        <Text style={styles.serviceDescription} numberOfLines={2}>
          {service.description || 'Aucune description disponible'}
        </Text>

        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>{discountedPrice.toFixed(0)} FCFA</Text>
          {service.discount_percent != null && service.discount_percent > 0 ? (
            <Text style={styles.originalPrice}>{service.price.toFixed(0)} FCFA</Text>
          ) : null}
          {service.price_type && (
            <Text style={styles.priceType}>/{service.price_type}</Text>
          )}
        </View>

        {service.duration != null && service.duration > 0 ? (
          <View style={styles.durationContainer}>
            <Clock color="#666" size={14} />
            <Text style={styles.durationText}>{service.duration} min</Text>
          </View>
        ) : null}

        {getServiceBadges().length > 0 && (
          <View style={styles.badgesContainer}>
            {getServiceBadges().map((badge, index) => (
              <View key={index} style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.ratingContainer}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                color="#FFB800"
                size={14}
                fill={star <= Math.round(liveRating?.average || 0) ? '#FFB800' : 'transparent'}
              />
            ))}
          </View>
          <Text style={styles.bookingsText}>
            {liveRating && liveRating.count > 0 ? `${liveRating.average.toFixed(1)} (${liveRating.count}) • ` : ''}{service.bookings_count || 0} réservations
          </Text>
        </View>

        {service.shop && (
          <View style={styles.vendorContainer}>
            <Image
              source={{
                uri: service.shop.logo_url || 'https://via.placeholder.com/24',
              }}
              style={styles.vendorAvatar}
            />
            <Text style={styles.vendorName} numberOfLines={1}>
              {service.shop.name}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    width: 280,
  },
  cardFullWidth: {
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portfolioBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 63, 47, 0.8)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003f2f',
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  priceType: {
    fontSize: 14,
    color: '#666',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  durationText: {
    fontSize: 13,
    color: '#666',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  bookingsText: {
    fontSize: 12,
    color: '#666',
  },
  vendorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  vendorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  vendorName: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
});
