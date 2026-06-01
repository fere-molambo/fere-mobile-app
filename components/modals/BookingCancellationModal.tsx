import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { X, AlertTriangle, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import type { CancellationReason } from '@/types/database';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (data: {
    reasonId: string;
    comment: string;
    proofUrl?: string;
  }) => Promise<void>;
  bookingStatus: string;
}

export default function BookingCancellationModal({ visible, onClose, onConfirm, bookingStatus }: Props) {
  const [reasons, setReasons] = useState<CancellationReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setSelectedReasonId(null);
    setComment('');
    setProofUri(null);
    loadReasons();
  }, [visible]);

  const loadReasons = async () => {
    setLoadingReasons(true);
    const { data } = await supabase
      .from('cancellation_reasons')
      .select('*')
      .eq('is_active', true)
      .contains('applies_to', ['service'])
      .order('display_order');
    setReasons((data || []) as CancellationReason[]);
    setLoadingReasons(false);
  };

  const handlePickProof = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setProofUri(url);
        }
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setProofUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReasonId) return;
    setLoading(true);
    try {
      await onConfirm({
        reasonId: selectedReasonId,
        comment,
        proofUrl: proofUri || undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const isArrived = bookingStatus === 'arrived';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Annuler la reservation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#666" size={24} />
            </TouchableOpacity>
          </View>

          {isArrived && (
            <View style={styles.warningBox}>
              <AlertTriangle color="#c2410c" size={18} />
              <Text style={styles.warningText}>
                Le prestataire est deja arrive. Aucun remboursement ne sera effectue pour les frais de deplacement.
              </Text>
            </View>
          )}

          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {loadingReasons ? (
              <ActivityIndicator color="#003f2f" style={{ paddingVertical: 24 }} />
            ) : (
              <>
                <Text style={styles.label}>Motif d'annulation</Text>
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.id}
                    style={[
                      styles.reasonCard,
                      selectedReasonId === reason.id && styles.reasonCardSelected,
                    ]}
                    onPress={() => setSelectedReasonId(reason.id)}
                  >
                    <View style={[styles.radioOuter, selectedReasonId === reason.id && styles.radioSelected]}>
                      {selectedReasonId === reason.id && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.reasonText}>{reason.label}</Text>
                  </TouchableOpacity>
                ))}

                <Text style={[styles.label, { marginTop: 16 }]}>Commentaire</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Decrivez la raison..."
                  placeholderTextColor="#aaa"
                  multiline
                  numberOfLines={3}
                  value={comment}
                  onChangeText={setComment}
                />

                <Text style={[styles.label, { marginTop: 16 }]}>Preuve (optionnel)</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={handlePickProof}>
                  <Upload color="#003f2f" size={20} />
                  <Text style={styles.uploadBtnText}>
                    {proofUri ? 'Changer la photo' : 'Ajouter une photo'}
                  </Text>
                </TouchableOpacity>
                {proofUri && (
                  <Image source={{ uri: proofUri }} style={styles.proofPreview} />
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!selectedReasonId || loading) && styles.confirmBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selectedReasonId || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmer l'annulation</Text>
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
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetContent: {
    padding: 16,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff7ed',
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#c2410c',
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 8,
  },
  reasonCardSelected: {
    borderColor: '#003f2f',
    backgroundColor: '#f0faf7',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#003f2f',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#003f2f',
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#003f2f',
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
  proofPreview: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginTop: 8,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
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
    alignItems: 'center',
    backgroundColor: '#dc2626',
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
