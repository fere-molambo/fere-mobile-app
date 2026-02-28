import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Star, Send, Pencil, Trash2, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import type { ReviewTargetType } from '@/types/database';
import {
  fetchReviews,
  fetchRepliesForReview,
  submitReview,
  updateReview,
  deleteReview,
  submitReply,
  type ReviewWithProfile,
  type ReviewReplyWithProfile,
} from '@/lib/reviewsUtils';

interface ReviewsSectionProps {
  targetType: ReviewTargetType;
  targetId: string;
  currentUserId?: string;
}

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.starInputRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
          <Star
            color="#FFB800"
            size={28}
            fill={star <= value ? '#FFB800' : 'transparent'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starDisplayRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          color="#FFB800"
          size={size}
          fill={star <= Math.round(rating) ? '#FFB800' : 'transparent'}
        />
      ))}
    </View>
  );
}

function ReplyItem({ reply }: { reply: ReviewReplyWithProfile }) {
  const name = reply.profile?.nom_complet || 'Membre';
  const avatar = reply.profile?.photo_profil;
  const date = new Date(reply.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.replyItem}>
      <View style={styles.replyAvatarCol}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.replyAvatar} />
        ) : (
          <View style={styles.replyAvatarPlaceholder}>
            <Text style={styles.replyAvatarInitial}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
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

interface ReviewItemProps {
  review: ReviewWithProfile;
  currentUserId?: string;
  targetType: ReviewTargetType;
  onEdited: () => void;
  onDeleted: () => void;
}

function ReviewItem({ review, currentUserId, targetType, onEdited, onDeleted }: ReviewItemProps) {
  const name = review.profile?.nom_complet || 'Membre';
  const avatar = review.profile?.photo_profil;
  const isOwn = currentUserId && review.user_id === currentUserId;

  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ReviewReplyWithProfile[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const date = new Date(review.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const loadReplies = useCallback(async () => {
    if (loadingReplies) return;
    setLoadingReplies(true);
    try {
      const data = await fetchRepliesForReview(review.id, targetType);
      setReplies(data);
    } catch {
    } finally {
      setLoadingReplies(false);
    }
  }, [review.id, targetType]);

  const handleToggleReplies = () => {
    if (!showReplies) {
      loadReplies();
    }
    setShowReplies((v) => !v);
  };

  const handleSaveEdit = async () => {
    if (editRating === 0) return;
    setSaving(true);
    try {
      await updateReview(targetType, review.id, editRating, editComment);
      setIsEditing(false);
      onEdited();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteReview(targetType, review.id);
      onDeleted();
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  const handleSendReply = async () => {
    if (!currentUserId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await submitReply(targetType, review.id, currentUserId, replyText);
      setReplyText('');
      loadReplies();
    } catch {
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewTop}>
        <View style={styles.reviewAuthorRow}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.reviewAvatar} />
          ) : (
            <View style={styles.reviewAvatarPlaceholder}>
              <Text style={styles.reviewAvatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.reviewAuthorInfo}>
            <Text style={styles.reviewAuthorName}>{name}</Text>
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>

        {isOwn && !isEditing && (
          <View style={styles.reviewActions}>
            <TouchableOpacity
              onPress={() => {
                setEditRating(review.rating);
                setEditComment(review.comment || '');
                setIsEditing(true);
              }}
              style={styles.reviewActionBtn}
            >
              <Pencil color="#003f2f" size={16} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.reviewActionBtn}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#e53935" />
              ) : (
                <Trash2 color="#e53935" size={16} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isEditing ? (
        <View style={styles.editForm}>
          <StarRatingInput value={editRating} onChange={setEditRating} />
          <TextInput
            style={styles.editInput}
            value={editComment}
            onChangeText={setEditComment}
            placeholder="Votre commentaire (facultatif)"
            placeholderTextColor="#aaa"
            multiline
          />
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || editRating === 0) && styles.saveBtnDisabled]}
              onPress={handleSaveEdit}
              disabled={saving || editRating === 0}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <StarDisplay rating={review.rating} />
          {review.comment ? (
            <Text style={styles.reviewComment}>{review.comment}</Text>
          ) : null}
        </>
      )}

      <TouchableOpacity style={styles.repliesToggle} onPress={handleToggleReplies}>
        <MessageCircle color="#666" size={14} />
        <Text style={styles.repliesToggleText}>
          {showReplies ? 'Masquer les réponses' : 'Répondre / voir les réponses'}
        </Text>
        {showReplies ? <ChevronUp color="#666" size={14} /> : <ChevronDown color="#666" size={14} />}
      </TouchableOpacity>

      {showReplies && (
        <View style={styles.repliesSection}>
          {loadingReplies ? (
            <ActivityIndicator size="small" color="#003f2f" style={{ marginVertical: 8 }} />
          ) : replies.length === 0 ? (
            <Text style={styles.noRepliesText}>Aucune réponse pour le moment</Text>
          ) : (
            replies.map((r) => <ReplyItem key={r.id} reply={r} />)
          )}

          {currentUserId && (
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
          )}
        </View>
      )}
    </View>
  );
}

export default function ReviewsSection({
  targetType,
  targetId,
  currentUserId,
}: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const userReview = currentUserId
    ? reviews.find((r) => r.user_id === currentUserId)
    : undefined;

  const averageRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReviews(targetType, targetId);
      setReviews(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!currentUserId || newRating === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitReview(targetType, targetId, currentUserId, newRating, newComment);
      setNewRating(0);
      setNewComment('');
      load();
    } catch (e: any) {
      if (e?.code === '23505') {
        setSubmitError('Vous avez déjà laissé un avis.');
      } else {
        setSubmitError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {reviews.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.averageValue}>{averageRating.toFixed(1)}</Text>
          <StarDisplay rating={averageRating} size={18} />
          <Text style={styles.reviewCount}>
            {reviews.length} avis{reviews.length > 1 ? '' : ''}
          </Text>
        </View>
      )}

      {currentUserId && !userReview && (
        <View style={styles.newReviewForm}>
          <Text style={styles.newReviewTitle}>Laisser un avis</Text>
          <StarRatingInput value={newRating} onChange={setNewRating} />
          <TextInput
            style={styles.commentInput}
            placeholder="Votre commentaire (facultatif)"
            placeholderTextColor="#aaa"
            value={newComment}
            onChangeText={setNewComment}
            multiline
            numberOfLines={3}
          />
          {submitError && <Text style={styles.errorText}>{submitError}</Text>}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (submitting || newRating === 0) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || newRating === 0}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Publier l'avis</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="small" color="#003f2f" style={{ marginVertical: 24 }} />
      ) : reviews.length === 0 ? (
        <Text style={styles.noReviewsText}>Aucun avis pour le moment</Text>
      ) : (
        reviews.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            currentUserId={currentUserId}
            targetType={targetType}
            onEdited={load}
            onDeleted={load}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  averageValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#003f2f',
  },
  starDisplayRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewCount: {
    fontSize: 13,
    color: '#666',
  },
  newReviewForm: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  newReviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  starInputRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#e53935',
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noReviewsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003f2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reviewAuthorInfo: {
    flex: 1,
  },
  reviewAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewActionBtn: {
    padding: 6,
  },
  reviewComment: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginTop: 6,
  },
  editForm: {
    marginTop: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#666',
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#003f2f',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  repliesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  repliesToggleText: {
    fontSize: 12,
    color: '#666',
  },
  repliesSection: {
    marginTop: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
  },
  noRepliesText: {
    fontSize: 12,
    color: '#bbb',
    marginBottom: 8,
  },
  replyItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  replyAvatarCol: {},
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyAvatarInitial: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  replyBody: {
    flex: 1,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  replyDate: {
    fontSize: 11,
    color: '#bbb',
  },
  replyText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  replyInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    marginTop: 8,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    color: '#333',
    minHeight: 36,
    textAlignVertical: 'top',
  },
  replySendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#003f2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replySendBtnDisabled: {
    opacity: 0.4,
  },
});
