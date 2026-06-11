import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Clock, FileText, Users, UserPlus, UserMinus, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DropdownSelect from '@/components/vendor/DropdownSelect';
import AddTeamMemberModal from '@/components/vendor/AddTeamMemberModal';

interface ShopData {
  id: string;
  name: string;
  description: string | null;
  shop_type?: string | null;
  statut_legal?: string | null;
  address?: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  support_phone: string | null;
  google_maps_link: string | null;
  whatsapp_catalog_link: string | null;
  opening_time: string | null;
  closing_time: string | null;
  delivery_details: string | null;
  return_policy: string | null;
  guide_url?: string | null;
  guide_name?: string | null;
  delivery_zone_id?: string | null;
  owner_id?: string;
}

interface Props {
  shop: ShopData;
  onUpdate: () => void;
}

interface TeamMember {
  id: string;
  member_id: string;
  is_active: boolean;
  profile?: { nom_complet: string; email: string; photo_profil?: string } | null;
}

interface Zone {
  id: string;
  name: string;
  city: string;
  commune: string;
}

const SHOP_TYPE_OPTIONS = [
  { label: 'Produits', value: 'fournisseur' },
  { label: 'Services', value: 'prestataire' },
  { label: 'Les deux', value: 'les_deux' },
];

const LEGAL_STATUS_OPTIONS = [
  { label: 'Particulier', value: 'particulier' },
  { label: 'Entreprise', value: 'entreprise' },
];

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
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

export default function ShopInfoTab({ shop, onUpdate }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description || '');
  const [shopType, setShopType] = useState(shop.shop_type || 'les_deux');
  const [statutLegal, setStatutLegal] = useState(shop.statut_legal || 'particulier');
  const [shopAddress, setShopAddress] = useState(shop.address || '');
  const [contactPhone, setContactPhone] = useState(shop.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(shop.contact_email || '');
  const [supportPhone, setSupportPhone] = useState(shop.support_phone || '');
  const [googleMapsLink, setGoogleMapsLink] = useState(shop.google_maps_link || '');
  const [whatsappLink, setWhatsappLink] = useState(shop.whatsapp_catalog_link || '');
  const [openingTime, setOpeningTime] = useState(parseTimeDisplay(shop.opening_time));
  const [closingTime, setClosingTime] = useState(parseTimeDisplay(shop.closing_time));
  const [deliveryDetails, setDeliveryDetails] = useState(shop.delivery_details || '');
  const [returnPolicy, setReturnPolicy] = useState(shop.return_policy || '');
  const [deliveryZoneId, setDeliveryZoneId] = useState(shop.delivery_zone_id || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [zones, setZones] = useState<Zone[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const loadExtras = useCallback(async () => {
    const [zonesRes, teamRes] = await Promise.all([
      supabase.from('delivery_zones').select('id, name, city, commune').eq('is_active', true).order('name'),
      supabase.from('shop_team_members')
        .select('id, member_id, is_active, profile:profiles(nom_complet, email, photo_profil)')
        .eq('shop_id', shop.id),
    ]);
    setZones((zonesRes.data || []) as Zone[]);
    setTeamMembers((teamRes.data || []) as unknown as TeamMember[]);
  }, [shop.id]);

  useEffect(() => { loadExtras(); }, [loadExtras]);

  const zoneOptions = zones.map((z) => ({ label: `${z.name} - ${z.commune}, ${z.city}`, value: z.id }));

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
        shop_type: shopType,
        statut_legal: statutLegal,
        address: shopAddress.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        support_phone: supportPhone.trim() || null,
        google_maps_link: googleMapsLink.trim() || null,
        whatsapp_catalog_link: whatsappLink.trim() || null,
        opening_time: openingTime.trim() || null,
        closing_time: closingTime.trim() || null,
        delivery_details: deliveryDetails.trim() || null,
        return_policy: returnPolicy.trim() || null,
        delivery_zone_id: deliveryZoneId || null,
        updated_at: new Date().toISOString(),
      };

      if (googleMapsLink.trim()) {
        const coords = parseGoogleMapsCoords(googleMapsLink.trim());
        if (coords) {
          updates.geolocation_lat = coords.lat;
          updates.geolocation_lng = coords.lng;
        }
      }

      const { error } = await supabase.from('shops').update(updates).eq('id', shop.id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Informations enregistrees avec succes' });
      onUpdate();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('shop_team_members').delete().eq('id', memberId);
    loadExtras();
  };

  const handleToggleMember = async (memberId: string, currentActive: boolean) => {
    await supabase.from('shop_team_members').update({ is_active: !currentActive }).eq('id', memberId);
    loadExtras();
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

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Type d'offre</Text>
            <DropdownSelect options={SHOP_TYPE_OPTIONS} value={shopType} onChange={setShopType} />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Statut legal</Text>
            <DropdownSelect options={LEGAL_STATUS_OPTIONS} value={statutLegal} onChange={setStatutLegal} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Adresse</Text>
          <TextInput style={styles.input} value={shopAddress} onChangeText={setShopAddress} placeholder="Adresse physique" placeholderTextColor="#9ca3af" />
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

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Heure d'ouverture</Text>
            <View style={styles.timeRow}>
              <TextInput style={[styles.input, styles.timeInput]} value={openingTime} onChangeText={setOpeningTime} placeholder="08:00" placeholderTextColor="#9ca3af" keyboardType="numbers-and-punctuation" />
              <Clock size={18} color="#666" />
            </View>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Heure de fermeture</Text>
            <View style={styles.timeRow}>
              <TextInput style={[styles.input, styles.timeInput]} value={closingTime} onChangeText={setClosingTime} placeholder="17:00" placeholderTextColor="#9ca3af" keyboardType="numbers-and-punctuation" />
              <Clock size={18} color="#666" />
            </View>
          </View>
        </View>

        {zoneOptions.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>Zone de livraison</Text>
            <DropdownSelect
              options={[{ label: 'Aucune zone', value: '' }, ...zoneOptions]}
              value={deliveryZoneId}
              onChange={setDeliveryZoneId}
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Details de livraison</Text>
          <TextInput style={[styles.input, styles.textArea]} value={deliveryDetails} onChangeText={setDeliveryDetails} placeholder="Informations sur la livraison" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Politique de retour</Text>
          <TextInput style={[styles.input, styles.textArea]} value={returnPolicy} onChangeText={setReturnPolicy} placeholder="Politique de retour" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
        </View>

        {shop.guide_url && (
          <View style={styles.guideBox}>
            <FileText size={16} color="#003f2f" />
            <Text style={styles.guideText}>{shop.guide_name || 'Guide vendeur'}</Text>
          </View>
        )}

        {message && (
          <View style={[styles.message, message.type === 'success' ? styles.successMsg : styles.errorMsg]}>
            <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.teamHeader}>
          <View style={styles.teamTitleRow}>
            <Users size={18} color="#003f2f" />
            <Text style={styles.cardTitle}>Equipe</Text>
          </View>
          <TouchableOpacity style={styles.addMemberBtn} onPress={() => setShowAddMember(true)}>
            <UserPlus size={14} color="#fff" />
            <Text style={styles.addMemberText}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {teamMembers.length === 0 ? (
          <Text style={styles.emptyTeam}>Aucun membre dans l'equipe</Text>
        ) : (
          teamMembers.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              {m.profile?.photo_profil ? (
                <Image source={{ uri: m.profile.photo_profil }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                  <Text style={styles.memberInitial}>{(m.profile?.nom_complet || '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.profile?.nom_complet || 'Membre'}</Text>
                <Text style={styles.memberEmail}>{m.profile?.email}</Text>
              </View>
              <View style={styles.memberActions}>
                <TouchableOpacity onPress={() => handleToggleMember(m.id, m.is_active)}>
                  {m.is_active ? (
                    <UserMinus size={16} color="#f59e0b" />
                  ) : (
                    <UserPlus size={16} color="#16a34a" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveMember(m.id)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />

      <AddTeamMemberModal
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        shopId={shop.id}
        vendorUserId={user?.id || ''}
        onSuccess={loadExtras}
      />
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
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 15, color: '#1f2937', borderWidth: 1, borderColor: '#e5e7eb',
  },
  textArea: { minHeight: 80, paddingTop: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeInput: { flex: 1 },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 18 },
  guideBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e8f3f0', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  guideText: { fontSize: 14, color: '#003f2f', fontWeight: '500' },
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
  teamHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  teamTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addMemberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#003f2f', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addMemberText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyTeam: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 16 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  memberAvatarPlaceholder: {
    backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center',
  },
  memberInitial: { fontSize: 16, fontWeight: '700', color: '#374151' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  memberEmail: { fontSize: 12, color: '#666' },
  memberActions: { flexDirection: 'row', gap: 12 },
});
