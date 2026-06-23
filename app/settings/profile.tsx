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
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import ProfileHeader from '@/components/ProfileHeader';
import TabNavigation, { TabType } from '@/components/TabNavigation';
import PersonalInfoTab from '@/components/tabs/PersonalInfoTab';
import AddressesTab from '@/components/tabs/AddressesTab';
import IdentityTab from '@/components/tabs/IdentityTab';
import DriverInfoTab from '@/components/tabs/DriverInfoTab';
import VendorInfoTab from '@/components/tabs/VendorInfoTab';
import SettingsSubHeader from '@/components/SettingsSubHeader';

export default function ProfileSettingsScreen() {
  const { profile, userRole, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isDriver = userRole === 'livreur';
  const isVendor = userRole === 'vendeur' || userRole === 'equipe';

  const handleEditPhoto = async () => {
    if (Platform.OS === 'web') {
      alert("L'upload de photo n'est pas disponible sur le web preview");
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert("Permission d'accès à la galerie refusée");
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
      const fileName = `${profile.id}/${profile.id}.${fileExt}`;

      const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
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
      alert("Erreur upload: " + (error?.message || "inconnu"));
    } finally {
      setUploadingPhoto(false);
    }
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
      <SettingsSubHeader title="Profil" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          isVendor={isVendor}
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
          {activeTab === 'vendor' && isVendor && (
            <VendorInfoTab profile={profile} onUpdate={refreshProfile} />
          )}
          {activeTab === 'driver' && isDriver && (
            <DriverInfoTab profile={profile} onUpdate={refreshProfile} />
          )}
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
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
});
