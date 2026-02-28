import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Briefcase } from 'lucide-react-native';
import { useServiceProviderTypes } from '@/hooks/useServiceProviderTypes';

interface ServiceProviderTypesScrollProps {
  onTypeSelect?: (typeId: string | null) => void;
}

export default function ServiceProviderTypesScroll({ onTypeSelect }: ServiceProviderTypesScrollProps) {
  const { providerTypes, loading } = useServiceProviderTypes();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleTypePress = (typeId: string | null) => {
    setSelectedType(typeId);
    onTypeSelect?.(typeId);
  };

  if (loading || providerTypes.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[
            styles.typeItem,
            selectedType === null && styles.typeItemSelected,
          ]}
          onPress={() => handleTypePress(null)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.iconContainer,
              selectedType === null && styles.iconContainerSelected,
            ]}
          >
            <Briefcase
              color={selectedType === null ? '#fff' : '#003f2f'}
              size={24}
            />
          </View>
          <Text
            style={[
              styles.typeName,
              selectedType === null && styles.typeNameSelected,
            ]}
          >
            Tous
          </Text>
        </TouchableOpacity>

        {providerTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeItem,
              selectedType === type.id && styles.typeItemSelected,
            ]}
            onPress={() => handleTypePress(type.id)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                selectedType === type.id && styles.iconContainerSelected,
              ]}
            >
              <Briefcase
                color={selectedType === type.id ? '#fff' : '#003f2f'}
                size={24}
              />
            </View>
            <Text
              style={[
                styles.typeName,
                selectedType === type.id && styles.typeNameSelected,
              ]}
              numberOfLines={1}
            >
              {type.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  typeItem: {
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
  },
  typeItemSelected: {
    opacity: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconContainerSelected: {
    backgroundColor: '#003f2f',
    borderColor: '#003f2f',
  },
  typeName: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  typeNameSelected: {
    color: '#003f2f',
    fontWeight: '700',
  },
});
