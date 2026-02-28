import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';

export function useProductDetail(productId: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productId) {
      fetchProductDetail();
    }
  }, [productId]);

  const fetchProductDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          *,
          shop:shops(*),
          category:product_categories!products_category_id_fkey(*),
          subcategory:product_categories!products_subcategory_id_fkey(*)
        `)
        .eq('id', productId)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('Product not found');
      }

      setProduct(data as Product);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching product detail:', err);
    } finally {
      setLoading(false);
    }
  };

  return { product, loading, error, refetch: fetchProductDetail };
}
