import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';

interface LegalSection {
  title: string;
  content: string;
}

const LEGAL_SECTIONS: LegalSection[] = [
  {
    title: "1. Éditeur de l'application",
    content:
      "L'application Fere est éditée par la société Fere SAS, au capital de 10 000 €, immatriculée au Registre du Commerce et des Sociétés. Siège social : [Adresse]. Email : contact@fere.com.",
  },
  {
    title: '2. Objet',
    content:
      "L'application Fere est une plateforme de mise en relation entre acheteurs et vendeurs de produits et services. Elle permet aux utilisateurs de parcourir des offres, passer des commandes et communiquer avec des prestataires.",
  },
  {
    title: '3. Collecte et traitement des données personnelles',
    content:
      "Conformément au Règlement Général sur la Protection des Données (RGPD), les données personnelles collectées (nom, prénom, e-mail, adresse) sont utilisées uniquement dans le cadre de la relation commerciale et ne sont pas cédées à des tiers sans consentement préalable.",
  },
  {
    title: '4. Droits des utilisateurs',
    content:
      "Tout utilisateur dispose d'un droit d'accès, de rectification, de suppression et de portabilité de ses données personnelles. Pour exercer ces droits, contactez-nous à : privacy@fere.com.",
  },
  {
    title: '5. Cookies',
    content:
      "L'application peut utiliser des technologies de suivi à des fins d'amélioration des services et d'analyse d'utilisation. Vous pouvez gérer vos préférences via les paramètres de votre appareil.",
  },
  {
    title: '6. Propriété intellectuelle',
    content:
      "Tous les contenus présents sur l'application (logos, textes, images, marques) sont la propriété exclusive de Fere SAS et sont protégés par les lois relatives à la propriété intellectuelle. Toute reproduction est interdite sans autorisation.",
  },
  {
    title: '7. Responsabilité',
    content:
      "Fere SAS ne saurait être tenue responsable des dommages directs ou indirects résultant de l'utilisation de l'application ou de l'indisponibilité du service. Les vendeurs sont seuls responsables du contenu de leurs annonces.",
  },
  {
    title: '8. Droit applicable',
    content:
      "Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux compétents sont ceux du ressort du siège social de Fere SAS.",
  },
];

export default function LegalScreen() {
  return (
    <View style={styles.container}>
      <SettingsSubHeader title="Mentions légales" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mentions légales</Text>
          <Text style={styles.headerDate}>Dernière mise à jour : Février 2026</Text>
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
