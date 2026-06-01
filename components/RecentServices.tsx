import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import ServiceCard from './ServiceCard';
import { useRecentServices } from '@/hooks/useRecentServices';

interface RecentServicesProps {
  providerTypeId?: string | null;
}

export default function RecentServices({ providerTypeId }: RecentServicesProps) {
  const router = useRouter();
  const { services, loading } = useRecentServices(8, providerTypeId || undefined);

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
        <Text style={styles.title}>Services récents</Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.seeAllText}>Voir tout</Text>
        </TouchableOpacity>
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
