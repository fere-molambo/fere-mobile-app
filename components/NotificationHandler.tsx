import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { NOTIFICATION_ROUTES, type NotificationType } from '@/lib/notificationConstants';

interface ToastData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export default function NotificationHandler() {
  const router = useRouter();
  const [toast, setToast] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setToast(null);
    });
  }, [translateY]);

  const showToast = useCallback((data: ToastData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(data);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
    timerRef.current = setTimeout(() => {
      dismissToast();
    }, 4000);
  }, [translateY, dismissToast]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let sub: any;
    let respSub: any;
    try {
      const Notifications = require('expo-notifications');

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        }),
      });

      sub = Notifications.addNotificationReceivedListener((notification: any) => {
        const content = notification.request.content;
        showToast({
          title: content.title || '',
          body: content.body || '',
          data: content.data || {},
        });
      });

      // Tap sur une notification système (app en arrière-plan) → navigation
      respSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response?.notification?.request?.content?.data;
        if (!data?.type) return;
        const routeFn = NOTIFICATION_ROUTES[data.type as NotificationType];
        if (routeFn) {
          router.push(routeFn(data) as any);
        }
      });
    } catch {}

    return () => {
      if (sub) sub.remove();
      if (respSub) respSub.remove();
    };
  }, [showToast, router]);

  const handleTap = useCallback(() => {
    if (!toast?.data?.type) return;
    const routeFn = NOTIFICATION_ROUTES[toast.data.type as NotificationType];
    if (routeFn) {
      const path = routeFn(toast.data);
      dismissToast();
      router.push(path as any);
    }
  }, [toast, dismissToast, router]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <TouchableOpacity style={styles.content} onPress={handleTap} activeOpacity={0.9}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={dismissToast}>
          <X size={16} color="#666" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 50,
    paddingHorizontal: 12,
  },
  content: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  textContainer: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  body: { fontSize: 13, color: '#666' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
