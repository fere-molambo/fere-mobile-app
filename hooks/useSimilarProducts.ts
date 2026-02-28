import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';

export function useSimilarProducts(productId: string, categoryId: string, limit: number = 6) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productId && categoryId) {
      fetchSimilarProducts();
    }
  }, [productId, categoryId, limit]);

  const fetchSimilarProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          *,
          shop:shops(*),
          category:product_categories!products_category_id_fkey(*)
        `)
        .eq('is_active', true)
        .eq('category_id', categoryId)
        .neq('id', productId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      setProducts((data as Product[]) || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching similar products:', err);
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, error, refetch: fetchSimilarProducts };
}
