import { supabase } from '@/lib/supabase';
import type { AppRole } from '@/types/database';

export async function resolveVendorShopIds(userId: string, role: AppRole): Promise<string[]> {
  if (role === 'vendeur') {
    const { data } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', userId)
      .eq('is_active', true);
    return (data || []).map((s) => s.id);
  }

  if (role === 'equipe') {
    const { data } = await supabase
      .from('shop_team_members')
      .select('shop_id')
      .eq('member_id', userId)
      .eq('is_active', true);
    return (data || []).map((s) => s.shop_id);
  }

  return [];
}

export async function getVendorServiceIds(shopIds: string[]): Promise<string[]> {
  if (shopIds.length === 0) return [];
  const { data } = await supabase
    .from('services')
    .select('id')
    .in('shop_id', shopIds);
  return (data || []).map((s) => s.id);
}

export function isVendorRole(role?: string): boolean {
  return role === 'vendeur' || role === 'equipe';
}
