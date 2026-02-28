import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase
      .from('device_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );
  } catch {}
}

export async function unregisterPushToken(userId: string): Promise<void> {
  await supabase
    .from('device_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

export async function sendNotificationToUser(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      user_id: targetUserId,
      title,
      body,
      data: data || {},
    }),
  });
}
