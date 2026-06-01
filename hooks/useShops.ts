import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Shop } from '@/types/database';

export function useShops(limit?: number) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShops();
  }, [limit]);

  const fetchShops = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('shops')
        .select('*')
        .eq('is_active', true)
        .eq('verification_status', 'verified')
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setShops((data as Shop[]) || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching shops:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchShops();
  };

  return { shops, loading, error, refresh };
}
