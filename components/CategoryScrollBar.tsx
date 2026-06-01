import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { useProductCategories } from '@/hooks/useProductCategories';

interface CategoryScrollBarProps {
  onCategorySelect?: (categoryId: string | null) => void;
}

export default function CategoryScrollBar({ onCategorySelect }: CategoryScrollBarProps) {
  const { categories, loading } = useProductCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategoryPress = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    onCategorySelect?.(categoryId);
  };

  if (loading || categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[
            styles.categoryItem,
            selectedCategory === null && styles.categoryItemSelected,
          ]}
          onPress={() => handleCategoryPress(null)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.iconContainer,
              selectedCategory === null && styles.iconContainerSelected,
            ]}
          >
            <ShoppingBag
              color={selectedCategory === null ? '#fff' : '#003f2f'}
              size={24}
            />
          </View>
          <Text
            style={[
              styles.categoryName,
              selectedCategory === null && styles.categoryNameSelected,
            ]}
          >
            Toutes
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryItem,
              selectedCategory === category.id && styles.categoryItemSelected,
            ]}
            onPress={() => handleCategoryPress(category.id)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                selectedCategory === category.id && styles.iconContainerSelected,
              ]}
            >
              <ShoppingBag
                color={selectedCategory === category.id ? '#fff' : '#003f2f'}
                size={24}
              />
            </View>
            <Text
              style={[
                styles.categoryName,
                selectedCategory === category.id && styles.categoryNameSelected,
              ]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
  },
  categoryItemSelected: {
    opacity: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconContainerSelected: {
    backgroundColor: '#003f2f',
    borderColor: '#003f2f',
  },
  categoryName: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: '#003f2f',
    fontWeight: '700',
  },
});
