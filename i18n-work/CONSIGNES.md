# ForgeMap — translation brief (read fully before editing)

ForgeMap is ForgeServer.fr's fork of the Valheim WebMap mod (MIT). The web viewer lives in
`WebMap/web/`. We make it bilingual **French / English**. English stays the source language.

## The API (already written: `WebMap/web/js/i18n.js`, loaded first on every page)

- `I18N.t("English text", {var: value})` → translated string; `{name}` placeholders are filled.
- `I18N.tn(n, "{n} piece", "{n} pieces", {...})` → plural by n (`{n}` is filled, already number-formatted).
- `I18N.num(n)`, `I18N.date(d, opts)`, `I18N.time(d)`, `I18N.datetime(d)` → locale formatting.
  Replace `x.toLocaleString()` on numbers by `I18N.num(x)`, `toLocaleTimeString()` by `I18N.time(...)`,
  `toLocaleDateString(undefined, o)` by `I18N.date(d, o)`, `toLocaleString()` on dates by `I18N.datetime(d)`.
- `I18N.lang` is `"fr"` or `"en"`.
- Static HTML text is translated automatically at DOMContentLoaded by exact match of each text node
  (whitespace collapsed + trimmed), plus attributes `title`, `placeholder`, `aria-label`, `alt`, and the
  meta description. **For a static element whose sentence contains inline markup** (`<b>`, `<a>`, `<kbd>`…),
  add the attribute `data-i18n` to that element: its whole innerHTML (whitespace collapsed to single
  spaces, trimmed) becomes the key and the value is the translated HTML (keep the same tags/attributes).
  Put `data-i18n` on the smallest element that holds the whole sentence (a `<p>`, `<li>`, `<span>`).

## What you do, for each file assigned to you

1. Wrap **every user-visible English string built in JavaScript** with `I18N.t(...)` / `I18N.tn(...)`:
   template literals, concatenations, `textContent`, `title=` in generated markup, `alert/confirm`, captions,
   tooltips, units shown to users ("km", "min ago"…), labels in arrays/objects used for display.
   - Turn concatenations into one template key with placeholders: `n + " pieces built"` →
     `I18N.tn(n, "{n} piece built", "{n} pieces built")`. Never split a sentence into fragments translated
     separately when word order may change in French.
   - When a string mixes markup and text, the key can contain the markup: `I18N.t("<b>{n}</b> deaths", {n})`.
   - Do NOT translate: CSS classes, ids, data keys, API paths, URL hashes, `localStorage` keys, prefab ids,
     console messages, code comments, values compared in code (`if(kind === "Mountain")`): translate only at
     the moment of display. If a display label is also used as a lookup key, add a separate display step.
   - Player names, world names, place names typed by players: never translated.
   - Item / creature names coming from the server data: leave as they are (a later step handles them).
2. Static HTML text: check that each visible text node is a whole sentence/label; add `data-i18n` where a
   sentence carries inline markup. Nothing to wrap otherwise.
3. Write the French table for everything you made translatable in a JSON file
   `i18n-work/<your-group>.json`: `{ "English key exactly as in code": "French" , ... }`.
   Keys must match the code byte for byte (after whitespace collapse for HTML keys). Valid JSON, UTF-8.
   Include static HTML texts and attribute texts too (exact trimmed text as key).
4. Keep the code working: no syntax errors (run `node --check` on every .js you touch; for .html, extract
   inline scripts mentally — be careful with quotes and backticks). Do not change behaviour, layout, or
   anything not related to text. Do not reformat code. Do not touch files outside your list, nor
   `js/i18n.js`, `js/lang/*`, `site.css`.

## French style (ForgeServer house style)

- Tutoiement ("tu"), friendly and short, natural French — not a word-for-word calque. Typographic
  French: space before `:` `;` `?` `!` is a normal space (we don't use NBSP), « guillemets » optional,
  decimal comma comes from I18N.num. No emojis.
- Keep it as short as the English where the UI is tight (buttons, column headers, chart labels).
- Valheim official French terms: Meadows = Prairies, Black Forest = Forêt noire, Swamp = Marais,
  Mountain(s) = Montagnes, Plains = Plaines, Ocean = Océan, Mistlands = Terres brumeuses,
  Ashlands = Terres cendrées, Deep North = Grand Nord. Bosses: keep Eikthyr, Moder, Yagluth, Fader,
  Bonemass as names; The Elder = L'Ancien; The Queen = La Reine. Portal = portail, workbench = établi,
  forge = forge, cultivator = cultivateur, hoe = houe, pickaxe = pioche, tombstone/grave = tombe,
  build piece = pièce de construction, cart = chariot, longship = drakkar, karve = karve,
  raft = radeau, trader = marchand (Haldor, Hildir, Bog Witch = la sorcière des marais),
  biome = biome, boss = boss, fog of war = brouillard, pin = repère, map = carte, world = monde,
  player = joueur, death = mort, kill = victime / ennemi tué, mead = hydromel, skill = compétence,
  base = base, dungeon = donjon, stamina = endurance, health = santé, Eitr = Eitr.
- Page names in the top bar: Map = Carte, World = Monde, Portals = Portails, Players = Joueurs, Plan = Plan.
- "Settings (admin)" = "Réglages (admin)".

## Report back

A short summary: files changed, number of keys, anything you left in English on purpose and why,
and any doubt. Don't paste the whole JSON in your answer.
