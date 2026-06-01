import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Heart } from 'lucide-react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';

export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Favoris" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Heart color="#003f2f" size={40} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Aucun favori pour l'instant</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez des produits ou services à vos favoris pour les retrouver facilement ici.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e8f3f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
});
