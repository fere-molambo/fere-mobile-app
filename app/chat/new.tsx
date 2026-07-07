import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { ChevronLeft, User, Search, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMemberContacts,
  getDriverContacts,
  startConversation,
  type ChatContact,
} from '@/lib/chatUtils';

export default function NewConversationScreen() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    try {
      const data = userRole === 'livreur'
        ? await getDriverContacts(user.id)
        : await getMemberContacts(user.id);
      setContacts(data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [user, userRole]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSelectContact = useCallback(async (contactId: string) => {
    if (!user || starting) return;
    setStarting(contactId);
    try {
      const conversationId = await startConversation(user.id, contactId);
      router.replace(`/chat/${conversationId}` as any);
    } catch (err) {
      Alert.alert('Erreur', "Impossible de creer la conversation. Veuillez réessayer.");
      setStarting(null);
    }
  }, [user, starting, router]);

  const filtered = searchQuery.trim()
    ? contacts.filter((c) =>
        c.nom_complet.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts;

  const renderItem = ({ item }: { item: ChatContact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleSelectContact(item.id)}
      activeOpacity={0.7}
      disabled={starting === item.id}
    >
      {item.photo_profil ? (
        <Image source={{ uri: item.photo_profil }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <User size={22} color="#999" />
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>{item.nom_complet}</Text>
        {item.role && <Text style={styles.contactRole}>{item.role}</Text>}
      </View>
      {starting === item.id && <ActivityIndicator size="small" color="#003f2f" />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle conversation</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un contact..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Users color="#d0d0d0" size={60} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Aucun contact disponible</Text>
          <Text style={styles.emptySubtitle}>
            {userRole === 'livreur'
              ? 'Les admins et vos contacts de livraison apparaitront ici'
              : 'Les contacts apparaitront ici lorsque vous aurez des commandes actives'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginVertical: 10,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    height: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  contactRole: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
});
