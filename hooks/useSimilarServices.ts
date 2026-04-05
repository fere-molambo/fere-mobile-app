import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Service } from '@/types/database';

export function useSimilarServices(serviceId: string, shopId: string, limit: number = 6) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serviceId && shopId) {
      fetchSimilarServices();
    }
  }, [serviceId, shopId, limit]);

  const fetchSimilarServices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: shopTypes, error: typesError } = await supabase
        .from('shop_service_types')
        .select('service_type_id')
        .eq('shop_id', shopId);

      if (typesError) throw typesError;

      const serviceTypeIds = (shopTypes || []).map((st: any) => st.service_type_id);

      if (serviceTypeIds.length === 0) {
        setServices([]);
        return;
      }

      const { data: relatedShops, error: shopsError } = await supabase
        .from('shop_service_types')
        .select('shop_id')
        .in('service_type_id', serviceTypeIds)
        .neq('shop_id', shopId);

      if (shopsError) throw shopsError;

      const shopIds = [...new Set((relatedShops || []).map((rs: any) => rs.shop_id))];

      if (shopIds.length === 0) {
        setServices([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('services')
        .select('*, shop:shops!inner(*)')
        .eq('is_active', true)
        .eq('shops.is_active', true)
        .eq('shops.verification_status', 'verified')
        .in('shop_id', shopIds)
        .neq('id', serviceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      setServices((data as Service[]) || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching similar services:', err);
    } finally {
      setLoading(false);
    }
  };

  return { services, loading, error, refetch: fetchSimilarServices };
}
