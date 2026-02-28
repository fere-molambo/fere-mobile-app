import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import SettingsSubHeader from '@/components/SettingsSubHeader';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'Comment passer une commande sur Fere ?',
    answer:
      "Parcourez les offres disponibles dans l'onglet \"Offres\", ajoutez les produits ou services souhaités à votre panier, puis validez votre commande en suivant les étapes de paiement.",
  },
  {
    id: '2',
    question: 'Comment suivre ma commande ?',
    answer:
      'Une fois votre commande validée, vous pouvez suivre son avancement dans la section "Commandes" de votre espace Paramètres. Vous recevrez également des notifications à chaque étape.',
  },
  {
    id: '3',
    question: 'Comment modifier mon profil ?',
    answer:
      'Rendez-vous dans Paramètres > Profil. Vous pouvez y modifier vos informations personnelles, ajouter ou modifier vos adresses de livraison, et mettre à jour votre photo de profil.',
  },
  {
    id: '4',
    question: 'Comment contacter un vendeur ?',
    answer:
      "Utilisez l'onglet \"Chat\" pour envoyer un message directement à un vendeur. Vous pouvez également accéder au chat depuis la page d'un produit ou service.",
  },
  {
    id: '5',
    question: 'Quels sont les modes de paiement acceptés ?',
    answer:
      'Fere accepte les paiements par carte bancaire (Visa, Mastercard), ainsi que les paiements mobiles. D\'autres modes de paiement seront bientôt disponibles.',
  },
  {
    id: '6',
    question: 'Comment annuler une commande ?',
    answer:
      "Pour annuler une commande, rendez-vous dans \"Commandes\" et sélectionnez la commande concernée. L'annulation est possible avant que le vendeur n'ait accepté la commande.",
  },
  {
    id: '7',
    question: 'Comment signaler un problème ?',
    answer:
      "Si vous rencontrez un problème, contactez notre service client via l'onglet Chat ou envoyez-nous un e-mail à support@fere.com. Nous répondons sous 24h.",
  },
  {
    id: '8',
    question: 'Mes données sont-elles sécurisées ?',
    answer:
      'Oui, la sécurité de vos données est notre priorité. Toutes vos informations sont chiffrées et stockées de manière sécurisée. Consultez nos mentions légales pour en savoir plus.',
  },
];

export default function FAQScreen() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.container}>
      <SettingsSubHeader title="FAQ" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introBox}>
          <Text style={styles.introText}>
            Vous avez des questions ? Retrouvez les réponses aux questions les plus fréquentes ci-dessous.
          </Text>
        </View>

        <View style={styles.list}>
          {FAQ_DATA.map((item, index) => {
            const isOpen = openId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.faqItem, index === FAQ_DATA.length - 1 && styles.faqItemLast]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  {isOpen ? (
                    <ChevronUp color="#003f2f" size={20} />
                  ) : (
                    <ChevronDown color="#888" size={20} />
                  )}
                </View>
                {isOpen && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </TouchableOpacity>
            );
          })}
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
  introBox: {
    backgroundColor: '#e8f3f0',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 14,
  },
  introText: {
    fontSize: 13,
    color: '#003f2f',
    lineHeight: 20,
  },
  list: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 32,
  },
  faqItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 20,
  },
  faqAnswer: {
    marginTop: 10,
    fontSize: 13,
    color: '#555',
    lineHeight: 21,
  },
});
