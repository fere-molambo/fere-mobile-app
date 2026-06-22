#!/usr/bin/env python3
"""
Session 1 — applique en une passe :
  [1] AppHeader safe area top + cloche cliquable (ouvre /settings/notifications par defaut)
  [2] Sweep accents (Vetements -> Vêtements, Telephone -> Téléphone, etc.)
      AVEC garde-fou pour les valeurs code (role: 'equipe', === 'equipe').
  [7] Cloche notification : handler par defaut dans AppHeader.
  [8] Search :
        - SearchBar.tsx : ajoute prop onSubmit + onSubmitEditing
        - (tabs)/index.tsx : branche router.push('/search?q=...')
        - app/search.tsx : nouvel ecran de resultats produits+services
  [11a] order-detail.tsx : detecte vendeur via shops.owner_id, bouton/handler
        "Contacter le client" si vendeur, sinon "Contacter le vendeur"
  [11b] chat/[id].tsx : behavior Android = 'height' (au lieu d'undefined)

A executer a la racine du repo (ou se trouve package.json). Idempotent.
"""
import re
import sys
from pathlib import Path

if not Path("package.json").exists():
    print("ERREUR: lance ce script a la racine du repo (ou se trouve package.json)")
    sys.exit(1)

print("== Session 1 ==\n")

# ===========================================================================
# [2] SWEEP ACCENTS
# ===========================================================================
ACCENT_MAP = {
    "Vetements": "Vêtements", "vetements": "vêtements",
    "Telephone": "Téléphone", "telephone": "téléphone",
    "Reduction": "Réduction", "reduction": "réduction",
    "Personnalisee": "Personnalisée", "personnalisee": "personnalisée",
    "Selectionner": "Sélectionner", "selectionner": "sélectionner",
    "Selectionnez": "Sélectionnez", "selectionnez": "sélectionnez",
    "Categorie": "Catégorie", "categorie": "catégorie",
    "Categories": "Catégories", "categories": "catégories",
    "Quantite": "Quantité", "quantite": "quantité",
    "Equipe": "Équipe",  # Note: 'equipe' lowercase NOT mapped (code value)
    "Apres": "Après", "apres": "après",
    "Telechargement": "Téléchargement", "telechargement": "téléchargement",
    "Reservation": "Réservation", "reservation": "réservation",
    "Reservations": "Réservations", "reservations": "réservations",
    "Specifie": "Spécifié", "specifie": "spécifié",
    "Specifiee": "Spécifiée", "specifiee": "spécifiée",
    "Specifique": "Spécifique", "specifique": "spécifique",
    "Acceder": "Accéder", "acceder": "accéder",
    "Accedez": "Accédez", "accedez": "accédez",
    "Numero": "Numéro", "numero": "numéro",
    "Operation": "Opération",
    "Operations": "Opérations",
    "Operateur": "Opérateur",
    "Communaute": "Communauté", "communaute": "communauté",
    "Notifie": "Notifié", "notifie": "notifié",
    "Notifiee": "Notifiée", "notifiee": "notifiée",
    "Verifie": "Vérifié", "verifie": "vérifié",
    "Verifiee": "Vérifiée", "verifiee": "vérifiée",
    "Activee": "Activée", "activee": "activée",
    "Annulee": "Annulée", "annulee": "annulée",
    "Annulees": "Annulées", "annulees": "annulées",
    "Terminee": "Terminée", "terminee": "terminée",
    "Livree": "Livrée", "livree": "livrée",
    "Cree": "Créé", "cree": "créé",
    "Creer": "Créer", "creer": "créer",
    "Creez": "Créez", "creez": "créez",
    "Creee": "Créée", "creee": "créée",
    "Etat": "État",
    "Etablir": "Établir", "etablir": "établir",
    "Eviter": "Éviter", "eviter": "éviter",
    "Enregistree": "Enregistrée", "enregistree": "enregistrée",
    "Enregistre": "Enregistré", "enregistre": "enregistré",
    "Envoyee": "Envoyée", "envoyee": "envoyée",
    "Envoye": "Envoyé", "envoye": "envoyé",
    "Reservee": "Réservée", "reservee": "réservée",
    "Reserve": "Réservé", "reserve": "réservé",
    "Connecte": "Connecté", "connecte": "connecté",
    "Deconnecte": "Déconnecté", "deconnecte": "déconnecté",
    "Deconnexion": "Déconnexion", "deconnexion": "déconnexion",
    "Detaille": "Détaillé", "detaille": "détaillé",
    "Details": "Détails", "details": "détails",
    "Generale": "Générale",
    "General": "Général",
    "Generee": "Générée", "generee": "générée",
    "Generer": "Générer", "generer": "générer",
    "Securite": "Sécurité", "securite": "sécurité",
    "Beneficier": "Bénéficier", "beneficier": "bénéficier",
    "Beneficiaire": "Bénéficiaire", "beneficiaire": "bénéficiaire",
    "Effectue": "Effectué", "effectue": "effectué",
    "Effectuee": "Effectuée", "effectuee": "effectuée",
    "Refusee": "Refusée", "refusee": "refusée",
    "Refuse": "Refusé", "refuse": "refusé",
    "Rembourse": "Remboursé", "rembourse": "remboursé",
    "Remboursee": "Remboursée", "remboursee": "remboursée",
    "Donnees": "Données", "donnees": "données",
    "Beaute": "Beauté", "beaute": "beauté",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "depasse": "dépassé", "Depasse": "Dépassé",
    "depasser": "dépasser",
    "delais": "délais", "Delais": "Délais",
    "delai": "délai", "Delai": "Délai",
    "premiere": "première", "Premiere": "Première",
    "Maniere": "Manière", "maniere": "manière",
    "Modifie": "Modifié", "modifie": "modifié",
    "Supprime": "Supprimé", "supprime": "supprimé",
    "Achete": "Acheté", "achete": "acheté",
    "Recents": "Récents", "recents": "récents",
    "Recente": "Récente", "recente": "récente",
    "Validee": "Validée", "validee": "validée",
    "Echec": "Échec", "echec": "échec",
    "Echoue": "Échoué", "echoue": "échoué",
    "Reussi": "Réussi", "reussi": "réussi",
    "Reussir": "Réussir", "reussir": "réussir",
    "Reussite": "Réussite", "reussite": "réussite",
    "Probleme": "Problème", "probleme": "problème",
    "Problemes": "Problèmes", "problemes": "problèmes",
    "Systeme": "Système", "systeme": "système",
    "Bientot": "Bientôt", "bientot": "bientôt",
}

CODE_VALUES_TO_PROTECT = ["'equipe'", '"equipe"']

n_files, n_repl = 0, 0
for tsx in Path(".").rglob("*.tsx"):
    if "node_modules" in str(tsx) or ".git" in str(tsx):
        continue
    txt = tsx.read_text()
    orig = txt
    for old, new in ACCENT_MAP.items():
        if old == new:
            continue
        pat = re.compile(r"\b" + re.escape(old) + r"\b")
        txt2, k = pat.subn(new, txt)
        if k > 0:
            txt = txt2
            n_repl += k
    # Garde-fou : revert 'équipe' -> 'equipe' en valeurs code
    for old_val, new_val in [
        ("=== 'équipe'", "=== 'equipe'"),
        ("!== 'équipe'", "!== 'equipe'"),
        ("role: 'équipe'", "role: 'equipe'"),
        ('=== "équipe"', '=== "equipe"'),
        ('!== "équipe"', '!== "equipe"'),
    ]:
        txt = txt.replace(old_val, new_val)
    if txt != orig:
        tsx.write_text(txt)
        n_files += 1
print(f"[2] Accents: {n_files} fichiers, {n_repl} remplacements")

# ===========================================================================
# [1]+[7] AppHeader: safe area top + cloche cliquable
# ===========================================================================
p = Path("components/AppHeader.tsx")
if p.exists():
    txt = p.read_text()
    if "useSafeAreaInsets" not in txt:
        txt = txt.replace(
            "import React from 'react';\nimport { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';\nimport { Bell, ShoppingCart } from 'lucide-react-native';\nimport { useAuth } from '@/contexts/AuthContext';\nimport { useCart } from '@/contexts/CartContext';",
            "import React from 'react';\nimport { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { useRouter } from 'expo-router';\nimport { Bell, ShoppingCart } from 'lucide-react-native';\nimport { useAuth } from '@/contexts/AuthContext';\nimport { useCart } from '@/contexts/CartContext';",
            1,
        )
        txt = txt.replace(
            "  const { profile } = useAuth();\n  const { openCart } = useCart();",
            "  const { profile } = useAuth();\n  const { openCart } = useCart();\n  const insets = useSafeAreaInsets();\n  const router = useRouter();\n  const handleBell = onNotificationPress ?? (() => router.push('/settings/notifications' as any));",
            1,
        )
        txt = txt.replace(
            "  return (\n    <View style={styles.container}>",
            "  return (\n    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>",
            1,
        )
        txt = txt.replace(
            "          onPress={onNotificationPress}",
            "          onPress={handleBell}",
            1,
        )
        # Retire paddingTop hardcode (safe area gere)
        txt = re.sub(
            r"\s*paddingTop:\s*Platform\.OS === 'ios' \? 50 : 16,\n",
            "\n",
            txt,
        )
        p.write_text(txt)
        print("[1]+[7] AppHeader: safe area + cloche -> /settings/notifications")
    else:
        print("[1]+[7] AppHeader: deja fait")

# ===========================================================================
# [11b] chat keyboard Android: behavior 'height' au lieu d'undefined
# ===========================================================================
p = Path("app/chat/[id].tsx")
if p.exists():
    txt = p.read_text()
    new_txt = txt.replace(
        "behavior={Platform.OS === 'ios' ? 'padding' : undefined}",
        "behavior={Platform.OS === 'ios' ? 'padding' : 'height'}",
        1,
    )
    if new_txt != txt:
        p.write_text(new_txt)
        print("[11b] chat/[id].tsx: behavior Android = height")
    else:
        print("[11b] chat: deja fait")

# ===========================================================================
# [11a] order-detail : isVendorViewing + handleContactClient + label
# ===========================================================================
p = Path("app/order-detail.tsx")
if p.exists():
    txt = p.read_text()
    if "isVendorViewing" not in txt:
        # 1. State + useEffect pour shopOwnerId
        old = (
            "  const [contactingDriver, setContactingDriver] = useState(false);\n"
            "  const [contactingVendor, setContactingVendor] = useState(false);\n"
            "\n"
            "  const handleContactDriver = useCallback(async () => {"
        )
        new = (
            "  const [contactingDriver, setContactingDriver] = useState(false);\n"
            "  const [contactingVendor, setContactingVendor] = useState(false);\n"
            "  const [shopOwnerId, setShopOwnerId] = useState<string | null>(null);\n"
            "  const isVendorViewing = !!user && !!shopOwnerId && user.id === shopOwnerId;\n"
            "\n"
            "  useEffect(() => {\n"
            "    if (!order?.shop_id) { setShopOwnerId(null); return; }\n"
            "    let cancelled = false;\n"
            "    (async () => {\n"
            "      const { data } = await supabase\n"
            "        .from('shops')\n"
            "        .select('owner_id')\n"
            "        .eq('id', order.shop_id)\n"
            "        .maybeSingle();\n"
            "      if (!cancelled) setShopOwnerId(data?.owner_id ?? null);\n"
            "    })();\n"
            "    return () => { cancelled = true; };\n"
            "  }, [order?.shop_id]);\n"
            "\n"
            "  const handleContactClient = useCallback(async () => {\n"
            "    if (!user || !order?.user_id || contactingVendor) return;\n"
            "    setContactingVendor(true);\n"
            "    try {\n"
            "      const convoId = await startConversation(user.id, order.user_id);\n"
            "      router.push(`/chat/${convoId}` as any);\n"
            "    } catch (err) {\n"
            "      Alert.alert('Erreur', \"Impossible d'ouvrir la conversation. Veuillez réessayer.\");\n"
            "    } finally {\n"
            "      setContactingVendor(false);\n"
            "    }\n"
            "  }, [user, order, contactingVendor, router]);\n"
            "\n"
            "  const handleContactDriver = useCallback(async () => {"
        )
        txt = txt.replace(old, new, 1)
        # 2. Ajoute user_id a la requete select
        txt = txt.replace(
            "delivery_fee, subtotal, created_at, shop_id, delivery_address_id,",
            "delivery_fee, subtotal, created_at, shop_id, user_id, delivery_address_id,",
            1,
        )
        # 3. Bouton conditionnel
        txt = txt.replace(
            "              <TouchableOpacity\n                style={styles.contactBtn}\n                onPress={handleContactVendor}\n                disabled={contactingVendor}\n              >\n                {contactingVendor ? (\n                  <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n                ) : (\n                  <>\n                    <MessageCircle color=\"#003f2f\" size={16} />\n                    <Text style={styles.contactBtnText}>Contacter le vendeur</Text>\n                  </>\n                )}\n              </TouchableOpacity>",
            "              <TouchableOpacity\n                style={styles.contactBtn}\n                onPress={isVendorViewing ? handleContactClient : handleContactVendor}\n                disabled={contactingVendor}\n              >\n                {contactingVendor ? (\n                  <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n                ) : (\n                  <>\n                    <MessageCircle color=\"#003f2f\" size={16} />\n                    <Text style={styles.contactBtnText}>{isVendorViewing ? 'Contacter le client' : 'Contacter le vendeur'}</Text>\n                  </>\n                )}\n              </TouchableOpacity>",
            1,
        )
        p.write_text(txt)
        print("[11a] order-detail.tsx: isVendorViewing + handleContactClient")
    else:
        print("[11a] order-detail: deja fait")

# Ajoute user_id a l'interface OrderDetail
p = Path("components/order/OrderDetailConstants.ts")
if p.exists():
    txt = p.read_text()
    if "user_id: string;" not in txt:
        txt = txt.replace(
            "  shop_id: string;\n  delivery_address_id: string | null;",
            "  shop_id: string;\n  user_id: string;\n  delivery_address_id: string | null;",
            1,
        )
        p.write_text(txt)
        print("[11a] OrderDetailConstants.ts: user_id ajoute a l'interface")
    else:
        print("[11a] OrderDetailConstants: deja fait")

# ===========================================================================
# [8] SearchBar : prop onSubmit + onSubmitEditing
# ===========================================================================
p = Path("components/SearchBar.tsx")
if p.exists():
    txt = p.read_text()
    if "onSubmit?:" not in txt:
        txt = txt.replace(
            "interface SearchBarProps {\n  onSearch?: (query: string) => void;",
            "interface SearchBarProps {\n  onSearch?: (query: string) => void;\n  onSubmit?: (query: string) => void;",
            1,
        )
        txt = txt.replace(
            "export default function SearchBar({\n  onSearch,\n  onVoiceSearch,",
            "export default function SearchBar({\n  onSearch,\n  onSubmit,\n  onVoiceSearch,",
            1,
        )
        txt = txt.replace(
            "          onChangeText={setSearchText}\n          returnKeyType=\"search\"",
            "          onChangeText={setSearchText}\n          onSubmitEditing={() => onSubmit?.(searchText.trim())}\n          returnKeyType=\"search\"",
            1,
        )
        p.write_text(txt)
        print("[8] SearchBar.tsx: onSubmit ajoute")
    else:
        print("[8] SearchBar: deja fait")

# ===========================================================================
# [8] (tabs)/index.tsx : router.push('/search?q=...')
# ===========================================================================
p = Path("app/(tabs)/index.tsx")
if p.exists():
    txt = p.read_text()
    if "handleSubmitSearch" not in txt:
        if "import { useRouter } from 'expo-router'" not in txt:
            txt = txt.replace(
                "import React, { useState } from 'react';\nimport { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';\nimport AppHeader from '@/components/AppHeader';",
                "import React, { useState } from 'react';\nimport { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';\nimport { useRouter } from 'expo-router';\nimport AppHeader from '@/components/AppHeader';",
                1,
            )
        txt = txt.replace(
            "export default function HomeScreen() {\n  const { userRole, user } = useAuth();\n  const [refreshing, setRefreshing] = useState(false);",
            "export default function HomeScreen() {\n  const { userRole, user } = useAuth();\n  const router = useRouter();\n  const [refreshing, setRefreshing] = useState(false);",
            1,
        )
        txt = txt.replace(
            "  const handleSearch = (query: string) => {\n    console.log('Searching for:', query);\n  };",
            "  const handleSubmitSearch = (query: string) => {\n    if (!query) return;\n    router.push({ pathname: '/search', params: { q: query } } as any);\n  };",
            1,
        )
        txt = txt.replace(
            "<SearchBar onSearch={handleSearch} />",
            "<SearchBar onSubmit={handleSubmitSearch} />",
            1,
        )
        p.write_text(txt)
        print("[8] (tabs)/index.tsx: search branche")
    else:
        print("[8] (tabs)/index.tsx: deja fait")

# ===========================================================================
# [8] CREATION ecran app/search.tsx
# ===========================================================================
SEARCH_TSX = r'''import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import ServiceCard from '@/components/ServiceCard';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const initialQuery = (q || '').trim();

  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'products' | 'services'>('products');

  const runSearch = useCallback(async (text: string) => {
    const term = text.trim();
    if (!term) {
      setProducts([]); setServices([]); return;
    }
    setLoading(true);
    try {
      const like = `%${term}%`;
      const [{ data: prodData }, { data: svcData }] = await Promise.all([
        supabase
          .from('products')
          .select('*, shop:shops!inner(*)')
          .eq('is_active', true)
          .eq('shops.is_active', true)
          .or(`name.ilike.${like},description.ilike.${like}`)
          .limit(40),
        supabase
          .from('services')
          .select('*, shop:shops!inner(*)')
          .eq('is_active', true)
          .eq('shops.is_active', true)
          .or(`name.ilike.${like},description.ilike.${like}`)
          .limit(40),
      ]);
      setProducts(prodData || []);
      setServices(svcData || []);
    } catch (e) {
      setProducts([]); setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
  }, [initialQuery, runSearch]);

  const currentList = tab === 'products' ? products : services;
  const hasResults = currentList.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#003f2f" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <SearchBar
            placeholder="Rechercher..."
            onSubmit={(text) => { setQuery(text); runSearch(text); }}
          />
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'products' && styles.tabActive]}
          onPress={() => setTab('products')}
        >
          <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>
            Produits ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'services' && styles.tabActive]}
          onPress={() => setTab('services')}
        >
          <Text style={[styles.tabText, tab === 'services' && styles.tabTextActive]}>
            Services ({services.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#003f2f" />
        </View>
      ) : !query ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Tapez pour rechercher</Text>
        </View>
      ) : !hasResults ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucun résultat pour "{query}"</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => runSearch(query)} />
          }
        >
          {tab === 'products'
            ? products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onPress={() => router.push(`/product/${p.id}` as any)}
                />
              ))
            : services.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onPress={() => router.push(`/service/${s.id}` as any)}
                />
              ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 8 },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#003f2f' },
  tabText: { fontSize: 14, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#003f2f', fontWeight: '700' },
  list: { padding: 12, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
});
'''

p = Path("app/search.tsx")
if not p.exists():
    p.write_text(SEARCH_TSX)
    print("[8] app/search.tsx: ecran cree")
else:
    print("[8] app/search.tsx: existe deja")

print("\nFini. Verifie : git diff --stat ; git status")
