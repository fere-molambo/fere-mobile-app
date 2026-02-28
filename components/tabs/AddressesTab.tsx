import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Plus, MapPin, User, Phone, Edit2, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { DeliveryAddress } from '@/types/database';
import AddressModal from '../modals/AddressModal';
import ConfirmDialog from '../ConfirmDialog';

interface AddressesTabProps {
  userId: string;
}

export default function AddressesTab({ userId }: AddressesTabProps) {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setSelectedAddress(null);
    setModalVisible(true);
  };

  const handleEdit = (address: DeliveryAddress) => {
    setSelectedAddress(address);
    setModalVisible(true);
  };

  const handleDeleteConfirm = (addressId: string) => {
    setAddressToDelete(addressId);
    setDeleteDialogVisible(true);
  };

  const handleDelete = async () => {
    if (!addressToDelete) return;

    try {
      const { error } = await supabase
        .from('delivery_addresses')
        .delete()
        .eq('id', addressToDelete);

      if (error) throw error;
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
    } finally {
      setDeleteDialogVisible(false);
      setAddressToDelete(null);
    }
  };

  const handleModalClose = (shouldRefresh: boolean) => {
    setModalVisible(false);
    setSelectedAddress(null);
    if (shouldRefresh) {
      fetchAddresses();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Adresses de livraison</Text>
            <Text style={styles.subtitle}>
              Gérez vos adresses de livraison (maximum 3)
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.addButton, addresses.length >= 3 && styles.addButtonDisabled]}
            onPress={handleAddNew}
            disabled={addresses.length >= 3}>
            <Plus size={20} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addButtonText}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={48} color="#d1d5db" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Aucune adresse enregistrée</Text>
            <Text style={styles.emptyText}>
              Ajoutez votre première adresse de livraison pour faciliter vos commandes
            </Text>
          </View>
        ) : (
          <View style={styles.addressList}>
            {addresses.map((address) => (
              <View key={address.id} style={styles.addressCard}>
                {address.is_default && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Par défaut</Text>
                  </View>
                )}

                <View style={styles.addressHeader}>
                  <View style={styles.addressTitleRow}>
                    <MapPin size={18} color="#003f2f" strokeWidth={2} />
                    <Text style={styles.addressLabel}>{address.label}</Text>
                  </View>
                </View>

                <Text style={styles.addressText}>{address.address}</Text>
                <Text style={styles.addressCity}>
                  {address.city}, {address.country}
                </Text>

                <View style={styles.recipientInfo}>
                  <View style={styles.recipientRow}>
                    <User size={14} color="#6b7280" />
                    <Text style={styles.recipientText}>{address.recipient_name}</Text>
                  </View>
                  <View style={styles.recipientRow}>
                    <Phone size={14} color="#6b7280" />
                    <Text style={styles.recipientText}>{address.recipient_phone}</Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEdit(address)}>
                    <Edit2 size={16} color="#003f2f" />
                    <Text style={styles.editText}>Modifier</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteConfirm(address.id)}>
                    <Trash2 size={16} color="#ef4444" />
                    <Text style={styles.deleteText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AddressModal
        visible={modalVisible}
        address={selectedAddress}
        userId={userId}
        onClose={handleModalClose}
      />

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Supprimer l'adresse"
        message="Êtes-vous sûr de vouloir supprimer cette adresse ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteDialogVisible(false);
          setAddressToDelete(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  addButton: {
    backgroundColor: '#003f2f',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  addressList: {
    padding: 16,
    gap: 16,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f2f',
  },
  addressHeader: {
    marginBottom: 8,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 20,
  },
  addressCity: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  recipientInfo: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginBottom: 12,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipientText: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#003f2f',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
});
