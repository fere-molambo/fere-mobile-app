import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_PREFERENCE_FIELDS, PREFERENCE_LABELS } from '@/lib/notificationConstants';

export default function NotificationsScreen() {
  const { user, userRole } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fields = ROLE_PREFERENCE_FIELDS[userRole || 'client'] || ROLE_PREFERENCE_FIELDS.client;

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const defaults: Record<string, boolean> = {};
    fields.forEach((f) => { defaults[f] = true; });

    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) {
      await supabase.from('notification_preferences').upsert({
        user_id: user.id,
        ...defaults,
      }, { onConflict: 'user_id' });
      setPrefs(defaults);
    } else {
      const current: Record<string, boolean> = {};
      fields.forEach((f) => { current[f] = data[f] ?? true; });
      setPrefs(current);
    }
    setLoading(false);
  }, [user, fields]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const togglePref = async (field: string) => {
    if (!user) return;
    const newVal = !prefs[field];
    setPrefs((p) => ({ ...p, [field]: newVal }));
    await supabase
      .from('notification_preferences')
      .update({ [field]: newVal })
      .eq('user_id', user.id);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SettingsSubHeader title="Notifications" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Notifications" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Gerez les types de notifications que vous souhaitez recevoir.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {fields.map((field, index) => {
            const meta = PREFERENCE_LABELS[field];
            if (!meta) return null;
            return (
              <View
                key={field}
                style={[
                  styles.settingItem,
                  index === fields.length - 1 && styles.settingItemLast,
                ]}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{meta.label}</Text>
                  <Text style={styles.settingDescription}>{meta.description}</Text>
                </View>
                <Switch
                  value={prefs[field] ?? true}
                  onValueChange={() => togglePref(field)}
                  trackColor={{ false: '#e0e0e0', true: '#a8d5c5' }}
                  thumbColor={prefs[field] ? '#003f2f' : '#fff'}
                  ios_backgroundColor="#e0e0e0"
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoBox: {
    backgroundColor: '#e8f3f0',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 14,
  },
  infoText: { fontSize: 13, color: '#003f2f', lineHeight: 20 },
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
  settingItemLast: { borderBottomWidth: 0 },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  settingDescription: { fontSize: 12, color: '#888', lineHeight: 18 },
});
