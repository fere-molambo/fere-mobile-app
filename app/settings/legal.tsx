import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { ExternalLink, FileText, Shield, Cookie } from 'lucide-react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';

const LEGAL_URLS = {
  cgu: 'https://fere.app/cgu',
  privacy: 'https://fere.app/privacy',
  cookies: 'https://fere.app/cookies',
};

const LEGAL_LINKS = [
  {
    icon: FileText,
    label: "Conditions générales d'utilisation",
    url: LEGAL_URLS.cgu,
  },
  {
    icon: Shield,
    label: 'Politique de confidentialité',
    url: LEGAL_URLS.privacy,
  },
  {
    icon: Cookie,
    label: 'Politique de cookies',
    url: LEGAL_URLS.cookies,
  },
];

interface LegalSection {
  title: string;
  content: string;
}

const LEGAL_SECTIONS: LegalSection[] = [
  {
    title: "1. Éditeur de l'application",
    content:
      "L'application Fere est éditée par la société Fere SAS. Email : contact@fere.com.",
  },
  {
    title: '2. Objet',
    content:
      "L'application Fere est une plateforme de mise en relation entre acheteurs et vendeurs de produits et services. Elle permet aux utilisateurs de parcourir des offres, passer des commandes et communiquer avec des prestataires.",
  },
  {
    title: '3. Collecte et traitement des données personnelles',
    content:
      "Les données personnelles collectées sont utilisées uniquement dans le cadre de la relation commerciale et ne sont pas cédées à des tiers sans consentement préalable.",
  },
  {
    title: '4. Droits des utilisateurs',
    content:
      "Tout utilisateur dispose d'un droit d'accès, de rectification, de suppression et de portabilité de ses données personnelles. Contactez-nous à : privacy@fere.com.",
  },
  {
    title: '5. Propriété intellectuelle',
    content:
      "Tous les contenus présents sur l'application sont la propriété exclusive de Fere SAS et sont protégés par les lois relatives à la propriété intellectuelle. Toute reproduction est interdite sans autorisation.",
  },
  {
    title: '6. Responsabilité',
    content:
      "Fere SAS ne saurait être tenue responsable des dommages résultant de l'utilisation de l'application. Les vendeurs sont seuls responsables du contenu de leurs annonces.",
  },
  {
    title: '7. Droit applicable',
    content:
      "Les présentes mentions légales sont soumises au droit applicable. En cas de litige, les tribunaux compétents sont ceux du ressort du siège social de Fere SAS.",
  },
];

export default function LegalScreen() {
  const handleOpen = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Mentions légales" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mentions légales</Text>
          <Text style={styles.headerDate}>Dernière mise à jour : Février 2026</Text>
        </View>

        <View style={styles.linksContainer}>
          <Text style={styles.linksTitle}>Documents légaux</Text>
          {LEGAL_LINKS.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.linkRow,
                  index < LEGAL_LINKS.length - 1 && styles.linkRowBorder,
                ]}
                onPress={() => handleOpen(item.url)}
                activeOpacity={0.7}
              >
                <View style={styles.linkIconWrap}>
                  <Icon size={18} color="#003f2f" strokeWidth={2} />
                </View>
                <Text style={styles.linkLabel}>{item.label}</Text>
                <ExternalLink size={16} color="#aaa" strokeWidth={2} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionsContainer}>
          {LEGAL_SECTIONS.map((section, index) => (
            <View
              key={index}
              style={[
                styles.section,
                index === LEGAL_SECTIONS.length - 1 && styles.sectionLast,
              ]}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionContent}>{section.content}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
  sectionsContainer: {
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
    marginBottom: 40,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionLast: {
    borderBottomWidth: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#003f2f',
    marginBottom: 8,
    lineHeight: 20,
  },
  sectionContent: {
    fontSize: 13,
    color: '#555',
    lineHeight: 21,
  },
});
