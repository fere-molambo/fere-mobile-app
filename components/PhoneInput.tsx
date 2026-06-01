import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { ChevronDown, Phone } from 'lucide-react-native';

const COUNTRY_CODES = [
  { code: '+223', country: 'Mali', flag: '\uD83C\uDDF2\uD83C\uDDF1' },
  { code: '+225', country: 'Cote d\'Ivoire', flag: '\uD83C\uDDE8\uD83C\uDDEE' },
  { code: '+221', country: 'Senegal', flag: '\uD83C\uDDF8\uD83C\uDDF3' },
  { code: '+226', country: 'Burkina Faso', flag: '\uD83C\uDDE7\uD83C\uDDEB' },
  { code: '+228', country: 'Togo', flag: '\uD83C\uDDF9\uD83C\uDDEC' },
  { code: '+229', country: 'Benin', flag: '\uD83C\uDDE7\uD83C\uDDEF' },
  { code: '+227', country: 'Niger', flag: '\uD83C\uDDF3\uD83C\uDDEA' },
];

interface PhoneInputProps {
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  number: string;
  onNumberChange: (number: string) => void;
  error?: string;
}

export default function PhoneInput({
  countryCode,
  onCountryCodeChange,
  number,
  onNumberChange,
  error,
}: PhoneInputProps) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const selected = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <View>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <TouchableOpacity
          style={styles.codeBtn}
          onPress={() => setPickerVisible(true)}
        >
          <Text style={styles.flag}>{selected.flag}</Text>
          <Text style={styles.codeText}>{selected.code}</Text>
          <ChevronDown size={16} color="#666" />
        </TouchableOpacity>

        <View style={styles.separator} />

        <Phone size={18} color="#666" style={styles.phoneIcon} />
        <TextInput
          style={styles.input}
          placeholder="70 00 00 00"
          placeholderTextColor="#aaa"
          value={number}
          onChangeText={(t) => onNumberChange(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={12}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={pickerVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.dropdown}>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.code === countryCode && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onCountryCodeChange(item.code);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={styles.optionFlag}>{item.flag}</Text>
                  <Text style={styles.optionCountry}>{item.country}</Text>
                  <Text style={styles.optionCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    paddingHorizontal: 12,
    height: 54,
  },
  rowError: {
    borderColor: '#dc2626',
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  flag: {
    fontSize: 20,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  separator: {
    width: 1,
    height: 28,
    backgroundColor: '#e5e5e5',
    marginRight: 10,
  },
  phoneIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    marginTop: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
    maxHeight: 360,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  optionSelected: {
    backgroundColor: '#f0f9f6',
  },
  optionFlag: {
    fontSize: 22,
  },
  optionCountry: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  optionCode: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
});
