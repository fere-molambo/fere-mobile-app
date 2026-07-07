import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
  RefreshControl, TouchableOpacity, TextInput,
} from 'react-native';
import { Star, MessageSquare, Send, ChevronDown, ChevronUp, Package, Wrench, Store } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { ReviewTargetType } from '@/types/database';
import {
  fetchRepliesForReview,
  submitReply,
  type ReviewReplyWithProfile,
} from '@/lib/reviewsUtils';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  profile: { nom_complet: string; photo_profil: string | null } | null;
  reviewType: ReviewTargetType;
  targetName?: string;
}

interface Props {
  shopId: string;
  userId: string;
}

type FilterType = 'all' | 'shop' | 'product' | 'service';

function ReplyItem({ reply }: { reply: ReviewReplyWithProfile }) {
  const name = reply.profile?.nom_complet || 'Membre';
  const avatar = reply.profile?.photo_profil;
  const date = new Date(reply.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short',
  });

  return (
    <View style={styles.replyItem}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.replyAvatar} />
      ) : (
        <View style={styles.replyAvatarPlaceholder}>
          <Text style={styles.replyAvatarInitial}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.replyBody}>
        <View style={styles.replyHeader}>
          <Text style={styles.replyAuthor}>{name}</Text>
          <Text style={styles.replyDate}>{date}</Text>
        </View>
        <Text style={styles.replyText}>{reply.reply}</Text>
      </View>
    </View>
  );
}

function ReviewCard({ review, userId }: { review: Review; userId: string }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ReviewReplyWithProfile[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const loadReplies = useCallback(async () => {
    if (loadingReplies) return;
    setLoadingReplies(true);
    try {
      const data = await fetchRepliesForReview(review.id, review.reviewType);
      setReplies(data);
    } catch {} finally {
      setLoadingReplies(false);
    }
  }, [review.id, review.reviewType]);

  const handleToggleReplies = () => {
    if (!showReplies) loadReplies();
    setShowReplies((v) => !v);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await submitReply(review.reviewType, review.id, userId, replyText);
      setReplyText('');
      loadReplies();
    } catch {} finally {
      setSendingReply(false);
    }
  };

  const typeConfig = {
    shop: { label: 'Boutique', icon: Store, color: '#003f2f', bg: '#e8f5e9' },
    product: { label: 'Produit', icon: Package, color: '#2563eb', bg: '#dbeafe' },
    service: { label: 'Service', icon: Wrench, color: '#c2410c', bg: '#ffedd5' },
  };
  const config = typeConfig[review.reviewType];
  const TypeIcon = config.icon;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        {review.profile?.photo_profil ? (
          <Image source={{ uri: review.profile.photo_profil }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>{(review.profile?.nom_complet || 'A')[0]}</Text>
          </View>
        )}
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewerName}>{review.profile?.nom_complet || 'Anonyme'}</Text>
          <View style={styles.starsSmall}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={14} color="#f59e0b" fill={s <= review.rating ? '#f59e0b' : 'transparent'} />
            ))}
          </View>
        </View>
        <Text style={styles.reviewDate}>
          {new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </Text>
      </View>

      <View style={styles.typeBadgeRow}>
        <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
          <TypeIcon size={12} color={config.color} />
          <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
        </View>
        {review.targetName && (
          <Text style={styles.targetName} numberOfLines={1}>{review.targetName}</Text>
        )}
      </View>

      {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}

      <TouchableOpacity style={styles.repliesToggle} onPress={handleToggleReplies}>
        <Text style={styles.repliesToggleText}>
          {showReplies ? 'Masquer' : 'Repondre'}
        </Text>
        {showReplies ? <ChevronUp color="#666" size={14} /> : <ChevronDown color="#666" size={14} />}
      </TouchableOpacity>

      {showReplies && (
        <View style={styles.repliesSection}>
          {loadingReplies ? (
            <ActivityIndicator size="small" color="#003f2f" style={{ marginVertical: 8 }} />
          ) : replies.length > 0 ? (
            replies.map((r) => <ReplyItem key={r.id} reply={r} />)
          ) : (
            <Text style={styles.noRepliesText}>Aucune réponse</Text>
          )}

          <View style={styles.replyInputRow}>
            <TextInput
              style={styles.replyInput}
              placeholder="Votre réponse..."
              placeholderTextColor="#aaa"
              value={replyText}
              onChangeText={setReplyText}
              multiline
            />
            <TouchableOpacity
              onPress={handleSendReply}
              disabled={sendingReply || !replyText.trim()}
              style={[
                styles.replySendBtn,
                (!replyText.trim() || sendingReply) && styles.replySendBtnDisabled,
              ]}
            >
              {sendingReply ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send color="#fff" size={16} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function ShopReviewsTab({ shopId, userId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadReviews = async () => {
    try {
      const [shopRes, productRes, serviceRes] = await Promise.all([
        supabase
          .from('shop_reviews')
          .select('id, rating, comment, created_at, user_id, profile:profiles(nom_complet, photo_profil)')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('product_reviews')
          .select('id, rating, comment, created_at, user_id, product:products!inner(name, shop_id), profile:profiles(nom_complet, photo_profil)')
          .eq('product.shop_id', shopId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('service_reviews')
          .select('id, rating, comment, created_at, user_id, service:services!inner(name, shop_id), profile:profiles(nom_complet, photo_profil)')
          .eq('service.shop_id', shopId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const shopReviews: Review[] = (shopRes.data || []).map((r: any) => ({
        ...r, reviewType: 'shop' as const, targetName: undefined,
      }));
      const productReviews: Review[] = (productRes.data || []).map((r: any) => ({
        id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
        user_id: r.user_id, profile: r.profile, reviewType: 'product' as const,
        targetName: r.product?.name,
      }));
      const serviceReviews: Review[] = (serviceRes.data || []).map((r: any) => ({
        id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
        user_id: r.user_id, profile: r.profile, reviewType: 'service' as const,
        targetName: r.service?.name,
      }));

      const all = [...shopReviews, ...productReviews, ...serviceReviews]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setReviews(all);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReviews(); }, [shopId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const filtered = filter === 'all' ? reviews : reviews.filter((r) => r.reviewType === filter);

  const avgRating = filtered.length > 0
    ? Math.round((filtered.reduce((s, r) => s + r.rating, 0) / filtered.length) * 10) / 10
    : 0;

  const counts = {
    all: reviews.length,
    shop: reviews.filter((r) => r.reviewType === 'shop').length,
    product: reviews.filter((r) => r.reviewType === 'product').length,
    service: reviews.filter((r) => r.reviewType === 'service').length,
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: `Tous (${counts.all})` },
    { key: 'shop', label: `Boutique (${counts.shop})` },
    { key: 'product', label: `Produits (${counts.product})` },
    { key: 'service', label: `Services (${counts.service})` },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#003f2f" />}
    >
      {reviews.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.avgNumber}>{avgRating}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={20} color="#f59e0b" fill={s <= Math.round(avgRating) ? '#f59e0b' : 'transparent'} />
            ))}
          </View>
          <Text style={styles.reviewCount}>{filtered.length} avis</Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <MessageSquare color="#ccc" size={40} />
          <Text style={styles.emptyTitle}>Aucun avis</Text>
          <Text style={styles.emptyText}>Les avis de vos clients apparaitront ici</Text>
        </View>
      ) : (
        filtered.map((r) => (
          <ReviewCard key={`${r.reviewType}-${r.id}`} review={r} userId={userId} />
        ))
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  scrollContent: { padding: 16 },
  summary: {
    alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 24,
    marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0',
  },
  avgNumber: { fontSize: 40, fontWeight: '800', color: '#1a1a1a' },
  stars: { flexDirection: 'row', gap: 4, marginTop: 8 },
  reviewCount: { fontSize: 14, color: '#666', marginTop: 8 },
  filterScroll: { marginBottom: 12 },
  filterBar: { gap: 8 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  filterBtnActive: { backgroundColor: '#003f2f', borderColor: '#003f2f' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptyText: { fontSize: 14, color: '#999' },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { fontSize: 16, fontWeight: '700', color: '#003f2f' },
  reviewMeta: { flex: 1 },
  reviewerName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  starsSmall: { flexDirection: 'row', gap: 2, marginTop: 2 },
  reviewDate: { fontSize: 12, color: '#aaa' },
  typeBadgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  targetName: { fontSize: 13, color: '#555', flex: 1 },
  reviewComment: { fontSize: 14, color: '#555', lineHeight: 22, marginTop: 8 },
  repliesToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 12, alignSelf: 'flex-start',
  },
  repliesToggleText: { fontSize: 12, color: '#666', fontWeight: '600' },
  repliesSection: {
    marginTop: 10, paddingLeft: 12,
    borderLeftWidth: 2, borderLeftColor: '#e0e0e0',
  },
  noRepliesText: { fontSize: 12, color: '#bbb', marginBottom: 8 },
  replyItem: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  replyAvatar: { width: 28, height: 28, borderRadius: 14 },
  replyAvatarPlaceholder: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#003f2f',
    justifyContent: 'center', alignItems: 'center',
  },
  replyAvatarInitial: { color: '#fff', fontSize: 12, fontWeight: '700' },
  replyBody: { flex: 1 },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  replyAuthor: { fontSize: 12, fontWeight: '600', color: '#333' },
  replyDate: { fontSize: 11, color: '#bbb' },
  replyText: { fontSize: 13, color: '#555', lineHeight: 18 },
  replyInputRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8,
  },
  replyInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 8, fontSize: 13, color: '#333', minHeight: 36,
    textAlignVertical: 'top',
  },
  replySendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#003f2f',
    justifyContent: 'center', alignItems: 'center',
  },
  replySendBtnDisabled: { opacity: 0.4 },
});
