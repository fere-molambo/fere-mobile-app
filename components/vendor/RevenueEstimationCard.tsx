import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info } from 'lucide-react-native';

interface Props {
  price: number;
  commissionRate?: number;
  minAutoPrice?: number;
  priceType?: string;
}

export default function RevenueEstimationCard({
  price,
  commissionRate = 10,
  minAutoPrice,
  priceType,
}: Props) {
  if (!price || price <= 0) return null;

  const commission = Math.round(price * (commissionRate / 100));
  const netRevenue = price - commission;

  const showNegotiated = priceType === 'negoce' && minAutoPrice && minAutoPrice > 0;
  const negotiatedCommission = showNegotiated
    ? Math.round(minAutoPrice * (commissionRate / 100))
    : 0;
  const negotiatedRevenue = showNegotiated ? minAutoPrice - negotiatedCommission : 0;

  const fmt = (n: number) => n.toLocaleString('fr-FR');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Info size={16} color="#003f2f" />
        <Text style={styles.title}>Estimation de vos revenus</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Prix affiche :</Text>
        <Text style={styles.rowValue}>{fmt(price)} FCFA</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Commission ({commissionRate}%) :</Text>
        <Text style={styles.rowValueRed}>- {fmt(commission)} FCFA</Text>
      </View>

      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Vous recevrez :</Text>
        <Text style={styles.totalValue}>{fmt(netRevenue)} FCFA</Text>
      </View>

      {showNegotiated && (
        <>
          <View style={styles.separator} />
          <Text style={styles.negotiatedHint}>Si le client negocie au minimum :</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Prix negocie ({fmt(minAutoPrice!)} FCFA) :</Text>
            <Text style={styles.rowValue}>{fmt(negotiatedRevenue)} FCFA</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f8faf9', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#e0e7e3',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowLabel: { fontSize: 13, color: '#666' },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  rowValueRed: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  totalRow: { marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#003f2f' },
  totalValue: { fontSize: 14, fontWeight: '700', color: '#003f2f' },
  separator: { height: 1, backgroundColor: '#e0e7e3', marginVertical: 10 },
  negotiatedHint: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 6 },
});
