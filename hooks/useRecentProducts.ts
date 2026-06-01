import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';

export function useRecentProducts(categoryId?: string, limit: number = 10) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [categoryId, limit]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('products')
        .select(`
          *,
          shop:shops!inner(*),
          category:product_categories!products_category_id_fkey(*)
        `)
        .eq('is_active', true)
        .eq('shops.is_active', true)
        .eq('shops.verification_status', 'verified')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setProducts((data as Product[]) || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchProducts();
  };

  return { products, loading, error, refresh };
}
