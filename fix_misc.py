#!/usr/bin/env python3
"""
Applique en une passe les fixes :
- 1: allowsEditing: true -> false (le crop natif sans bouton confirm est evite)
- 2: PRODUCT_TYPES aligne sur la contrainte DB (fragile/lourd/inflammable/autre)
- 3: ProductFormModal -> KeyboardAvoidingView + input hex pour color picker custom
- 5: 'Fere' -> 'FERE' dans tous les textes affiches
- 6: Liste pays = Mali + CI uniquement, defaut +223

A executer a la racine du repo fere-mobile-app.
"""
import re
from pathlib import Path
import sys

if not Path("package.json").exists():
    print("ERREUR: lance ce script a la racine du repo (ou se trouve package.json)")
    sys.exit(1)

# ============== FIX 1 + 5 ==============
files_imagepicker = [
    "app/settings/profile.tsx", "app/(tabs)/profile.tsx",
    "components/tabs/IdentityTab.tsx",
    "components/vendor/ServiceFormModal.tsx",
    "components/vendor/VendorShopScreen.tsx",
    "components/vendor/ProductFormModal.tsx",
]
fere_files = [
    "app/auth/register.tsx", "app/auth/login.tsx",
    "app/settings/orders.tsx", "app/settings/legal.tsx", "app/settings/faq.tsx",
    "app/(tabs)/profile.tsx",
    "components/DeleteAccountModal.tsx",
    "components/vendor/VendorShopScreen.tsx",
]
for f in files_imagepicker:
    p = Path(f)
    if not p.exists(): continue
    t = p.read_text(); o = t
    t = re.sub(r"allowsEditing:\s*true", "allowsEditing: false", t)
    t = re.sub(r"\s*aspect:\s*\[[^\]]+\],?\n", "\n", t)
    if t != o:
        p.write_text(t); print(f"  [1] allowsEditing -> false : {f}")
for f in fere_files:
    p = Path(f)
    if not p.exists(): continue
    t = p.read_text(); o = t
    t = re.sub(r"\bFere\b", "FERE", t)
    if t != o:
        p.write_text(t); print(f"  [5] Fere -> FERE : {f}")

# ============== FIX 2: PRODUCT_TYPES ==============
p = Path("components/vendor/ProductFormModal.tsx")
if p.exists():
    t = p.read_text()
    pat = re.compile(r"const PRODUCT_TYPES = \[[^\]]+\];", re.DOTALL)
    if pat.search(t):
        new_block = """const PRODUCT_TYPES = [
  { value: 'fragile', label: 'Fragile' },
  { value: 'lourd', label: 'Lourd' },
  { value: 'inflammable', label: 'Inflammable' },
  { value: 'autre', label: 'Autre' },
];"""
        t2 = pat.sub(new_block, t)
        if t2 != t:
            p.write_text(t2); print("  [2] PRODUCT_TYPES aligne sur DB : components/vendor/ProductFormModal.tsx")

# ============== FIX 3: KeyboardAvoidingView + input hex ==============
p = Path("components/vendor/ProductFormModal.tsx")
if p.exists():
    t = p.read_text()
    # Imports
    if "KeyboardAvoidingView" not in t:
        t = t.replace(
            "Modal, ActivityIndicator, Switch, Image, Platform,",
            "Modal, ActivityIndicator, Switch, Image, Platform, KeyboardAvoidingView,",
            1,
        )
    # Wrapping
    if "<KeyboardAvoidingView" not in t:
        t = t.replace(
            '<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">\n      <View style={styles.container}>',
            '<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">\n      <KeyboardAvoidingView\n        style={{ flex: 1 }}\n        behavior={Platform.OS === \'ios\' ? \'padding\' : \'height\'}\n        keyboardVerticalOffset={0}\n      >\n      <View style={styles.container}>',
            1,
        )
        t = t.replace(
            "          <View style={{ height: 40 }} />\n        </ScrollView>\n      </View>\n    </Modal>",
            "          <View style={{ height: 40 }} />\n        </ScrollView>\n      </View>\n      </KeyboardAvoidingView>\n    </Modal>",
            1,
        )
    # Input hex custom color
    old_row = (
        "            <Text style={styles.subLabel}>Personnalisee</Text>\n"
        "            <View style={styles.customColorRow}>\n"
        "              <View style={[styles.colorPreviewBox, { backgroundColor: customColorHex }]} />\n"
        "              <TextInput\n"
        "                style={[styles.input, styles.colorInput]}\n"
        "                value={customColorName}\n"
        "                onChangeText={setCustomColorName}\n"
        "                placeholder=\"Nom (optionnel)\"\n"
        "                placeholderTextColor=\"#9ca3af\"\n"
        "              />\n"
        "              <TouchableOpacity style={styles.addColorBtn} onPress={addCustomColor}>\n"
        "                <Plus size={18} color=\"#003f2f\" />\n"
        "              </TouchableOpacity>\n"
        "            </View>"
    )
    new_row = (
        "            <Text style={styles.subLabel}>Personnalisee</Text>\n"
        "            <View style={styles.customColorRow}>\n"
        "              <View style={[styles.colorPreviewBox, { backgroundColor: customColorHex }]} />\n"
        "              <TextInput\n"
        "                style={[styles.input, styles.colorHexInput]}\n"
        "                value={customColorHex}\n"
        "                onChangeText={(v) => {\n"
        "                  let h = v.trim();\n"
        "                  if (h && !h.startsWith('#')) h = '#' + h;\n"
        "                  setCustomColorHex(h.slice(0, 7).toUpperCase());\n"
        "                }}\n"
        "                placeholder=\"#000000\"\n"
        "                placeholderTextColor=\"#9ca3af\"\n"
        "                autoCapitalize=\"characters\"\n"
        "                maxLength={7}\n"
        "              />\n"
        "              <TextInput\n"
        "                style={[styles.input, styles.colorInput]}\n"
        "                value={customColorName}\n"
        "                onChangeText={setCustomColorName}\n"
        "                placeholder=\"Nom (optionnel)\"\n"
        "                placeholderTextColor=\"#9ca3af\"\n"
        "              />\n"
        "              <TouchableOpacity style={styles.addColorBtn} onPress={addCustomColor}>\n"
        "                <Plus size={18} color=\"#003f2f\" />\n"
        "              </TouchableOpacity>\n"
        "            </View>"
    )
    if old_row in t:
        t = t.replace(old_row, new_row, 1)
    # Style colorHexInput
    if "colorHexInput:" not in t:
        t = t.replace(
            "colorInput: { flex: 1 },",
            "colorInput: { flex: 1 },\n  colorHexInput: { width: 90, fontSize: 13 },",
            1,
        )
    p.write_text(t)
    print("  [3] KeyboardAvoidingView + input hex couleur : components/vendor/ProductFormModal.tsx")

# ============== FIX 6: Pays Mali (1er) + CI uniquement, defaut +223 ==============
p = Path("components/PhoneInput.tsx")
if p.exists():
    t = p.read_text()
    pat = re.compile(r"const COUNTRY_CODES = \[[^\]]+\];", re.DOTALL)
    if pat.search(t):
        new_block = (
            "const COUNTRY_CODES = [\n"
            "  { code: '+223', country: 'Mali', flag: '\\uD83C\\uDDF2\\uD83C\\uDDF1' },\n"
            "  { code: '+225', country: 'Cote d\\'Ivoire', flag: '\\uD83C\\uDDE8\\uD83C\\uDDEE' },\n"
            "];"
        )
        t2 = pat.sub(new_block, t)
        if t2 != t:
            p.write_text(t2); print("  [6] COUNTRY_CODES = Mali + CI : components/PhoneInput.tsx")
for f in ["app/auth/login.tsx", "app/auth/register.tsx", "app/auth/admin-reset.tsx", "app/auth/reset-pin.tsx"]:
    p = Path(f)
    if not p.exists(): continue
    t = p.read_text(); o = t
    t = t.replace("useState('+225')", "useState('+223')")
    if t != o:
        p.write_text(t); print(f"  [6] defaut +223 : {f}")

print("\nTermine. Verifie avec : git diff --stat")
