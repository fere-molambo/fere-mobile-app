#!/usr/bin/env python3
"""
Fix critique - applique en une passe TOUT ce qui manque :

CASSURES DE MON SCRIPT ACCENTS PRECEDENT (a reverter):
  [BUG-A] CategoryScrollBar.tsx : 'catégories' (variable destructuree) -> 'categories'
          (cause "barre de navigation accueil ne marche pas")
  [BUG-B] ProductFormModal.tsx  : '[catégories, setCategories]' -> '[categories, setCategories]'
  [BUG-C] PersonalInfoTab.tsx   : variable 'téléphone' -> 'telephone'
  [BUG-D] AddTeamMemberModal.tsx: cle 'téléphone:' -> 'contact:' (matche l'edge function)

SESSION 2 (pas encore appliquee) :
  [CAROUSEL] HeroCarousel boutons -> router.push(button_link)
  [6 PHOTO]  bucket 'profile_pictures' -> 'avatars' + path id/id.ext + arrayBuffer
  [9 STATS]  product/[id] + service/[id] : stats hardcodes -> dynamiques
  [10 BACK]  fleche retour -> fallback canGoBack

CANAUX REALTIME (preventif si fix_realtime.py pas applique):
  Tous les channel('xxx') -> channel('xxx-${Date.now()}-${random}')

A executer a la racine du repo (ou se trouve package.json). Idempotent.
"""
import re
import sys
from pathlib import Path

if not Path("package.json").exists():
    print("ERREUR: lance ce script a la racine du repo")
    sys.exit(1)

print("== Fix critique ==\n")

# ===========================================================================
# [BUG-A] CategoryScrollBar : catégories -> categories
# ===========================================================================
p = Path("components/CategoryScrollBar.tsx")
if p.exists():
    txt = p.read_text()
    orig = txt
    txt = txt.replace("catégories", "categories")
    if txt != orig:
        p.write_text(txt)
        print("[BUG-A] CategoryScrollBar.tsx : catégories -> categories (BARRE NAV ACCUEIL FIXED)")
    else:
        print("[BUG-A] CategoryScrollBar : deja fait")

# ===========================================================================
# [BUG-B] ProductFormModal : catégories -> categories
# ===========================================================================
p = Path("components/vendor/ProductFormModal.tsx")
if p.exists():
    txt = p.read_text()
    orig = txt
    txt = txt.replace("catégories", "categories")
    if txt != orig:
        p.write_text(txt)
        print("[BUG-B] ProductFormModal.tsx : catégories -> categories")
    else:
        print("[BUG-B] ProductFormModal : deja fait")

# ===========================================================================
# [BUG-C] PersonalInfoTab : téléphone -> telephone (variable seulement)
# ===========================================================================
p = Path("components/tabs/PersonalInfoTab.tsx")
if p.exists():
    txt = p.read_text()
    orig = txt
    # Remplace seulement l'usage du nom de variable, pas le label UI affiche
    # Pattern: const [téléphone, setTelephone]
    txt = txt.replace("[téléphone, setTelephone]", "[telephone, setTelephone]")
    # Usages : !téléphone.trim() , contact: téléphone , value={téléphone}
    txt = re.sub(r"\btéléphone\.trim\(\)", "telephone.trim()", txt)
    txt = re.sub(r"contact:\s*téléphone\b", "contact: telephone", txt)
    txt = re.sub(r"value=\{téléphone\}", "value={telephone}", txt)
    if txt != orig:
        p.write_text(txt)
        print("[BUG-C] PersonalInfoTab.tsx : variable téléphone -> telephone")
    else:
        print("[BUG-C] PersonalInfoTab : deja fait")

# ===========================================================================
# [BUG-D] AddTeamMemberModal : 'téléphone:' -> 'contact:' (matche edge function)
# ===========================================================================
p = Path("components/vendor/AddTeamMemberModal.tsx")
if p.exists():
    txt = p.read_text()
    orig = txt
    txt = txt.replace("téléphone: phone.trim()", "contact: phone.trim()")
    txt = txt.replace("telephone: phone.trim()", "contact: phone.trim()")
    if txt != orig:
        p.write_text(txt)
        print("[BUG-D] AddTeamMemberModal.tsx : téléphone -> contact (matche edge)")
    else:
        print("[BUG-D] AddTeamMemberModal : deja fait")

# ===========================================================================
# [CAROUSEL] HeroCarousel buttons -> navigate to card.button_link
# ===========================================================================
p = Path("components/HeroCarousel.tsx")
if p.exists():
    txt = p.read_text()
    if "useRouter" not in txt:
        txt = txt.replace(
            "import { supabase } from '@/lib/supabase';",
            "import { useRouter } from 'expo-router';\nimport { supabase } from '@/lib/supabase';",
            1,
        )
        txt = txt.replace(
            "export default function HeroCarousel() {\n  const [heroCards, setHeroCards] = useState<HeroCard[]>([]);",
            "export default function HeroCarousel() {\n  const router = useRouter();\n  const [heroCards, setHeroCards] = useState<HeroCard[]>([]);",
            1,
        )
        txt = txt.replace(
            "          <TouchableOpacity\n            key={index}\n            style={styles.card}\n            activeOpacity={0.9}\n          >",
            "          <TouchableOpacity\n            key={index}\n            style={styles.card}\n            activeOpacity={0.9}\n            onPress={() => {\n              const link = (card as any).button_link;\n              if (link) router.push(link as any);\n            }}\n          >",
            1,
        )
        p.write_text(txt)
        print("[CAROUSEL] HeroCarousel.tsx : boutons cliquables -> router.push(button_link)")
    else:
        print("[CAROUSEL] HeroCarousel : deja fait")

# ===========================================================================
# [6 PHOTO] profile uploads : bucket avatars + path {id}/{id}.{ext} + arrayBuffer
# ===========================================================================
def fix_profile_upload(path):
    p = Path(path)
    if not p.exists():
        return False
    txt = p.read_text()
    orig = txt
    txt = txt.replace(".from('profile_pictures')", ".from('avatars')")
    txt = txt.replace('.from("profile_pictures")', '.from("avatars")')
    txt = re.sub(
        r"const fileName = `\$\{(profile|user)\.id\}_\$\{Date\.now\(\)\}\.\$\{(fileExt|ext)\}`;",
        lambda m: f"const fileName = `${{{m.group(1)}.id}}/${{{m.group(1)}.id}}.${{{m.group(2)}}}`;",
        txt,
    )
    txt = re.sub(
        r"const response = await fetch\(([^)]+)\);\s*\n\s*const blob = await response\.blob\(\);",
        lambda m: f"const arrayBuffer = await fetch({m.group(1)}).then((r) => r.arrayBuffer());",
        txt,
    )
    txt = re.sub(r"\.upload\((\w+),\s*blob,", r".upload(\1, arrayBuffer,", txt)
    txt = re.sub(
        r"`image/\$\{(fileExt|ext)\}`",
        r"`image/${\1 === 'jpg' ? 'jpeg' : \1}`",
        txt,
    )
    # Affiche le vrai message d'erreur Supabase
    txt = txt.replace(
        'alert("Erreur lors de l\'upload de la photo");',
        'alert("Erreur upload: " + (error?.message || "inconnu"));',
    )
    txt = txt.replace(
        "alert('Erreur lors de l\\'upload de la photo');",
        "alert('Erreur upload: ' + (error?.message || 'inconnu'));",
    )
    if txt != orig:
        p.write_text(txt)
        return True
    return False

for f in ["app/settings/profile.tsx", "app/(tabs)/profile.tsx"]:
    if fix_profile_upload(f):
        print(f"[6 PHOTO] {f} : bucket=avatars, path=id/id.ext, arrayBuffer, erreur visible")
    else:
        print(f"[6 PHOTO] {f} : deja fait")

# ===========================================================================
# [9 STATS] product/[id] + service/[id] : stats dynamiques
# ===========================================================================
def fix_product_stats():
    p = Path("app/product/[id].tsx")
    if not p.exists():
        return False
    txt = p.read_text()
    if "shopStatsData" in txt:
        return False  # deja fait
    anchor = "  useEffect(() => {\n    if (id) {\n      fetchProduct();\n    }\n  }, [id]);"
    if anchor in txt:
        inject = (
            "  const [shopStatsData, setShopStatsData] = useState<{ avg: number; count: number; total: number } | null>(null);\n\n"
            "  useEffect(() => {\n"
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
            "  }, [(product as any)?.shop?.id]);\n\n"
            + anchor
        )
        txt = txt.replace(anchor, inject, 1)
    old_block = (
        "                <View style={styles.shopStats}>\n"
        "                  <View style={styles.shopStars}>\n"
        "                    {[1, 2, 3, 4, 5].map((star) => (\n"
        "                      <Star key={star} color=\"#FFB800\" size={14} fill=\"#FFB800\" />\n"
        "                    ))}\n"
        "                  </View>\n"
        "                  <Text style={styles.shopStatsText}>\n"
        "                    4.8 \u2022 156 produits \u2022 1.2k vendus\n"
        "                  </Text>\n"
        "                </View>"
    )
    new_block = (
        "                <View style={styles.shopStats}>\n"
        "                  <View style={styles.shopStars}>\n"
        "                    {[1, 2, 3, 4, 5].map((star) => (\n"
        "                      <Star key={star} color=\"#FFB800\" size={14}\n"
        "                        fill={star <= Math.round(shopStatsData?.avg || 0) ? \"#FFB800\" : \"transparent\"} />\n"
        "                    ))}\n"
        "                  </View>\n"
        "                  <Text style={styles.shopStatsText}>\n"
        "                    {shopStatsData\n"
        "                      ? `${shopStatsData.avg > 0 ? shopStatsData.avg.toFixed(1) + ' \u2022 ' : ''}${shopStatsData.count} produit${shopStatsData.count > 1 ? 's' : ''}${shopStatsData.total > 0 ? ' \u2022 ' + shopStatsData.total + ' vendu' + (shopStatsData.total > 1 ? 's' : '') : ''}`\n"
        "                      : '...'}\n"
        "                  </Text>\n"
        "                </View>"
    )
    if old_block in txt:
        txt = txt.replace(old_block, new_block, 1)
    p.write_text(txt)
    return True

def fix_service_stats():
    p = Path("app/service/[id].tsx")
    if not p.exists():
        return False
    txt = p.read_text()
    if "shopStatsData" in txt:
        return False
    anchor_match = re.search(
        r"  useEffect\(\(\) => \{\n    if \(id\) \{\n      fetchService\(\);\n    \}\n  \}, \[id\]\);", txt
    )
    if anchor_match:
        anchor = anchor_match.group(0)
        inject = (
            "  const [shopStatsData, setShopStatsData] = useState<{ avg: number; count: number } | null>(null);\n\n"
            "  useEffect(() => {\n"
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
            "  }, [(service as any)?.shop?.id]);\n\n"
            + anchor
        )
        txt = txt.replace(anchor, inject, 1)
    old_block = (
        "                <View style={styles.shopStats}>\n"
        "                  <View style={styles.shopStars}>\n"
        "                    {[1, 2, 3, 4, 5].map((star) => (\n"
        "                      <Star key={star} color=\"#FFB800\" size={14} fill=\"#FFB800\" />\n"
        "                    ))}\n"
        "                  </View>\n"
        "                  <Text style={styles.shopStatsText}>\n"
        "                    4.8 \u2022 156 services \u2022 1.2k r\u00e9servations\n"
        "                  </Text>\n"
        "                </View>"
    )
    new_block = (
        "                <View style={styles.shopStats}>\n"
        "                  <View style={styles.shopStars}>\n"
        "                    {[1, 2, 3, 4, 5].map((star) => (\n"
        "                      <Star key={star} color=\"#FFB800\" size={14}\n"
        "                        fill={star <= Math.round(shopStatsData?.avg || 0) ? \"#FFB800\" : \"transparent\"} />\n"
        "                    ))}\n"
        "                  </View>\n"
        "                  <Text style={styles.shopStatsText}>\n"
        "                    {shopStatsData\n"
        "                      ? `${shopStatsData.avg > 0 ? shopStatsData.avg.toFixed(1) + ' \u2022 ' : ''}${shopStatsData.count} service${shopStatsData.count > 1 ? 's' : ''}`\n"
        "                      : '...'}\n"
        "                  </Text>\n"
        "                </View>"
    )
    if old_block in txt:
        txt = txt.replace(old_block, new_block, 1)
    p.write_text(txt)
    return True

if fix_product_stats():
    print("[9 STATS] product/[id].tsx : stats dynamiques")
else:
    print("[9 STATS] product/[id].tsx : deja fait")
if fix_service_stats():
    print("[9 STATS] service/[id].tsx : stats dynamiques")
else:
    print("[9 STATS] service/[id].tsx : deja fait")

# ===========================================================================
# [10 BACK] router.back() -> fallback router.replace('/') si pas d'historique
# ===========================================================================
back_files = [
    "app/product/[id].tsx", "app/service/[id].tsx", "app/shop/[id].tsx",
    "app/order-detail.tsx", "app/booking-detail.tsx",
]
for f in back_files:
    p = Path(f)
    if not p.exists():
        continue
    txt = p.read_text()
    orig = txt
    txt = txt.replace(
        "() => router.back()",
        "() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }",
    )
    if txt != orig:
        p.write_text(txt)
        print(f"[10 BACK] {f} : fallback canGoBack ajoute")

# ===========================================================================
# CHANNELS REALTIME : suffixe unique partout (preventif)
# ===========================================================================
channel_files = [
    "app/booking-detail.tsx", "app/chat/[id].tsx", "app/order-detail.tsx",
    "app/settings/payouts.tsx", "app/settings/transactions.tsx", "app/(tabs)/orders.tsx",
    "components/driver/DriverEarningsScreen.tsx", "components/driver/DriverHomeScreen.tsx",
    "components/chat/DriverChatScreen.tsx", "components/chat/MemberChatScreen.tsx",
    "components/vendor/VendorEarningsScreen.tsx", "components/vendor/VendorHomeScreen.tsx",
    "components/vendor/VendorOrdersScreen.tsx", "hooks/useTrackingSession.ts",
]
SUFFIX = "-${Date.now()}-${Math.random().toString(36).slice(2)}"
re_tpl = re.compile(r"(\.channel\(`)([^`]+?)(`\))")
re_str = re.compile(r"\.channel\('([^']+)'\)")
n_chan = 0
for f in channel_files:
    p = Path(f)
    if not p.exists():
        continue
    t = p.read_text()
    if SUFFIX in t:
        continue
    orig = t
    t = re_tpl.sub(lambda m: f"{m.group(1)}{m.group(2)}{SUFFIX}{m.group(3)}", t)
    t = re_str.sub(lambda m: f".channel(`{m.group(1)}{SUFFIX}`)", t)
    if t != orig:
        p.write_text(t)
        n_chan += 1
print(f"[REALTIME] {n_chan} fichiers patches (suffixe unique sur les canaux)")

# ===========================================================================
# [ADMIN] orders.tsx : utilise RPC get_support_admin_id au lieu d'un SELECT
# ===========================================================================
p = Path("app/(tabs)/orders.tsx")
if p.exists():
    txt = p.read_text()
    if "get_support_admin_id" not in txt:
        old_admin = (
            "      const { data: admins } = await supabase\n"
            "        .from('user_roles')\n"
            "        .select('user_id')\n"
            "        .in('role', ['admin', 'super_admin'])\n"
            "        .limit(1);\n"
            "      const adminId = admins?.[0]?.user_id;"
        )
        new_admin = (
            "      const { data: adminIdResult } = await supabase.rpc('get_support_admin_id');\n"
            "      const adminId = adminIdResult as string | null;"
        )
        if old_admin in txt:
            txt = txt.replace(old_admin, new_admin, 1)
            p.write_text(txt)
            print("[ADMIN] orders.tsx : utilise RPC get_support_admin_id")
        else:
            print("[ADMIN] orders.tsx : pattern introuvable, verifie manuellement")
    else:
        print("[ADMIN] orders.tsx : deja fait")

print("\n=== IMPORTANT ===")
print("Si tu veux que le bouton 'Admin' marche, applique aussi le SQL")
print("dans Supabase Dashboard > SQL Editor : fichier fix_admin_contact.sql")
