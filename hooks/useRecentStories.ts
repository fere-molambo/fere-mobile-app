import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Story } from '@/types/database';

export function useRecentStories(limit: number = 5) {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
  }, [limit]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('shop_stories')
        .select(`
          *,
          shop:shops(*),
          linked_product:products(*),
          linked_service:services(*)
        `)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      const validStories = data?.filter((s: any) => s.shop != null) || [];
      setStories(validStories);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching recent stories:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchStories();
  };

  return { stories, loading, error, refresh };
}
