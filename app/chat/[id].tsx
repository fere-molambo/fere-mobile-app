import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Send,
  User,
  ImagePlus,
  Mic,
  Square,
  Check,
  CheckCheck,
  Clock,
  XCircle,
  MoreVertical,
  Ban,
  Trash2,
  RotateCcw,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import AudioPlayer from '@/components/chat/AudioPlayer';
import { uriToBytes } from '@/lib/uploadUtils';
import { sendNotificationToUser } from '@/lib/notificationService';
import ImageViewer from '@/components/chat/ImageViewer';
import ImagePreviewModal from '@/components/chat/ImagePreviewModal';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url?: string;
  media_type: string;
  status: string;
  read_at?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface Participant {
  id: string;
  nom_complet: string;
  photo_profil?: string;
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { setCurrentOpenConversationId, refreshUnreadCount } = useChat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [longPressedMsgId, setLongPressedMsgId] = useState<string | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (id) setCurrentOpenConversationId(id);
    return () => setCurrentOpenConversationId(null);
  }, [id, setCurrentOpenConversationId]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, media_url, media_type, status, read_at, retry_count, created_at, updated_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((data as ChatMessage[]) || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchParticipant = useCallback(async () => {
    if (!id || !userId) return;
    const { data } = await supabase
      .from('conversation_participants')
      .select('user_id, profiles:user_id(id, nom_complet, photo_profil)')
      .eq('conversation_id', id)
      .neq('user_id', userId);
    if (data && data.length > 0) {
      const p = (data[0] as any).profiles;
      setParticipant(p);
      if (p?.id) checkBlocked(p.id);
    }
  }, [id, userId]);

  const checkBlocked = async (otherId: string) => {
    if (!userId) return;
    const { data: blocked } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', otherId)
      .maybeSingle();
    setBlockedByMe(!!blocked);

    const { data: blockedMe } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', otherId)
      .eq('blocked_id', userId)
      .maybeSingle();
    setIsBlocked(!!blockedMe);
  };

  const markAsRead = useCallback(async () => {
    if (!id || !userId) return;
    const unreadIds = messages
      .filter((m) => m.sender_id !== userId && m.status !== 'read')
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    await supabase.rpc('mark_messages_as_read', { message_ids: unreadIds });
    refreshUnreadCount();
  }, [id, userId, messages, refreshUnreadCount]);

  useEffect(() => {
    fetchMessages();
    fetchParticipant();
  }, [fetchMessages, fetchParticipant]);

  useEffect(() => {
    if (!loading && messages.length > 0) markAsRead();
  }, [loading, messages.length]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`chat-detail-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const notifyPeer = (preview: string) => {
    if (!participant?.id || !id) return;
    sendNotificationToUser(participant.id, 'Nouveau message', preview.slice(0, 120), {
      type: 'new_message',
      conversation_id: id,
    }).catch(() => {});
  };

  const handleSend = async () => {
    if (!inputText.trim() || !id || !userId || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: userId,
        content: text,
        media_type: 'text',
        status: 'sent',
      });
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id);
      notifyPeer(text);
    } catch {
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert('Image trop volumineuse', 'La taille maximum est de 10 Mo.');
        return;
      }
      setSelectedImage(asset.uri);
      setShowImagePreview(true);
    }
  };

  const handleSendImage = async (caption: string) => {
    if (!selectedImage || !id || !userId) return;
    try {
      const ext = selectedImage.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}/${id}/${Date.now()}.${ext}`;
      // Blob.arrayBuffer() n'existe pas en React Native
      const arrayBuffer =
        Platform.OS === 'web'
          ? await (await (await fetch(selectedImage)).blob()).arrayBuffer()
          : await uriToBytes(selectedImage);

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(fileName, 365 * 24 * 60 * 60);

      const mediaUrl = urlData?.signedUrl;
      if (!mediaUrl) throw new Error('URL création failed');

      await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: userId,
        content: caption || '',
        media_url: mediaUrl,
        media_type: 'image',
        status: 'sent',
      });
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id);
      notifyPeer(caption || '📷 Photo');
    } finally {
      setSelectedImage(null);
      setShowImagePreview(false);
    }
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e: any) => { audioChunksRef.current.push(e.data); };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch {
        Alert.alert('Erreur', "Impossible d'acceder au microphone.");
      }
      return;
    }

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch {
      Alert.alert('Erreur', "Impossible d'acceder au microphone.");
    }
  };

  const stopRecording = async () => {
    if (Platform.OS === 'web') {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      return new Promise<void>((resolve) => {
        recorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await uploadAudio(blob, 'webm');
          recorder.stream?.getTracks().forEach((t: any) => t.stop());
          mediaRecorderRef.current = null;
          setIsRecording(false);
          resolve();
        };
        recorder.stop();
      });
    }

    const recording = recordingRef.current;
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        // Blob.arrayBuffer() n'existe pas en React Native : lecture directe du fichier
        const bytes = await uriToBytes(uri);
        await uploadAudioBody(bytes, 'm4a');
      }
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob, ext: string) => {
    // Web uniquement : Blob.arrayBuffer() y est disponible
    const arrayBuffer = await blob.arrayBuffer();
    await uploadAudioBody(arrayBuffer, ext);
  };

  const uploadAudioBody = async (arrayBuffer: ArrayBuffer | Uint8Array, ext: string) => {
    if (!id || !userId) return;
    try {
      const fileName = `${userId}/${id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, arrayBuffer, { contentType: `audio/${ext}`, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(fileName, 365 * 24 * 60 * 60);

      const mediaUrl = urlData?.signedUrl;
      if (!mediaUrl) throw new Error('URL création failed');

      await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: userId,
        content: '',
        media_url: mediaUrl,
        media_type: 'audio',
        status: 'sent',
      });
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id);
      notifyPeer('🎤 Note vocale');
    } catch (err) {
      console.error('Audio upload error:', err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setLongPressedMsgId(null);
    await supabase.from('messages').delete().eq('id', msgId);
  };

  const handleRetryMessage = async (msg: ChatMessage) => {
    await supabase
      .from('messages')
      .update({ status: 'sent', retry_count: 0 })
      .eq('id', msg.id);
  };

  const handleBlockToggle = async () => {
    setShowMenu(false);
    if (!participant || !userId) return;
    if (blockedByMe) {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', participant.id);
      setBlockedByMe(false);
    } else {
      await supabase.from('blocked_users').insert({
        blocker_id: userId,
        blocked_id: participant.id,
      });
      setBlockedByMe(true);
    }
  };

  const formatMsgTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'failed':
        return <XCircle size={12} color="#ef4444" />;
      case 'pending':
        return <Clock size={12} color="rgba(255,255,255,0.5)" />;
      case 'read':
        return <CheckCheck size={12} color="#60a5fa" />;
      default:
        return <Check size={12} color="rgba(255,255,255,0.5)" />;
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.sender_id === userId;
    const isLongPressed = longPressedMsgId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => isMine ? setLongPressedMsgId(isLongPressed ? null : item.id) : null}
        style={[styles.messageBubbleRow, isMine ? styles.myRow : styles.theirRow]}
      >
        <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
          {item.media_type === 'image' && item.media_url && (
            <TouchableOpacity onPress={() => { setViewerImage(item.media_url!); setShowViewer(true); }}>
              <Image
                source={{ uri: item.media_url }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {item.media_type === 'audio' && item.media_url && (
            <AudioPlayer uri={item.media_url} messageId={item.id} isOwnMessage={isMine} />
          )}

          {item.content ? (
            <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
          ) : null}

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMine ? styles.myTime : styles.theirTime]}>
              {formatMsgTime(item.created_at)}
            </Text>
            {isMine && renderStatusIcon(item.status)}
          </View>
        </View>

        {isMine && item.status === 'failed' && (
          <View style={styles.failedActions}>
            <TouchableOpacity style={styles.failedBtn} onPress={() => handleRetryMessage(item)}>
              <RotateCcw size={12} color="#e67e22" />
              <Text style={styles.failedBtnText}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.failedBtn} onPress={() => handleDeleteMessage(item.id)}>
              <Trash2 size={12} color="#ef4444" />
              <Text style={[styles.failedBtnText, { color: '#ef4444' }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLongPressed && item.status !== 'failed' && (
          <TouchableOpacity
            style={styles.deleteBtnFloat}
            onPress={() => handleDeleteMessage(item.id)}
          >
            <Trash2 size={14} color="#ef4444" />
            <Text style={styles.deleteBtnText}>Supprimer</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const canSend = !blockedByMe && !isBlocked;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#003f2f" />
        </TouchableOpacity>
        {participant?.photo_profil ? (
          <Image source={{ uri: participant.photo_profil }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <User size={18} color="#999" />
          </View>
        )}
        <Text style={styles.headerName} numberOfLines={1}>
          {participant?.nom_complet || 'Conversation'}
        </Text>
        <View style={styles.menuContainer}>
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuBtn}>
            <MoreVertical size={20} color="#333" />
          </TouchableOpacity>
          {showMenu && (
            <View style={styles.menuDropdown}>
              <TouchableOpacity style={styles.menuItem} onPress={handleBlockToggle}>
                <Ban size={16} color={blockedByMe ? '#16a34a' : '#ef4444'} />
                <Text style={[styles.menuItemText, { color: blockedByMe ? '#16a34a' : '#ef4444' }]}>
                  {blockedByMe ? 'Débloquer' : 'Bloquer'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {blockedByMe && (
        <View style={styles.blockedBanner}>
          <Ban size={16} color="#991b1b" />
          <Text style={styles.blockedText}>Vous avez bloqué cet utilisateur</Text>
          <TouchableOpacity onPress={handleBlockToggle}>
            <Text style={styles.unblockLink}>Débloquer</Text>
          </TouchableOpacity>
        </View>
      )}

      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Ban size={16} color="#991b1b" />
          <Text style={styles.blockedText}>Cet utilisateur vous a bloqué</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Aucun message. Dites bonjour !</Text>
            </View>
          }
        />
      )}

      {canSend && (
        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          {isRecording ? (
            <View style={styles.recordingBar}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Enregistrement en cours...</Text>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Square size={16} color="#fff" fill="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.mediaBtn} onPress={handlePickImage}>
                <ImagePlus size={22} color="#003f2f" />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder="Votre message..."
                placeholderTextColor="#999"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
              />
              {inputText.trim() ? (
                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Send size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.micButton} onPress={startRecording}>
                  <Mic size={22} color="#003f2f" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      <ImagePreviewModal
        uri={selectedImage}
        visible={showImagePreview}
        onClose={() => { setShowImagePreview(false); setSelectedImage(null); }}
        onSend={handleSendImage}
      />

      {viewerImage && (
        <ImageViewer
          uri={viewerImage}
          visible={showViewer}
          onClose={() => { setShowViewer(false); setViewerImage(null); }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  backButton: {
    padding: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  menuContainer: {
    position: 'relative',
  },
  menuBtn: {
    padding: 4,
  },
  menuDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 160,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  blockedText: {
    fontSize: 13,
    color: '#991b1b',
    fontWeight: '500',
    flex: 1,
  },
  unblockLink: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubbleRow: {
    marginBottom: 8,
  },
  myRow: {
    alignItems: 'flex-end',
  },
  theirRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    padding: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  myBubble: {
    backgroundColor: '#003f2f',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  messageImage: {
    width: 220,
    height: 180,
    borderRadius: 10,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myText: {
    color: '#fff',
  },
  theirText: {
    color: '#1a1a1a',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myTime: {
    color: 'rgba(255,255,255,0.6)',
  },
  theirTime: {
    color: '#999',
  },
  failedActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingRight: 4,
  },
  failedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  failedBtnText: {
    fontSize: 12,
    color: '#e67e22',
    fontWeight: '600',
  },
  deleteBtnFloat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  },
  mediaBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#003f2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  micButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
