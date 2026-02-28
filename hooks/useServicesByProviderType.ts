import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Service } from '@/types/database';

export function useServicesByProviderType(providerTypeId?: string, limit: number = 10) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, [providerTypeId, limit]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!providerTypeId) {
        const { data, error: fetchError } = await supabase
          .from('services')
          .select(`
            *,
            shop:shops(*)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fetchError) throw fetchError;
        setServices((data as Service[]) || []);
      } else {
        const { data: shopIds, error: shopError } = await supabase
          .from('shop_service_types')
          .select('shop_id')
          .eq('service_type_id', providerTypeId);

        if (shopError) throw shopError;

        if (!shopIds || shopIds.length === 0) {
          setServices([]);
          return;
        }

        const ids = shopIds.map(s => s.shop_id);

        const { data, error: fetchError } = await supabase
          .from('services')
          .select(`
            *,
            shop:shops(*)
          `)
          .eq('is_active', true)
          .in('shop_id', ids)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fetchError) throw fetchError;
        setServices((data as Service[]) || []);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching services by provider type:', err);
    } finally {
      setLoading(false);
    }
  };

  return { services, loading, error, refetch: fetchServices };
}
