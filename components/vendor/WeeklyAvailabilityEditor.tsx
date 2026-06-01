import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
} from 'react-native';
import { Trash2, Plus } from 'lucide-react-native';
import DropdownSelect from '@/components/vendor/DropdownSelect';
import { DAY_ORDER, DAY_NAMES } from '@/lib/bookingUtils';

interface TimeSlot {
  start: string;
  end: string;
}

type WeeklyAvailability = Record<string, TimeSlot[]>;

interface Props {
  value: WeeklyAvailability;
  onChange: (value: WeeklyAvailability) => void;
}

const TIME_OPTIONS = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 6; h <= 23; h++) {
    for (let m = 0; m < 60; m += 15) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      opts.push({ value: time, label: time });
    }
  }
  return opts;
})();

export default function WeeklyAvailabilityEditor({ value, onChange }: Props) {
  const isDayEnabled = (day: string) => {
    return Array.isArray(value[day]) && value[day].length > 0;
  };

  const toggleDay = (day: string) => {
    const next = { ...value };
    if (isDayEnabled(day)) {
      delete next[day];
    } else {
      next[day] = [{ start: '09:00', end: '17:00' }];
    }
    onChange(next);
  };

  const updateSlot = (day: string, index: number, field: 'start' | 'end', newVal: string) => {
    const slots = [...(value[day] || [])];
    slots[index] = { ...slots[index], [field]: newVal };
    onChange({ ...value, [day]: slots });
  };

  const removeSlot = (day: string, index: number) => {
    const slots = (value[day] || []).filter((_, i) => i !== index);
    if (slots.length === 0) {
      const next = { ...value };
      delete next[day];
      onChange(next);
    } else {
      onChange({ ...value, [day]: slots });
    }
  };

  const addSlot = (day: string) => {
    const slots = [...(value[day] || [])];
    const lastSlot = slots[slots.length - 1];
    const newStart = lastSlot ? lastSlot.end : '09:00';
    slots.push({ start: newStart, end: '17:00' });
    onChange({ ...value, [day]: slots });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Disponibilites hebdomadaires</Text>

      {DAY_ORDER.map((day) => {
        const enabled = isDayEnabled(day);
        const slots = value[day] || [];

        return (
          <View key={day} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Switch
                value={enabled}
                onValueChange={() => toggleDay(day)}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={enabled ? '#003f2f' : '#9ca3af'}
              />
              <Text style={[styles.dayName, enabled && styles.dayNameActive]}>
                {DAY_NAMES[day]}
              </Text>
            </View>

            {enabled && (
              <View style={styles.slotsContainer}>
                {slots.map((slot, index) => (
                  <View key={index} style={styles.slotRow}>
                    <View style={styles.slotDropdown}>
                      <DropdownSelect
                        value={slot.start}
                        options={TIME_OPTIONS}
                        onChange={(v) => updateSlot(day, index, 'start', v)}
                      />
                    </View>
                    <Text style={styles.slotSeparator}>-</Text>
                    <View style={styles.slotDropdown}>
                      <DropdownSelect
                        value={slot.end}
                        options={TIME_OPTIONS}
                        onChange={(v) => updateSlot(day, index, 'end', v)}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteSlotBtn}
                      onPress={() => removeSlot(day, index)}
                    >
                      <Trash2 size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSlotBtn} onPress={() => addSlot(day)}>
                  <Plus size={16} color="#003f2f" />
                  <Text style={styles.addSlotText}>Ajouter un creneau</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  dayBlock: { marginBottom: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayName: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  dayNameActive: { color: '#1a1a1a' },
  slotsContainer: { marginTop: 10, marginLeft: 8, gap: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotDropdown: { flex: 1 },
  slotSeparator: { fontSize: 16, color: '#666', fontWeight: '600' },
  deleteSlotBtn: {
    width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  addSlotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  addSlotText: { fontSize: 13, fontWeight: '600', color: '#003f2f' },
});
