import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { DeliveryRequest, CancellationReason } from '@/types/database';

interface CancellationModalProps {
  visible: boolean;
  delivery: DeliveryRequest | null;
  userId: string;
  onClose: () => void;
  onCancelled: () => void;
}

export default function CancellationModal({ visible, delivery, userId, onClose, onCancelled }: CancellationModalProps) {
  const [reasons, setReasons] = useState<CancellationReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchReasons();
      setSelectedReasonId(null);
      setCustomReason('');
    }
  }, [visible]);

  const fetchReasons = async () => {
    setLoadingReasons(true);
    try {
      const { data } = await supabase
        .from('cancellation_reasons')
        .select('id, label, is_active, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      setReasons(data || []);
    } catch {
      setReasons([]);
    } finally {
      setLoadingReasons(false);
    }
  };

  const handleConfirm = async () => {
    if (!delivery || !selectedReasonId) return;
    setLoading(true);
    try {
      const { error: cancelError } = await supabase.from('cancellations').insert({
        order_id: delivery.order_id,
        cancelled_by: userId,
        canceller_role: 'driver',
        reason_id: selectedReasonId,
        custom_reason: customReason || null,
        status_at_cancellation: delivery.status,
        requires_return: false,
      });
      if (cancelError) throw cancelError;

      const { error: updateError } = await supabase
        .from('delivery_requests')
        .update({ status: 'cancelled' })
        .eq('id', delivery.id)
        .eq('driver_id', userId);
      if (updateError) throw updateError;

      onCancelled();
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'annuler cette livraison.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Annuler la livraison</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Selectionnez un motif d'annulation
          </Text>

          {loadingReasons ? (
            <ActivityIndicator size="small" color="#003f2f" style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView style={styles.reasonsList} showsVerticalScrollIndicator={false}>
              {reasons.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonItem,
                    selectedReasonId === reason.id && styles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReasonId(reason.id)}
                >
                  <View style={[
                    styles.radio,
                    selectedReasonId === reason.id && styles.radioSelected,
                  ]}>
                    {selectedReasonId === reason.id && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[
                    styles.reasonText,
                    selectedReasonId === reason.id && styles.reasonTextSelected,
                  ]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TextInput
            style={styles.input}
            placeholder="Commentaire (optionnel)"
            placeholderTextColor="#999"
            value={customReason}
            onChangeText={setCustomReason}
            multiline
            numberOfLines={3}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !selectedReasonId && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!selectedReasonId || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmer</Text>
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
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  reasonsList: {
    maxHeight: 220,
    marginBottom: 12,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 6,
  },
  reasonItemSelected: {
    backgroundColor: '#e8f3f0',
    borderWidth: 1,
    borderColor: '#003f2f',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#003f2f',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#003f2f',
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  reasonTextSelected: {
    fontWeight: '600',
    color: '#003f2f',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
    textAlignVertical: 'top',
    minHeight: 70,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
