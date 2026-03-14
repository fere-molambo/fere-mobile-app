import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import type { DeliveryAddress } from '@/types/database';

interface AddressModalProps {
  visible: boolean;
  address?: DeliveryAddress | null;
  userId: string;
  onClose: (shouldRefresh: boolean) => void;
  onSave?: () => void;
}

export default function AddressModal({
  visible,
  address = null,
  userId,
  onClose,
  onSave,
}: AddressModalProps) {
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Mali');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (address) {
      setLabel(address.label);
      setRecipientName(address.recipient_name);
      setRecipientPhone(address.recipient_phone);
      setAddressText(address.address);
      setCity(address.city);
      setCountry(address.country);
      setLat(address.geolocation_lat || null);
      setLng(address.geolocation_lng || null);
      setIsDefault(address.is_default);
    } else {
      resetForm();
    }
  }, [address, visible]);

  const resetForm = () => {
    setLabel('');
    setRecipientName('');
    setRecipientPhone('');
    setAddressText('');
    setCity('');
    setCountry('Mali');
    setLat(null);
    setLng(null);
    setIsDefault(false);
    setError(null);
  };

  const handleGetLocation = async () => {
    if (Platform.OS === 'web') {
      setError('La géolocalisation n\'est pas disponible sur le web. Veuillez entrer l\'adresse manuellement.');
      return;
    }

    try {
      setGettingLocation(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission de géolocalisation refusée');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLat(location.coords.latitude);
      setLng(location.coords.longitude);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la récupération de la position');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!label.trim()) {
      setError('Le libellé est requis');
      return;
    }

    if (!recipientName.trim()) {
      setError('Le nom du destinataire est requis');
      return;
    }

    if (!recipientPhone.trim()) {
      setError('Le contact du destinataire est requis');
      return;
    }

    if (!addressText.trim()) {
      setError('L\'adresse complète est requise');
      return;
    }

    if (!city.trim()) {
      setError('La ville est requise');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const addressData: any = {
        user_id: userId,
        label: label.trim(),
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        address: addressText.trim(),
        city: city.trim(),
        country: country.trim(),
        geolocation_lat: lat,
        geolocation_lng: lng,
        is_default: isDefault,
        updated_at: new Date().toISOString(),
      };

      if (address) {
        const { error: updateError } = await supabase
          .from('delivery_addresses')
          .update(addressData)
          .eq('id', address.id);

        if (updateError) throw updateError;
      } else {
        addressData.created_at = new Date().toISOString();

        const { error: insertError } = await supabase
          .from('delivery_addresses')
          .insert(addressData);

        if (insertError) throw insertError;
      }

      if (isDefault) {
        await supabase
          .from('delivery_addresses')
          .update({ is_default: false })
          .neq('id', address?.id || '')
          .eq('user_id', userId);
      }

      if (onSave) {
        onSave();
        onClose(false);
      } else {
        onClose(true);
      }
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose(false)}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {address ? 'Modifier l\'adresse' : 'Nouvelle adresse'}
          </Text>
          <TouchableOpacity onPress={() => onClose(false)} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Text style={styles.label}>Libellé *</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Ex: Maison, Bureau, Chez maman"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Nom du destinataire *</Text>
              <TextInput
                style={styles.input}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Nom complet"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Contact *</Text>
              <TextInput
                style={styles.input}
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="+223XXXXXXXXX"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Adresse complète *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={addressText}
              onChangeText={setAddressText}
              placeholder="Adresse détaillée avec repères"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Ville *</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Bamako"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Pays *</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder="Mali"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Géolocalisation</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleGetLocation}
              disabled={gettingLocation}>
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#003f2f" />
              ) : (
                <>
                  <MapPin size={20} color="#003f2f" />
                  <Text style={styles.locationButtonText}>
                    {lat && lng ? 'Position enregistrée' : 'Pointer ma position'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {lat && lng && (
              <Text style={styles.coordinatesText}>
                Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.defaultCheckbox}
            onPress={() => setIsDefault(!isDefault)}>
            <View style={[styles.checkbox, isDefault && styles.checkboxChecked]}>
              {isDefault && <View style={styles.checkboxInner} />}
            </View>
            <Text style={styles.checkboxLabel}>Définir comme adresse par défaut</Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => onClose(false)}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {address ? 'Modifier' : 'Ajouter'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
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
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e8f5e9',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#003f2f',
    borderStyle: 'dashed',
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  defaultCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: '#003f2f',
    backgroundColor: '#003f2f',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
