import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import PasswordInput from '../PasswordInput';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface PersonalInfoTabProps {
  profile: Profile;
  onUpdate: () => void;
}

export default function PersonalInfoTab({
  profile,
  onUpdate,
}: PersonalInfoTabProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [nomComplet, setNomComplet] = useState(profile.nom_complet);
  const [telephone, setTelephone] = useState(profile.contact);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSave = async () => {
    if (!nomComplet.trim()) {
      setMessage({ type: 'error', text: 'Le nom complet est requis' });
      return;
    }

    if (!telephone.trim()) {
      setMessage({ type: 'error', text: 'Le téléphone est requis' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Partial<Profile> = {
        nom_complet: nomComplet,
        contact: telephone,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (updateError) throw updateError;

      if (password && password.length >= 6) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password,
        });

        if (passwordError) throw passwordError;
      }

      setMessage({ type: 'success', text: 'Informations enregistrées avec succès' });
      setPassword('');
      onUpdate();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations personnelles</Text>
        <Text style={styles.sectionDescription}>
          Ces informations nous aident à personnaliser votre expérience
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.input}
            value={nomComplet}
            onChangeText={setNomComplet}
            placeholder="Votre nom complet"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            style={styles.input}
            value={telephone}
            onChangeText={setTelephone}
            placeholder="+223XXXXXXXXX"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            label="Nouveau mot de passe"
            placeholder="Laisser vide pour ne pas changer"
          />
          {password && password.length > 0 && password.length < 6 && (
            <Text style={styles.hint}>Minimum 6 caractères requis</Text>
          )}
        </View>

        {message && (
          <View
            style={[
              styles.message,
              message.type === 'success' ? styles.successMessage : styles.errorMessage,
            ]}>
            <Text
              style={[
                styles.messageText,
                message.type === 'success' ? styles.successText : styles.errorText,
              ]}>
              {message.text}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hint: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },
  message: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successMessage: {
    backgroundColor: '#d1fae5',
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
  },
  messageText: {
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    color: '#065f46',
  },
  errorText: {
    color: '#991b1b',
  },
  saveButton: {
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
