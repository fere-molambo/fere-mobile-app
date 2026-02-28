import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function DropdownSelect({ label, value, options, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const displayText = selected?.label || placeholder || 'Selectionner...';

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {displayText}
        </Text>
        <ChevronDown size={18} color="#666" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {label && <Text style={styles.sheetTitle}>{label}</Text>}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => { onChange(item.value); setOpen(false); }}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {item.label}
                    </Text>
                    {isSelected && <Check size={18} color="#003f2f" />}
                  </TouchableOpacity>
                );
              }}
              style={styles.list}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  triggerText: { fontSize: 15, color: '#1f2937', flex: 1, marginRight: 8 },
  placeholder: { color: '#9ca3af' },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, maxHeight: '60%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db',
    alignSelf: 'center', marginTop: 12, marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16, fontWeight: '700', color: '#1a1a1a',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  list: { paddingHorizontal: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginVertical: 2,
  },
  optionSelected: { backgroundColor: '#f0fdf4' },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextSelected: { color: '#003f2f', fontWeight: '600' },
});
