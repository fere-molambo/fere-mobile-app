import { supabase } from '@/lib/supabase';
import type { Profile, Message } from '@/types/database';

export interface ChatContact {
  id: string;
  nom_complet: string;
  photo_profil?: string;
  role?: string;
}

export interface ConversationWithDetails {
  id: string;
  last_message_at: string | null;
  other_participant: {
    id: string;
    nom_complet: string;
    photo_profil?: string;
  };
  last_message: {
    content: string;
    media_type: string;
    sender_id: string;
    created_at: string;
  } | null;
  unread_count: number;
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `il y a ${diffD} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function getLastMessagePreview(message: { content: string; media_type: string } | null): string {
  if (!message) return '';
  if (message.media_type === 'image') return 'Image';
  if (message.media_type === 'audio') return 'Note vocale';
  if (!message.content) return '';
  return message.content.length > 40 ? message.content.substring(0, 40) + '...' : message.content;
}

async function fetchProfilesByIds(ids: string[]): Promise<ChatContact[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, nom_complet, photo_profil')
    .in('id', ids);
  return (data || []) as ChatContact[];
}

export async function getMemberContacts(userId: string): Promise<ChatContact[]> {
  const contactIds = new Set<string>();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, shop_id')
    .eq('user_id', userId)
    .not('status', 'in', '("delivered","cancelled")');

  const orderIds = (orders || []).map((o: any) => o.id);
  const shopIds = [...new Set((orders || []).map((o: any) => o.shop_id))];

  if (orderIds.length > 0) {
    const { data: deliveries } = await supabase
      .from('delivery_requests')
      .select('driver_id')
      .in('order_id', orderIds)
      .not('driver_id', 'is', null)
      .not('status', 'in', '("delivered","cancelled")');
    (deliveries || []).forEach((d: any) => {
      if (d.driver_id && d.driver_id !== userId) contactIds.add(d.driver_id);
    });
  }

  if (shopIds.length > 0) {
    const { data: shops } = await supabase
      .from('shops')
      .select('owner_id')
      .in('id', shopIds);
    (shops || []).forEach((s: any) => {
      if (s.owner_id && s.owner_id !== userId) contactIds.add(s.owner_id);
    });

    const { data: teamMembers } = await supabase
      .from('shop_team_members')
      .select('member_id')
      .in('shop_id', shopIds);
    (teamMembers || []).forEach((t: any) => {
      if (t.member_id && t.member_id !== userId) contactIds.add(t.member_id);
    });
  }

  const { data: admins } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['admin', 'super_admin']);
  (admins || []).forEach((a: any) => {
    if (a.user_id && a.user_id !== userId) contactIds.add(a.user_id);
  });

  const profiles = await fetchProfilesByIds([...contactIds]);

  const adminIds = new Set((admins || []).map((a: any) => a.user_id));
  return profiles.map((p) => ({
    ...p,
    role: adminIds.has(p.id) ? 'Admin' : undefined,
  }));
}

export async function getDriverContacts(userId: string): Promise<ChatContact[]> {
  const contactIds = new Set<string>();

  const { data: deliveries } = await supabase
    .from('delivery_requests')
    .select('order_id')
    .eq('driver_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const orderIds = [...new Set((deliveries || []).map((d: any) => d.order_id).filter(Boolean))];

  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('user_id, shop_id')
      .in('id', orderIds);

    const shopIds = [...new Set((orders || []).map((o: any) => o.shop_id))];

    (orders || []).forEach((o: any) => {
      if (o.user_id && o.user_id !== userId) contactIds.add(o.user_id);
    });

    if (shopIds.length > 0) {
      const { data: shops } = await supabase
        .from('shops')
        .select('owner_id')
        .in('id', shopIds);
      (shops || []).forEach((s: any) => {
        if (s.owner_id && s.owner_id !== userId) contactIds.add(s.owner_id);
      });

      const { data: teamMembers } = await supabase
        .from('shop_team_members')
        .select('member_id')
        .in('shop_id', shopIds);
      (teamMembers || []).forEach((t: any) => {
        if (t.member_id && t.member_id !== userId) contactIds.add(t.member_id);
      });
    }
  }

  const { data: admins } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['admin', 'super_admin']);
  (admins || []).forEach((a: any) => {
    if (a.user_id && a.user_id !== userId) contactIds.add(a.user_id);
  });

  const profiles = await fetchProfilesByIds([...contactIds]);
  const adminIds = new Set((admins || []).map((a: any) => a.user_id));
  return profiles.map((p) => ({
    ...p,
    role: adminIds.has(p.id) ? 'Admin' : undefined,
  }));
}

export async function getConversations(userId: string): Promise<ConversationWithDetails[]> {
  const { data: participations } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  if (!participations || participations.length === 0) return [];

  const convoIds = participations.map((p: any) => p.conversation_id);

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, last_message_at')
    .in('id', convoIds)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (!conversations || conversations.length === 0) return [];

  const { data: allParticipants } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', convoIds);

  const otherUserIds = new Set<string>();
  const convoOtherUser: Record<string, string> = {};
  (allParticipants || []).forEach((p: any) => {
    if (p.user_id !== userId) {
      otherUserIds.add(p.user_id);
      convoOtherUser[p.conversation_id] = p.user_id;
    }
  });

  const profiles = await fetchProfilesByIds([...otherUserIds]);
  const profileMap: Record<string, ChatContact> = {};
  profiles.forEach((p) => { profileMap[p.id] = p; });

  const results: ConversationWithDetails[] = [];

  for (const convo of conversations) {
    const otherId = convoOtherUser[convo.id];
    const profile = profileMap[otherId];
    if (!profile) continue;

    const { data: lastMsg } = await supabase
      .from('messages')
      .select('content, media_type, sender_id, created_at')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', convo.id)
      .neq('sender_id', userId)
      .neq('status', 'read');

    results.push({
      id: convo.id,
      last_message_at: convo.last_message_at,
      other_participant: {
        id: profile.id,
        nom_complet: profile.nom_complet,
        photo_profil: profile.photo_profil,
      },
      last_message: lastMsg as any,
      unread_count: count || 0,
    });
  }

  return results;
}

export async function startConversation(userId: string, otherUserId: string): Promise<string> {
  if (!userId || !otherUserId) {
    throw new Error('Utilisateur non identifié');
  }

  const { data: myConvos } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  if (myConvos && myConvos.length > 0) {
    const convoIds = myConvos.map((c: any) => c.conversation_id);
    const { data: match } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', convoIds)
      .limit(1)
      .maybeSingle();

    if (match) return match.conversation_id;
  }

  const { data: newConvo, error } = await supabase
    .from('conversations')
    .insert({
      last_message_at: new Date().toISOString(),
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !newConvo) throw new Error('Impossible de creer la conversation');

  const { error: participantsError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: newConvo.id, user_id: userId },
      { conversation_id: newConvo.id, user_id: otherUserId },
    ]);

  if (participantsError) {
    await supabase.from('conversations').delete().eq('id', newConvo.id);
    throw new Error('Impossible de creer la conversation');
  }

  return newConvo.id;
}
