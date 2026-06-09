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
import { formatRelativeTime, getLastMessagePreview } from '@/lib/chatUtils';
import AppHeader from '@/components/AppHeader';

interface ConversationItem {
  id: string;
  last_message_at: string;
  participant: {
    id: string;
    nom_complet: string;
    photo_profil?: string;
  };
  lastMessage?: {
    content: string;
    media_type: string;
    sender_id: string;
    created_at: string;
  };
  unreadCount: number;
}

interface DriverChatScreenProps {
  userId: string;
}

export default function DriverChatScreen({ userId }: DriverChatScreenProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (!myParticipations || myParticipations.length === 0) {
        setConversations([]);
        return;
      }

      const convIds = myParticipations.map(p => p.conversation_id);
      const readMap: Record<string, string | null> = {};
      myParticipations.forEach(p => { readMap[p.conversation_id] = p.last_read_at; });

      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, profiles:user_id(id, nom_complet, photo_profil)')
        .in('conversation_id', convIds)
        .neq('user_id', userId);

      const { data: convData } = await supabase
        .from('conversations')
        .select('id, last_message_at')
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      const { data: lastMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, media_type, sender_id, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      const lastMsgMap: Record<string, any> = {};
      (lastMessages || []).forEach(msg => {
        if (!lastMsgMap[msg.conversation_id]) {
          lastMsgMap[msg.conversation_id] = msg;
        }
      });

      const participantMap: Record<string, any> = {};
      (otherParticipants || []).forEach((p: any) => {
        if (!participantMap[p.conversation_id] && p.profiles) {
          participantMap[p.conversation_id] = p.profiles;
        }
      });

      const items: ConversationItem[] = (convData || [])
        .filter(c => participantMap[c.id])
        .map(conv => {
          const lastReadAt = readMap[conv.id];
          const unread = lastMessages
            ? lastMessages.filter(m =>
              m.conversation_id === conv.id &&
              m.sender_id !== userId &&
              (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt))
            ).length
            : 0;

          return {
            id: conv.id,
            last_message_at: conv.last_message_at || conv.id,
            participant: participantMap[conv.id],
            lastMessage: lastMsgMap[conv.id],
            unreadCount: unread,
          };
        });

      setConversations(items);
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
      .channel(`driver-messages-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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
        c.participant.nom_complet.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const renderItem = ({ item }: { item: ConversationItem }) => {
    const preview = getLastMessagePreview(item.lastMessage || null);
    const time = item.lastMessage ? formatRelativeTime(item.lastMessage.created_at) : '';
    const senderPrefix = item.lastMessage?.sender_id === userId ? 'Vous: ' : '';

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/chat/${item.id}` as any)}
        activeOpacity={0.7}
      >
        {item.participant.photo_profil ? (
          <Image source={{ uri: item.participant.photo_profil }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={22} color="#999" />
          </View>
        )}

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.participantName, item.unreadCount > 0 && styles.unreadName]} numberOfLines={1}>
              {item.participant.nom_complet}
            </Text>
            {time ? <Text style={styles.time}>{time}</Text> : null}
          </View>
          <View style={styles.messageRow}>
            <Text
              style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadMessage]}
              numberOfLines={1}
            >
              {senderPrefix}{preview || 'Aucun message'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
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
            Les discussions avec les clients et vendeurs apparaitront ici
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
