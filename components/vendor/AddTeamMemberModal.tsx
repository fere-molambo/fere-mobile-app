import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { X, UserPlus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import PasswordInput from '@/components/PasswordInput';

interface Props {
  visible: boolean;
  onClose: () => void;
  shopId: string;
  vendorUserId: string;
  onSuccess: () => void;
}

export default function AddTeamMemberModal({ visible, onClose, shopId, vendorUserId, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Nom, email et mot de passe sont requis');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-user`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          nom_complet: name.trim(),
          telephone: phone.trim() || null,
          role: 'equipe',
          created_by: vendorUserId,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Erreur lors de la creation du compte');
        setLoading(false);
        return;
      }

      const newUserId = result.user_id;

      const { error: memberError } = await supabase
        .from('shop_team_members')
        .insert({
          shop_id: shopId,
          user_id: newUserId,
          role: 'member',
          added_by: vendorUserId,
          is_active: true,
        });

      if (memberError) {
        setError('Compte cree mais erreur ajout a l\'equipe');
        setLoading(false);
        return;
      }

      resetForm();
      onSuccess();
      onClose();
    } catch {
      setError('Erreur reseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <UserPlus size={20} color="#003f2f" />
              <Text style={styles.headerTitle}>Ajouter un membre</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={18} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Nom complet *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nom et prenom"
                placeholderTextColor="#aaa"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemple.com"
                placeholderTextColor="#aaa"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Telephone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+225 00 00 00 00"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe *</Text>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 caracteres"
              />
            </View>

            <Text style={styles.hint}>
              Un compte avec le role "equipe" sera cree. Le membre pourra se connecter avec son email et mot de passe.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>Creer le membre</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 16 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: '#dc2626', fontSize: 13 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#003f2f',
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
