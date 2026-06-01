import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function ShopScreen() {
  const { user, userRole } = useAuth();

  if ((userRole === 'vendeur' || userRole === 'equipe') && user) {
    const VendorShopScreen = require('@/components/vendor/VendorShopScreen').default;
    return <VendorShopScreen userId={user.id} userRole={userRole} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Boutiques</Text>
      <Text style={styles.subtitle}>Les boutiques seront affichees ici</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#003f2f',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
