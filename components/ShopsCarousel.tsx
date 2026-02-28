import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Store, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useShops } from '@/hooks/useShops';
import AllShopsModal from './AllShopsModal';

export default function ShopsCarousel() {
  const router = useRouter();
  const { shops, loading } = useShops(10);
  const [modalVisible, setModalVisible] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#003f2f" />
      </View>
    );
  }

  if (shops.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Boutiques</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {shops.map((shop) => (
            <TouchableOpacity
              key={shop.id}
              style={styles.shopCard}
              onPress={() => router.push(`/shop/${shop.id}`)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: shop.logo_url || 'https://via.placeholder.com/80' }}
                style={styles.shopLogo}
              />
              <Text style={styles.shopName} numberOfLines={1}>
                {shop.name}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.seeAllCard}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.seeAllIcon}>
              <Store color="#003f2f" size={32} />
              <ChevronRight color="#003f2f" size={20} style={styles.chevronIcon} />
            </View>
            <Text style={styles.seeAllText}>Voir toutes{'\n'}les boutiques</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <AllShopsModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  shopCard: {
    width: 100,
    alignItems: 'center',
    gap: 8,
  },
  shopLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  shopName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    width: '100%',
  },
  seeAllCard: {
    width: 100,
    alignItems: 'center',
    gap: 8,
  },
  seeAllIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f7f5',
    borderWidth: 2,
    borderColor: '#003f2f',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f2f',
    textAlign: 'center',
  },
});
