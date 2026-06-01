import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import ProductCard from './ProductCard';
import { useRecentProducts } from '@/hooks/useRecentProducts';

interface ProductsByCategoryProps {
  categoryId?: string;
  categoryName: string;
  onSeeAll?: () => void;
}

export default function ProductsByCategory({
  categoryId,
  categoryName,
  onSeeAll,
}: ProductsByCategoryProps) {
  const router = useRouter();
  const { products, loading } = useRecentProducts(categoryId, 8);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{categoryName}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>Voir tout</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onPress={() => router.push(`/product/${product.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
