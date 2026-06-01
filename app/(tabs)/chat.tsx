import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import DriverChatScreen from '@/components/chat/DriverChatScreen';
import MemberChatScreen from '@/components/chat/MemberChatScreen';

export default function ChatScreen() {
  const { userRole, user } = useAuth();

  if (userRole === 'livreur' && user) {
    return <DriverChatScreen userId={user.id} />;
  }

  if (user) {
    return <MemberChatScreen userId={user.id} />;
  }

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
