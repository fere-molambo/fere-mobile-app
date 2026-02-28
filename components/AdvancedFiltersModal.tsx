import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useServiceProviderTypes } from '@/hooks/useServiceProviderTypes';

export interface Filters {
  categoryIds: string[];
  subcategoryIds: string[];
  providerTypeIds: string[];
  priceMin?: number;
  priceMax?: number;
  priceTypes: string[];
  conditions: string[];
  inStockOnly: boolean;
  period?: number;
}

interface AdvancedFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: Filters) => void;
  initialFilters?: Filters;
  activeTab: 'products' | 'services';
}

const PRICE_TYPES = [
  { id: 'unitaire', label: 'Unitaire' },
  { id: 'negoce', label: 'Négociable' },
  { id: 'en_gros', label: 'En gros' },
];

const CONDITIONS = [
  { id: 'neuf', label: 'Neuf' },
  { id: 'occasion', label: 'Occasion' },
];

const PERIODS = [
  { value: 7, label: '7 jours' },
  { value: 14, label: '14 jours' },
  { value: 30, label: '30 jours' },
];

export default function AdvancedFiltersModal({
  visible,
  onClose,
  onApply,
  initialFilters,
  activeTab,
}: AdvancedFiltersModalProps) {
  const { categories } = useProductCategories();
  const { providerTypes } = useServiceProviderTypes();

  const [filters, setFilters] = useState<Filters>(
    initialFilters || {
      categoryIds: [],
      subcategoryIds: [],
      providerTypeIds: [],
      priceTypes: [],
      conditions: [],
      inStockOnly: false,
    }
  );

  useEffect(() => {
    if (visible && initialFilters) {
      setFilters(initialFilters);
    }
  }, [visible]);

  const handleReset = () => {
    setFilters({
      categoryIds: [],
      subcategoryIds: [],
      providerTypeIds: [],
      priceTypes: [],
      conditions: [],
      inStockOnly: false,
    });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const toggleArrayValue = (key: keyof Filters, value: string) => {
    setFilters((prev) => {
      const array = (prev[key] as string[]) || [];
      if (array.includes(value)) {
        return { ...prev, [key]: array.filter((v) => v !== value) };
      }
      return { ...prev, [key]: [...array, value] };
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Filtres avancés</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X color="#333" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'products' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Catégories</Text>
                <View style={styles.optionsGrid}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.option,
                        filters.categoryIds.includes(category.id) && styles.optionSelected,
                      ]}
                      onPress={() => toggleArrayValue('categoryIds', category.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          filters.categoryIds.includes(category.id) && styles.optionTextSelected,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Type de prix</Text>
                <View style={styles.optionsGrid}>
                  {PRICE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.option,
                        filters.priceTypes.includes(type.id) && styles.optionSelected,
                      ]}
                      onPress={() => toggleArrayValue('priceTypes', type.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          filters.priceTypes.includes(type.id) && styles.optionTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>État</Text>
                <View style={styles.optionsGrid}>
                  {CONDITIONS.map((condition) => (
                    <TouchableOpacity
                      key={condition.id}
                      style={[
                        styles.option,
                        filters.conditions.includes(condition.id) && styles.optionSelected,
                      ]}
                      onPress={() => toggleArrayValue('conditions', condition.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          filters.conditions.includes(condition.id) && styles.optionTextSelected,
                        ]}
                      >
                        {condition.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>En stock uniquement</Text>
                  <Switch
                    value={filters.inStockOnly}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, inStockOnly: value }))}
                    trackColor={{ false: '#ddd', true: '#003f2f' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </>
          )}

          {activeTab === 'services' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Types de services</Text>
              <View style={styles.optionsGrid}>
                {providerTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.option,
                      filters.providerTypeIds.includes(type.id) && styles.optionSelected,
                    ]}
                    onPress={() => toggleArrayValue('providerTypeIds', type.id)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        filters.providerTypeIds.includes(type.id) && styles.optionTextSelected,
                      ]}
                    >
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tranche de prix</Text>
            <View style={styles.priceRangeRow}>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.priceInputLabel}>Prix min</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={filters.priceMin !== undefined ? String(filters.priceMin) : ''}
                  onChangeText={(val) =>
                    setFilters((prev) => ({
                      ...prev,
                      priceMin: val === '' ? undefined : Number(val),
                    }))
                  }
                />
              </View>
              <View style={styles.priceRangeSeparator} />
              <View style={styles.priceInputWrapper}>
                <Text style={styles.priceInputLabel}>Prix max</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="∞"
                  keyboardType="numeric"
                  value={filters.priceMax !== undefined ? String(filters.priceMax) : ''}
                  onChangeText={(val) =>
                    setFilters((prev) => ({
                      ...prev,
                      priceMax: val === '' ? undefined : Number(val),
                    }))
                  }
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Période</Text>
            <View style={styles.optionsGrid}>
              {PERIODS.map((period) => (
                <TouchableOpacity
                  key={period.value}
                  style={[
                    styles.option,
                    filters.period === period.value && styles.optionSelected,
                  ]}
                  onPress={() =>
                    setFilters((prev) => ({
                      ...prev,
                      period: prev.period === period.value ? undefined : period.value,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      filters.period === period.value && styles.optionTextSelected,
                    ]}
                  >
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Réinitialiser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#e8f5f0',
    borderColor: '#003f2f',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  optionTextSelected: {
    color: '#003f2f',
    fontWeight: '600',
  },
  priceRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  priceRangeSeparator: {
    width: 12,
    height: 1,
    backgroundColor: '#ccc',
    marginTop: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#003f2f',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
