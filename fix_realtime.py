#!/usr/bin/env python3
"""
Fix les crashs Supabase Realtime "cannot add postgres_changes callbacks after subscribe()".
À exécuter à la racine du repo fere-mobile-app (où se trouve package.json).

Ce script ajoute un suffixe unique (timestamp + random) à chaque nom de canal Supabase
pour éviter la réutilisation d'un canal déjà subscribed lors du remount d'un composant.
"""
import re
import sys
from pathlib import Path

FILES = [
    "app/booking-detail.tsx",
    "app/chat/[id].tsx",
    "app/order-detail.tsx",
    "app/settings/payouts.tsx",
    "app/settings/transactions.tsx",
    "app/(tabs)/orders.tsx",
    "components/driver/DriverEarningsScreen.tsx",
    "components/driver/DriverHomeScreen.tsx",
    "components/chat/DriverChatScreen.tsx",
    "components/chat/MemberChatScreen.tsx",
    "components/vendor/VendorEarningsScreen.tsx",
    "components/vendor/VendorHomeScreen.tsx",
    "components/vendor/VendorOrdersScreen.tsx",
]

SUFFIX = "-${Date.now()}-${Math.random().toString(36).slice(2)}"

# Template literal:  .channel(`name-${x}`)  -> ajoute le suffixe avant le backtick fermant
re_tpl = re.compile(r"(\.channel\(`)([^`]+?)(`\))")
# String simple:     .channel('name')       -> convertit en template literal + suffixe
re_str = re.compile(r"\.channel\('([^']+)'\)")

if not Path("package.json").exists():
    print("ERREUR: Lance ce script à la racine du repo (où se trouve package.json).")
    sys.exit(1)

total = 0
for f in FILES:
    p = Path(f)
    if not p.exists():
        print(f"  SKIP (introuvable) : {f}")
        continue
    txt = p.read_text()
    orig = txt
    # Skip si déjà patché
    if SUFFIX in txt:
        print(f"  DÉJÀ FIX : {f}")
        continue
    txt = re_tpl.sub(lambda m: f"{m.group(1)}{m.group(2)}{SUFFIX}{m.group(3)}", txt)
    txt = re_str.sub(lambda m: f".channel(`{m.group(1)}{SUFFIX}`)", txt)
    if txt != orig:
        p.write_text(txt)
        n = sum(1 for _ in re.finditer(r"\.channel\(", orig))
        total += n
        print(f"  FIX : {f}  ({n} canal/canaux)")
    else:
        print(f"  RIEN À FAIRE : {f}")

print(f"\nTerminé. {total} canaux corrigés.")
print("Vérifie avec : git diff --stat")
