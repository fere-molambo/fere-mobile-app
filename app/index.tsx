import { View, Image, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const router = useRouter();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        if (session) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/login');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [loading, session]);

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
