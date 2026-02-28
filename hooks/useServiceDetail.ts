import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Service } from '@/types/database';

export function useServiceDetail(serviceId: string) {
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serviceId) {
      fetchServiceDetail();
    }
  }, [serviceId]);

  const fetchServiceDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('services')
        .select(`
          *,
          shop:shops(*)
        `)
        .eq('id', serviceId)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('Service not found');
      }

      setService(data as Service);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching service detail:', err);
    } finally {
      setLoading(false);
    }
  };

  return { service, loading, error, refetch: fetchServiceDetail };
}
