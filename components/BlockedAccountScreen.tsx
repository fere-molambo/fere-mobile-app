import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import { ShieldOff, Phone, Mail, ArrowLeft } from 'lucide-react-native';

interface Props {
  reason?: string | null;
  supportPhone?: string;
  supportEmail?: string;
  onBack: () => void;
}

export default function BlockedAccountScreen({
  reason,
  supportPhone = '+22300000000',
  supportEmail = 'support@fere.app',
  onBack,
}: Props) {
  const handleCallSupport = () => {
    Linking.openURL(`tel:${supportPhone}`);
  };

  const handleEmailSupport = () => {
    Linking.openURL(`mailto:${supportEmail}`);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={20} color="#666" />
        <Text style={styles.backText}>Retour</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <ShieldOff size={40} color="#dc2626" />
          </View>
        </View>

        <Text style={styles.title}>Compte suspendu</Text>
        <Text style={styles.subtitle}>
          Votre compte a ete suspendu par notre equipe.
        </Text>

        {reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Motif :</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}

        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Contactez le support</Text>
          <Text style={styles.contactSubtitle}>
            Si vous pensez qu'il s'agit d'une erreur, contactez notre equipe de support.
          </Text>

          <TouchableOpacity style={styles.contactBtn} onPress={handleCallSupport} activeOpacity={0.7}>
            <Phone size={18} color="#003f2f" />
            <Text style={styles.contactBtnText}>{supportPhone}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactBtn} onPress={handleEmailSupport} activeOpacity={0.7}>
            <Mail size={18} color="#003f2f" />
            <Text style={styles.contactBtnText}>{supportEmail}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  reasonBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
  },
  contactSection: {
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  contactSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  contactBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#003f2f',
  },
});
