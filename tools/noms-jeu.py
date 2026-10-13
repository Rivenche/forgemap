#!/usr/bin/env python3
"""ForgeMap: i18n-work/_noms-jeu.json (prefab -> official {en, fr} names, read from the game's
own files) -> WebMap/web/js/lang/noms.js, the table I18N.name() reads. fr null = the game has
no French for it either, so the English name shows."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = json.loads((ROOT / "i18n-work" / "_noms-jeu.json").read_text(encoding="utf-8"))
rows = {}
for prefab, n in sorted(src.items()):
    en, fr = n.get("en"), n.get("fr")
    if not en:
        continue
    rows[prefab] = [en] if not fr or fr == en else [en, fr]
out = ROOT / "WebMap" / "web" / "js" / "lang" / "noms.js"
body = ",\n".join(json.dumps(k, ensure_ascii=False) + ":" + json.dumps(v, ensure_ascii=False) for k, v in rows.items())
out.write_text("// ForgeMap -- Valheim's own names for its items, creatures and build pieces, English and French,\n"
               "// read from the game's files by tools (see tools/noms-jeu.py). Prefab -> [en, fr]; no fr: the game has none.\n"
               "I18N.addNames({\n" + body + "\n});\n", encoding="utf-8", newline="\n")
print(len(rows), "names ->", out.relative_to(ROOT), out.stat().st_size, "bytes")
