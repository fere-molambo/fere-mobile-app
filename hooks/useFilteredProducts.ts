import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';

interface ProductFilters {
  searchQuery?: string;
  categoryIds?: string[];
  subcategoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  priceTypes?: string[];
  conditions?: string[];
  inStockOnly?: boolean;
  period?: number; // in days
}

export function useFilteredProducts(filters: ProductFilters, limit: number = 20) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
    fetchProducts(true);
  }, [filters, limit]);

  const fetchProducts = async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('products')
        .select(`
          *,
          shop:shops!inner(*),
          category:product_categories!products_category_id_fkey(*),
          subcategory:product_categories!products_subcategory_id_fkey(*)
        `)
        .eq('is_active', true)
        .eq('shops.is_active', true)
        .eq('shops.verification_status', 'verified')
        .order('created_at', { ascending: false })
        .range(reset ? 0 : offset, reset ? limit - 1 : offset + limit - 1);

      if (filters.searchQuery && filters.searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
        );
      }

      if (filters.categoryIds && filters.categoryIds.length > 0) {
        query = query.in('category_id', filters.categoryIds);
      }

      if (filters.subcategoryIds && filters.subcategoryIds.length > 0) {
        query = query.in('subcategory_id', filters.subcategoryIds);
      }

      if (filters.priceMin !== undefined) {
        query = query.gte('price', filters.priceMin);
      }

      if (filters.priceMax !== undefined) {
        query = query.lte('price', filters.priceMax);
      }

      if (filters.priceTypes && filters.priceTypes.length > 0) {
        query = query.in('price_type', filters.priceTypes);
      }

      if (filters.conditions && filters.conditions.length > 0) {
        query = query.in('condition', filters.conditions);
      }

      if (filters.inStockOnly) {
        query = query.gt('quantity_available', 0);
      }

      if (filters.period) {
        const date = new Date();
        date.setDate(date.getDate() - filters.period);
        query = query.gte('created_at', date.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const newProducts = (data as Product[]) || [];

      if (reset) {
        setProducts(newProducts);
        setOffset(limit);
      } else {
        setProducts((prev) => [...prev, ...newProducts]);
        setOffset((prev) => prev + limit);
      }

      setHasMore(newProducts.length === limit);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching filtered products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchProducts(false);
    }
  };

  const refresh = () => {
    setOffset(0);
    fetchProducts(true);
  };

  return { products, loading, error, hasMore, loadMore, refresh };
}
