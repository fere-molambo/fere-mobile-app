import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, ActivityIndicator, Switch, Image, Platform,
} from 'react-native';
import { X, Camera, Trash2, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import DropdownSelect from '@/components/vendor/DropdownSelect';
import RevenueEstimationCard from '@/components/vendor/RevenueEstimationCard';

interface ProductData {
  id?: string;
  name: string;
  description?: string | null;
  includes?: string | null;
  price: number;
  price_type: string;
  discount_percent?: number | null;
  quantity_available?: number | null;
  min_quantity?: number | null;
  condition?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  main_media_url?: string | null;
  media_urls?: string[] | null;
  product_type?: string | null;
  is_active: boolean;
  min_auto_price?: number | null;
  auto_validation?: boolean | null;
  colors?: Array<{ name: string; hex: string }> | null;
  sizes?: string[] | null;
}

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Props {
  visible: boolean;
  shopId: string;
  product?: ProductData | null;
  onClose: () => void;
  onSaved: () => void;
}

const PRICE_TYPES = [
  { value: 'unitaire', label: 'Unitaire' },
  { value: 'negoce', label: 'Negoce' },
  { value: 'en_gros', label: 'En gros' },
];

const CONDITIONS = [
  { value: 'neuf', label: 'Neuf' },
  { value: 'occasion', label: 'Occasion' },
  { value: 'reconditionne', label: 'Reconditionne' },
];

const PRODUCT_TYPES = [
  { value: 'vetements', label: 'Vetements' },
  { value: 'chaussures', label: 'Chaussures' },
  { value: 'electronique', label: 'Electronique' },
  { value: 'accessoires', label: 'Accessoires' },
  { value: 'beaute', label: 'Beaute' },
  { value: 'maison', label: 'Maison' },
  { value: 'alimentation', label: 'Alimentation' },
  { value: 'autre', label: 'Autre' },
];

const PRESET_COLORS = [
  { name: 'Noir', hex: '#000000' },
  { name: 'Blanc', hex: '#FFFFFF' },
  { name: 'Rouge', hex: '#EF4444' },
  { name: 'Bleu', hex: '#3B82F6' },
  { name: 'Vert', hex: '#22C55E' },
  { name: 'Jaune', hex: '#EAB308' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Violet', hex: '#A855F7' },
  { name: 'Rose', hex: '#EC4899' },
  { name: 'Gris', hex: '#9CA3AF' },
  { name: 'Marron', hex: '#92400E' },
  { name: 'Beige', hex: '#D4C5A9' },
];

export default function ProductFormModal({ visible, shopId, product, onClose, onSaved }: Props) {
  const isEdit = !!product?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includes, setIncludes] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState('unitaire');
  const [discountPercent, setDiscountPercent] = useState('');
  const [quantityAvailable, setQuantityAvailable] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [condition, setCondition] = useState('neuf');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
  const [productType, setProductType] = useState('autre');
  const [isActive, setIsActive] = useState(true);
  const [minAutoPrice, setMinAutoPrice] = useState('');
  const [autoValidation, setAutoValidation] = useState(false);
  const [colors, setColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [newSize, setNewSize] = useState('');
  const [customColorHex, setCustomColorHex] = useState('#000000');
  const [customColorName, setCustomColorName] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadCategories();
      if (product) {
        setName(product.name);
        setDescription(product.description || '');
        setIncludes(product.includes || '');
        setPrice(String(product.price));
        setPriceType(product.price_type || 'unitaire');
        setDiscountPercent(product.discount_percent ? String(product.discount_percent) : '');
        setQuantityAvailable(product.quantity_available != null ? String(product.quantity_available) : '');
        setMinQuantity(product.min_quantity != null ? String(product.min_quantity) : '');
        setCondition(product.condition || 'neuf');
        setCategoryId(product.category_id || null);
        setSubcategoryId(product.subcategory_id || null);
        setMainImageUrl(product.main_media_url || null);
        setProductType(product.product_type || 'autre');
        setIsActive(product.is_active);
        setMinAutoPrice(product.min_auto_price ? String(product.min_auto_price) : '');
        setAutoValidation(product.auto_validation || false);
        setColors(product.colors || []);
        setSizes(product.sizes || []);
      } else {
        resetForm();
      }
    }
  }, [visible, product]);

  useEffect(() => {
    if (categoryId) {
      supabase
        .from('product_categories')
        .select('id, name, parent_id')
        .eq('parent_id', categoryId)
        .eq('is_active', true)
        .order('display_order')
        .then(({ data }) => setSubcategories((data || []) as Category[]));
    } else {
      setSubcategories([]);
      setSubcategoryId(null);
    }
  }, [categoryId]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('id, name, parent_id')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('display_order');
    setCategories((data || []) as Category[]);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIncludes('');
    setPrice('');
    setPriceType('unitaire');
    setDiscountPercent('');
    setQuantityAvailable('');
    setMinQuantity('');
    setCondition('neuf');
    setCategoryId(null);
    setSubcategoryId(null);
    setMainImageUrl(null);
    setProductType('autre');
    setIsActive(true);
    setMinAutoPrice('');
    setAutoValidation(false);
    setColors([]);
    setSizes([]);
    setNewSize('');
    setCustomColorHex('#000000');
    setCustomColorName('');
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
      allowsEditing: true,
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
        .from('product-media')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('product-media').getPublicUrl(fileName);
      setMainImageUrl(urlData.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du telechargement');
    } finally {
      setUploading(false);
    }
  };

  const toggleColor = (color: { name: string; hex: string }) => {
    const exists = colors.find((c) => c.hex === color.hex);
    if (exists) {
      setColors(colors.filter((c) => c.hex !== color.hex));
    } else {
      setColors([...colors, color]);
    }
  };

  const addCustomColor = () => {
    if (!customColorHex || colors.find((c) => c.hex.toLowerCase() === customColorHex.toLowerCase())) return;
    setColors([...colors, { name: customColorName || customColorHex, hex: customColorHex }]);
    setCustomColorHex('#000000');
    setCustomColorName('');
  };

  const removeColor = (hex: string) => {
    setColors(colors.filter((c) => c.hex !== hex));
  };

  const addSize = () => {
    const s = newSize.trim();
    if (!s || sizes.includes(s)) return;
    setSizes([...sizes, s]);
    setNewSize('');
  };

  const removeSize = (size: string) => {
    setSizes(sizes.filter((s) => s !== size));
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom est requis'); return; }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) { setError('Le prix est requis et doit etre positif'); return; }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        shop_id: shopId,
        name: name.trim(),
        description: description.trim() || null,
        includes: includes.trim() || null,
        price: Number(price),
        price_type: priceType,
        discount_percent: discountPercent ? Number(discountPercent) : null,
        quantity_available: quantityAvailable ? parseInt(quantityAvailable) : null,
        min_quantity: minQuantity ? parseInt(minQuantity) : null,
        condition: condition || null,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        main_media_url: mainImageUrl || null,
        product_type: productType || null,
        is_active: isActive,
        min_auto_price: minAutoPrice ? Number(minAutoPrice) : null,
        auto_validation: autoValidation,
        colors: colors.length > 0 ? colors : null,
        sizes: sizes.length > 0 ? sizes : null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && product?.id) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', product.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('products').insert(payload);
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

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const subcategoryOptions = subcategories.map((c) => ({ value: c.id, label: c.name }));
  const priceNum = Number(price) || 0;
  const minAutoPriceNum = Number(minAutoPrice) || 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{isEdit ? 'Modifier le produit' : 'Nouveau produit'}</Text>
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
            <Text style={styles.label}>Nom du produit *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom du produit" placeholderTextColor="#9ca3af" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Description du produit" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ce qui est inclus</Text>
            <TextInput style={[styles.input, styles.textArea]} value={includes} onChangeText={setIncludes} placeholder="Elements inclus" placeholderTextColor="#9ca3af" multiline numberOfLines={2} textAlignVertical="top" />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <DropdownSelect
                label="Categorie"
                value={categoryId || ''}
                options={categoryOptions}
                onChange={(v) => setCategoryId(v || null)}
                placeholder="Selectionner..."
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <DropdownSelect
                label="Sous-categorie"
                value={subcategoryId || ''}
                options={subcategoryOptions}
                onChange={(v) => setSubcategoryId(v || null)}
                placeholder="Selectionner une..."
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <DropdownSelect
                label="Type de tarif"
                value={priceType}
                options={PRICE_TYPES}
                onChange={setPriceType}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Prix de base (FCFA) *</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            </View>
          </View>

          {priceNum > 0 && (
            <RevenueEstimationCard
              price={priceNum}
              minAutoPrice={priceType === 'negoce' ? minAutoPriceNum : undefined}
              priceType={priceType}
            />
          )}

          {priceType === 'negoce' && (
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Montant minimum auto (FCFA)</Text>
                <TextInput style={styles.input} value={minAutoPrice} onChangeText={setMinAutoPrice} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
              </View>
              <View style={[styles.field, { flex: 1, justifyContent: 'flex-end' }]}>
                <View style={styles.toggleField}>
                  <Text style={styles.toggleLabel}>Validation automatique</Text>
                  <Switch value={autoValidation} onValueChange={setAutoValidation} trackColor={{ false: '#d1d5db', true: '#86efac' }} thumbColor={autoValidation ? '#003f2f' : '#9ca3af'} />
                </View>
              </View>
            </View>
          )}

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <DropdownSelect
                label="Type de produit"
                value={productType}
                options={PRODUCT_TYPES}
                onChange={setProductType}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <DropdownSelect
                label="Etat du produit"
                value={condition}
                options={CONDITIONS}
                onChange={setCondition}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Quantite minimum de commande</Text>
              <TextInput style={styles.input} value={minQuantity} onChangeText={setMinQuantity} placeholder="1" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Quantite en stock</Text>
              <TextInput style={styles.input} value={quantityAvailable} onChangeText={setQuantityAvailable} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Reduction (%)</Text>
            <TextInput style={styles.input} value={discountPercent} onChangeText={setDiscountPercent} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Couleurs disponibles</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c) => {
                const isSelected = colors.some((sc) => sc.hex === c.hex);
                return (
                  <TouchableOpacity
                    key={c.hex}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c.hex },
                      c.hex === '#FFFFFF' && styles.whiteSwatchBorder,
                      isSelected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => toggleColor(c)}
                    activeOpacity={0.7}
                  />
                );
              })}
            </View>

            <Text style={styles.subLabel}>Personnalisee</Text>
            <View style={styles.customColorRow}>
              <View style={[styles.colorPreviewBox, { backgroundColor: customColorHex }]} />
              <TextInput
                style={[styles.input, styles.colorInput]}
                value={customColorName}
                onChangeText={setCustomColorName}
                placeholder="Nom (optionnel)"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity style={styles.addColorBtn} onPress={addCustomColor}>
                <Plus size={18} color="#003f2f" />
              </TouchableOpacity>
            </View>

            {colors.length > 0 && (
              <View style={styles.selectedChips}>
                {colors.map((c) => (
                  <TouchableOpacity key={c.hex} style={styles.colorChip} onPress={() => removeColor(c.hex)}>
                    <View style={[styles.colorChipDot, { backgroundColor: c.hex }, c.hex === '#FFFFFF' && styles.whiteSwatchBorder]} />
                    <Text style={styles.colorChipText}>{c.name}</Text>
                    <X size={12} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tailles disponibles</Text>
            <View style={styles.sizeInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newSize}
                onChangeText={setNewSize}
                placeholder="Ajouter une taille"
                placeholderTextColor="#9ca3af"
                onSubmitEditing={addSize}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addSizeBtn} onPress={addSize}>
                <Plus size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {sizes.length > 0 && (
              <View style={styles.selectedChips}>
                {sizes.map((s) => (
                  <TouchableOpacity key={s} style={styles.sizeChip} onPress={() => removeSize(s)}>
                    <Text style={styles.sizeChipText}>{s}</Text>
                    <X size={12} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.toggleField}>
            <Text style={styles.label}>Produit actif</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: '#d1d5db', true: '#86efac' }}
              thumbColor={isActive ? '#003f2f' : '#9ca3af'}
            />
          </View>

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
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isEdit ? 'Modifier le produit' : 'Creer le produit'}</Text>}
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
  subLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginTop: 12, marginBottom: 8, fontStyle: 'italic' },
  input: {
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 15, color: '#1f2937', borderWidth: 1, borderColor: '#e5e7eb',
  },
  textArea: { minHeight: 80, paddingTop: 14 },
  row: { flexDirection: 'row', gap: 12 },
  toggleField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#374151', flexShrink: 1, marginRight: 8 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18,
  },
  whiteSwatchBorder: { borderWidth: 1, borderColor: '#d1d5db' },
  colorSwatchSelected: {
    borderWidth: 3, borderColor: '#003f2f',
  },
  customColorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorPreviewBox: {
    width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },
  colorInput: { flex: 1 },
  addColorBtn: {
    width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  selectedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  colorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e5e7eb',
  },
  colorChipDot: { width: 14, height: 14, borderRadius: 7 },
  colorChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  sizeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addSizeBtn: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: '#003f2f',
    justifyContent: 'center', alignItems: 'center',
  },
  sizeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e5e7eb',
  },
  sizeChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
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
