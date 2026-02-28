import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useShops } from '@/hooks/useShops';

interface AllShopsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AllShopsModal({ visible, onClose }: AllShopsModalProps) {
  const router = useRouter();
  const { shops, loading } = useShops();

  const handleShopPress = (shopId: string) => {
    onClose();
    router.push(`/shop/${shopId}`);
  };

  const renderShopItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.shopItem}
      onPress={() => handleShopPress(item.id)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.logo_url || 'https://via.placeholder.com/60' }}
        style={styles.shopLogo}
      />
      <View style={styles.shopInfo}>
        <Text style={styles.shopName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description && (
          <Text style={styles.shopDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Toutes les boutiques</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X color="#333" size={24} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003f2f" />
          </View>
        ) : (
          <FlatList
            data={shops}
            renderItem={renderShopItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shopLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  shopDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});
