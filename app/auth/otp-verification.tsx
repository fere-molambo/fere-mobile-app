import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import PinInput from '@/components/PinInput';
import * as phoneAuth from '@/lib/phoneAuth';
import type { PhoneAuthError } from '@/lib/phoneAuth';
import { useAuthFlow } from '@/contexts/AuthFlowContext';

const RESEND_COOLDOWN = 60;

export default function OtpVerificationScreen() {
  const { flowData, clearFlowData } = useAuthFlow();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const maskedPhone = flowData?.phone
    ? flowData.phone.slice(0, 6) + '****' + flowData.phone.slice(-2)
    : '';

  const handleVerify = async () => {
    setError(null);
    if (!flowData?.phone) {
      setError('Session expiree, veuillez recommencer l\'inscription');
      return;
    }
    if (otp.length !== 6) {
      setError('Veuillez entrer le code a 6 chiffres');
      return;
    }

    setLoading(true);
    try {
      await phoneAuth.verifyRegistration(flowData.phone, otp);
      clearFlowData();
      setSuccess(true);
      setTimeout(() => {
        router.replace('/auth/login');
      }, 1500);
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      setError(authErr.error || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending || !flowData) return;
    setResending(true);
    setError(null);
    try {
      await phoneAuth.register(
        flowData.phone,
        flowData.full_name,
        flowData.pin,
        flowData.role,
        flowData.email || undefined,
      );
      setResendCooldown(RESEND_COOLDOWN);
      timerRef.current = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      setError(authErr.error || 'Erreur lors du renvoi');
    } finally {
      setResending(false);
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
          <Text style={styles.title}>Verification</Text>
          <Text style={styles.subtitle}>
            Un code SMS a ete envoye au {maskedPhone}
          </Text>
        </View>

        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Compte cree avec succes !</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.otpSection}>
          <Text style={styles.label}>Code de verification</Text>
          <PinInput
            value={otp}
            onChange={setOtp}
            length={6}
            secure={false}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, (loading || success) && styles.verifyButtonDisabled]}
          onPress={handleVerify}
          disabled={loading || success}
        >
          <Text style={styles.verifyButtonText}>
            {loading ? 'Verification...' : success ? 'Redirection...' : 'Verifier'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, resendCooldown > 0 && styles.resendButtonDisabled]}
          onPress={handleResend}
          disabled={resendCooldown > 0 || resending}
        >
          <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
            {resending
              ? 'Envoi...'
              : resendCooldown > 0
                ? `Renvoyer le code (${resendCooldown}s)`
                : 'Renvoyer le code'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
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
    marginBottom: 12,
    textAlign: 'center',
  },
  otpSection: {
    marginBottom: 32,
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
  verifyButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
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
    marginTop: 8,
  },
  backLinkText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
});
