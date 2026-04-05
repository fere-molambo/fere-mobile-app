import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Service } from '@/types/database';

interface ServiceFilters {
  searchQuery?: string;
  providerTypeIds?: string[];
  priceMin?: number;
  priceMax?: number;
  period?: number; // in days
  availabilityDate?: string;
}

export function useFilteredServices(filters: ServiceFilters, limit: number = 20) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
    fetchServices(true);
  }, [filters, limit]);

  const fetchServices = async (reset: boolean = false) => {
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
        .range(reset ? 0 : offset, reset ? limit - 1 : offset + limit - 1);

      if (filters.searchQuery && filters.searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
        );
      }

      if (filters.providerTypeIds && filters.providerTypeIds.length > 0) {
        const { data: shopIds } = await supabase
          .from('shop_service_types')
          .select('shop_id')
          .in('service_type_id', filters.providerTypeIds);
        const matchingShopIds = (shopIds || []).map((s: any) => s.shop_id);
        if (matchingShopIds.length > 0) {
          query = query.in('shop_id', matchingShopIds);
        } else {
          setServices([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
      }

      if (filters.priceMin !== undefined) {
        query = query.gte('price', filters.priceMin);
      }

      if (filters.priceMax !== undefined) {
        query = query.lte('price', filters.priceMax);
      }

      if (filters.period) {
        const date = new Date();
        date.setDate(date.getDate() - filters.period);
        query = query.gte('created_at', date.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const newServices = (data as Service[]) || [];

      if (reset) {
        setServices(newServices);
        setOffset(limit);
      } else {
        setServices((prev) => [...prev, ...newServices]);
        setOffset((prev) => prev + limit);
      }

      setHasMore(newServices.length === limit);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching filtered services:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchServices(false);
    }
  };

  const refresh = () => {
    setOffset(0);
    fetchServices(true);
  };

  return { services, loading, error, hasMore, loadMore, refresh };
}
