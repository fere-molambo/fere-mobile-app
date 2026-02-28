import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { Bell, ShoppingCart } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

interface AppHeaderProps {
  onNotificationPress?: () => void;
  notificationCount?: number;
  cartItemsCount?: number;
  hideCart?: boolean;
}

export default function AppHeader({ onNotificationPress, notificationCount = 0, cartItemsCount = 0, hideCart = false }: AppHeaderProps) {
  const { profile } = useAuth();
  const { openCart } = useCart();

  const firstName = profile?.nom_complet?.split(' ')[0] || 'Utilisateur';

  return (
    <View style={styles.container}>
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
          onPress={onNotificationPress}
          activeOpacity={0.7}
        >
          <Bell color="#003f2f" size={24} strokeWidth={2} />
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 99 ? '99+' : notificationCount}
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
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
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
