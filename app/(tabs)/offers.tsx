import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Filter } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import OffersSearchBar from '@/components/OffersSearchBar';
import RecentStoriesCarousel from '@/components/RecentStoriesCarousel';
import ShopsCarousel from '@/components/ShopsCarousel';
import ProductCard from '@/components/ProductCard';
import ServiceCard from '@/components/ServiceCard';
import AdvancedFiltersModal, { Filters } from '@/components/AdvancedFiltersModal';
import { useFilteredProducts } from '@/hooks/useFilteredProducts';
import { useFilteredServices } from '@/hooks/useFilteredServices';

type Tab = 'products' | 'services';

export default function OffersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({
    categoryIds: [],
    subcategoryIds: [],
    providerTypeIds: [],
    priceTypes: [],
    conditions: [],
    inStockOnly: false,
  });
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);

  const productFilters = useMemo(() => ({
    searchQuery,
    categoryIds: filters.categoryIds,
    subcategoryIds: filters.subcategoryIds,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    priceTypes: filters.priceTypes,
    conditions: filters.conditions,
    inStockOnly: filters.inStockOnly,
    period: filters.period,
  }), [searchQuery, filters.categoryIds, filters.subcategoryIds, filters.priceMin, filters.priceMax, filters.priceTypes, filters.conditions, filters.inStockOnly, filters.period]);

  const serviceFilters = useMemo(() => ({
    searchQuery,
    providerTypeIds: filters.providerTypeIds,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    period: filters.period,
  }), [searchQuery, filters.providerTypeIds, filters.priceMin, filters.priceMax, filters.period]);

  const {
    products,
    loading: productsLoading,
    hasMore: hasMoreProducts,
    loadMore: loadMoreProducts,
  } = useFilteredProducts(productFilters, 20);

  const {
    services,
    loading: servicesLoading,
    hasMore: hasMoreServices,
    loadMore: loadMoreServices,
  } = useFilteredServices(serviceFilters, 20);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.categoryIds.length > 0) count++;
    if (filters.subcategoryIds.length > 0) count++;
    if (filters.providerTypeIds.length > 0) count++;
    if (filters.priceTypes.length > 0) count++;
    if (filters.conditions.length > 0) count++;
    if (filters.inStockOnly) count++;
    if (filters.period) count++;
    if (filters.priceMin !== undefined) count++;
    if (filters.priceMax !== undefined) count++;
    return count;
  };

  const renderProductItem = ({ item }: any) => (
    <View style={styles.cardWrapper}>
      <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} fullWidth />
    </View>
  );

  const renderServiceItem = ({ item }: any) => (
    <View style={styles.cardWrapper}>
      <ServiceCard service={item} onPress={() => router.push(`/service/${item.id}`)} fullWidth />
    </View>
  );

  const renderFooter = () => {
    if (
      (activeTab === 'products' && !productsLoading && !hasMoreProducts) ||
      (activeTab === 'services' && !servicesLoading && !hasMoreServices)
    ) {
      return null;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#003f2f" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader notificationCount={0} cartItemsCount={0} />

      <ScrollView
        style={styles.scrollView}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <OffersSearchBar onSearch={setSearchQuery} loading={productsLoading || servicesLoading} />
        </View>

        <View style={styles.tabsWrapper}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'products' && styles.tabActive]}
              onPress={() => setActiveTab('products')}
            >
              <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
                Produits
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'services' && styles.tabActive]}
              onPress={() => setActiveTab('services')}
            >
              <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
                Services
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setFiltersModalVisible(true)}
            >
              <Filter color="#003f2f" size={20} />
              {getActiveFiltersCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <RecentStoriesCarousel />

        <ShopsCarousel />

        {!productsLoading && !servicesLoading && (
          <View style={styles.resultsCountContainer}>
            <Text style={styles.resultsCountText}>
              {activeTab === 'products'
                ? `${products.length} produit${products.length > 1 ? 's' : ''} trouvé${products.length > 1 ? 's' : ''}`
                : `${services.length} service${services.length > 1 ? 's' : ''} trouvé${services.length > 1 ? 's' : ''}`}
            </Text>
          </View>
        )}

        <View style={styles.resultsContainer}>
          {activeTab === 'products' ? (
            productsLoading && products.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003f2f" />
              </View>
            ) : products.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
              </View>
            ) : (
              <FlatList
                data={products}
                renderItem={renderProductItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.listContent}
                scrollEnabled={false}
                ListFooterComponent={renderFooter}
                onEndReached={loadMoreProducts}
                onEndReachedThreshold={0.5}
              />
            )
          ) : servicesLoading && services.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#003f2f" />
            </View>
          ) : services.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucun service trouvé</Text>
            </View>
          ) : (
            <FlatList
              data={services}
              renderItem={renderServiceItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.listContent}
              scrollEnabled={false}
              ListFooterComponent={renderFooter}
              onEndReached={loadMoreServices}
              onEndReachedThreshold={0.5}
            />
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <AdvancedFiltersModal
        visible={filtersModalVisible}
        onClose={() => setFiltersModalVisible(false)}
        onApply={setFilters}
        initialFilters={filters}
        activeTab={activeTab}
      />
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
  tabsWrapper: {
    backgroundColor: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#003f2f',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  filterButton: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  resultsCountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  resultsCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
  resultsContainer: {
    minHeight: 400,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardWrapper: {
    width: '48%',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 24,
  },
});
