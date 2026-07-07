import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Package, Wrench } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface ResultItem {
  id: string;
  name: string;
  price: number;
  main_media_url?: string | null;
  type: 'product' | 'service';
}

function formatPrice(n: number) {
  return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ');
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState((q as string) || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (text: string) => {
    const term = text.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const pattern = `%${term}%`;
      const [{ data: products }, { data: services }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, price, main_media_url')
          .eq('is_active', true)
          .or(`name.ilike.${pattern},description.ilike.${pattern}`)
          .limit(25),
        supabase
          .from('services')
          .select('id, name, price, main_media_url')
          .eq('is_active', true)
          .or(`name.ilike.${pattern},description.ilike.${pattern}`)
          .limit(25),
      ]);
      setResults([
        ...((products || []) as any[]).map((p) => ({ ...p, type: 'product' as const })),
        ...((services || []) as any[]).map((s) => ({ ...s, type: 'service' as const })),
      ]);
      setSearched(true);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color="#003f2f" />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Search color="#666" size={18} />
          <TextInput
            style={styles.input}
            placeholder="Rechercher produits ou services..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus={!q}
            returnKeyType="search"
            onSubmitEditing={() => { Keyboard.dismiss(); runSearch(query); }}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#003f2f" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {searched && results.length === 0 ? (
            <Text style={styles.emptyText}>Aucun résultat pour « {query.trim()} »</Text>
          ) : (
            results.map((r) => (
              <TouchableOpacity
                key={`${r.type}-${r.id}`}
                style={styles.row}
                onPress={() => router.push(`/${r.type}/${r.id}` as any)}
              >
                {r.main_media_url ? (
                  <Image source={{ uri: r.main_media_url }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    {r.type === 'product' ? <Package size={20} color="#999" /> : <Wrench size={20} color="#999" />}
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.rowType}>{r.type === 'product' ? 'Produit' : 'Service'}</Text>
                </View>
                <Text style={styles.price}>{formatPrice(r.price)} FCFA</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f5f5f5', borderRadius: 22, paddingHorizontal: 14, height: 44,
  },
  input: { flex: 1, fontSize: 15, color: '#111', paddingVertical: 0 },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f7f7f7',
  },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#f0f0f0' },
  thumbPlaceholder: {
    width: 52, height: 52, borderRadius: 8, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  rowType: { fontSize: 12, color: '#888', marginTop: 2 },
  price: { fontSize: 13, fontWeight: '700', color: '#003f2f' },
});
