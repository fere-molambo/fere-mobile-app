import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Trash2, CircleAlert as AlertCircle, CircleCheck as CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'form' | 'already_pending' | 'success';

export default function DeleteAccountModal({ visible, onClose }: DeleteAccountModalProps) {
  const { session } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setStep('form');
    setReason('');
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!session?.user?.id) return;
    setError(null);
    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from('account_deletion_requests')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        setStep('already_pending');
        return;
      }

      const { error: insertError } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id: session.user.id,
          reason: reason.trim() || null,
        });

      if (insertError) throw insertError;
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <>
      <View style={styles.iconContainer}>
        <View style={styles.iconBg}>
          <Trash2 size={32} color="#DC2626" />
        </View>
      </View>

      <Text style={styles.title}>Supprimer mon compte</Text>
      <Text style={styles.description}>
        Cette action enverra une demande de suppression a notre equipe. Votre compte restera actif
        jusqu'au traitement de la demande.
      </Text>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.inputLabel}>Raison (optionnel)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Dites-nous pourquoi vous souhaitez partir..."
        placeholderTextColor="#9CA3AF"
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleClose}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Confirmer</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.webLink}
        onPress={() => Linking.openURL('https://fere.app/delete-account')}
      >
        <Text style={styles.webLinkText}>
          Vous pouvez aussi faire cette demande sur fere.app/delete-account
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderAlreadyPending = () => (
    <>
      <View style={styles.iconContainer}>
        <View style={[styles.iconBg, styles.iconBgWarning]}>
          <AlertCircle size={32} color="#D97706" />
        </View>
      </View>

      <Text style={styles.title}>Demande deja en cours</Text>
      <Text style={styles.description}>
        Vous avez deja une demande en cours de traitement. Notre equipe vous contactera dans les
        meilleurs delais.
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.fullButton, styles.cancelButton]}
        onPress={handleClose}
      >
        <Text style={styles.cancelButtonText}>Fermer</Text>
      </TouchableOpacity>
    </>
  );

  const renderSuccess = () => (
    <>
      <View style={styles.iconContainer}>
        <View style={[styles.iconBg, styles.iconBgSuccess]}>
          <CheckCircle size={32} color="#059669" />
        </View>
      </View>

      <Text style={styles.title}>Demande enregistree</Text>
      <Text style={styles.description}>
        Votre demande a ete enregistree. L'equipe Fere vous contactera dans un delai de 30 jours.
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.fullButton, styles.successCloseButton]}
        onPress={handleClose}
      >
        <Text style={styles.deleteButtonText}>Compris</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {step === 'form' && renderForm()}
          {step === 'already_pending' && renderAlreadyPending()}
          {step === 'success' && renderSuccess()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBgWarning: {
    backgroundColor: '#FEF3C7',
  },
  iconBgSuccess: {
    backgroundColor: '#D1FAE5',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 80,
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  fullButton: {
    flex: undefined,
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successCloseButton: {
    backgroundColor: '#059669',
  },
  webLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  webLinkText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
