# ForgeMap

**FR** · La carte web en direct de ton monde Valheim, **en français et en anglais**, par
[ForgeServer.fr](https://forgeserver.fr). Mod **côté serveur uniquement** : les joueurs
n'installent rien, ils ouvrent un lien dans leur navigateur.

**EN** · A live web map of your Valheim world, **in French and English**, by
[ForgeServer.fr](https://forgeserver.fr). **Server-side only**: players install nothing,
they open a link in their browser.

ForgeMap is a fork of [WebMap](https://github.com/hunter-jsb/valheim-webmap) (MIT), with
ForgeServer's look and a full French translation. Free, for the whole community.

---

## Français

### Ce que tu vois sur la carte

* La carte du monde avec le **brouillard partagé** : seulement ce que les joueurs ont exploré.
* Les **joueurs en direct**, leurs constructions, les portails, les bateaux, les chariots,
  les tombes et les marchands.
* Les **noms des lieux** (îles, montagnes, lacs, rivières) et les chemins les plus pratiqués.
* **Le monde en 3D** : pose le petit bonhomme sur un endroit déjà parcouru, comme dans
  Street View.
* Les pages **Monde** (records, terres, boss), **Portails** (l'atlas des portails),
  **Joueurs** (statistiques, classe, et le personnage en 3D avec son équipement) et **Plan**
  (dessiner et partager des itinéraires).
* Le bouton **FR / EN** en haut à droite change la langue ; par défaut, celle du navigateur.

### Installation

1. Installe [BepInExPack Valheim](https://thunderstore.io/c/valheim/p/denikson/BepInExPack_Valheim/)
   sur ton **serveur dédié**.
2. Copie le contenu de l'archive dans `BepInEx/plugins/ForgeMap/` (les fichiers `WebMap.dll`
   et `websocket-sharp.dll`, et le dossier `web`).
3. Démarre le serveur, ouvre le port configuré (3000 par défaut) et va sur
   `http://ip_du_serveur:3000`.

Tu es chez [ForgeServer.fr](https://forgeserver.fr) ? Rien à faire : la carte s'installe en
un clic depuis L'Atelier (onglet Mods, « Carte en direct »).

> ForgeMap remplace WebMap : n'installe pas les deux en même temps. Ta configuration
> WebMap (`com.github.h0tw1r3.valheim.webmap.cfg`) est reprise telle quelle. Pour garder la
> carte déjà explorée, les repères et les réglages du site, déplace aussi le dossier
> `map_data` (et `announce.token` s'il existe) de l'ancien dossier de WebMap vers celui de
> ForgeMap : ils sont rangés à côté de `WebMap.dll`.

---

## English

### What the map shows

* The world map with a **shared fog of war**: only what players have explored.
* **Live players**, their builds, portals, ships, carts, graves and traders.
* **Place names** (islands, ranges, lakes, rivers) and the most walked trails.
* **The world in 3D**: drop the little figure on any walked spot, as in Street View.
* The **World** (records, lands, bosses), **Portals** (the portal atlas), **Players** (stats,
  class, and the player in 3D with their gear) and **Plan** (draw and share routes) pages.
* The **FR / EN** switch at the top right changes the language; the browser's by default.

### Install

1. Install [BepInExPack Valheim](https://thunderstore.io/c/valheim/p/denikson/BepInExPack_Valheim/)
   on your **dedicated server**.
2. Copy the archive's content into `BepInEx/plugins/ForgeMap/` (`WebMap.dll`,
   `websocket-sharp.dll` and the `web` folder).
3. Start the server, open the configured port (3000 by default) and browse to
   `http://server_ip:3000`.

> ForgeMap replaces WebMap: don't install both. Your WebMap configuration
> (`com.github.h0tw1r3.valheim.webmap.cfg`) is kept as it is. To keep the explored map, the
> pins and the site's settings, also move the `map_data` folder (and `announce.token` if
> there is one) from the old WebMap folder to ForgeMap's: they live beside `WebMap.dll`.

The full documentation of every feature, route and setting (English) is in
[README-WebMap.md](README-WebMap.md).

---

## Credits / Crédits

* **ForgeMap** — French translation, ForgeServer look: [ForgeServer.fr](https://forgeserver.fr)
* Based on **WebMap** — 1.0 update, structures, forest, portals, 3D and much more by
  [Hunter Boyd](https://github.com/hunterjsb); maintained upstream by
  [Jeff Clark](https://github.com/h0tw1r3); original work by
  [Kyle Paulsen](https://github.com/kylepaulsen)
* The 3D view's model export, asset readers, world objects and sky are ported from
  [f00d4tehg0dz/valheim-webmap](https://github.com/f00d4tehg0dz/valheim-webmap) (MIT)
* [three.js](https://threejs.org) r180 (MIT), vendored under `web/vendor/three`
* [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License 1.1), `web/fonts`
* [websocket-sharp](https://github.com/sta/websocket-sharp) by sta.blockhead (MIT),
  `websocket-sharp.dll`
* Earlier WebMap versions' page background (`tile.webp`, no longer shipped) by
  [webtreats](https://www.flickr.com/photos/webtreatsetc/4081217254),
  [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)
* Item, creature and build piece names (EN/FR, `web/js/lang/noms.js`) are Valheim's own.
  Valheim is a trademark of Iron Gate AB; ForgeMap is a fan project, not affiliated with
  Iron Gate or Coffee Stain.

MIT licence: see [LICENSE](LICENSE).
