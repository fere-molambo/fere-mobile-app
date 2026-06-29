#!/usr/bin/env python3
"""
Fix contact rules - reecrit la logique de contact selon le role :

PRODUIT (order-detail.tsx) :
  - Vendeur  -> [Contacter le livreur (si assigne)] + [Contacter l'admin]
  - Client   -> [Contacter le livreur (si assigne)] + [Contacter l'admin]
  - Livreur  -> [Contacter le client] + [Contacter le vendeur] + [Contacter l'admin]
  PAS de contact direct vendeur <-> client (passe par le livreur).

SERVICE (booking-detail.tsx) :
  - Vendeur (prestataire) -> [Contacter le client] uniquement
  - Client                -> [Contacter le prestataire]
  PAS de livreur (service direct).

UTILISE LE RPC `get_support_admin_id` deja cree (voir fix_admin_contact.sql).
A executer a la racine du repo. Idempotent (detecte handleContactAdmin).
"""
import re
import sys
from pathlib import Path

if not Path("package.json").exists():
    print("ERREUR: lance ce script a la racine du repo")
    sys.exit(1)

print("== Fix contact rules ==\n")

# ===========================================================================
# order-detail.tsx
# ===========================================================================
p = Path("app/order-detail.tsx")
if p.exists():
    txt = p.read_text()
    if "handleContactAdmin" in txt:
        print("[ORDER] deja fait")
    else:
        # 1) Ajouter userRole et isDriver/isClient
        # userRole peut deja etre destructure ou pas
        if "user, userRole" not in txt:
            txt = re.sub(
                r"const \{ user \} = useAuth\(\);",
                "const { user, userRole } = useAuth();",
                txt, count=1,
            )

        # 2) Remplacer isVendorViewing par 3 booleens
        old_role = re.search(
            r"  const isVendorViewing = !!user && [^;]+;", txt
        )
        new_role = (
            "  const isVendor = !!user && ((!!shopOwnerId && user.id === shopOwnerId) || userRole === 'vendeur' || userRole === 'equipe');\n"
            "  const isDriver = userRole === 'livreur';\n"
            "  const isClient = !isVendor && !isDriver;"
        )
        if old_role:
            txt = txt.replace(old_role.group(0), new_role, 1)
        elif "const isVendor = " not in txt:
            # Fallback : ajouter apres shopOwnerId state
            txt = txt.replace(
                "  const [shopOwnerId, setShopOwnerId] = useState<string | null>(null);",
                "  const [shopOwnerId, setShopOwnerId] = useState<string | null>(null);\n" + new_role,
                1,
            )

        # 3) Ajouter handleContactAdmin apres handleContactVendor
        if "handleContactAdmin" not in txt:
            # On cherche la fin de handleContactVendor (qui se termine par "}, [...]);")
            # Insertion juste apres
            anchor_admin = re.search(
                r"(  const handleContactVendor = useCallback\(async \(\) => \{[\s\S]+?\}, \[[^\]]+\]\);)",
                txt
            )
            if anchor_admin:
                admin_fn = (
                    "\n\n  const [contactingAdmin, setContactingAdmin] = useState(false);\n"
                    "  const handleContactAdmin = useCallback(async () => {\n"
                    "    if (!user || contactingAdmin) return;\n"
                    "    setContactingAdmin(true);\n"
                    "    try {\n"
                    "      const { data: adminIdResult } = await supabase.rpc('get_support_admin_id');\n"
                    "      const adminId = adminIdResult as string | null;\n"
                    "      if (!adminId) {\n"
                    "        Alert.alert('Admin indisponible', \"Aucun administrateur n'est disponible pour le moment.\");\n"
                    "        return;\n"
                    "      }\n"
                    "      const convoId = await startConversation(user.id, adminId);\n"
                    "      router.push(`/chat/${convoId}` as any);\n"
                    "    } catch {\n"
                    "      Alert.alert('Erreur', \"Impossible d'ouvrir la conversation.\");\n"
                    "    } finally {\n"
                    "      setContactingAdmin(false);\n"
                    "    }\n"
                    "  }, [user, contactingAdmin, router]);"
                )
                txt = txt.replace(
                    anchor_admin.group(1),
                    anchor_admin.group(1) + admin_fn,
                    1,
                )

        # 4) Remplacer toute la section Contact
        # Cherche depuis <Text...sectionTitle>Contact</Text> jusqu'a la fermeture de contactBtnsRow
        section_re = re.compile(
            r"(            <Text style=\{styles\.sectionTitle\}>Contact</Text>\s*\n)"
            r"            <View style=\{styles\.contactBtnsRow\}>[\s\S]+?\n            </View>",
        )
        m = section_re.search(txt)
        if m:
            new_section = (
                m.group(1) +
                "            <View style={styles.contactBtnsRow}>\n"
                "              {isDriver && (\n"
                "                <>\n"
                "                  <TouchableOpacity\n"
                "                    style={styles.contactBtn}\n"
                "                    onPress={handleContactClient}\n"
                "                    disabled={contactingVendor}\n"
                "                  >\n"
                "                    {contactingVendor ? (\n"
                "                      <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n"
                "                    ) : (\n"
                "                      <>\n"
                "                        <MessageCircle color=\"#003f2f\" size={16} />\n"
                "                        <Text style={styles.contactBtnText}>Contacter le client</Text>\n"
                "                      </>\n"
                "                    )}\n"
                "                  </TouchableOpacity>\n"
                "                  <TouchableOpacity\n"
                "                    style={styles.contactBtn}\n"
                "                    onPress={handleContactVendor}\n"
                "                    disabled={contactingVendor}\n"
                "                  >\n"
                "                    <MessageCircle color=\"#003f2f\" size={16} />\n"
                "                    <Text style={styles.contactBtnText}>Contacter le vendeur</Text>\n"
                "                  </TouchableOpacity>\n"
                "                </>\n"
                "              )}\n"
                "              {!isDriver && delivery && delivery.driver_id && !['delivered', 'cancelled'].includes(delivery.status) && (\n"
                "                <TouchableOpacity\n"
                "                  style={styles.contactBtn}\n"
                "                  onPress={handleContactDriver}\n"
                "                  disabled={contactingDriver}\n"
                "                >\n"
                "                  {contactingDriver ? (\n"
                "                    <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n"
                "                  ) : (\n"
                "                    <>\n"
                "                      <MessageCircle color=\"#003f2f\" size={16} />\n"
                "                      <Text style={styles.contactBtnText}>Contacter le livreur</Text>\n"
                "                    </>\n"
                "                  )}\n"
                "                </TouchableOpacity>\n"
                "              )}\n"
                "              <TouchableOpacity\n"
                "                style={styles.contactBtn}\n"
                "                onPress={handleContactAdmin}\n"
                "                disabled={contactingAdmin}\n"
                "              >\n"
                "                {contactingAdmin ? (\n"
                "                  <ActivityIndicator size=\"small\" color=\"#003f2f\" />\n"
                "                ) : (\n"
                "                  <>\n"
                "                    <MessageCircle color=\"#003f2f\" size={16} />\n"
                "                    <Text style={styles.contactBtnText}>Contacter l'admin</Text>\n"
                "                  </>\n"
                "                )}\n"
                "              </TouchableOpacity>\n"
                "            </View>"
            )
            txt = section_re.sub(new_section, txt, count=1)
            p.write_text(txt)
            print("[ORDER] order-detail.tsx : section Contact reecrite (3 roles + admin)")
        else:
            p.write_text(txt)
            print("[ORDER] order-detail.tsx : section Contact pattern introuvable, partial")

# ===========================================================================
# booking-detail.tsx
# ===========================================================================
p = Path("app/booking-detail.tsx")
if p.exists():
    txt = p.read_text()
    if "handleContactClient" in txt:
        print("[BOOKING] deja fait")
    else:
        # 1) destructure userRole
        if "user, userRole" not in txt:
            txt = re.sub(
                r"const \{ user \} = useAuth\(\);",
                "const { user, userRole } = useAuth();",
                txt, count=1,
            )

        # 2) Ajouter handleContactClient + isVendor
        # Anchor : la fonction handleContact existante
        anchor = "  const handleContact = async () => {\n    if (!user || !vendorProfile) return;\n    try {\n      const convoId = await startConversation(user.id, vendorProfile.id);\n      router.push({ pathname: '/chat/[id]', params: { id: convoId } });\n    } catch {}\n  };"
        if anchor in txt:
            new_block = (
                "  const isVendor = !!user && !!vendorProfile && (user.id === vendorProfile.id || userRole === 'vendeur' || userRole === 'equipe');\n\n"
                + anchor + "\n\n"
                "  const handleContactClient = async () => {\n"
                "    if (!user) return;\n"
                "    const customerId = (booking as any)?.customer?.id || (booking as any)?.customer_id;\n"
                "    if (!customerId) return;\n"
                "    try {\n"
                "      const convoId = await startConversation(user.id, customerId);\n"
                "      router.push({ pathname: '/chat/[id]', params: { id: convoId } });\n"
                "    } catch {}\n"
                "  };"
            )
            txt = txt.replace(anchor, new_block, 1)

        # 3) Remplacer le bouton "Contacter le prestataire" par logique role
        old_btn = (
            "            <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>\n"
            "              <MessageCircle color=\"#003f2f\" size={18} />\n"
            "              <Text style={styles.contactBtnText}>Contacter le prestataire</Text>\n"
            "            </TouchableOpacity>"
        )
        new_btn = (
            "            {isVendor ? (\n"
            "              <TouchableOpacity style={styles.contactBtn} onPress={handleContactClient}>\n"
            "                <MessageCircle color=\"#003f2f\" size={18} />\n"
            "                <Text style={styles.contactBtnText}>Contacter le client</Text>\n"
            "              </TouchableOpacity>\n"
            "            ) : (\n"
            "              <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>\n"
            "                <MessageCircle color=\"#003f2f\" size={18} />\n"
            "                <Text style={styles.contactBtnText}>Contacter le prestataire</Text>\n"
            "              </TouchableOpacity>\n"
            "            )}"
        )
        if old_btn in txt:
            txt = txt.replace(old_btn, new_btn, 1)
            # Si vendor : on cache aussi la carte "Prestataire" (pas de sens pour le vendeur)
            # On wrap la condition autour de la card entiere ? Trop complexe.
            # Solution simpler: garder la card mais cacher seulement le bouton + label
            # Actuellement on a deja fait : le bouton change. La carte montre le prestataire.
            # Pour le vendeur, voir sa propre fiche n'a pas grand interet mais ce n'est pas grave.
            p.write_text(txt)
            print("[BOOKING] booking-detail.tsx : bouton selon role (vendeur=client, client=prestataire)")
        else:
            p.write_text(txt)
            print("[BOOKING] booking-detail.tsx : pattern bouton introuvable")

print("\nFini. Verifie : git diff --stat")
