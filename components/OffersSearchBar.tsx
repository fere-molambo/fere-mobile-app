import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Search, X } from 'lucide-react-native';

interface OffersSearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export default function OffersSearchBar({ onSearch, loading }: OffersSearchBarProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleClear = () => {
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search color="#999" size={20} />
        <TextInput
          style={styles.input}
          placeholder="Rechercher des produits ou services..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color="#003f2f" />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
            <X color="#999" size={20} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
});
