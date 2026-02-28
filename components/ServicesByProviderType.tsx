import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import ServiceCard from './ServiceCard';
import { useServicesByProviderType } from '@/hooks/useServicesByProviderType';

interface ServicesByProviderTypeProps {
  providerTypeId?: string;
  providerTypeName: string;
  onSeeAll?: () => void;
}

export default function ServicesByProviderType({
  providerTypeId,
  providerTypeName,
  onSeeAll,
}: ServicesByProviderTypeProps) {
  const router = useRouter();
  const { services, loading } = useServicesByProviderType(providerTypeId, 8);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  if (services.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{providerTypeName}</Text>
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
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={() => router.push(`/service/${service.id}`)}
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
