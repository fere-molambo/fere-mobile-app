import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/database';
import { User, Phone, Mail, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react-native';

export default function RegisterScreen() {
  const [activeTab, setActiveTab] = useState<'connexion' | 'inscription'>('inscription');
  const [nomComplet, setNomComplet] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('client');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { signUp } = useAuth();

  const roleOptions: { value: AppRole; label: string }[] = [
    { value: 'client', label: 'Membre' },
    { value: 'livreur', label: 'Livreur' },
    { value: 'vendeur', label: 'Vendeur' },
  ];

  const handleRegister = async () => {
    if (!nomComplet || !contact || !email || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, nomComplet, contact, selectedRole);
    setLoading(false);

    if (error) {
      Alert.alert('Erreur d\'inscription', error.message);
    } else {
      Alert.alert('Succès', 'Votre compte a été créé avec succès', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
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
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez la communauté Fere</Text>
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

          <Text style={styles.label}>Numéro de téléphone</Text>
          <View style={styles.inputContainer}>
            <Phone size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="+223"
              value={contact}
              onChangeText={setContact}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>Email</Text>
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

          <Text style={styles.label}>Vous êtes</Text>
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

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.inputContainer}>
            <Lock size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={20} color="#666" />
              ) : (
                <Eye size={20} color="#666" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <View style={styles.inputContainer}>
            <Lock size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              {showConfirmPassword ? (
                <EyeOff size={20} color="#666" />
              ) : (
                <Eye size={20} color="#666" />
              )}
            </TouchableOpacity>
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
  registerButton: {
    backgroundColor: '#003f2f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
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
