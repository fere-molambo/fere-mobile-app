import { supabase } from '@/lib/supabase';
import type { ProductReview, ServiceReview, ShopReview, ReviewReply, ReviewTargetType } from '@/types/database';

const TABLE_MAP: Record<ReviewTargetType, string> = {
  product: 'product_reviews',
  service: 'service_reviews',
  shop: 'shop_reviews',
};

const FK_MAP: Record<ReviewTargetType, string> = {
  product: 'product_id',
  service: 'service_id',
  shop: 'shop_id',
};

const REPLY_FK_MAP: Record<ReviewTargetType, string> = {
  shop: 'review_id',
  product: 'product_review_id',
  service: 'service_review_id',
};

export type ReviewWithProfile = (ProductReview | ServiceReview | ShopReview) & {
  profile?: { id: string; nom_complet: string; photo_profil?: string };
  replies?: ReviewReplyWithProfile[];
};

export type ReviewReplyWithProfile = ReviewReply & {
  profile?: { id: string; nom_complet: string; photo_profil?: string };
};

export async function fetchReviews(
  targetType: ReviewTargetType,
  targetId: string
): Promise<ReviewWithProfile[]> {
  const table = TABLE_MAP[targetType];
  const fk = FK_MAP[targetType];

  const { data, error } = await supabase
    .from(table)
    .select('*, profile:profiles(id, nom_complet, photo_profil)')
    .eq(fk, targetId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ReviewWithProfile[];
}

export async function fetchRepliesForReview(
  reviewId: string,
  targetType: ReviewTargetType
): Promise<ReviewReplyWithProfile[]> {
  const replyFk = REPLY_FK_MAP[targetType];

  const { data, error } = await supabase
    .from('review_replies')
    .select('*, profile:profiles(id, nom_complet, photo_profil)')
    .eq(replyFk, reviewId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as ReviewReplyWithProfile[];
}

export async function submitReview(
  targetType: ReviewTargetType,
  targetId: string,
  userId: string,
  rating: number,
  comment: string
): Promise<void> {
  const table = TABLE_MAP[targetType];
  const fk = FK_MAP[targetType];

  const { error } = await supabase.from(table).insert({
    [fk]: targetId,
    user_id: userId,
    rating,
    comment: comment.trim() || null,
  });

  if (error) throw error;
}

export async function updateReview(
  targetType: ReviewTargetType,
  reviewId: string,
  rating: number,
  comment: string
): Promise<void> {
  const table = TABLE_MAP[targetType];

  const { error } = await supabase
    .from(table)
    .update({ rating, comment: comment.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', reviewId);

  if (error) throw error;
}

export async function deleteReview(
  targetType: ReviewTargetType,
  reviewId: string
): Promise<void> {
  const table = TABLE_MAP[targetType];

  const { error } = await supabase.from(table).delete().eq('id', reviewId);
  if (error) throw error;
}

export async function submitReply(
  targetType: ReviewTargetType,
  reviewId: string,
  userId: string,
  replyText: string
): Promise<void> {
  const replyFk = REPLY_FK_MAP[targetType];

  const { error } = await supabase.from('review_replies').insert({
    [replyFk]: reviewId,
    user_id: userId,
    reply: replyText.trim(),
  });

  if (error) throw error;
}

export async function fetchAverageRating(
  targetType: ReviewTargetType,
  targetId: string
): Promise<{ average: number; count: number }> {
  const table = TABLE_MAP[targetType];
  const fk = FK_MAP[targetType];

  const { data, error } = await supabase
    .from(table)
    .select('rating')
    .eq(fk, targetId);

  if (error) throw error;

  const reviews = data || [];
  if (reviews.length === 0) return { average: 0, count: 0 };

  const sum = reviews.reduce((acc: number, r: any) => acc + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}
