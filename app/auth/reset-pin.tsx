import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import PhoneInput from '@/components/PhoneInput';
import PinInput from '@/components/PinInput';
import * as phoneAuth from '@/lib/phoneAuth';
import type { PhoneAuthError } from '@/lib/phoneAuth';

const RESEND_COOLDOWN = 60;

export default function ResetPinScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [countryCode, setCountryCode] = useState('+223');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    setError(null);
    if (!phoneNumber) {
      setError('Veuillez entrer votre numéro de téléphone');
      return;
    }

    const fullPhone = `${countryCode}${phoneNumber}`;
    setLoading(true);
    try {
      await phoneAuth.resetPinRequest(fullPhone);
      setStep(2);
      startCooldown();
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      setError(authErr.error || 'Erreur lors de l\'envoi du code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const fullPhone = `${countryCode}${phoneNumber}`;
    setError(null);
    try {
      await phoneAuth.resetPinRequest(fullPhone);
      startCooldown();
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      setError(authErr.error || 'Erreur lors du renvoi');
    }
  };

  const handleResetPin = async () => {
    setError(null);
    setPinError(null);

    if (otp.length !== 6) {
      setError('Veuillez entrer le code a 6 chiffres');
      return;
    }
    if (newPin.length !== 6) {
      setPinError('Le nouveau PIN doit contenir 6 chiffres');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Les codes PIN ne correspondent pas');
      return;
    }

    const fullPhone = `${countryCode}${phoneNumber}`;
    setLoading(true);
    try {
      await phoneAuth.resetPinConfirm(fullPhone, otp, newPin);
      setSuccess(true);
      setTimeout(() => {
        router.replace('/auth/login');
      }, 1500);
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      setError(authErr.error || 'Erreur lors de la reinitialisation');
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
          <Text style={styles.title}>Reinitialiser le PIN</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Entrez votre numéro pour recevoir un code de verification'
              : 'Entrez le code recu et votre nouveau PIN'}
          </Text>
        </View>

        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>PIN reinitialise avec succès !</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <PhoneInput
              countryCode={countryCode}
              onCountryCodeChange={setCountryCode}
              number={phoneNumber}
              onNumberChange={setPhoneNumber}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && !success && (
          <View>
            <Text style={styles.label}>Code de verification</Text>
            <PinInput
              value={otp}
              onChange={setOtp}
              length={6}
              secure={false}
              autoFocus
            />

            <View style={styles.newPinSection}>
              <Text style={styles.label}>Nouveau code PIN</Text>
              <PinInput
                value={newPin}
                onChange={(v) => { setNewPin(v); setPinError(null); }}
                length={6}
                secure
                error={pinError || undefined}
              />
            </View>

            <View style={styles.newPinSection}>
              <Text style={styles.label}>Confirmer le PIN</Text>
              <PinInput
                value={confirmPin}
                onChange={(v) => { setConfirmPin(v); setPinError(null); }}
                length={6}
                secure
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleResetPin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Reinitialisation...' : 'Reinitialiser'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendButton, resendCooldown > 0 && styles.resendButtonDisabled]}
              onPress={handleResend}
              disabled={resendCooldown > 0}
            >
              <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
                {resendCooldown > 0 ? `Renvoyer le code (${resendCooldown}s)` : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour a la connexion</Text>
        </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
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
  successBanner: {
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  successText: {
    fontSize: 15,
    color: '#166534',
    textAlign: 'center',
    fontWeight: '600',
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
  newPinSection: {
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 15,
    color: '#003f2f',
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#999',
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
