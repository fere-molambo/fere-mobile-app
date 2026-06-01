import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import AppHeader from '@/components/AppHeader';
import SearchBar from '@/components/SearchBar';
import HeroCarousel from '@/components/HeroCarousel';
import VendorStories from '@/components/VendorStories';
import RecentProducts from '@/components/RecentProducts';
import CategoryScrollBar from '@/components/CategoryScrollBar';
import RecentServices from '@/components/RecentServices';
import ServiceProviderTypesScroll from '@/components/ServiceProviderTypesScroll';
import { useAuth } from '@/contexts/AuthContext';
import DriverHomeScreen from '@/components/driver/DriverHomeScreen';
import VendorHomeScreen from '@/components/vendor/VendorHomeScreen';

export default function HomeScreen() {
  const { userRole, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProviderType, setSelectedProviderType] = useState<string | null>(null);

  if (userRole === 'livreur' && user) {
    return <DriverHomeScreen userId={user.id} />;
  }

  if ((userRole === 'vendeur' || userRole === 'equipe') && user) {
    const VendorOrdersScreen = require('@/components/vendor/VendorOrdersScreen').default;
    return <VendorOrdersScreen userId={user.id} userRole={userRole} />;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleSearch = (query: string) => {
    console.log('Searching for:', query);
  };

  return (
    <View style={styles.container}>
      <AppHeader notificationCount={3} cartItemsCount={0} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <SearchBar onSearch={handleSearch} />

        <HeroCarousel />

        <VendorStories />

        <CategoryScrollBar onCategorySelect={setSelectedCategory} />

        <RecentProducts categoryId={selectedCategory} />

        <ServiceProviderTypesScroll onTypeSelect={setSelectedProviderType} />

        <RecentServices providerTypeId={selectedProviderType} />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  bottomSpacer: {
    height: 24,
  },
});
