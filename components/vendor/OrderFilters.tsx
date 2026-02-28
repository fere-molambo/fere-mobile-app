import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import DropdownSelect, { type DropdownOption } from '@/components/vendor/DropdownSelect';

export type DatePreset = 'all' | 'today' | 'week' | 'month';

interface FilterChip {
  key: string;
  label: string;
}

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  datePreset: DatePreset;
  onDatePresetChange: (p: DatePreset) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  statusOptions: FilterChip[];
  paymentFilter: string;
  onPaymentFilterChange: (p: string) => void;
  paymentOptions: FilterChip[];
}

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
];

export function getDateRangeStart(preset: DatePreset): Date | null {
  const now = new Date();
  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (preset === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  return null;
}

function toDropdownOptions(chips: FilterChip[]): DropdownOption[] {
  return chips.map((c) => ({ value: c.key, label: c.label }));
}

export default function OrderFilters({
  searchQuery, onSearchChange, searchPlaceholder,
  datePreset, onDatePresetChange,
  statusFilter, onStatusFilterChange, statusOptions,
  paymentFilter, onPaymentFilterChange, paymentOptions,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Search color="#999" size={18} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder || 'Rechercher...'}
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color="#999" size={18} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DATE_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.chip, datePreset === p.key && styles.chipActive]}
            onPress={() => onDatePresetChange(p.key)}
          >
            <Text style={[styles.chipText, datePreset === p.key && styles.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.dropdownRow}>
        <View style={styles.dropdownCol}>
          <DropdownSelect
            label="Statut"
            value={statusFilter}
            options={toDropdownOptions(statusOptions)}
            onChange={onStatusFilterChange}
            placeholder="Tous"
          />
        </View>
        <View style={styles.dropdownCol}>
          <DropdownSelect
            label="Paiement"
            value={paymentFilter}
            options={toDropdownOptions(paymentOptions)}
            onChange={onPaymentFilterChange}
            placeholder="Tous"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingBottom: 12, gap: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8,
    marginHorizontal: 16, marginTop: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a', padding: 0 },
  chipRow: { paddingHorizontal: 16, gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#003f2f', borderColor: '#003f2f' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  dropdownRow: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 4,
  },
  dropdownCol: { flex: 1 },
});
