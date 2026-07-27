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

    // Canal Android obligatoire pour le son + l'affichage des notifications
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications FERE',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#003f2f',
      });
    }

    const Constants = require('expo-constants').default;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
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
  // L'edge function exige le token de session (auth.getUser) et un tableau user_ids
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      user_ids: [targetUserId],
      title,
      body,
      data: data || {},
    }),
  });
}
