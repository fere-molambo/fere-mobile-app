import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

export default function PasswordInput({
  value,
  onChangeText,
  placeholder = 'Mot de passe',
  label,
  error,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          placeholderTextColor="#9ca3af"
        />
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsVisible(!isVisible)}>
          {isVisible ? (
            <EyeOff size={20} color="#6b7280" />
          ) : (
            <Eye size={20} color="#6b7280" />
          )}
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1f2937',
  },
  toggleButton: {
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },
});
