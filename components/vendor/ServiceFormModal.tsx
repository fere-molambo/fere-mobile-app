import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, ActivityIndicator, Switch, Image, Platform,
} from 'react-native';
import { X, Camera, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import DropdownSelect from '@/components/vendor/DropdownSelect';
import RevenueEstimationCard from '@/components/vendor/RevenueEstimationCard';
import WeeklyAvailabilityEditor from '@/components/vendor/WeeklyAvailabilityEditor';
import { DURATION_OPTIONS, normalizeAvailabilityKeys } from '@/lib/bookingUtils';

interface TimeSlot {
  start: string;
  end: string;
}

type WeeklyAvailability = Record<string, TimeSlot[]>;

interface ServiceData {
  id?: string;
  name: string;
  description?: string | null;
  includes?: string | null;
  client_preparation?: string | null;
  price: number;
  price_type?: string | null;
  discount_percent?: number | null;
  requires_booking: boolean;
  duration?: number | null;
  travel_fee_type?: string | null;
  travel_fee_amount?: number | null;
  portfolio_link?: string | null;
  main_media_url?: string | null;
  media_urls?: string[] | null;
  is_active: boolean;
  min_auto_price?: number | null;
  auto_validation?: boolean | null;
  weekly_availability?: WeeklyAvailability | null;
}

interface Props {
  visible: boolean;
  shopId: string;
  service?: ServiceData | null;
  onClose: () => void;
  onSaved: () => void;
}

const PRICE_TYPES = [
  { value: 'fixe', label: 'Fixe' },
  { value: 'negoce', label: 'Negoce' },
];

const DURATION_DROPDOWN = DURATION_OPTIONS.map((d) => ({
  value: String(d.value),
  label: d.label,
}));

export default function ServiceFormModal({ visible, shopId, service, onClose, onSaved }: Props) {
  const isEdit = !!service?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includes, setIncludes] = useState('');
  const [clientPrep, setClientPrep] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState('fixe');
  const [discountPercent, setDiscountPercent] = useState('');
  const [requiresBooking, setRequiresBooking] = useState(true);
  const [duration, setDuration] = useState('60');
  const [travelFeeType, setTravelFeeType] = useState<'gratuit' | 'payant'>('gratuit');
  const [travelFeeAmount, setTravelFeeAmount] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [minAutoPrice, setMinAutoPrice] = useState('');
  const [autoValidation, setAutoValidation] = useState(false);
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>({});

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (service) {
        setName(service.name);
        setDescription(service.description || '');
        setIncludes(service.includes || '');
        setClientPrep(service.client_preparation || '');
        setPrice(String(service.price));
        setPriceType(service.price_type || 'fixe');
        setDiscountPercent(service.discount_percent ? String(service.discount_percent) : '');
        setRequiresBooking(service.requires_booking);
        setDuration(service.duration ? String(service.duration) : '60');
        const feeType = service.travel_fee_type;
        setTravelFeeType(feeType === 'paid' ? 'payant' : 'gratuit');
        setTravelFeeAmount(service.travel_fee_amount ? String(service.travel_fee_amount) : '');
        setPortfolioLink(service.portfolio_link || '');
        setMainImageUrl(service.main_media_url || null);
        setIsActive(service.is_active);
        setMinAutoPrice(service.min_auto_price ? String(service.min_auto_price) : '');
        setAutoValidation(service.auto_validation || false);
        setWeeklyAvailability(
          service.weekly_availability && typeof service.weekly_availability === 'object'
            ? normalizeAvailabilityKeys(service.weekly_availability)
            : {}
        );
      } else {
        resetForm();
      }
    }
  }, [visible, service]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIncludes('');
    setClientPrep('');
    setPrice('');
    setPriceType('fixe');
    setDiscountPercent('');
    setRequiresBooking(true);
    setDuration('60');
    setTravelFeeType('gratuit');
    setTravelFeeAmount('');
    setPortfolioLink('');
    setMainImageUrl(null);
    setIsActive(true);
    setMinAutoPrice('');
    setAutoValidation(false);
    setWeeklyAvailability({});
    setError(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission requise pour acceder aux photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    setError(null);

    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `${shopId}/${Date.now()}.${ext}`;

      const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('service-media')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('service-media').getPublicUrl(fileName);
      setMainImageUrl(urlData.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du telechargement');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom est requis'); return; }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) { setError('Le prix est requis et doit etre positif'); return; }

    setSaving(true);
    setError(null);

    try {
      const hasAvailability = Object.keys(weeklyAvailability).length > 0;

      const payload: Record<string, any> = {
        shop_id: shopId,
        name: name.trim(),
        description: description.trim() || null,
        includes: includes.trim() || null,
        client_preparation: clientPrep.trim() || null,
        price: Number(price),
        price_type: priceType,
        discount_percent: discountPercent ? Number(discountPercent) : null,
        requires_booking: requiresBooking,
        duration: duration ? parseInt(duration) : null,
        travel_fee_type: travelFeeType === 'payant' ? 'paid' : 'free',
        travel_fee_amount: travelFeeType === 'payant' && travelFeeAmount ? Number(travelFeeAmount) : null,
        portfolio_link: portfolioLink.trim() || null,
        main_media_url: mainImageUrl || null,
        is_active: isActive,
        min_auto_price: minAutoPrice ? Number(minAutoPrice) : null,
        auto_validation: autoValidation,
        weekly_availability: hasAvailability ? weeklyAvailability : null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && service?.id) {
        const { error: err } = await supabase.from('services').update(payload).eq('id', service.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('services').insert(payload);
        if (err) throw err;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const priceNum = Number(price) || 0;
  const minAutoPriceNum = Number(minAutoPrice) || 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{isEdit ? 'Modifier la prestation' : 'Nouvelle prestation'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.imageUpload} onPress={pickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="large" color="#003f2f" />
            ) : mainImageUrl ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: mainImageUrl }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeImage} onPress={() => setMainImageUrl(null)}>
                  <Trash2 size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Camera size={32} color="#999" />
                <Text style={styles.imageUploadText}>Ajouter une photo</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={styles.label}>Nom de la prestation *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom de la prestation" placeholderTextColor="#9ca3af" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ce qui est inclus</Text>
            <TextInput style={[styles.input, styles.textArea]} value={includes} onChangeText={setIncludes} placeholder="Elements inclus dans la prestation" placeholderTextColor="#9ca3af" multiline numberOfLines={2} textAlignVertical="top" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Preparation du client</Text>
            <TextInput style={[styles.input, styles.textArea]} value={clientPrep} onChangeText={setClientPrep} placeholder="Ce que le client doit preparer" placeholderTextColor="#9ca3af" multiline numberOfLines={2} textAlignVertical="top" />
          </View>

          <View style={styles.field}>
            <DropdownSelect
              label="Duree de la prestation"
              value={duration}
              options={DURATION_DROPDOWN}
              onChange={setDuration}
              placeholder="Selectionner..."
            />
          </View>

          <View style={styles.field}>
            <DropdownSelect
              label="Type de tarif *"
              value={priceType}
              options={PRICE_TYPES}
              onChange={setPriceType}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Prix (FCFA) *</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
          </View>

          {priceNum > 0 && (
            <RevenueEstimationCard
              price={priceNum}
              minAutoPrice={priceType === 'negoce' ? minAutoPriceNum : undefined}
              priceType={priceType}
            />
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Montant minimum auto (FCFA)</Text>
            <TextInput style={styles.input} value={minAutoPrice} onChangeText={setMinAutoPrice} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
          </View>

          <View style={styles.toggleField}>
            <Text style={styles.label}>Validation automatique</Text>
            <Switch value={autoValidation} onValueChange={setAutoValidation} trackColor={{ false: '#d1d5db', true: '#86efac' }} thumbColor={autoValidation ? '#003f2f' : '#9ca3af'} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Reduction (%)</Text>
            <TextInput style={styles.input} value={discountPercent} onChangeText={setDiscountPercent} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Lien portfolio</Text>
            <TextInput style={styles.input} value={portfolioLink} onChangeText={setPortfolioLink} placeholder="https://..." placeholderTextColor="#9ca3af" autoCapitalize="none" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Frais de deplacement</Text>
            <View style={styles.travelFeeToggle}>
              <TouchableOpacity
                style={[styles.travelFeeBtn, travelFeeType === 'gratuit' && styles.travelFeeBtnActive]}
                onPress={() => setTravelFeeType('gratuit')}
              >
                <Text style={[styles.travelFeeBtnText, travelFeeType === 'gratuit' && styles.travelFeeBtnTextActive]}>
                  Gratuit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.travelFeeBtn, travelFeeType === 'payant' && styles.travelFeeBtnActive]}
                onPress={() => setTravelFeeType('payant')}
              >
                <Text style={[styles.travelFeeBtnText, travelFeeType === 'payant' && styles.travelFeeBtnTextActive]}>
                  Payant
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {travelFeeType === 'payant' && (
            <View style={styles.field}>
              <Text style={styles.label}>Montant des frais de deplacement (FCFA)</Text>
              <TextInput style={styles.input} value={travelFeeAmount} onChangeText={setTravelFeeAmount} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
              <Text style={styles.travelFeeHint}>
                Ce montant sera paye par le client a la reservation via Orange Money.
              </Text>
            </View>
          )}

          <View style={styles.toggleField}>
            <Text style={styles.label}>Prestation active</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#d1d5db', true: '#86efac' }} thumbColor={isActive ? '#003f2f' : '#9ca3af'} />
          </View>

          <WeeklyAvailabilityEditor
            value={weeklyAvailability}
            onChange={setWeeklyAvailability}
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.footerButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isEdit ? 'Modifier la prestation' : 'Creer la prestation'}</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 16 : 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  imageUpload: {
    height: 180, borderRadius: 16, backgroundColor: '#f0f0f0', borderWidth: 2,
    borderColor: '#e5e7eb', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, overflow: 'hidden',
  },
  imageUploadText: { fontSize: 14, color: '#999', marginTop: 8 },
  imagePreview: { width: '100%', height: '100%' },
  previewImage: { width: '100%', height: '100%' },
  removeImage: {
    position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 15, color: '#1f2937', borderWidth: 1, borderColor: '#e5e7eb',
  },
  textArea: { minHeight: 80, paddingTop: 14 },
  row: { flexDirection: 'row', gap: 12 },
  toggleField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  travelFeeToggle: {
    flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden',
  },
  travelFeeBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff',
  },
  travelFeeBtnActive: { backgroundColor: '#003f2f' },
  travelFeeBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
  travelFeeBtnTextActive: { color: '#fff' },
  travelFeeHint: {
    fontSize: 12, color: '#0891b2', marginTop: 6, fontStyle: 'italic',
  },
  errorBox: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { color: '#991b1b', fontSize: 14, textAlign: 'center' },
  footerButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  saveBtn: {
    flex: 1, backgroundColor: '#003f2f', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
