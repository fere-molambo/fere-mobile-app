import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Service } from '@/types/database';

export function useRecentServices(limit: number = 10, providerTypeId?: string) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, [limit, providerTypeId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('services')
        .select(`
          *,
          shop:shops!inner(*)
        `)
        .eq('is_active', true)
        .eq('shops.is_active', true)
        .eq('shops.verification_status', 'verified')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (providerTypeId) {
        query = query.eq('service_provider_type_id', providerTypeId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setServices((data as Service[]) || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchServices();
  };

  return { services, loading, error, refresh };
}
