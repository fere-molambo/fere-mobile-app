import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { Bell, ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useChat } from '@/contexts/ChatContext';

interface AppHeaderProps {
  onNotificationPress?: () => void;
  notificationCount?: number;
  cartItemsCount?: number;
  hideCart?: boolean;
}

export default function AppHeader({ onNotificationPress, notificationCount, cartItemsCount = 0, hideCart = false }: AppHeaderProps) {
  const { profile } = useAuth();
  const { openCart } = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { totalUnreadCount } = useChat();
  const badgeCount = notificationCount ?? totalUnreadCount;
  const handleNotificationPress = onNotificationPress || (() => router.push('/notifications' as any));

  const firstName = profile?.nom_complet?.split(' ')[0] || 'Utilisateur';

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
      <View style={styles.leftSection}>
        <Image
          source={require('@/assets/images/Logo_fere2.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.greeting}>Hello {firstName}</Text>
      </View>

      <View style={styles.rightSection}>
        {!hideCart && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={openCart}
            activeOpacity={0.7}
          >
            <ShoppingCart color="#003f2f" size={24} strokeWidth={2} />
            {cartItemsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cartItemsCount > 99 ? '99+' : cartItemsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleNotificationPress}
          activeOpacity={0.7}
        >
          <Bell color="#003f2f" size={24} strokeWidth={2} />
          {badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 32,
    height: 32,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003f2f',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
