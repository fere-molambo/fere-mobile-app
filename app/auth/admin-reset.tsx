import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import PhoneInput from '@/components/PhoneInput';
import * as phoneAuth from '@/lib/phoneAuth';
import type { PhoneAuthError } from '@/lib/phoneAuth';

export default function AdminResetScreen() {
  const [countryCode, setCountryCode] = useState('+223');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  const handleSubmit = async () => {
    setError(null);
    if (!phoneNumber) {
      setError('Veuillez entrer votre numero de telephone');
      return;
    }

    const fullPhone = `${countryCode}${phoneNumber}`;
    setLoading(true);
    try {
      await phoneAuth.requestAdminReset(fullPhone);
      setSuccess(true);
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      setError(authErr.error || 'Erreur lors de l\'envoi de la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/Logo_fere2.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Demande de reinitialisation</Text>
          <Text style={styles.subtitle}>
            Un administrateur reinitialiser votre code PIN manuellement
          </Text>
        </View>

        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Demande envoyee</Text>
            <Text style={styles.successText}>
              Votre demande a ete transmise a un administrateur. Vous serez contacte prochainement.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/auth/login')}
            >
              <Text style={styles.primaryButtonText}>Retour a la connexion</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Numero de telephone</Text>
            <PhoneInput
              countryCode={countryCode}
              onCountryCodeChange={setCountryCode}
              number={phoneNumber}
              onNumberChange={setPhoneNumber}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Envoi...' : 'Envoyer la demande'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!success && (
          <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.backLink}>
            <Text style={styles.backLinkText}>Retour a la connexion</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
  },
  successText: {
    fontSize: 15,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    width: '100%',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
});
