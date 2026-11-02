import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { BatteryWarning, Settings } from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const STEPS = [
  'Ouvrez les réglages de FERE avec le bouton ci-dessous.',
  'Touchez « Batterie », puis choisissez « Sans restriction » (ou « Autoriser l’activité en arrière-plan »).',
  'Sur Tecno, Infinix, itel et Xiaomi, activez aussi « Démarrage automatique ».',
  'Pendant une course, laissez la notification « FERE · suivi en cours » : c’est elle qui garde le GPS actif.',
];

/**
 * Les gestionnaires de batterie des constructeurs ferment les applications en
 * arriere-plan malgre le service de premier plan. Mesure en base le 29/10 : une
 * seule position envoyee en seize minutes de course. Aucun code ne peut lever
 * cette restriction a la place du livreur ; on le guide vers le bon reglage.
 */
export default function BatteryGuideModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <BatteryWarning size={24} color="#b45309" />
          </View>

          <Text style={styles.title}>Gardez FERE active pendant vos courses</Text>
          <Text style={styles.intro}>
            Votre téléphone peut couper FERE pour économiser la batterie. Le client et le vendeur ne
            vous voient alors plus bouger sur la carte.
          </Text>

          {STEPS.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              Linking.openSettings().catch(() => {});
            }}
          >
            <Settings size={16} color="#fff" />
            <Text style={styles.primaryText}>Ouvrir les réglages de FERE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryText}>J'ai compris</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 22 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#003f2f', marginBottom: 6 },
  intro: { fontSize: 13.5, color: '#555', lineHeight: 19, marginBottom: 14 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#003f2f',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  stepText: { flex: 1, fontSize: 13.5, color: '#333', lineHeight: 19 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { color: '#666', fontSize: 13.5, fontWeight: '500' },
});
