import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { HeroCard } from '@/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const AUTO_SCROLL_INTERVAL = 5000;

export default function HeroCarousel() {
  const router = useRouter();
  const [heroCards, setHeroCards] = useState<HeroCard[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchHeroCards = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('hero_cards')
        .single();

      if (error) throw error;
      if (data?.hero_cards) {
        setHeroCards(data.hero_cards);
      }
    } catch (error) {
      console.error('Error fetching hero cards:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * (CARD_WIDTH + 16),
      animated: true,
    });
    setActiveIndex(index);
  }, []);

  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }

    autoScrollTimer.current = setInterval(() => {
      const nextIndex = (activeIndex + 1) % heroCards.length;
      scrollToIndex(nextIndex);
    }, AUTO_SCROLL_INTERVAL);
  }, [activeIndex, heroCards.length, scrollToIndex]);

  useEffect(() => {
    fetchHeroCards();
  }, [fetchHeroCards]);

  useEffect(() => {
    if (heroCards.length > 1) {
      startAutoScroll();
      return () => {
        if (autoScrollTimer.current) {
          clearInterval(autoScrollTimer.current);
        }
      };
    }
  }, [heroCards.length, activeIndex, startAutoScroll]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (CARD_WIDTH + 16));
    setActiveIndex(index);
  };

  if (loading || heroCards.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {heroCards.map((card, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => {
              const text = (card.button_text || '').toLowerCase();
              const link = (card as any).button_link;
              if (text.includes('inscri') || text.includes("s'inscri")) {
                router.push('/auth/register' as any);
              } else if (text.includes('service')) {
                router.push({ pathname: '/(tabs)/offers', params: { tab: 'services' } } as any);
              } else if (text.includes('produit')) {
                router.push('/(tabs)/offers' as any);
              } else if (link && typeof link === 'string' && link.startsWith('/')) {
                router.push(link as any);
              } else {
                router.push('/(tabs)/offers' as any);
              }
            }}
          >
            <Image
              source={{ uri: card.image_url }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.overlay} />
            <View style={styles.textContainer}>
              <Text style={styles.title}>{card.title}</Text>
              <Text style={styles.text}>{card.text}</Text>
              <View style={styles.buttonContainer}>
                <Text style={styles.buttonText}>{card.button_text}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.pagination}>
        {heroCards.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: CARD_WIDTH,
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  textContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    opacity: 0.95,
  },
  buttonContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003f2f',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#003f2f',
    width: 24,
  },
  dotInactive: {
    backgroundColor: '#d0d0d0',
  },
});
