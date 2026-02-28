import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Clock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface ShopData {
  id: string;
  name: string;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  support_phone: string | null;
  google_maps_link: string | null;
  whatsapp_catalog_link: string | null;
  opening_time: string | null;
  closing_time: string | null;
  delivery_details: string | null;
  return_policy: string | null;
}

interface Props {
  shop: ShopData;
  onUpdate: () => void;
}

function parseTimeDisplay(time: string | null): string {
  if (!time) return '';
  return time.substring(0, 5);
}

function parseGoogleMapsCoords(link: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /place\/.*?\/(-?\d+\.\d+),(-?\d+\.\d+)/,
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const match = link.match(p);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
  }
  return null;
}

export default function ShopInfoTab({ shop, onUpdate }: Props) {
  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description || '');
  const [contactPhone, setContactPhone] = useState(shop.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(shop.contact_email || '');
  const [supportPhone, setSupportPhone] = useState(shop.support_phone || '');
  const [googleMapsLink, setGoogleMapsLink] = useState(shop.google_maps_link || '');
  const [whatsappLink, setWhatsappLink] = useState(shop.whatsapp_catalog_link || '');
  const [openingTime, setOpeningTime] = useState(parseTimeDisplay(shop.opening_time));
  const [closingTime, setClosingTime] = useState(parseTimeDisplay(shop.closing_time));
  const [deliveryDetails, setDeliveryDetails] = useState(shop.delivery_details || '');
  const [returnPolicy, setReturnPolicy] = useState(shop.return_policy || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Le nom de la boutique est requis' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        support_phone: supportPhone.trim() || null,
        google_maps_link: googleMapsLink.trim() || null,
        whatsapp_catalog_link: whatsappLink.trim() || null,
        opening_time: openingTime.trim() || null,
        closing_time: closingTime.trim() || null,
        delivery_details: deliveryDetails.trim() || null,
        return_policy: returnPolicy.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (googleMapsLink.trim()) {
        const coords = parseGoogleMapsCoords(googleMapsLink.trim());
        if (coords) {
          updates.geolocation_lat = coords.lat;
          updates.geolocation_lng = coords.lng;
        }
      }

      const { error } = await supabase
        .from('shops')
        .update(updates)
        .eq('id', shop.id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Informations enregistrees avec succes' });
      onUpdate();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informations de la boutique</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nom de la boutique</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom de la boutique" placeholderTextColor="#9ca3af" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Description de la boutique" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Telephone de contact</Text>
          <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} placeholder="+223XXXXXXXXX" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email de contact</Text>
          <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} placeholder="email@example.com" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Telephone support</Text>
          <TextInput style={styles.input} value={supportPhone} onChangeText={setSupportPhone} placeholder="+223XXXXXXXXX" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Lien Google Maps</Text>
          <TextInput style={styles.input} value={googleMapsLink} onChangeText={setGoogleMapsLink} placeholder="https://www.google.com/maps/place/..." placeholderTextColor="#9ca3af" autoCapitalize="none" />
          <Text style={styles.hint}>Copiez le lien Google Maps de votre boutique. Les coordonnees seront extraites automatiquement.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Lien catalogue WhatsApp</Text>
          <TextInput style={styles.input} value={whatsappLink} onChangeText={setWhatsappLink} placeholder="https://wa.me/c/..." placeholderTextColor="#9ca3af" autoCapitalize="none" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Heure d'ouverture</Text>
          <View style={styles.timeRow}>
            <TextInput style={[styles.input, styles.timeInput]} value={openingTime} onChangeText={setOpeningTime} placeholder="08:00" placeholderTextColor="#9ca3af" keyboardType="numbers-and-punctuation" />
            <Clock size={18} color="#666" />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Heure de fermeture</Text>
          <View style={styles.timeRow}>
            <TextInput style={[styles.input, styles.timeInput]} value={closingTime} onChangeText={setClosingTime} placeholder="17:00" placeholderTextColor="#9ca3af" keyboardType="numbers-and-punctuation" />
            <Clock size={18} color="#666" />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Details de livraison</Text>
          <TextInput style={[styles.input, styles.textArea]} value={deliveryDetails} onChangeText={setDeliveryDetails} placeholder="Informations sur la livraison" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Politique de retour</Text>
          <TextInput style={[styles.input, styles.textArea]} value={returnPolicy} onChangeText={setReturnPolicy} placeholder="Politique de retour" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
        </View>

        {message && (
          <View style={[styles.message, message.type === 'success' ? styles.successMsg : styles.errorMsg]}>
            <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, margin: 16,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 15, color: '#1f2937', borderWidth: 1, borderColor: '#e5e7eb',
  },
  textArea: { minHeight: 80, paddingTop: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeInput: { flex: 1 },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 18 },
  message: { padding: 12, borderRadius: 10, marginBottom: 16 },
  successMsg: { backgroundColor: '#dcfce7' },
  errorMsg: { backgroundColor: '#fee2e2' },
  messageText: { fontSize: 14, textAlign: 'center' },
  successText: { color: '#065f46' },
  errorText: { color: '#991b1b' },
  saveBtn: {
    backgroundColor: '#003f2f', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
