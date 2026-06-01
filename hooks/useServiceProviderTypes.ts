import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ServiceProviderType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
}

export function useServiceProviderTypes() {
  const [providerTypes, setProviderTypes] = useState<ServiceProviderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviderTypes();
  }, []);

  const fetchProviderTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_provider_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setProviderTypes(data || []);
    } catch (err) {
      console.error('Error fetching provider types:', err);
      setError(err instanceof Error ? err.message : 'Failed to load provider types');
    } finally {
      setLoading(false);
    }
  };

  return { providerTypes, loading, error, refetch: fetchProviderTypes };
}
