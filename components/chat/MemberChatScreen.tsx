import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
} from 'react-native';
import { MessageCircle, User, Plus, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  getConversations,
  formatRelativeTime,
  getLastMessagePreview,
  type ConversationWithDetails,
} from '@/lib/chatUtils';
import AppHeader from '@/components/AppHeader';

interface MemberChatScreenProps {
  userId: string;
}

export default function MemberChatScreen({ userId }: MemberChatScreenProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations(userId);
      setConversations(data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const channel = supabase
      .channel(`member-messages-list-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  const filtered = searchQuery.trim()
    ? conversations.filter((c) =>
        c.other_participant.nom_complet.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const renderItem = ({ item }: { item: ConversationWithDetails }) => {
    const preview = getLastMessagePreview(item.last_message);
    const time = item.last_message ? formatRelativeTime(item.last_message.created_at) : '';
    const senderPrefix = item.last_message?.sender_id === userId ? 'Vous: ' : '';

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/chat/${item.id}` as any)}
        activeOpacity={0.7}
      >
        {item.other_participant.photo_profil ? (
          <Image source={{ uri: item.other_participant.photo_profil }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={22} color="#999" />
          </View>
        )}

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[styles.participantName, item.unread_count > 0 && styles.unreadName]}
              numberOfLines={1}
            >
              {item.other_participant.nom_complet}
            </Text>
            {time ? <Text style={styles.time}>{time}</Text> : null}
          </View>
          <View style={styles.messageRow}>
            <Text
              style={[styles.lastMessage, item.unread_count > 0 && styles.unreadMessage]}
              numberOfLines={1}
            >
              {senderPrefix}{preview || 'Aucun message'}
            </Text>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader hideCart />

      <View style={styles.topBar}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une conversation..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={() => router.push('/chat/new' as any)}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <MessageCircle color="#d0d0d0" size={70} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptySubtitle}>
            Vos discussions avec les vendeurs et livreurs apparaitront ici
          </Text>
          <TouchableOpacity
            style={styles.startChatBtn}
            onPress={() => router.push('/chat/new' as any)}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.startChatBtnText}>Demarrer une conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchConversations(); }}
              tintColor="#003f2f"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 14,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    height: 40,
  },
  newChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003f2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#003f2f',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  startChatBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  unreadName: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 13,
    color: '#888',
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    color: '#333',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#003f2f',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
