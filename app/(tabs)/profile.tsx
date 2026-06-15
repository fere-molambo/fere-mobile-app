import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { LogOut, Menu, ShoppingCart } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import ProfileHeader from '@/components/ProfileHeader';
import TabNavigation, { TabType } from '@/components/TabNavigation';
import PersonalInfoTab from '@/components/tabs/PersonalInfoTab';
import AddressesTab from '@/components/tabs/AddressesTab';
import IdentityTab from '@/components/tabs/IdentityTab';
import DriverInfoTab from '@/components/tabs/DriverInfoTab';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function ProfileScreen() {
  const { profile, userRole, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isDriver = userRole === 'livreur';

  const handleEditPhoto = async () => {
    if (Platform.OS === 'web') {
      alert('L\'upload de photo n\'est pas disponible sur le web preview');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission d\'accès à la galerie refusée');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && profile) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error picking photo:', error);
      alert('Erreur lors de la sélection de la photo');
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!profile) return;

    try {
      setUploadingPhoto(true);

      const fileExt = uri.split('.').pop()?.toLowerCase();
      const fileName = `${profile.id}_${Date.now()}.${fileExt}`;

      const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('profile_pictures')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile_pictures')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          photo_profil: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      alert('Erreur lors de l\'upload de la photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
    setLogoutDialogVisible(false);
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f2f" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>FERE</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconButton}>
            <ShoppingCart size={24} color="#1f2937" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Menu size={24} color="#1f2937" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Mon Profil</Text>
          <Text style={styles.pageSubtitle}>Gérez vos informations personnelles</Text>
        </View>

        {uploadingPhoto ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#003f2f" />
            <Text style={styles.uploadingText}>Upload en cours...</Text>
          </View>
        ) : (
          <ProfileHeader
            fullName={profile.nom_complet}
            email={profile.email}
            avatarUrl={profile.photo_profil}
            onEditPhoto={handleEditPhoto}
          />
        )}

        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isDriver={isDriver}
        />

        <View style={styles.tabContent}>
          {activeTab === 'info' && (
            <PersonalInfoTab profile={profile} onUpdate={refreshProfile} />
          )}
          {activeTab === 'addresses' && !isDriver && (
            <AddressesTab userId={profile.id} />
          )}
          {activeTab === 'identity' && (
            <IdentityTab profile={profile} onUpdate={refreshProfile} />
          )}
          {activeTab === 'driver' && isDriver && (
            <DriverInfoTab profile={profile} onUpdate={refreshProfile} />
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setLogoutDialogVisible(true)}>
            <LogOut size={20} color="#dc2626" strokeWidth={2} />
            <Text style={styles.logoutButtonText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={logoutDialogVisible}
        title="Déconnexion"
        message="Êtes-vous sûr de vouloir vous déconnecter ?"
        confirmText="Déconnexion"
        cancelText="Annuler"
        onConfirm={handleSignOut}
        onCancel={() => setLogoutDialogVisible(false)}
      />
    </View>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#003f2f',
  },
  topActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  headerSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  uploadingContainer: {
    backgroundColor: '#fff',
    paddingVertical: 32,
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  tabContent: {
    minHeight: 400,
  },
  footer: {
    padding: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});
