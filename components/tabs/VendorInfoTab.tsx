import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Profile, StatutLegalType, TypeOffreType } from '@/types/database';

interface Props {
  profile: Profile;
  onUpdate: () => void;
}

const STATUT_LEGAL_OPTIONS: { value: StatutLegalType; label: string }[] = [
  { value: 'particulier', label: 'Particulier' },
  { value: 'entreprise', label: 'Entreprise' },
];

const TYPE_OFFRE_OPTIONS: { value: TypeOffreType; label: string }[] = [
  { value: 'produits', label: 'Produits' },
  { value: 'services', label: 'Services' },
  { value: 'les_deux', label: 'Les deux' },
];

function parseGoogleMapsCoords(link: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /place\/.*?\/(-?\d+\.\d+),(-?\d+\.\d+)/,
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const match = link.match(p);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

export default function VendorInfoTab({ profile, onUpdate }: Props) {
  const [statutLegal, setStatutLegal] = useState<StatutLegalType | ''>(profile.statut_legal || '');
  const [typeOffre, setTypeOffre] = useState<TypeOffreType | ''>(profile.type_offre || '');
  const [adresse, setAdresse] = useState(profile.adresse || '');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile.geolocalisation_lat && profile.geolocalisation_lng) {
      setGoogleMapsLink(`https://www.google.com/maps?q=${profile.geolocalisation_lat},${profile.geolocalisation_lng}`);
    }
  }, [profile]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {
        statut_legal: statutLegal || null,
        type_offre: typeOffre || null,
        adresse: adresse.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (googleMapsLink.trim()) {
        const coords = parseGoogleMapsCoords(googleMapsLink.trim());
        if (coords) {
          updates.geolocalisation_lat = coords.lat;
          updates.geolocalisation_lng = coords.lng;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Informations enregistrées avec succès' });
      onUpdate();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations vendeur</Text>
        <Text style={styles.sectionDescription}>
          Ces informations sont liees a votre activite de vendeur
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Statut legal</Text>
          <View style={styles.chips}>
            {STATUT_LEGAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, statutLegal === opt.value && styles.chipActive]}
                onPress={() => setStatutLegal(statutLegal === opt.value ? '' : opt.value)}
              >
                <Text style={[styles.chipText, statutLegal === opt.value && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Type d'offre</Text>
          <View style={styles.chips}>
            {TYPE_OFFRE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, typeOffre === opt.value && styles.chipActive]}
                onPress={() => setTypeOffre(typeOffre === opt.value ? '' : opt.value)}
              >
                <Text style={[styles.chipText, typeOffre === opt.value && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Adresse</Text>
          <TextInput
            style={styles.input}
            value={adresse}
            onChangeText={setAdresse}
            placeholder="Votre adresse"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Lien Google Maps</Text>
          <TextInput
            style={styles.input}
            value={googleMapsLink}
            onChangeText={setGoogleMapsLink}
            placeholder="https://www.google.com/maps/place/..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            Copiez le lien Google Maps de votre emplacement. Les coordonnees seront extraites automatiquement.
          </Text>
        </View>

        {message && (
          <View style={[styles.message, message.type === 'success' ? styles.successMsg : styles.errorMsg]}>
            <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
              {message.text}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  section: { backgroundColor: '#fff', padding: 20, margin: 16, borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  sectionDescription: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#f5f5f5', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 15, color: '#1f2937', borderWidth: 1, borderColor: 'transparent',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  chipActive: { backgroundColor: '#003f2f', borderColor: '#003f2f' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 18 },
  message: { padding: 12, borderRadius: 8, marginBottom: 16 },
  successMsg: { backgroundColor: '#d1fae5' },
  errorMsg: { backgroundColor: '#fee2e2' },
  messageText: { fontSize: 14, textAlign: 'center' },
  successText: { color: '#065f46' },
  errorText: { color: '#991b1b' },
  saveButton: {
    backgroundColor: '#003f2f', paddingVertical: 16, borderRadius: 10, alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
