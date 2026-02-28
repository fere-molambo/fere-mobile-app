import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, Star } from 'lucide-react-native';
import { Product } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAverageRating } from '@/lib/reviewsUtils';

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  fullWidth?: boolean;
}

export default function ProductCard({ product, onPress, fullWidth = false }: ProductCardProps) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [liveRating, setLiveRating] = useState<{ average: number; count: number } | null>(null);

  useEffect(() => {
    fetchAverageRating('product', product.id)
      .then(setLiveRating)
      .catch(() => {});
  }, [product.id]);

  const discountedPrice = product.discount_percent
    ? product.price * (1 - product.discount_percent / 100)
    : product.price;

  const handleFavoriteToggle = async () => {
    if (!user) return;

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
      } else {
        await supabase.from('favorites').insert({
          user_id: user.id,
          product_id: product.id,
        });
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const getConditionBadges = () => {
    const badges = [];
    if (product.condition) badges.push(product.condition);
    if (product.is_negotiable) badges.push('Négociable');
    if (product.is_wholesale) badges.push('En gros');
    return badges;
  };

  return (
    <TouchableOpacity style={[styles.card, fullWidth && styles.cardFullWidth]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: product.main_media_url || 'https://via.placeholder.com/300',
          }}
          style={styles.image}
          resizeMode="cover"
        />

        {product.discount_percent && product.discount_percent > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{product.discount_percent}%</Text>
          </View>
        )}

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
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={styles.productDescription} numberOfLines={2}>
          {product.description || 'Aucune description disponible'}
        </Text>

        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>{discountedPrice.toFixed(0)} FCFA</Text>
          {product.discount_percent && product.discount_percent > 0 && (
            <Text style={styles.originalPrice}>{product.price.toFixed(0)} FCFA</Text>
          )}
        </View>

        {getConditionBadges().length > 0 && (
          <View style={styles.badgesContainer}>
            {getConditionBadges().map((badge, index) => (
              <View key={index} style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.stockText}>
          {product.quantity_available > 0
            ? `${product.quantity_available} en stock`
            : 'Rupture de stock'}
        </Text>

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
          <Text style={styles.salesText}>
            {liveRating && liveRating.count > 0 ? `${liveRating.average.toFixed(1)} (${liveRating.count}) • ` : ''}{product.sales_count || 0} vendus
          </Text>
        </View>

        {product.shop && (
          <View style={styles.vendorContainer}>
            <Image
              source={{
                uri: product.shop.logo_url || 'https://via.placeholder.com/24',
              }}
              style={styles.vendorAvatar}
            />
            <Text style={styles.vendorName} numberOfLines={1}>
              {product.shop.name}
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
  contentContainer: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
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
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
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
  stockText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
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
  salesText: {
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
