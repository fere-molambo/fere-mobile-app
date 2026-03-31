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
import DropdownSelect from '@/components/vendor/DropdownSelect';
import { supabase } from '@/lib/supabase';
import type { Profile, DeliveryZone, DriverZone } from '@/types/database';

interface DriverInfoTabProps {
  profile: Profile;
  onUpdate: () => void;
}

interface ZoneWithStatus extends DeliveryZone {
  isActive: boolean;
}

export default function DriverInfoTab({ profile, onUpdate }: DriverInfoTabProps) {
  const [loading, setLoading] = useState(false);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [vehicleType, setVehicleType] = useState(profile.vehicle_type || '');
  const [vehicleColor, setVehicleColor] = useState(profile.vehicle_color || '');
  const [vehiclePlate, setVehiclePlate] = useState(profile.vehicle_plate || '');
  const [zones, setZones] = useState<ZoneWithStatus[]>([]);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      setZonesLoading(true);

      const { data: allZones, error: zonesError } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (zonesError) throw zonesError;

      const { data: driverZones, error: driverZonesError } = await supabase
        .from('driver_zones')
        .select('zone_id, is_active')
        .eq('driver_id', profile.id);

      if (driverZonesError) throw driverZonesError;

      const driverZoneMap = new Map(
        driverZones?.map((dz) => [dz.zone_id, dz.is_active]) || []
      );

      const zonesWithStatus: ZoneWithStatus[] = (allZones || []).map((zone) => ({
        ...zone,
        isActive: driverZoneMap.get(zone.id) || false,
      }));

      setZones(zonesWithStatus);
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setZonesLoading(false);
    }
  };

  const handleToggleZone = async (zoneId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    const activeZonesCount = zones.filter((z) => z.isActive).length;
    if (!newStatus && activeZonesCount === 1) {
      setMessage({
        type: 'error',
        text: 'Au moins une zone doit rester active',
      });
      return;
    }

    try {
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, isActive: newStatus } : z))
      );

      const { data: existing } = await supabase
        .from('driver_zones')
        .select('id')
        .eq('driver_id', profile.id)
        .eq('zone_id', zoneId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('driver_zones')
          .update({ is_active: newStatus })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('driver_zones').insert({
          driver_id: profile.id,
          zone_id: zoneId,
          is_active: newStatus,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Erreur lors de la mise à jour de la zone',
      });
      fetchZones();
    }
  };

  const handleSave = async () => {
    if (!vehicleType) {
      setMessage({ type: 'error', text: 'Le type d\'engin est requis' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          vehicle_type: vehicleType,
          vehicle_color: vehicleColor,
          vehicle_plate: vehiclePlate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Informations enregistrées avec succès',
      });
      onUpdate();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Erreur lors de la sauvegarde',
      });
    } finally {
      setLoading(false);
    }
  };

  const activeZonesCount = zones.filter((z) => z.isActive).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations du livreur</Text>

        <View style={styles.field}>
          <DropdownSelect
            label="Type d'engin *"
            value={vehicleType}
            onChange={(value) => setVehicleType(value)}
            placeholder="Sélectionner"
            options={[
              { label: 'Vélo', value: 'velo' },
              { label: 'Moto', value: 'moto' },
              { label: 'Véhicule', value: 'vehicule' },
              { label: 'Minivan', value: 'minivan' },
              { label: 'Camion', value: 'camion' },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Couleur de l'engin</Text>
          <TextInput
            style={styles.input}
            value={vehicleColor}
            onChangeText={setVehicleColor}
            placeholder="Ex: Rouge, Blanc, Noir"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Numéro de plaque</Text>
          <TextInput
            style={styles.input}
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            placeholder="Ex: BK 1234 AB"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
          />
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

      <View style={styles.section}>
        <View style={styles.zonesHeader}>
          <Text style={styles.sectionTitle}>Zones de livraison</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeZonesCount} active(s)</Text>
          </View>
        </View>
        <Text style={styles.sectionDescription}>
          Activez ou désactivez vos zones de livraison (minimum 1)
        </Text>

        {zonesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003f2f" />
          </View>
        ) : zones.length === 0 ? (
          <Text style={styles.noZonesText}>Aucune zone disponible</Text>
        ) : (
          <View style={styles.zonesList}>
            {zones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                style={styles.zoneItem}
                onPress={() => handleToggleZone(zone.id, zone.isActive)}>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Text style={styles.zoneDetails}>
                    {zone.city} • {zone.commune}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    zone.isActive && styles.checkboxActive,
                  ]}>
                  {zone.isActive && <View style={styles.checkboxInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    marginBottom: 20,
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
  zonesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#e8f5e9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f2f',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noZonesText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  zonesList: {
    gap: 12,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  zoneDetails: {
    fontSize: 13,
    color: '#6b7280',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: '#003f2f',
    backgroundColor: '#003f2f',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
});
