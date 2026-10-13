#!/usr/bin/env python3
"""ForgeMap: merge i18n-work/*.json (English key -> French) into WebMap/web/js/lang/fr.js.

A key translated differently by two files is reported; the first file (sorted by name)
wins unless i18n-work/_choix.json settles it. Keys are written sorted, one per line.
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORK = ROOT / "i18n-work"
OUT = ROOT / "WebMap" / "web" / "js" / "lang" / "fr.js"

choix = {}
if (WORK / "_choix.json").exists():
    choix = json.loads((WORK / "_choix.json").read_text(encoding="utf-8"))
table, origine, conflits = {}, {}, []
for f in sorted(WORK.glob("*.json")):
    if f.name.startswith("_"):
        continue
    for k, v in json.loads(f.read_text(encoding="utf-8")).items():
        if k in table and table[k] != v and k not in choix:
            conflits.append((k, origine[k], table[k], f.name, v))
            continue
        table.setdefault(k, v)
        origine.setdefault(k, f.name)
table.update(choix)
lignes = ["// ForgeMap -- French. Generated from i18n-work/*.json by tools/i18n-merge.py: edit those, then rerun.",
          "// Keys are the English source text, exactly as the code writes it.",
          'I18N.add("fr", {']
for k in sorted(table):
    lignes.append("  " + json.dumps(k, ensure_ascii=False) + ": " + json.dumps(table[k], ensure_ascii=False) + ",")
lignes.append("});")
OUT.write_text("\n".join(lignes) + "\n", encoding="utf-8", newline="\n")
print(f"{len(table)} keys -> {OUT.relative_to(ROOT)}")
for k, f1, v1, f2, v2 in conflits:
    print(f"CONFLICT {k!r}: {f1}={v1!r} / {f2}={v2!r}")
sys.exit(0)
