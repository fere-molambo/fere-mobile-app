import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchLegalTexts, type LegalDocument } from '@/lib/consentService';

interface LegalTextModalProps {
  visible: boolean;
  document: LegalDocument;
  onClose: () => void;
}

const TITLES: Record<LegalDocument, string> = {
  cgu: "Conditions générales d'utilisation",
  privacy: 'Politique de confidentialité',
};

/**
 * Les textes sont stockes en markdown leger dans platform_settings.
 * On evite une dependance de rendu markdown pour trois marqueurs.
 */
function renderMarkdown(source: string) {
  return source.split('\n').map((rawLine, index) => {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      return <View key={index} style={styles.spacer} />;
    }

    if (line.startsWith('### ')) {
      return (
        <Text key={index} style={styles.h3}>
          {line.slice(4)}
        </Text>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <Text key={index} style={styles.h2}>
          {line.slice(3)}
        </Text>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <Text key={index} style={styles.h1}>
          {line.slice(2)}
        </Text>
      );
    }

    const bold = /^\*\*(.+)\*\*$/.exec(line.trim());
    if (bold) {
      return (
        <Text key={index} style={styles.bold}>
          {bold[1]}
        </Text>
      );
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <View key={index} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.paragraph}>{line.slice(2)}</Text>
        </View>
      );
    }

    return (
      <Text key={index} style={styles.paragraph}>
        {line.replace(/\*\*/g, '')}
      </Text>
    );
  });
}

export default function LegalTextModal({ visible, document, onClose }: LegalTextModalProps) {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    setLoading(true);
    fetchLegalTexts()
      .then((texts) => {
        if (cancelled) return;
        setContent(document === 'cgu' ? texts.cgu : texts.privacy);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, document]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {TITLES[document]}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <X size={22} color="#003f2f" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#003f2f" />
          </View>
        ) : content ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          >
            {renderMarkdown(content)}
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.empty}>
              Ce document n'est pas encore disponible. Contactez-nous à privacy@fere.com.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#003f2f' },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  h1: { fontSize: 18, fontWeight: '700', color: '#003f2f', marginTop: 8, marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: '700', color: '#003f2f', marginTop: 18, marginBottom: 6 },
  h3: { fontSize: 14, fontWeight: '700', color: '#003f2f', marginTop: 12, marginBottom: 4 },
  bold: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, lineHeight: 21 },
  paragraph: { fontSize: 14, color: '#444', lineHeight: 21, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 4, paddingLeft: 4 },
  bullet: { fontSize: 14, color: '#003f2f', lineHeight: 21 },
  spacer: { height: 8 },
});
