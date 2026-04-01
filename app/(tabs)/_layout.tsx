import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Hop as Home, Tag, ShoppingCart, MessageCircle, Settings, Package, Truck, Wallet, Store } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useChat } from '@/contexts/ChatContext';

export default function TabLayout() {
  const { userRole } = useAuth();
  const { getCartCount, openCart } = useCart();
  const { totalUnreadCount } = useChat();
  const cartCount = getCartCount();

  const isClient = userRole === 'membre';
  const isDriver = userRole === 'livreur';
  const isVendor = userRole === 'vendeur' || userRole === 'equipe';

  const tabBarScreenOptions = {
    headerShown: false,
    tabBarActiveTintColor: '#003f2f',
    tabBarInactiveTintColor: '#666',
    tabBarStyle: {
      borderTopWidth: 1,
      borderTopColor: '#e5e5e5',
      height: 60,
      paddingBottom: 8,
      paddingTop: 8,
    },
  };

  if (isVendor) {
    return (
      <Tabs screenOptions={tabBarScreenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Commandes',
            tabBarIcon: ({ size, color }) => (
              <Package size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Recettes',
            tabBarIcon: ({ size, color }) => (
              <Wallet size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: 'Boutique',
            tabBarIcon: ({ size, color }) => (
              <Store size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ size, color }) => (
              <View>
                <MessageCircle size={size} color={color} />
                {totalUnreadCount > 0 && (
                  <View style={tabStyles.badge}>
                    <Text style={tabStyles.badgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Parametres',
            tabBarIcon: ({ size, color }) => (
              <Settings size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="offers" options={{ href: null }} />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    );
  }

  if (isDriver) {
    return (
      <Tabs screenOptions={tabBarScreenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Livraisons',
            tabBarIcon: ({ size, color }) => (
              <Truck size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Recettes',
            tabBarIcon: ({ size, color }) => (
              <Wallet size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ size, color }) => (
              <View>
                <MessageCircle size={size} color={color} />
                {totalUnreadCount > 0 && (
                  <View style={tabStyles.badge}>
                    <Text style={tabStyles.badgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Parametres',
            tabBarIcon: ({ size, color }) => (
              <Settings size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="offers" options={{ href: null }} />
        <Tabs.Screen name="shop" options={{ href: null }} />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    );
  }

  if (isClient) {
    return (
      <Tabs screenOptions={tabBarScreenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ size, color }) => (
              <Home size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="offers"
          options={{
            title: 'Offres',
            tabBarIcon: ({ size, color }) => (
              <Tag size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Commandes',
            tabBarIcon: ({ size, color }) => (
              <Package size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ size, color }) => (
              <View>
                <MessageCircle size={size} color={color} />
                {totalUnreadCount > 0 && (
                  <View style={tabStyles.badge}>
                    <Text style={tabStyles.badgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Parametres',
            tabBarIcon: ({ size, color }) => (
              <Settings size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="shop" options={{ href: null }} />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <Tabs screenOptions={tabBarScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: 'Offres',
          tabBarIcon: ({ size, color }) => (
            <Tag size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ size, color }) => (
            <Package size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ size, color }) => (
            <View>
              <MessageCircle size={size} color={color} />
              {totalUnreadCount > 0 && (
                <View style={tabStyles.badge}>
                  <Text style={tabStyles.badgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Parametres',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="shop" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
