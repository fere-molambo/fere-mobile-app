import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import PhoneInput from '@/components/PhoneInput';
import PinInput from '@/components/PinInput';
import BlockedAccountScreen from '@/components/BlockedAccountScreen';
import * as phoneAuth from '@/lib/phoneAuth';
import type { PhoneAuthError } from '@/lib/phoneAuth';

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState<'connexion' | 'inscription'>('connexion');
  const [countryCode, setCountryCode] = useState('+223');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedSeconds, setBlockedSeconds] = useState(0);
  const [accountBlocked, setAccountBlocked] = useState<{
    reason?: string | null;
    supportPhone?: string;
    supportEmail?: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();
  const { setSessionFromTokens } = useAuth();

  useEffect(() => {
    if (blockedSeconds <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setBlockedSeconds((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [blockedSeconds > 0]);

  const handleLogin = async () => {
    setError(null);
    const fullPhone = `${countryCode}${phoneNumber}`;

    if (!phoneNumber) {
      setError('Veuillez entrer votre numéro de téléphone');
      return;
    }
    if (pin.length !== 6) {
      setError('Le code PIN doit contenir 6 chiffres');
      return;
    }

    setLoading(true);
    try {
      const result = await phoneAuth.login(fullPhone, pin);
      const accessToken = result.session?.access_token || (result as any).access_token;
      const refreshToken = result.session?.refresh_token || (result as any).refresh_token;
      if (accessToken && refreshToken) {
        await setSessionFromTokens(accessToken, refreshToken);
        router.replace('/(tabs)');
      } else {
        setError('Réponse invalide du serveur. Veuillez réessayer.');
      }
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      if (authErr.error === 'account_blocked') {
        setAccountBlocked({
          reason: authErr.reason,
          supportPhone: authErr.support_phone,
          supportEmail: authErr.support_email,
        });
        return;
      }
      setError(authErr.error || 'Erreur de connexion');
      if (authErr.remaining_seconds && authErr.remaining_seconds > 0) {
        setBlockedSeconds(authErr.remaining_seconds);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isBlocked = blockedSeconds > 0;

  if (accountBlocked) {
    return (
      <BlockedAccountScreen
        reason={accountBlocked.reason}
        supportPhone={accountBlocked.supportPhone}
        supportEmail={accountBlocked.supportEmail}
        onBack={() => setAccountBlocked(null)}
      />
    );
  }

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
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Accedez a votre espace FERE</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'connexion' && styles.activeTab]}
            onPress={() => setActiveTab('connexion')}
          >
            <Text style={[styles.tabText, activeTab === 'connexion' && styles.activeTabText]}>
              Connexion
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'inscription' && styles.activeTab]}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={[styles.tabText, activeTab === 'inscription' && styles.activeTabText]}>
              Inscription
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {isBlocked && (
            <View style={styles.blockedBanner}>
              <Text style={styles.blockedText}>
                Trop de tentatives. Reessayez dans {formatTimer(blockedSeconds)}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Numéro de téléphone</Text>
          <PhoneInput
            countryCode={countryCode}
            onCountryCodeChange={setCountryCode}
            number={phoneNumber}
            onNumberChange={setPhoneNumber}
          />

          <View style={styles.pinSection}>
            <Text style={styles.label}>Code PIN</Text>
            <PinInput
              value={pin}
              onChange={setPin}
              length={6}
              secure
            />
          </View>

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={() => router.push('/auth/reset-pin')}>
              <Text style={styles.linkText}>PIN oublie ?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/auth/admin-reset')}>
              <Text style={styles.linkText}>Demander a un admin</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, (loading || isBlocked) && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading || isBlocked}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 32,
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
    fontSize: 16,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  pinSection: {
    marginTop: 24,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
  },
  blockedBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  blockedText: {
    fontSize: 14,
    color: '#92400e',
    textAlign: 'center',
    fontWeight: '600',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 24,
  },
  linkText: {
    fontSize: 14,
    color: '#003f2f',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
