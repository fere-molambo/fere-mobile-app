import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'orders',
      label: 'Commandes',
      description: 'Mises à jour sur vos commandes en cours',
      enabled: true,
    },
    {
      id: 'promotions',
      label: 'Promotions',
      description: 'Offres spéciales et réductions personnalisées',
      enabled: true,
    },
    {
      id: 'messages',
      label: 'Messages',
      description: 'Nouveaux messages de vos vendeurs',
      enabled: true,
    },
    {
      id: 'newProducts',
      label: 'Nouveaux produits',
      description: 'Alertes sur les nouvelles arrivées',
      enabled: false,
    },
    {
      id: 'newsletter',
      label: 'Newsletter',
      description: 'Actualités et tendances de la semaine',
      enabled: false,
    },
  ]);

  const toggleSetting = (id: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Notifications" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Gérez les types de notifications que vous souhaitez recevoir.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences</Text>
          {settings.map((setting, index) => (
            <View
              key={setting.id}
              style={[
                styles.settingItem,
                index === settings.length - 1 && styles.settingItemLast,
              ]}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{setting.label}</Text>
                <Text style={styles.settingDescription}>{setting.description}</Text>
              </View>
              <Switch
                value={setting.enabled}
                onValueChange={() => toggleSetting(setting.id)}
                trackColor={{ false: '#e0e0e0', true: '#a8d5c5' }}
                thumbColor={setting.enabled ? '#003f2f' : '#fff'}
                ios_backgroundColor="#e0e0e0"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#e8f3f0',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    color: '#003f2f',
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
});
