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
2. Copie le contenu de l'archive dans `BepInEx/plugins/ForgeMap/` : les fichiers
   `ForgeMap.dll` et `websocket-sharp.dll`, et le dossier `web`.
3. Démarre le serveur, ouvre le port configuré (3000 par défaut) et va sur
   `http://ip_du_serveur:3000`.

La configuration est dans `BepInEx/config/fr.forgeserver.forgemap.cfg` (arrête le serveur
avant de la modifier : BepInEx la réécrit à l'arrêt).

Tu es chez [ForgeServer.fr](https://forgeserver.fr) ? Rien à faire : la carte s'installe en
un clic depuis L'Atelier (onglet Mods, « Carte en direct »).

> **Tu viens de WebMap (ou de ForgeMap 1.0) ? Rien à faire, c'est automatique.** Depuis la
> 1.1.0, ForgeMap est un mod à part entière (son propre identifiant et `ForgeMap.dll`). Au
> premier démarrage, il **copie** ta configuration WebMap
> (`com.github.h0tw1r3.valheim.webmap.cfg`) sous son nouveau nom, et, si son propre dossier
> `map_data` est vide, il **copie** celui de l'ancien WebMap (carte explorée, repères, noms
> des lieux, statistiques, modèles 3D) et `announce.token`. Les originaux ne sont pas
> touchés, et le journal du serveur dit ce qui a été copié. Supprime ensuite l'ancien
> `WebMap.dll` : les deux ensemble se disputeraient le port (le journal t'avertit s'il est
> encore là).

### Nouveautés de la 1.1.0

* **Ping des joueurs** : la carte reçoit le temps d'aller-retour de chaque joueur connecté
  vers le serveur, en millisecondes, moyenné sur une minute.
* **Commandes du chat en français** : `!repère [type] [texte]` pose un repère là où tu es
  (types : `point`, `feu`, `mine`, `maison`, `grotte`), `!annulerrepère` retire ton dernier
  repère, `!supprrepère <texte>` retire celui qui porte ce texte. Avec ou sans accents,
  majuscules ou non ; `!pin`, `!undoPin` et `!deletePin` marchent toujours.
* **Mode léger** pour les petits serveurs (2 à 4 Go) : `light_mode = true` dans la section
  `[Performance]` de la configuration (ou sur la page des réglages du site). Il coupe
  l'export des modèles 3D et la lecture des textures et maillages du jeu (les modèles déjà
  exportés restent affichés, les autres objets n'apparaissent pas en 3D), n'envoie à la
  vue 3D que les constructions et les lieux (ni arbres, ni rochers, ni buissons), garde
  4 fois moins de terrain 3D en mémoire, limite
  `render_size` à `texture_size` et ne balaie le monde que toutes les 5 minutes au lieu de
  chaque minute. **La carte 2D reste complète** (brouillard, constructions, forêt,
  portails, joueurs, repères) ; ses couches de constructions et de forêt se rafraîchissent
  simplement moins souvent. Gain attendu : plus de pics de plusieurs centaines de Mo
  pendant l'extraction des textures et maillages, et quelques dizaines à une centaine de
  Mo de moins en continu sur un monde bien exploré.

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
2. Copy the archive's content into `BepInEx/plugins/ForgeMap/`: `ForgeMap.dll`,
   `websocket-sharp.dll` and the `web` folder.
3. Start the server, open the configured port (3000 by default) and browse to
   `http://server_ip:3000`.

The configuration is `BepInEx/config/fr.forgeserver.forgemap.cfg` (stop the server before
editing it: BepInEx rewrites it on shutdown).

> **Coming from WebMap (or ForgeMap 1.0)? Nothing to do, it is automatic.** Since 1.1.0
> ForgeMap is a mod of its own (its own GUID and `ForgeMap.dll`). On its first start it
> **copies** your WebMap configuration (`com.github.h0tw1r3.valheim.webmap.cfg`) under its
> new name and, when its own `map_data` folder is empty, **copies** the old WebMap's
> (explored map, pins, place names, stats, 3D models) and `announce.token`. The originals
> are left untouched and the server log says what was copied. Then delete the old
> `WebMap.dll`: both together would fight over the port (the log warns you while it is
> still there).

### New in 1.1.0

* **Player ping**: the map gets each connected player's round trip to the server, in
  milliseconds, averaged over a minute.
* **French chat commands**: `!repère [type] [text]` pins where you stand (types `point`,
  `feu`, `mine`, `maison`, `grotte`), `!annulerrepère` takes up your last pin,
  `!supprrepère <text>` the one with that text. Accents and case don't matter; `!pin`,
  `!undoPin` and `!deletePin` still work.
* **Light mode** for small servers (2-4 GB): `light_mode = true` under `[Performance]` in
  the config (or on the site's settings page). It turns off the 3D model export and
  reading the game's textures and meshes (models already exported are still drawn, other
  objects are left out of the 3D view), sends the 3D view buildings and locations only (no
  trees, rocks or bushes), keeps a quarter of the 3D ground in memory, caps `render_size` at `texture_size` and sweeps the world every
  5 minutes instead of every minute. **The 2D map stays complete** (fog, builds, forest,
  portals, players, pins); its builds and forest layers just refresh less often. Expected
  saving: no more peaks of several hundred MB while textures and meshes are extracted, and
  some tens to a hundred MB less all the time on a well explored world.

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
