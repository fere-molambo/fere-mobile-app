import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, Mic } from 'lucide-react-native';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onSubmit?: (query: string) => void;
  onVoiceSearch?: () => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchBar({
  onSearch,
  onSubmit,
  onVoiceSearch,
  placeholder = 'Rechercher produits ou services...',
  debounceMs = 500,
}: SearchBarProps) {
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (onSearch) {
        onSearch(searchText);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchText, debounceMs, onSearch]);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search color="#666" size={20} style={styles.searchIcon} />

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          onSubmitEditing={() => onSubmit && onSubmit(searchText)}
        />

        {onVoiceSearch && (
          <TouchableOpacity
            onPress={onVoiceSearch}
            style={styles.micButton}
            activeOpacity={0.7}
          >
            <Mic color="#666" size={20} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  micButton: {
    padding: 4,
    marginLeft: 8,
  },
});
