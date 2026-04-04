import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Store, MapPin, Phone, Mail } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import DropdownSelect from '@/components/vendor/DropdownSelect';

interface Props {
  userId: string;
  onCreated: () => void;
}

const SHOP_TYPES = [
  { value: 'produits', label: 'Produits uniquement' },
  { value: 'prestataire', label: 'Services uniquement' },
  { value: 'les_deux', label: 'Produits et services' },
];

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

export default function ShopCreationForm({ userId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shopType, setShopType] = useState('les_deux');
  const [address, setAddress] = useState('');
  const [phone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Le nom de la boutique est requis');
      return;
    }
    if (name.trim().length < 3) {
      setError('Le nom doit contenir au moins 3 caracteres');
      return;
    }

    setSaving(true);
    try {
      const slug = generateSlug(name.trim());

      const { data, error: insertError } = await supabase.from('shops').insert({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        owner_id: userId,
        shop_type: shopType,
        verification_status: 'pending',
        is_official: false,
        is_active: false,
        address: address.trim() || null,
        contact_phone: phone.trim() || null,
        contact_email: email.trim() || null,
      }).select('id, name').maybeSingle();

      if (insertError) throw insertError;

      if (data) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'new_shop_created',
              title: 'Nouvelle boutique creee',
              body: `Une nouvelle boutique "${data.name}" a ete creee et est en attente de validation.`,
              target_roles: ['admin', 'super_admin'],
              data: { shop_id: data.id },
            },
          });
        } catch {
          // Notification failure should not block shop creation
        }
      }

      onCreated();
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) {
        setError('Une boutique avec ce nom existe deja');
      } else {
        setError(err?.message || 'Erreur lors de la creation');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Store size={32} color="#003f2f" />
          </View>
        </View>

        <Text style={styles.title}>Creer votre boutique</Text>
        <Text style={styles.subtitle}>
          Remplissez les informations de base pour demarrer. Vous pourrez completer votre profil plus tard.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Nom de la boutique *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Boutique Adama"
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Decrivez votre activite en quelques mots"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
          />
        </View>

        <View style={styles.field}>
          <DropdownSelect
            label="Type de boutique *"
            value={shopType}
            options={SHOP_TYPES}
            onChange={setShopType}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <MapPin size={14} color="#374151" />
            <Text style={styles.label}>Adresse</Text>
          </View>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Adresse de votre boutique"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Phone size={14} color="#374151" />
            <Text style={styles.label}>Telephone de contact</Text>
          </View>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setContactPhone}
            placeholder="+229 XX XX XX XX"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Mail size={14} color="#374151" />
            <Text style={styles.label}>Email</Text>
          </View>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="contact@maboutique.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Bon a savoir</Text>
          <Text style={styles.infoText}>
            Votre boutique sera soumise a validation par notre equipe. Vous pourrez ajouter vos produits et services en attendant, mais ils ne seront visibles par les clients qu'apres activation.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, saving && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Creer ma boutique</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#15803d',
    lineHeight: 19,
  },
  createBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
