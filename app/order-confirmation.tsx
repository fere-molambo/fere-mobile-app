import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CircleCheck, CircleX, ShoppingCart, Package } from 'lucide-react-native';

function formatPrice(n: number) {
  return n.toLocaleString('fr-FR').replace(/\s/g, ' ');
}

export default function OrderConfirmationScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const reference = params.reference as string;
  const amount = Number(params.amount || 0);
  const success = params.success === 'true';
  const orderIdsRaw = params.orderIds as string | undefined;
  const orderIds: string[] = orderIdsRaw ? JSON.parse(orderIdsRaw) : [];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {success ? (
            <CircleCheck color="#16a34a" size={72} strokeWidth={1.5} />
          ) : (
            <CircleX color="#ef4444" size={72} strokeWidth={1.5} />
          )}

          <Text style={styles.title}>
            {success ? 'Acompte payé avec succès !' : 'Paiement non abouti'}
          </Text>

          <Text style={styles.subtitle}>
            {success
              ? `Votre acompte de ${formatPrice(amount)} XOF a été encaissé. Vous paierez le solde à la réception de votre commande.`
              : "Le paiement n'a pas été finalisé. Votre panier est intact — vous pouvez réessayer ou supprimer des articles."}
          </Text>

          {success && reference && (
            <View style={styles.referenceCard}>
              <Text style={styles.referenceLabel}>Référence de paiement</Text>
              <Text style={styles.referenceValue}>{reference}</Text>
            </View>
          )}

          {success && orderIds.length > 0 && (
            <View style={styles.ordersCard}>
              <View style={styles.ordersHeader}>
                <Package color="#003f2f" size={16} />
                <Text style={styles.ordersHeaderText}>
                  {orderIds.length} commande{orderIds.length > 1 ? 's' : ''} créée{orderIds.length > 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={styles.ordersSubtext}>
                Vos commandes sont en attente de confirmation par les vendeurs.
              </Text>
            </View>
          )}

          {success ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/(tabs)/orders')}
              >
                <Text style={styles.primaryBtnText}>Voir mes commandes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={styles.secondaryBtnText}>Retour à l'accueil</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/(tabs)/cart')}
              >
                <View style={styles.btnRow}>
                  <ShoppingCart color="#fff" size={18} />
                  <Text style={styles.primaryBtnText}>Retourner au panier</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={styles.secondaryBtnText}>Retour à l'accueil</Text>
              </TouchableOpacity>
            </>
          )}
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  referenceCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  referenceLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  ordersCard: {
    backgroundColor: '#f0f7f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  ordersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ordersHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#003f2f',
  },
  ordersSubtext: {
    fontSize: 13,
    color: '#2d6a4f',
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
});
