import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AppRole } from '@/types/database';
import { User, Mail, ChevronDown } from 'lucide-react-native';
import PhoneInput from '@/components/PhoneInput';
import PinInput from '@/components/PinInput';
import * as phoneAuth from '@/lib/phoneAuth';
import type { PhoneAuthError } from '@/lib/phoneAuth';
import { useAuthFlow } from '@/contexts/AuthFlowContext';

export default function RegisterScreen() {
  const [activeTab, setActiveTab] = useState<'connexion' | 'inscription'>('inscription');
  const [nomComplet, setNomComplet] = useState('');
  const [countryCode, setCountryCode] = useState('+225');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('membre');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const router = useRouter();
  const { setFlowData } = useAuthFlow();

  const roleOptions: { value: AppRole; label: string }[] = [
    { value: 'membre', label: 'Membre' },
    { value: 'livreur', label: 'Livreur' },
    { value: 'vendeur', label: 'Vendeur' },
  ];

  const handleRegister = async () => {
    setError(null);
    setPinError(null);

    if (!nomComplet || !phoneNumber) {
      setError('Veuillez remplir le nom et le telephone');
      return;
    }

    if (pin.length !== 6) {
      setPinError('Le code PIN doit contenir 6 chiffres');
      return;
    }

    if (pin !== confirmPin) {
      setPinError('Les codes PIN ne correspondent pas');
      return;
    }

    const fullPhone = `${countryCode}${phoneNumber}`;

    setLoading(true);
    try {
      const result = await phoneAuth.register(fullPhone, nomComplet, pin, selectedRole, email || undefined);
      if (result.sms_sent === false && result.dev_otp) {
        console.log('[DEV] OTP code:', result.dev_otp);
      }
      setFlowData({
        phone: fullPhone,
        full_name: nomComplet,
        pin,
        role: selectedRole,
        email: email || '',
      });
      router.push('/auth/otp-verification');
    } catch (err: unknown) {
      const authErr = err as PhoneAuthError;
      setError(authErr.error || 'Erreur lors de l\'inscription');
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
          <Text style={styles.title}>Creer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez la communaute Fere</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'connexion' && styles.activeTab]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={[styles.tabText, activeTab === 'connexion' && styles.activeTabText]}>
              Connexion
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'inscription' && styles.activeTab]}
            onPress={() => setActiveTab('inscription')}
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

          <Text style={styles.label}>Nom complet</Text>
          <View style={styles.inputContainer}>
            <User size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Jean Dupont"
              value={nomComplet}
              onChangeText={setNomComplet}
            />
          </View>

          <Text style={styles.label}>Numero de telephone</Text>
          <PhoneInput
            countryCode={countryCode}
            onCountryCodeChange={setCountryCode}
            number={phoneNumber}
            onNumberChange={setPhoneNumber}
          />

          <View style={styles.spacer} />

          <Text style={styles.label}>Email (optionnel)</Text>
          <View style={styles.inputContainer}>
            <Mail size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Vous etes</Text>
          <TouchableOpacity
            style={styles.pickerContainer}
            onPress={() => setShowRolePicker(!showRolePicker)}
          >
            <Text style={styles.pickerText}>
              {roleOptions.find(r => r.value === selectedRole)?.label}
            </Text>
            <ChevronDown size={20} color="#666" />
          </TouchableOpacity>

          {showRolePicker && (
            <View style={styles.pickerOptions}>
              {roleOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.pickerOption}
                  onPress={() => {
                    setSelectedRole(option.value);
                    setShowRolePicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Code PIN (6 chiffres)</Text>
          <PinInput
            value={pin}
            onChange={(v) => { setPin(v); setPinError(null); }}
            length={6}
            secure
            error={pinError || undefined}
          />

          <View style={styles.confirmPinSection}>
            <Text style={styles.label}>Confirmer le code PIN</Text>
            <PinInput
              value={confirmPin}
              onChange={(v) => { setConfirmPin(v); setPinError(null); }}
              length={6}
              secure
            />
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Inscription...' : 'S\'inscrire'}
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
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  spacer: {
    height: 4,
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
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  pickerText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  pickerOptions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    overflow: 'hidden',
  },
  pickerOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  confirmPinSection: {
    marginTop: 20,
  },
  registerButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
