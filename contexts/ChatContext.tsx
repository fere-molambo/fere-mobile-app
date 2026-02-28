import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ChatContextType {
  totalUnreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  currentOpenConversationId: string | null;
  setCurrentOpenConversationId: (id: string | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [currentOpenConversationId, setCurrentOpenConversationId] = useState<string | null>(null);
  const openConvoRef = useRef<string | null>(null);

  useEffect(() => {
    openConvoRef.current = currentOpenConversationId;
  }, [currentOpenConversationId]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!participations || participations.length === 0) {
      setTotalUnreadCount(0);
      return;
    }

    const convoIds = participations.map((p: any) => p.conversation_id);

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convoIds)
      .neq('sender_id', user.id)
      .neq('status', 'read');

    setTotalUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshUnreadCount();
  }, [user, refreshUnreadCount]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-chat-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const msg = payload.new;
          if (msg.sender_id !== user.id && msg.conversation_id !== openConvoRef.current) {
            setTotalUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload: any) => {
          const msg = payload.new;
          const old = payload.old;
          if (msg.sender_id !== user.id && old.status !== 'read' && msg.status === 'read') {
            setTotalUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <ChatContext.Provider
      value={{
        totalUnreadCount,
        refreshUnreadCount,
        currentOpenConversationId,
        setCurrentOpenConversationId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
