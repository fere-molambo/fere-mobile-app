import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useCart } from '@/contexts/CartContext';
export default function CartScreen() {
  const { items, openCart, getCartCount } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (items.length > 0) {
      openCart();
    }
  }, []);

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.emptyContainer}>
          <ShoppingCart color="#d0d0d0" size={80} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptyText}>
            Ajoutez des produits ou services pour commencer
          </Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/(tabs)/offers')}>
            <Text style={styles.browseButtonText}>Parcourir les offres</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <View style={styles.emptyContainer}>
        <ShoppingCart color="#003f2f" size={60} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>{getCartCount()} article{getCartCount() > 1 ? 's' : ''} dans votre panier</Text>
        <TouchableOpacity style={styles.browseButton} onPress={openCart}>
          <Text style={styles.browseButtonText}>Voir mon panier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#003f2f',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 16,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
