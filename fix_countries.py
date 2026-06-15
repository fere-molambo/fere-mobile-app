#!/usr/bin/env python3
"""Finit l'item 6 : pays = Mali + CI, defaut +223."""
import re
from pathlib import Path
import sys

if not Path("package.json").exists():
    print("ERREUR: lance ce script a la racine du repo")
    sys.exit(1)

# Fix PhoneInput
p = Path("components/PhoneInput.tsx")
if p.exists():
    t = p.read_text()
    pat = re.compile(r"const COUNTRY_CODES = \[[^\]]+\];", re.DOTALL)
    new_block = (
        "const COUNTRY_CODES = [\n"
        "  { code: '+223', country: 'Mali', flag: '\\uD83C\\uDDF2\\uD83C\\uDDF1' },\n"
        "  { code: '+225', country: 'Cote d\\'Ivoire', flag: '\\uD83C\\uDDE8\\uD83C\\uDDEE' },\n"
        "];"
    )
    # lambda evite l'interpretation des \u en regex replacement
    t2 = pat.sub(lambda m: new_block, t)
    if t2 != t:
        p.write_text(t2)
        print("  [6] PhoneInput : Mali + CI uniquement")
    else:
        print("  [6] PhoneInput : deja fait")

# Defaut +223 dans les ecrans auth
for f in ["app/auth/login.tsx", "app/auth/register.tsx",
          "app/auth/admin-reset.tsx", "app/auth/reset-pin.tsx"]:
    p = Path(f)
    if not p.exists(): continue
    t = p.read_text()
    n = t.replace("useState('+225')", "useState('+223')")
    if n != t:
        p.write_text(n); print(f"  [6] defaut +223 : {f}")
    else:
        print(f"  [6] deja fait : {f}")

print("\nFini. git diff --stat pour verifier.")
