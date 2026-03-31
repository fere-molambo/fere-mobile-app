import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import DropdownSelect from '@/components/vendor/DropdownSelect';
import { Upload, FileCheck, CircleAlert as AlertCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import type { Profile, PieceIdentiteClientType } from '@/types/database';

interface IdentityTabProps {
  profile: Profile;
  onUpdate: () => void;
}

export default function IdentityTab({ profile, onUpdate }: IdentityTabProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [idType, setIdType] = useState<PieceIdentiteClientType | ''>(
    profile.piece_identite_client_type || ''
  );
  const [idUrl, setIdUrl] = useState(profile.piece_identite_client_url || '');
  const [uploading, setUploading] = useState(false);

  const handlePickDocument = async () => {
    if (Platform.OS === 'web') {
      setMessage({
        type: 'error',
        text: 'L\'upload de fichiers n\'est pas disponible sur le web preview',
      });
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setMessage({
          type: 'error',
          text: 'Permission d\'accès à la galerie refusée',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(result.assets[0].uri);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Erreur lors de la sélection du fichier',
      });
    }
  };

  const uploadDocument = async (uri: string) => {
    try {
      setUploading(true);
      setMessage(null);

      const fileExt = uri.split('.').pop()?.toLowerCase();
      const fileName = `${profile.id}_${Date.now()}.${fileExt}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('identity_documents')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('identity_documents')
        .getPublicUrl(fileName);

      setIdUrl(urlData.publicUrl);
      setMessage({
        type: 'success',
        text: 'Document téléversé avec succès',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Erreur lors du téléversement',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!idType) {
      setMessage({
        type: 'error',
        text: 'Veuillez sélectionner le type de pièce d\'identité',
      });
      return;
    }

    if (!idUrl) {
      setMessage({
        type: 'error',
        text: 'Veuillez téléverser votre pièce d\'identité',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          piece_identite_client_type: idType,
          piece_identite_client_url: idUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Pièce d\'identité enregistrée avec succès',
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pièce d'identité</Text>
        <Text style={styles.sectionDescription}>
          Vérifiez votre identité pour accéder à certaines fonctionnalités
        </Text>

        <View style={styles.field}>
          <DropdownSelect
            label="Type de pièce d'identité *"
            value={idType}
            onChange={(value) => setIdType(value as PieceIdentiteClientType)}
            placeholder="Sélectionner"
            options={[
              { label: "Carte d'étudiant", value: 'carte_etudiant' },
              { label: "CNI (Carte Nationale d'Identité)", value: 'cni' },
              { label: 'Passeport', value: 'passeport' },
              { label: 'Permis de conduire', value: 'permis_conduire' },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Document *</Text>

          {idUrl ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: idUrl }} style={styles.preview} resizeMode="cover" />
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handlePickDocument}
                disabled={uploading}>
                <Upload size={16} color="#003f2f" />
                <Text style={styles.changeButtonText}>Modifier</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadArea}
              onPress={handlePickDocument}
              disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="large" color="#003f2f" />
              ) : (
                <>
                  <Upload size={32} color="#003f2f" strokeWidth={1.5} />
                  <Text style={styles.uploadText}>Cliquez pour téléverser</Text>
                  <Text style={styles.uploadHint}>
                    JPEG, PNG, WEBP ou PDF (max 10 Mo)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.securityNote}>
          <AlertCircle size={16} color="#6b7280" />
          <Text style={styles.securityText}>
            Votre pièce d'identité est stockée de manière sécurisée et confidentielle
          </Text>
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
            <>
              <FileCheck size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </>
          )}
        </TouchableOpacity>
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
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  uploadArea: {
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#003f2f',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003f2f',
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  preview: {
    width: '100%',
    height: 200,
    backgroundColor: '#e5e7eb',
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e8f5e9',
    paddingVertical: 12,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003f2f',
  },
  securityNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 10,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
