import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Camera } from 'lucide-react-native';

interface ProfileHeaderProps {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  onEditPhoto: () => void;
}

export default function ProfileHeader({
  fullName,
  email,
  avatarUrl,
  onEditPhoto,
}: ProfileHeaderProps) {
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.initials}>{getInitials(fullName)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.name}>{fullName}</Text>
      <Text style={styles.email}>{email}</Text>

      <TouchableOpacity style={styles.editButton} onPress={onEditPhoto}>
        <Camera size={16} color="#003f2f" strokeWidth={2} />
        <Text style={styles.editButtonText}>Modifier la photo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 28,
    fontWeight: '600',
    color: '#003f2f',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#003f2f',
  },
});
