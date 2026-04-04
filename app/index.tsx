import { View, Image, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import BlockedAccountScreen from '@/components/BlockedAccountScreen';

export default function SplashScreen() {
  const router = useRouter();
  const { loading, session, blockedAccount, clearBlockedAccount } = useAuth();
  const [showBlocked, setShowBlocked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (blockedAccount) {
        setShowBlocked(true);
        return;
      }

      const timer = setTimeout(() => {
        if (session) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/login');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [loading, session, blockedAccount]);

  if (showBlocked && blockedAccount) {
    return (
      <BlockedAccountScreen
        reason={blockedAccount.reason}
        supportPhone={blockedAccount.supportPhone}
        supportEmail={blockedAccount.supportEmail}
        onBack={() => {
          clearBlockedAccount();
          setShowBlocked(false);
          router.replace('/auth/login');
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/Logo_fere2.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#003f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
