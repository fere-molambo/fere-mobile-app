import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronRight, FileText, Shield, Cookie } from 'lucide-react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';
import LegalTextModal from '@/components/legal/LegalTextModal';
import type { LegalDocKey } from '@/lib/consentService';

// Les textes viennent de platform_settings, la meme source que fere.app/cgu et
// que les modales de consentement : une seule version de chaque document.
const LEGAL_LINKS: { icon: typeof FileText; label: string; doc: LegalDocKey }[] = [
  {
    icon: FileText,
    label: "Conditions générales d'utilisation",
    doc: 'cgu',
  },
  {
    icon: Shield,
    label: 'Politique de confidentialité',
    doc: 'privacy',
  },
  {
    icon: Cookie,
    label: 'Politique de cookies',
    doc: 'cookies',
  },
];

export default function LegalScreen() {
  const [openDoc, setOpenDoc] = useState<LegalDocKey | null>(null);

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Mentions légales" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mentions légales</Text>
          <Text style={styles.headerDate}>
            Documents en vigueur, identiques à ceux publiés sur fere.app
          </Text>
        </View>

        <View style={styles.linksContainer}>
          <Text style={styles.linksTitle}>Documents légaux</Text>
          {LEGAL_LINKS.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.doc}
                style={[
                  styles.linkRow,
                  index < LEGAL_LINKS.length - 1 && styles.linkRowBorder,
                ]}
                onPress={() => setOpenDoc(item.doc)}
                activeOpacity={0.7}
              >
                <View style={styles.linkIconWrap}>
                  <Icon size={18} color="#003f2f" strokeWidth={2} />
                </View>
                <Text style={styles.linkLabel}>{item.label}</Text>
                <ChevronRight size={18} color="#aaa" strokeWidth={2} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <LegalTextModal
        visible={openDoc !== null}
        document={openDoc ?? 'cgu'}
        onClose={() => setOpenDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003f2f',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 12,
    color: '#888',
  },
  linksContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    paddingTop: 14,
  },
  linksTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  linkRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f0f7f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
});
