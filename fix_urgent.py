#!/usr/bin/env python3
"""
Fix urgent - corrige 4 bugs critiques :

[1 CRASH]    product/[id] + service/[id] : shopStatsData utilise mais
             jamais declare (useState pas injecte par fix precedent).
             => Re-injecter useState + useEffect proprement.
             Cause : "app se ferme quand on clique sur un produit".

[2 CHAT]     chat/[id] : champ texte cache sous nav system Android,
             clavier ne s'ouvre pas. => useSafeAreaInsets + padding bottom.

[3 CAROUSEL] HeroCarousel : button_link de la DB peut etre invalide.
             => Derive la route depuis button_text (Voir les produits ->
             /(tabs)/offers, S'inscrire -> /auth/register, etc.)

[4 VENDEUR]  order-detail : bouton "Contacter le vendeur" reste visible
             cote vendeur. => Detecte via userRole (vendeur/equipe) plutot
             que via shopOwnerId, masque le bouton si vendeur viewing.

A executer a la racine du repo. Idempotent.
"""
import re
import sys
from pathlib import Path

if not Path("package.json").exists():
    print("ERREUR: lance ce script a la racine du repo")
    sys.exit(1)

print("== Fix urgent ==\n")

# ===========================================================================
# [1 CRASH] product/[id].tsx : injecter useState shopStatsData
# ===========================================================================
p = Path("app/product/[id].tsx")
if p.exists():
    txt = p.read_text()
    has_state = re.search(r"const \[shopStatsData,\s*setShopStatsData\]\s*=\s*useState", txt)
    uses_var = "shopStatsData?" in txt or "shopStatsData ?" in txt or "shopStatsData\n" in txt
    if uses_var and not has_state:
        # Anchor : la ligne useEffect pour liveRating
        anchor = "  useEffect(() => {\n    if (id) {\n      fetchAverageRating('product', id as string)\n        .then(setLiveRating)\n        .catch(() => {});\n    }\n  }, [id]);"
        if anchor in txt:
            inject = (
                "  const [shopStatsData, setShopStatsData] = useState<{ avg: number; count: number; total: number } | null>(null);\n\n"
                + anchor
                + "\n\n  useEffect(() => {\n"
                "    const shopId = (product as any)?.shop?.id;\n"
                "    if (!shopId) return;\n"
                "    let cancel = false;\n"
                "    (async () => {\n"
                "      try {\n"
                "        const [reviewsRes, productsRes] = await Promise.all([\n"
                "          supabase.from('shop_reviews').select('rating').eq('shop_id', shopId),\n"
                "          supabase.from('products').select('sales_count', { count: 'exact' }).eq('shop_id', shopId).eq('is_active', true),\n"
                "        ]);\n"
                "        if (cancel) return;\n"
                "        const ratings = (reviewsRes.data || []).map((r: any) => r.rating);\n"
                "        const avg = ratings.length ? ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length : 0;\n"
                "        const count = productsRes.count || 0;\n"
                "        const total = (productsRes.data || []).reduce((s: number, p: any) => s + (p.sales_count || 0), 0);\n"
                "        setShopStatsData({ avg, count, total });\n"
                "      } catch {}\n"
                "    })();\n"
                "    return () => { cancel = true; };\n"
                "  }, [(product as any)?.shop?.id]);"
            )
            txt = txt.replace(anchor, inject, 1)
            p.write_text(txt)
            print("[1 CRASH] product/[id].tsx : useState shopStatsData injecte (CRASH FIXE)")
        else:
            print("[1 CRASH] product/[id].tsx : anchor liveRating introuvable, intervention manuelle")
    elif has_state:
        print("[1 CRASH] product/[id].tsx : deja OK")
    else:
        print("[1 CRASH] product/[id].tsx : pas affecte")

# Service
p = Path("app/service/[id].tsx")
if p.exists():
    txt = p.read_text()
    has_state = re.search(r"const \[shopStatsData,\s*setShopStatsData\]\s*=\s*useState", txt)
    uses_var = "shopStatsData?" in txt or "shopStatsData ?" in txt
    if uses_var and not has_state:
        anchor = "  useEffect(() => {\n    if (id) {\n      fetchAverageRating('service', id as string)\n        .then(setLiveRating)\n        .catch(() => {});\n    }\n  }, [id]);"
        if anchor in txt:
            inject = (
                "  const [shopStatsData, setShopStatsData] = useState<{ avg: number; count: number } | null>(null);\n\n"
                + anchor
                + "\n\n  useEffect(() => {\n"
                "    const shopId = (service as any)?.shop?.id;\n"
                "    if (!shopId) return;\n"
                "    let cancel = false;\n"
                "    (async () => {\n"
                "      try {\n"
                "        const [reviewsRes, servicesRes] = await Promise.all([\n"
                "          supabase.from('shop_reviews').select('rating').eq('shop_id', shopId),\n"
                "          supabase.from('services').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('is_active', true),\n"
                "        ]);\n"
                "        if (cancel) return;\n"
                "        const ratings = (reviewsRes.data || []).map((r: any) => r.rating);\n"
                "        const avg = ratings.length ? ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length : 0;\n"
                "        const count = servicesRes.count || 0;\n"
                "        setShopStatsData({ avg, count });\n"
                "      } catch {}\n"
                "    })();\n"
                "    return () => { cancel = true; };\n"
                "  }, [(service as any)?.shop?.id]);"
            )
            txt = txt.replace(anchor, inject, 1)
            p.write_text(txt)
            print("[1 CRASH] service/[id].tsx : useState shopStatsData injecte (CRASH FIXE)")
        else:
            print("[1 CRASH] service/[id].tsx : anchor introuvable")
    elif has_state:
        print("[1 CRASH] service/[id].tsx : deja OK")

# ===========================================================================
# [2 CHAT] chat/[id] : safe area inset bottom + offset
# ===========================================================================
p = Path("app/chat/[id].tsx")
if p.exists():
    txt = p.read_text()
    if "useSafeAreaInsets" not in txt:
        # Import
        if "import { Stack" in txt:
            txt = re.sub(
                r"(import [^\n]*'expo-router';)",
                r"\1\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';",
                txt, count=1
            )
        # Add insets hook in component (juste apres const router)
        txt = re.sub(
            r"(const router = useRouter\(\);)",
            r"\1\n  const insets = useSafeAreaInsets();",
            txt, count=1
        )
        # KAV: ajouter paddingBottom dynamique via style array
        txt = txt.replace(
            "    <KeyboardAvoidingView\n      style={styles.container}\n      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}\n      keyboardVerticalOffset={0}\n    >",
            "    <KeyboardAvoidingView\n      style={[styles.container, { paddingBottom: insets.bottom }]}\n      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}\n      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}\n    >",
            1,
        )
        p.write_text(txt)
        print("[2 CHAT] chat/[id].tsx : useSafeAreaInsets ajoute + paddingBottom dynamique")
    else:
        print("[2 CHAT] chat/[id].tsx : deja fait")

# ===========================================================================
# [3 CAROUSEL] HeroCarousel : derive route depuis button_text
# ===========================================================================
p = Path("components/HeroCarousel.tsx")
if p.exists():
    txt = p.read_text()
    # Remplace l'onPress actuel par une fonction qui derive la route
    old_onpress = (
        "            onPress={() => {\n"
        "              const link = (card as any).button_link;\n"
        "              if (link) router.push(link as any);\n"
        "            }}"
    )
    new_onpress = (
        "            onPress={() => {\n"
        "              const text = (card.button_text || '').toLowerCase();\n"
        "              const link = (card as any).button_link;\n"
        "              if (text.includes('inscri') || text.includes(\"s'inscri\")) {\n"
        "                router.push('/auth/register' as any);\n"
        "              } else if (text.includes('service')) {\n"
        "                router.push({ pathname: '/(tabs)/offers', params: { tab: 'services' } } as any);\n"
        "              } else if (text.includes('produit')) {\n"
        "                router.push('/(tabs)/offers' as any);\n"
        "              } else if (link && typeof link === 'string' && link.startsWith('/')) {\n"
        "                router.push(link as any);\n"
        "              } else {\n"
        "                router.push('/(tabs)/offers' as any);\n"
        "              }\n"
        "            }}"
    )
    if old_onpress in txt:
        txt = txt.replace(old_onpress, new_onpress, 1)
        p.write_text(txt)
        print("[3 CAROUSEL] HeroCarousel : routes derivees du button_text")
    else:
        # Fallback : peut etre que l'onPress n'est meme pas pose. Verifie + injecte.
        if "router.push" not in txt:
            print("[3 CAROUSEL] HeroCarousel : onPress absent, applique fix_critical d'abord")
        else:
            print("[3 CAROUSEL] HeroCarousel : deja fait OU pattern different")

# Optionnel : accepter `tab` query param dans offers
p = Path("app/(tabs)/offers.tsx")
if p.exists():
    txt = p.read_text()
    if "useLocalSearchParams" not in txt:
        # Import
        txt = re.sub(
            r"import \{ useRouter \} from 'expo-router';",
            "import { useRouter, useLocalSearchParams } from 'expo-router';",
            txt, count=1
        )
        # Si pas d'import du tout
        if "useLocalSearchParams" not in txt and "from 'expo-router'" in txt:
            txt = re.sub(
                r"(import [^\n]*from 'expo-router';)",
                r"\1\nimport { useLocalSearchParams } from 'expo-router';",
                txt, count=1
            )
    # Use param tab pour set initial activeTab
    if "const [activeTab, setActiveTab] = useState<Tab>('products');" in txt and "params.tab" not in txt:
        txt = txt.replace(
            "const [activeTab, setActiveTab] = useState<Tab>('products');",
            "const params = useLocalSearchParams<{ tab?: string }>();\n"
            "  const [activeTab, setActiveTab] = useState<Tab>(\n"
            "    params?.tab === 'services' ? 'services' : 'products'\n"
            "  );",
            1,
        )
        p.write_text(txt)
        print("[3 CAROUSEL] offers.tsx : accepte param ?tab=services")
    else:
        print("[3 CAROUSEL] offers.tsx : deja OK")

# ===========================================================================
# [4 VENDEUR] order-detail : utiliser userRole pour masquer "Contacter vendeur"
# ===========================================================================
p = Path("app/order-detail.tsx")
if p.exists():
    txt = p.read_text()
    # Verifie useAuth importe
    if "userRole" not in txt:
        # Probable que useAuth est deja importe mais sans userRole destructure
        txt = re.sub(
            r"const \{ user \} = useAuth\(\);",
            "const { user, userRole } = useAuth();",
            txt, count=1,
        )
    # Remplace isVendorViewing pour inclure userRole en fallback
    txt = txt.replace(
        "const isVendorViewing = !!user && !!shopOwnerId && user.id === shopOwnerId;",
        "const isVendorViewing = !!user && ((!!shopOwnerId && user.id === shopOwnerId) || userRole === 'vendeur' || userRole === 'equipe');",
        1,
    )
    # Masque le bouton "Contacter le vendeur" si vendeur viewing (pas de bouton vers soi-meme)
    # Au lieu du toggle, on rend conditionnel + masque
    old_btn = (
        "              <TouchableOpacity\n"
        "                style={styles.contactBtn}\n"
        "                onPress={isVendorViewing ? handleContactClient : handleContactVendor}\n"
        "                disabled={contactingVendor}\n"
        "              >\n"
        "                {contactingVendor ? (\n"
        "                  <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n"
        "                ) : (\n"
        "                  <>\n"
        "                    <MessageCircle color=\"#003f2f\" size={16} />\n"
        "                    <Text style={styles.contactBtnText}>{isVendorViewing ? 'Contacter le client' : 'Contacter le vendeur'}</Text>\n"
        "                  </>\n"
        "                )}\n"
        "              </TouchableOpacity>"
    )
    new_btn = (
        "              {isVendorViewing ? (\n"
        "                <TouchableOpacity\n"
        "                  style={styles.contactBtn}\n"
        "                  onPress={handleContactClient}\n"
        "                  disabled={contactingVendor}\n"
        "                >\n"
        "                  {contactingVendor ? (\n"
        "                    <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n"
        "                  ) : (\n"
        "                    <>\n"
        "                      <MessageCircle color=\"#003f2f\" size={16} />\n"
        "                      <Text style={styles.contactBtnText}>Contacter le client</Text>\n"
        "                    </>\n"
        "                  )}\n"
        "                </TouchableOpacity>\n"
        "              ) : (\n"
        "                <TouchableOpacity\n"
        "                  style={styles.contactBtn}\n"
        "                  onPress={handleContactVendor}\n"
        "                  disabled={contactingVendor}\n"
        "                >\n"
        "                  {contactingVendor ? (\n"
        "                    <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n"
        "                  ) : (\n"
        "                    <>\n"
        "                      <MessageCircle color=\"#003f2f\" size={16} />\n"
        "                      <Text style={styles.contactBtnText}>Contacter le vendeur</Text>\n"
        "                    </>\n"
        "                  )}\n"
        "                </TouchableOpacity>\n"
        "              )}"
    )
    if old_btn in txt:
        txt = txt.replace(old_btn, new_btn, 1)
        p.write_text(txt)
        print("[4 VENDEUR] order-detail.tsx : bouton vendeur masque si vendeur, userRole fallback")
    else:
        # Le pattern peut etre deja modifie. Verifie qu'on a juste isVendorViewing avec userRole
        if "userRole === 'vendeur'" in txt:
            p.write_text(txt)
            print("[4 VENDEUR] order-detail.tsx : userRole ajoute (bouton inchange ou deja a jour)")
        else:
            print("[4 VENDEUR] order-detail.tsx : pattern bouton introuvable, verifie manuellement")

print("\nFini. Verifie : git diff --stat")
