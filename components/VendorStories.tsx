import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { X, Store as StoreIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Story, Shop } from '@/types/database';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StoryWithShop extends Story {
  shop: Shop;
  linked_product?: any;
  linked_service?: any;
  linked_product_id?: string;
  linked_service_id?: string;
}

export default function VendorStories() {
  const { user } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<StoryWithShop[]>([]);
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [selectedStory, setSelectedStory] = useState<StoryWithShop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const { data: storiesData, error } = await supabase
        .from('shop_stories')
        .select(`
          *,
          shop:shops(*),
          linked_product:products(*),
          linked_service:services(*)
        `)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (storiesData) {
        const validStories = storiesData.filter((s: any) => s.shop != null) as StoryWithShop[];
        setStories(validStories);

        if (user) {
          const { data: viewsData } = await supabase
            .from('story_views')
            .select('story_id')
            .eq('viewer_id', user.id);

          if (viewsData) {
            setViewedStories(new Set(viewsData.map((v) => v.story_id)));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryPress = async (story: StoryWithShop) => {
    setSelectedStory(story);

    if (user && !viewedStories.has(story.id)) {
      await supabase.from('story_views').insert({
        story_id: story.id,
        viewer_id: user.id,
      });

      setViewedStories((prev) => new Set([...prev, story.id]));
    }
  };

  const handleCloseStory = () => {
    setSelectedStory(null);
  };

  if (loading || stories.length === 0) {
    return null;
  }

  const groupedStories = stories.reduce((acc, story) => {
    const shopId = story.shop_id;
    if (!acc[shopId]) {
      acc[shopId] = [];
    }
    acc[shopId].push(story);
    return acc;
  }, {} as Record<string, StoryWithShop[]>);

  return (
    <>
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {Object.entries(groupedStories).map(([shopId, shopStories]) => {
            const firstStory = shopStories[0];
            const hasUnviewedStories = shopStories.some(
              (s) => !viewedStories.has(s.id)
            );

            return (
              <TouchableOpacity
                key={shopId}
                style={styles.storyItem}
                onPress={() => handleStoryPress(firstStory)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.storyCircle,
                    hasUnviewedStories
                      ? styles.storyCircleUnviewed
                      : styles.storyCircleViewed,
                  ]}
                >
                  <View style={styles.storyImageContainer}>
                    <Image
                      source={{
                        uri:
                          firstStory.shop.logo_url ||
                          'https://via.placeholder.com/70',
                      }}
                      style={styles.storyImage}
                    />
                  </View>
                </View>
                <Text style={styles.storyName} numberOfLines={1}>
                  {firstStory.shop.name.substring(0, 10)}
                  {firstStory.shop.name.length > 10 ? '...' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Modal
        visible={selectedStory !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={handleCloseStory}
      >
        {selectedStory && (
          <View style={styles.modalContainer}>
            <Image
              source={{ uri: selectedStory.media_url }}
              style={styles.storyFullImage}
              resizeMode="contain"
            />

            <View style={styles.storyHeader}>
              <View style={styles.progressBar}>
                <View style={styles.progressFill} />
              </View>

              <View style={styles.storyHeaderContent}>
                <View style={styles.headerLeft}>
                  <Image
                    source={{
                      uri:
                        selectedStory.shop.logo_url ||
                        'https://via.placeholder.com/32',
                    }}
                    style={styles.storyHeaderAvatar}
                  />
                  <Text style={styles.storyHeaderName}>
                    {selectedStory.shop.name}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.shopButton}
                  onPress={() => {
                    router.push(`/shop/${selectedStory.shop_id}`);
                    handleCloseStory();
                  }}
                >
                  <StoreIcon color="#fff" size={20} />
                  <Text style={styles.shopButtonText}>Voir boutique</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseStory}
              >
                <X color="#fff" size={28} />
              </TouchableOpacity>
            </View>

            {(selectedStory.linked_product || selectedStory.linked_service) && (
              <View style={styles.linkedItemContainer}>
                <View style={styles.linkedItemContent}>
                  <Image
                    source={{
                      uri:
                        selectedStory.linked_product?.main_media_url ||
                        selectedStory.linked_service?.main_media_url ||
                        'https://via.placeholder.com/60',
                    }}
                    style={styles.linkedItemImage}
                  />
                  <View style={styles.linkedItemInfo}>
                    <Text style={styles.linkedItemName} numberOfLines={1}>
                      {selectedStory.linked_product?.name ||
                        selectedStory.linked_service?.name}
                    </Text>
                    <Text style={styles.linkedItemPrice}>
                      {selectedStory.linked_product?.price?.toFixed(0) ||
                        selectedStory.linked_service?.price?.toFixed(0)}{' '}
                      FCFA
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewItemButton}
                    onPress={() => {
                      if (selectedStory.linked_product) {
                        router.push(`/product/${selectedStory.linked_product_id}`);
                      } else if (selectedStory.linked_service) {
                        router.push(`/service/${selectedStory.linked_service_id}`);
                      }
                      handleCloseStory();
                    }}
                  >
                    <Text style={styles.viewItemButtonText}>Voir produit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  storyItem: {
    alignItems: 'center',
    width: 70,
  },
  storyCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 3,
    marginBottom: 4,
  },
  storyCircleUnviewed: {
    backgroundColor: '#003f2f',
  },
  storyCircleViewed: {
    backgroundColor: '#d0d0d0',
  },
  storyImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyFullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  storyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    width: '100%',
  },
  storyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  storyHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 63, 47, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    padding: 4,
  },
  linkedItemContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  linkedItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  linkedItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  linkedItemInfo: {
    flex: 1,
  },
  linkedItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  linkedItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#003f2f',
  },
  viewItemButton: {
    backgroundColor: '#003f2f',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  viewItemButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
