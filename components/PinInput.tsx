import { useRef } from 'react';
import { View, TextInput, StyleSheet, Text, Pressable } from 'react-native';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  secure?: boolean;
  autoFocus?: boolean;
  error?: string;
}

export default function PinInput({
  value,
  onChange,
  length = 6,
  secure = false,
  autoFocus = false,
  error,
}: PinInputProps) {
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const cells = Array.from({ length }, (_, i) => {
    const char = value[i];
    const isFilled = char !== undefined;
    const isActive = i === value.length;

    return (
      <Pressable
        key={i}
        style={[
          styles.cell,
          isActive && styles.cellActive,
          isFilled && styles.cellFilled,
          error ? styles.cellError : null,
        ]}
        onPress={focusInput}
      >
        <Text style={styles.cellText}>
          {isFilled ? (secure ? '\u2022' : char) : ''}
        </Text>
      </Pressable>
    );
  });

  return (
    <View>
      <View style={styles.container}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={length}
          autoFocus={autoFocus}
          style={styles.hiddenInput}
          caretHidden
        />
        <Pressable style={styles.cellsRow} onPress={focusInput}>
          {cells}
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  cell: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellActive: {
    borderColor: '#003f2f',
    backgroundColor: '#fff',
  },
  cellFilled: {
    borderColor: '#003f2f',
    backgroundColor: '#f0f9f6',
  },
  cellError: {
    borderColor: '#dc2626',
  },
  cellText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    marginTop: 8,
    textAlign: 'center',
  },
});
