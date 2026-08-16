import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

interface ConsentCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  /** Texte avant le lien, ex. "J'accepte les " */
  prefix: string;
  /** Libelle cliquable du document, ex. "conditions générales d'utilisation" */
  linkLabel: string;
  onPressLink: () => void;
  disabled?: boolean;
}

export default function ConsentCheckbox({
  checked,
  onToggle,
  prefix,
  linkLabel,
  onPressLink,
  disabled,
}: ConsentCheckboxProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onToggle}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={[styles.box, checked && styles.boxChecked, disabled && styles.boxDisabled]}
      >
        {checked && <Check size={14} color="#fff" strokeWidth={3} />}
      </TouchableOpacity>

      <Text style={styles.label}>
        {prefix}
        <Text style={styles.link} onPress={onPressLink}>
          {linkLabel}
        </Text>
        {' '}
        <Text style={styles.required}>*</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#003f2f',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: { backgroundColor: '#003f2f' },
  boxDisabled: { opacity: 0.5 },
  label: { flex: 1, fontSize: 13, color: '#444', lineHeight: 19 },
  link: { color: '#003f2f', fontWeight: '600', textDecorationLine: 'underline' },
  required: { color: '#c0392b', fontWeight: '700' },
});
