import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { User, MapPin, CreditCard, Truck, Store } from 'lucide-react-native';

export type TabType = 'info' | 'addresses' | 'identity' | 'driver' | 'vendor';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isDriver: boolean;
  isVendor?: boolean;
}

export default function TabNavigation({
  activeTab,
  onTabChange,
  isDriver,
  isVendor,
}: TabNavigationProps) {
  const tabs: Tab[] = [
    {
      id: 'info',
      label: 'Informations',
      icon: <User size={18} color={activeTab === 'info' ? '#003f2f' : '#6b7280'} />,
    },
    ...(isVendor
      ? [
          {
            id: 'vendor' as TabType,
            label: 'Vendeur',
            icon: <Store size={18} color={activeTab === 'vendor' ? '#003f2f' : '#6b7280'} />,
          },
        ]
      : []),
    ...(!isDriver
      ? [
          {
            id: 'addresses' as TabType,
            label: 'Adresses',
            icon: <MapPin size={18} color={activeTab === 'addresses' ? '#003f2f' : '#6b7280'} />,
          },
        ]
      : []),
    {
      id: 'identity',
      label: 'Identite',
      icon: <CreditCard size={18} color={activeTab === 'identity' ? '#003f2f' : '#6b7280'} />,
    },
    ...(isDriver
      ? [
          {
            id: 'driver' as TabType,
            label: 'Livraison',
            icon: <Truck size={18} color={activeTab === 'driver' ? '#003f2f' : '#6b7280'} />,
          },
        ]
      : []),
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.tabActive,
            ]}
            onPress={() => onTabChange(tab.id)}>
            {tab.icon}
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#e8f5e9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#003f2f',
    fontWeight: '600',
  },
});
