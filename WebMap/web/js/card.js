/* card.js — a player as the roster reads them, shared by the players page and the map's tour:
 * the class, the pentagon, the four figures and the Viking on a turntable.
 *
 * One global, no modules, as map-core.js: both pages' scripts are plain scripts. three.js
 * is imported only when a look is first shown.
 */
const PlayerCard = (() => {
"use strict";
const esc = MapCore.esc, num = MapCore.num, km = MapCore.km, per = MapCore.per;
// the build's stamp on this file (?v=...), carried to the module it imports, so a browser never pairs
// this card.js with a rig.js it kept from an older build
const VER = (() => { try{ return new URL(document.currentScript.src).search; }catch(e){ return ""; } })();

// last_seen 0 is a name the sweep found on a grave or a build without ever
// seeing its owner online: no session behind it, so no elapsed time to show.
function seen(t){ return t ? I18N.t("last seen {ago}", {ago: MapCore.secsAgo(t, I18N.t("moments ago"))}) : I18N.t("not seen since the tally began"); }

// ---------- the pentagon ----------
// Five sides, each the player's share of the roster's best, square-rooted: a
// giant still reaches the rim, and everyone else keeps a shape worth reading.
// A side made of several figures is the mean of their shares, over the figures
// anyone on the roster has at all.
const sea = p => num(((p.biomes || []).find(b => b.biome === "Ocean") || {}).m);
const kpd = p => num(p.dist_m) >= 1000 ? num(p.dist_m)/1000/Math.max(1, num(p.deaths)) : 0;
const kit = p => p.kitchen || {};   // none from a mod that counts no kitchen
// km per death as shown: whole from ten up, else one decimal, in the page's locale
const kpdText = v => v >= 10 ? I18N.num(Math.round(v)) : I18N.num(+v.toFixed(1), {minimumFractionDigits: 1, maximumFractionDigits: 1});
const PARTS = {km: p => num(p.dist_m), hops: p => num(p.hops), sea, pieces: p => num(p.pieces), kpd, kills: p => num(p.kills), trees: p => num(p.trees), rocks: p => num(p.rocks),
  cooked: p => num(kit(p).cooked), smelted: p => num(kit(p).smelted)};
const BEST = {};
// the rim is the roster's best on each side
function rim(roster){ for(const k in PARTS) BEST[k] = Math.max(0, ...roster.map(PARTS[k])); }
const share = (p, keys) => { const has = keys.filter(k => BEST[k] > 0); return has.length ? has.reduce((t, k) => t + Math.min(1, PARTS[k](p)/BEST[k]), 0)/has.length : 0; };
const AXES = [
  ["Explorer", ["km", "hops", "sea"], p => `${km(p.dist_m)} km · ${I18N.tn(num(p.hops), "{n} hop", "{n} hops")}${BEST.sea > 0 ? ` · ${I18N.t("{n} at sea", {n: km(sea(p))})}` : ""}`],
  ["Builder", ["pieces"], p => I18N.tn(num(p.pieces), "{n} piece", "{n} pieces")],
  ["Survivor", ["kpd"], p => I18N.t("{n} km per death", {n: kpdText(kpd(p))})],
  ["Slayer", ["kills"], p => I18N.tn(num(p.kills), "{n} kill", "{n} kills")],
  ["Harvester", ["trees", "rocks", "cooked", "smelted"], p => `${I18N.tn(num(p.trees), "{n} tree", "{n} trees")} · ${I18N.tn(num(p.rocks), "{n} rock", "{n} rocks")}${BEST.cooked > 0 || BEST.smelted > 0 ? ` · ${I18N.t("{n} made", {n: I18N.num(num(kit(p).cooked) + num(kit(p).smelted))})}` : ""}`],
];
// ForgeMap: in French the longer words of a side figure run off the card, so its parts stand one under the other
const lines = (t, anchor, lx) => I18N.lang === "fr" && anchor !== "middle" ? t.split(" · ").map((s, j) => j ? `<tspan x="${lx.toFixed(1)}" dy="10">${esc(s)}</tspan>` : esc(s)).join("") : esc(t);
// bare: the corners named without their figures (a player's shareable card, where room is short)
function radar(p, size, big, bare){
  const c = size/2, R = big ? c - (bare ? 18 : 30) : c - 3, pts = [];
  AXES.forEach(([, keys], i) => {
    const a = -Math.PI/2 + i*2*Math.PI/5, r = R*Math.sqrt(share(p, keys));
    pts.push([c + r*Math.cos(a), c + r*Math.sin(a), a]);
  });
  const ring = k => AXES.map((_, i) => { const a = -Math.PI/2 + i*2*Math.PI/5; return `${(c + R*k*Math.cos(a)).toFixed(1)},${(c + R*k*Math.sin(a)).toFixed(1)}`; }).join(" ");
  let out = `<svg class="radar${big ? " big" : ""}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`
    + [.25, .5, .75, 1].map(k => `<polygon class="grid" points="${ring(k)}"/>`).join("")
    + pts.map(([, , a]) => `<line class="spoke" x1="${c}" y1="${c}" x2="${(c + R*Math.cos(a)).toFixed(1)}" y2="${(c + R*Math.sin(a)).toFixed(1)}"/>`).join("")
    + `<polygon class="fill" points="${pts.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" ")}"/>`;
  if(big){
    out += pts.map(([x, y]) => `<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>`).join("");
    AXES.forEach(([name, , text], i) => {
      const a = -Math.PI/2 + i*2*Math.PI/5, lx = c + (R + 14)*Math.cos(a), ly = c + (R + 14)*Math.sin(a);
      const anchor = Math.abs(Math.cos(a)) < .2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
      if(bare){ out += `<text class="lb" x="${lx.toFixed(1)}" y="${(ly + (Math.sin(a) > .5 ? 8 : Math.sin(a) < -.5 ? -2 : 3)).toFixed(1)}" text-anchor="${anchor}">${I18N.t(name)}</text>`; return; }
      out += `<text class="lb" x="${lx.toFixed(1)}" y="${(ly + (Math.sin(a) > .5 ? 6 : Math.sin(a) < -.5 ? -4 : 0)).toFixed(1)}" text-anchor="${anchor}">${I18N.t(name)}</text>`
        + `<text class="lv" x="${lx.toFixed(1)}" y="${(ly + (Math.sin(a) > .5 ? 17 : Math.sin(a) < -.5 ? 7 : 11)).toFixed(1)}" text-anchor="${anchor}">${lines(text(p), anchor, lx)}</text>`;
    });
  }
  return out + `</svg>`;
}
// A class is three parts. The first word is a compound of two: what is fought with
// (the prefix: battle, blade, shield, bow, knife, spell) and what the body is (the root:
// mage, knight, warrior, rogue, brute), read from the clothes and the food. The second
// word is the trade, from the deeds. The gear decides the body -- robes and eitr make a
// mage however long the hammer was out tonight -- and any part may be missing. The
// server sees blows landed only on creatures another player owns, and never the foods
// themselves, only the health, stamina and eitr they add; time in hand is the evidence.
const FAMILY_WORD = {bow: "a bow", crossbow: "a crossbow", staff: "a staff", shield: "a shield", knife: "a knife", sword: "a sword", axe: "an axe", mace: "a mace", spear: "a spear", polearm: "an atgeir", hammer: "the hammer", hoe: "the hoe", cultivator: "the cultivator", pickaxe: "a pickaxe", torch: "a torch", fishing: "a fishing rod", tool: "a tool"};
const ARMOUR_WORD = {mage: "eitr-weave", heavy: "heavy armour", medium: "medium armour", light: "light armour", none: "no armour"};
// an item's family from its prefab name, for what is carried but not being held
function familyOf(name){
  const n = String(name || "").toLowerCase(); if(!n) return null;
  if(/crossbow|arbalest/.test(n)) return "crossbow";
  if(/^bow/.test(n)) return "bow";
  if(/^staff/.test(n)) return "staff";
  if(/^shield/.test(n)) return "shield";
  if(/^knife/.test(n)) return "knife";
  if(/^(thsword|sword)/.test(n)) return "sword";
  if(/^(battleaxe|axe)/.test(n)) return "axe";
  if(/^(sledge|mace|club)/.test(n)) return "mace";
  if(/^spear/.test(n)) return "spear";
  if(/^atgeir/.test(n)) return "polearm";
  if(/^hammer$/.test(n)) return "hammer";
  if(/^hoe$/.test(n)) return "hoe";
  if(/^cultivator$/.test(n)) return "cultivator";
  if(/^pickaxe/.test(n)) return "pickaxe";
  if(/^(torch|lantern)/.test(n)) return "torch";
  if(/fishingrod/.test(n)) return "fishing";
  return "tool";
}
const FIGHT = {staff: "magic", bow: "ranged", crossbow: "ranged", shield: "shield", knife: "knife", sword: "melee", axe: "melee", mace: "melee", spear: "melee", polearm: "melee"};
const twoHander = n => /^(thsword|battleaxe|sledge|atgeir)/i.test(String(n || ""));
const seaShare = p => { const b = p.biomes || [], all = b.reduce((t, x) => t + num(x.m), 0); return all ? num((b.find(x => x.biome === "Ocean") || {}).m)/all : 0; };
// a list as it reads: "a and b", "a and b and c"
const and = list => list.reduce((a, b) => I18N.t("{a} and {b}", {a, b}));
// the compound, by the body (rows) and what it fights with (columns)
const TITLE = {
  mage:    {none: "Mage", spell: "Mage", battle: "Battlemage", blade: "Spellsword", shield: "Spellguard", bow: "Arcane Archer", knife: "Nightblade"},
  knight:  {none: "Knight", spell: "Templar", battle: "Champion", blade: "Warrior", shield: "Paladin", bow: "Marksman", knife: "Executioner"},
  warrior: {none: "Soldier", spell: "Warlock", battle: "Reaver", blade: "Fighter", shield: "Warden", bow: "Ranger", knife: "Rogue"},
  rogue:   {none: "Rogue", spell: "Enchanter", battle: "Berserker", blade: "Duelist", shield: "Skirmisher", bow: "Archer", knife: "Assassin"},
  brute:   {none: "Brute", spell: "Shaman", battle: "Berserker", blade: "Bruiser", shield: "Guardian", bow: "Hunter", knife: "Cutthroat"},
  none:    {none: null, spell: "Sorcerer", battle: "Berserker", blade: "Brawler", shield: "Sentinel", bow: "Archer", knife: "Cutpurse"},
};
const DIET_WORD = {hearty: "hearty food", quick: "light, quick food", eitr: "eitr food", balanced: "a balanced table"};
// what the stone oven bakes: bread, the pies, and the platters that go in raw
const OVEN = /^(Bread|FishAndBread|LoxPie|HoneyGlazedChicken|MeatPlatter|MisthareSupreme|MagicallyStuffedShroom|PiquantPie|RoastedCrustPie)$/;
// roster: everyone tallied, for the roster's best and the pace of its deaths
function classify(p, roster){
  const g = p.gear || {};
  // 1. the body: clothes, and the food behind the health, stamina and eitr
  const arm = g.armor || {}, armTotal = Object.values(arm).reduce((t, v) => t + num(v), 0);
  const A = armTotal ? Object.entries(arm).sort((a, b) => num(b[1]) - num(a[1]))[0][0] : "none";
  const diet = g.diet || {}, fed = Object.entries(diet).filter(([k]) => k !== "none"), fedTotal = fed.reduce((t, [, v]) => t + num(v), 0);
  const D = fedTotal && fedTotal >= num(diet.none) ? fed.sort((a, b) => num(b[1]) - num(a[1]))[0][0] : null;   // unfed more often than not says nothing
  const root = A === "mage" || (D === "eitr" && A !== "heavy") ? "mage" : A === "heavy" ? "knight" : A === "medium" ? (D === "quick" ? "rogue" : "warrior")
    : A === "light" ? (D === "hearty" ? "warrior" : "rogue") : D === "hearty" ? "brute" : "none";
  const food = g.food || null, fedWords = food ? [num(food.hp) && I18N.t("{n} health", {n: Math.round(num(food.hp))}), num(food.st) && I18N.t("{n} stamina", {n: Math.round(num(food.st))}), num(food.eitr) && I18N.t("{n} eitr", {n: Math.round(num(food.eitr))})].filter(Boolean) : [];
  const bodyWhy = [armTotal && I18N.t(ARMOUR_WORD[A] || A), D && DIET_WORD[D] && I18N.t(DIET_WORD[D]), fedWords.length ? I18N.t("fed for {what}", {what: fedWords.join(", ")}) : food && !D && I18N.t("unfed")].filter(Boolean);
  // 2. the weapons: a minute of fighting gear in hand decides; before that, what is carried
  const hand = g.hand || {}, held = Object.entries(hand).filter(([k]) => k !== "none" && k !== "twohanded"), heldTotal = held.reduce((t, [, v]) => t + num(v), 0);
  const fought = held.filter(([k]) => FIGHT[k]), fightTotal = fought.reduce((t, [, v]) => t + num(v), 0);
  const worn = g.worn || {}, carriedNames = [worn.right, worn.left, worn.rightBack, worn.leftBack].filter(n => FIGHT[familyOf(n)]), carried = [...new Set(carriedNames.map(familyOf))];
  const F = {magic: 0, ranged: 0, shield: 0, knife: 0, melee: 0}, FS = {}, armsWhy = [];
  let twoh = 0;
  if(fightTotal >= 60){
    for(const [k, v] of fought){ FS[k] = num(v)/fightTotal; F[FIGHT[k]] += FS[k]*(k === "axe" ? .5 : 1); }   // an axe is half a tool
    twoh = num(hand.twohanded)/fightTotal;
    armsWhy.push(I18N.t(twoh >= .5 ? "{what} of the time in hand, two-handed" : "{what} of the time in hand",
      {what: and(fought.slice().sort((a, b) => num(b[1]) - num(a[1])).slice(0, 2).map(([k, v]) => I18N.t("{what} {pct}%", {what: I18N.t(FAMILY_WORD[k] || k), pct: Math.round(100*num(v)/heldTotal)})))}));
  } else if(carried.length){
    for(const k of carried){ FS[k] = 1; F[FIGHT[k]] += 1; }
    twoh = carriedNames.some(twoHander) ? 1 : 0;
    armsWhy.push(I18N.t("carries {what}", {what: and(carried.map(k => I18N.t(FAMILY_WORD[k])))}));
  }
  const hits = g.hits || {}, hitTotal = num(hits.melee) + num(hits.ranged) + num(hits.magic);
  if(hitTotal >= 10){
    F.magic += num(hits.magic)/hitTotal*.5; F.ranged += num(hits.ranged)/hitTotal*.5; F.melee += num(hits.melee)/hitTotal*.3; F.knife += num(hits.backstab)/hitTotal*.5;
    const kind = [["ranged", "{n} shots landed"], ["magic", "{n} spells landed"], ["backstab", "{n} backstabs landed"], ["melee", "{n} blows landed"]].sort((a, b) => num(hits[b[0]]) - num(hits[a[0]]))[0];
    armsWhy.push(I18N.t(kind[1], {n: num(hits[kind[0]])}));
  }
  // a quarter of the fighting counts as a way of fighting; a mage's staff is already in the root, so the rest names the prefix
  const facets = Object.entries(F).filter(([, v]) => v >= .25).sort((a, b) => b[1] - a[1]), has = k => facets.some(f => f[0] === k);
  const lead = (root === "mage" ? facets.find(f => f[0] !== "magic") || facets[0] : facets[0])?.[0] || null, shielded = has("shield") || carried.includes("shield");
  const fam = k => num(FS[k]), steel = ["sword", "axe", "mace", "spear", "polearm"].sort((a, b) => fam(b) - fam(a))[0];
  const prefix = lead === "magic" ? "spell" : lead === "ranged" ? "bow" : lead === "knife" ? "knife" : lead === "shield" ? "shield" : lead === "melee" ? (twoh >= .5 ? "battle" : shielded ? "shield" : "blade") : "none";
  const hasGear = armTotal > 0 || heldTotal > 0 || carried.length > 0 || hitTotal > 0;
  let fighter = TITLE[root][prefix];
  // the weapon itself colours a few
  if(root !== "mage"){
    if(prefix === "bow" && fam("crossbow") > fam("bow")) fighter = "Arbalist";
    else if(prefix === "bow" && (has("knife") || fam("spear") >= .25)) fighter = "Hunter";
    else if(prefix === "battle" && steel === "polearm") fighter = "Vanguard";
    else if(prefix === "shield" && steel === "axe" && (root === "knight" || root === "warrior")) fighter = "Huscarl";
    else if(prefix === "shield" && steel === "spear") fighter = "Hoplite";
    else if(prefix === "blade" && steel === "axe" && root !== "knight") fighter = "Raider";
  }
  if(prefix === "knife" && num(hits.backstab) >= 10 && num(hits.backstab)*2 >= hitTotal) fighter = "Assassin";
  // nothing seen in hand yet: dying more often than half the roster says something too
  const perDeath = q => num(q.deaths) ? num(q.dist_m)/num(q.deaths) : Infinity, pers = roster.map(perDeath).filter(isFinite).sort((a, b) => a - b), median = pers.length ? pers[Math.floor(pers.length/2)] : 0;
  if(!fighter && !hasGear && num(p.deaths) >= 20 && perDeath(p) <= median){ fighter = "Berserker"; armsWhy.push(I18N.t("{n} deaths, one every {km} km", {n: num(p.deaths), km: I18N.num(+(perDeath(p)/1000).toFixed(1), {minimumFractionDigits: 1, maximumFractionDigits: 1})})); }
  // 3. the trade, from the deeds: building against the roster's best, the rest in plain numbers
  const best = k => Math.max(1, ...roster.map(q => num(q[k])));
  const pieces = num(p.pieces), bestPieces = best("pieces"), trees = num(p.trees), rocks = num(p.rocks), taken = trees + rocks, roam = num(p.dist_m)/best("dist_m"), kills = num(p.kills), hops = num(p.hops);
  const tool = k => heldTotal ? num(hand[k])/heldTotal : 0, farm = tool("hoe") + tool("cultivator"), fish = tool("fishing"), sea = seaShare(p);
  const building = pieces >= 1000 || (pieces >= 300 && pieces/bestPieces >= .2), harvesting = taken >= 100 || (taken >= 10 && tool("pickaxe") + tool("axe") >= .25);
  const roaming = (roam >= .5 || num(p.ships) >= 3) && !(building && pieces/bestPieces >= .25);   // a builder who mostly roams is an explorer
  // the kitchen's trade, by what leads among what came out of the stations; over a builder only
  // when it is the larger share of the roster's best
  const K = kit(p), cooked = num(K.cooked), burnt = num(K.burnt), brewed = num(K.brewed), smelted = num(K.smelted);
  const baked = Object.entries(K.dishes || {}).reduce((t, [k, v]) => t + (OVEN.test(k) ? num(v) : 0), 0);
  const made = q => num(kit(q).cooked) + num(kit(q).brewed) + num(kit(q).smelted), bestMade = Math.max(1, ...roster.map(made));
  const craft = made(p) >= 50 ? [["Cook", cooked - baked], ["Baker", baked], ["Brewer", brewed], ["Smith", smelted]].sort((a, b) => b[1] - a[1])[0][0] : null;
  const trade = building && pieces >= bestPieces ? "Architect"
    : building && harvesting ? (trees > rocks ? "Carpenter" : "Engineer")
    : building && farm >= .2 ? "Homesteader"
    : craft && (!building || made(p)/bestMade > pieces/bestPieces) ? craft
    : kills >= 50 && kills >= .8*best("kills") ? "Slayer"
    : building && !roaming ? "Builder"
    : harvesting ? (rocks >= trees ? "Miner" : "Lumberjack")
    : farm >= .2 ? "Farmer"
    : roaming ? (sea >= .3 ? "Seafarer" : "Explorer")
    : fish >= .1 ? "Angler"
    : hops >= 200 && hops >= .8*best("hops") ? "Wayfarer" : null;
  const dishWhy = {Cook: I18N.t("{n} dishes", {n: cooked}), Baker: I18N.t("{n} from the oven", {n: baked}), Brewer: I18N.t("{n} meads brewed", {n: brewed}), Smith: I18N.t("{n} bars smelted", {n: smelted})}[trade];
  const deedsWhy = [dishWhy, dishWhy && burnt && (trade === "Cook" || trade === "Baker") && I18N.t("{n} burnt", {n: burnt}),
    building && I18N.t("{n} pieces built", {n: I18N.num(pieces)}), trees >= 10 && I18N.t("{n} trees felled", {n: trees}), rocks >= 10 && I18N.t("{n} rocks broken", {n: rocks}),
    trade === "Slayer" && I18N.t("{n} kills", {n: kills}), (trade === "Homesteader" || trade === "Farmer") && I18N.t("the hoe and cultivator {pct}% of the time in hand", {pct: Math.round(farm*100)}),
    (trade === "Seafarer" || trade === "Explorer") && I18N.t("{n} km travelled", {n: Math.round(num(p.dist_m)/1000)}), trade === "Seafarer" && I18N.t("{pct}% of it at sea", {pct: Math.round(sea*100)}),
    trade === "Angler" && I18N.t("a fishing rod {pct}% of the time in hand", {pct: Math.round(fish*100)}), trade === "Wayfarer" && I18N.t("{n} portal hops", {n: I18N.num(hops)})].filter(Boolean);
  const name = [fighter, trade].filter(Boolean).join(" ") || (hasGear ? "Wanderer" : "");
  if(!name) return null;
  // the title as shown: English as named; French puts the trade first and the fighter after it as
  // its qualifier ("Architecte rôdeur"), each part translated whole
  const low = s => s.charAt(0).toLowerCase() + s.slice(1);
  const title = I18N.lang === "fr" ? (fighter && trade ? I18N.t(trade) + " " + low(I18N.t(fighter)) : I18N.t(fighter || trade || "Wanderer")) : name;
  // the reason names the three parts: prefix (weapons), root (body), trade (deeds)
  const part = (label, words) => words.length ? (label ? I18N.t("{part}: {why}", {part: label, why: words.join(", ")}) : words.join(", ")) : null;
  const why = [part(fighter && prefix !== "none" ? I18N.t(prefix) : null, armsWhy), part(fighter && root !== "none" ? I18N.t(root) : null, bodyWhy), part(trade && I18N.t(trade).toLowerCase(), deedsWhy)].filter(Boolean);
  // faint until ten minutes have had something in hand or the hits have come in
  const early = !hasGear || (heldTotal < 600 && hitTotal < 10);
  return {name, title, early, why: why.join(" \u00b7 ") || I18N.t("nothing to go on yet"), top: heldTotal ? held.slice().sort((a, b) => num(b[1]) - num(a[1])).slice(0, 3).map(([k, v]) => ({fam: k, share: num(v)/heldTotal})) : []};
}
// the class as its pill, the reason under the pointer
const pill = c => c ? `<span class="cls${c.early ? " early" : ""}" title="${esc(c.why)}">${c.title}</span>` : "";
const mini = (v, k, cls) => `<span class="m${cls ? " " + cls : ""}"><span class="v">${v}</span><span class="k">${k}</span></span>`;
// the four figures people compare; a label agrees with its count in French, English keeps its one word
const lab = (n, one, many) => I18N.lang === "fr" ? I18N.tn(n, one, many) : I18N.t(many);
function figures(p){
  const d = num(p.deaths), m = num(p.dist_m);
  return `<span class="mini">` + mini(I18N.num(d), lab(d, "death", "deaths"), d ? "" : "nil") + mini(km(m), "km", m ? "" : "nil")
    + mini(per(d, m).replace(/^1\D*?(?=\d)/, ""), I18N.t("per death"), d && m ? "" : "nil")
    + mini(I18N.num(num(p.pieces)), lab(num(p.pieces), "piece", "pieces"), num(p.pieces) ? "" : "nil") + `</span>`;
}
// ---------- the Viking ----------
// The player as the 3D view draws them, on a slow turntable, lit the way the game lights a
// figure: a warm sun casting a soft shadow, the sky's cool fill and, for ForgeServer, an ember
// rim from behind; an image-based light (a small room of glowing panels, prefiltered once)
// gives the metal its sheen. three.js and the rig load with the first look shown, one renderer
// for the page; a rig is built again only when the look's key changes.
const STILL = matchMedia("(prefers-reduced-motion: reduce)");
// Valheim's grade over ACES: a little less colour, warm highlights, cool shadows. In the shader's
// tone mapping, so the PNG export carries it too; only renderers asking for CustomToneMapping use it.
function grade(T){
  const k = "vec3 CustomToneMapping( vec3 color ) { return color; }", c = T.ShaderChunk.tonemapping_pars_fragment;
  if(!c.includes(k)) return;
  T.ShaderChunk.tonemapping_pars_fragment = c.replace(k, `vec3 CustomToneMapping( vec3 color ) {
    vec3 c = ACESFilmicToneMapping( color );
    float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
    c = mix( vec3( l ), c, 0.86 );
    c *= mix( vec3( 0.92, 0.97, 1.07 ), vec3( 1.05, 1.0, 0.91 ), smoothstep( 0.04, 0.7, l ) );
    return saturate( c );
  }`);
}
// The room the image-based light is taken from: dark warm walls, a cool sky overhead, a warm
// panel where the sun is, an ember one behind; colours past 1 are light, not paint.
function room(T){
  const sc = new T.Scene(), box = new T.BoxGeometry(1, 1, 1);
  const wall = new T.Mesh(box, new T.MeshBasicMaterial({side: T.BackSide, color: new T.Color(0.07, 0.06, 0.055)}));
  wall.scale.set(12, 8, 12); wall.position.y = 3; sc.add(wall);
  const panel = (r, g, b, x, y, z, sx, sy) => {
    const m = new T.Mesh(box, new T.MeshBasicMaterial({color: new T.Color(r, g, b)}));
    m.position.set(x, y, z); m.lookAt(0, 1, 0); m.scale.set(sx, sy, 0.1); sc.add(m);
  };
  panel(1.1, 1.25, 1.45, 0, 6.8, 0, 7, 7);          // the sky
  panel(5.5, 4.4, 3.2, -4, 5, 4.5, 3, 3);           // the sun, high on the left
  panel(0.5, 0.62, 0.85, 5.5, 2.4, 3, 2.5, 3);      // the cool fill
  panel(6, 2.2, 0.55, 2.5, 3, -5.5, 3, 4);          // the ember rim
  panel(0.14, 0.1, 0.075, 0, -0.95, 0, 12, 12);     // the ground's bounce
  return sc;
}
function viking(api){
  // lib: the library's index as fetched, {rev, p}; gen counts the fetches that moved a rig part, built the one the rig is from
  // ang: the turntable's angle; tilt: the camera raised or lowered by a drag; auto: the slow turn's
  // speed, 0..1, eased back in after a drag; hold: until when (rAF time) the turn waits after one;
  // fit: the rig's height and reach, for the framing
  const VK = {el: document.createElement("figure"), ready: null, v: null, lib: null, gen: 0, built: -1, key: undefined, name: null, rig: null, missing: 0, want: null, raf: 0, w: 0, h: 0,
    ang: 0.5, tilt: 0, auto: 1, hold: 0, drag: null, last: 0, fit: null};
  VK.el.className = "card viking"; VK.el.hidden = true;
  VK.el.innerHTML = `<canvas aria-hidden="true" title="${esc(I18N.t("Drag to turn"))}"></canvas><figcaption></figcaption>`;
  function load(){
    if(!VK.ready) VK.ready = Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js"), import("./rig.js" + VER)]).then(([THREE, {GLTFLoader}, rig]) => {
      const renderer = new THREE.WebGLRenderer({canvas: VK.el.querySelector("canvas"), antialias: true, alpha: true});
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      grade(THREE);
      renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 0.95;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(room(THREE), 0.03).texture;
      pm.dispose();
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 232/300, 0.1, 50);
      scene.environment = env; scene.environmentIntensity = 0.5;
      // the sun, warm and high on the left, the one light that casts a shadow (one 1024 map)
      const key = new THREE.DirectionalLight(0xffdcb4, 2.15); key.position.set(-2.7, 3.6, 1.5); key.target.position.set(0, 0.9, 0);
      key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
      Object.assign(key.shadow.camera, {left: -1.3, right: 1.3, top: 1.6, bottom: -1.3, near: 0.5, far: 9});
      scene.add(key, key.target);
      const fill = new THREE.DirectionalLight(0xa9bede, 0.5); fill.position.set(2.8, 1.4, 2.4); scene.add(fill);
      // the ember rim from behind, one each side, so a turning figure keeps an edge of fire
      const rim = new THREE.DirectionalLight(0xff7a2a, 3.0); rim.position.set(1.8, 2.4, -3); scene.add(rim);
      const rim2 = new THREE.DirectionalLight(0xff9548, 1.5); rim2.position.set(-2, 1.6, -2.6); scene.add(rim2);
      scene.add(new THREE.HemisphereLight(0xc4d2e6, 0x2c2118, 0.35));
      // the ground: invisible but for the shadow on it, and the soft pool of light they stand in
      const catcher = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({opacity: 0.62}));
      catcher.rotation.x = -Math.PI/2; catcher.receiveShadow = true; scene.add(catcher);
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const x = c.getContext("2d"), grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(232,150,80,.28)"); grad.addColorStop(.55, "rgba(201,120,60,.1)"); grad.addColorStop(1, "rgba(201,120,60,0)");
      x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
      const glow = new THREE.CanvasTexture(c); glow.colorSpace = THREE.SRGBColorSpace;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({map: glow, transparent: true, depthWrite: false, toneMapped: false}));
      pool.rotation.x = -Math.PI/2; pool.position.y = 0.002; scene.add(pool);
      const turn = new THREE.Group(); scene.add(turn);
      // the items' pictures: their own small scene under the same light, without the ground
      const shelf = new THREE.Scene(); shelf.environment = env; shelf.environmentIntensity = 0.7;
      const sk = new THREE.DirectionalLight(0xffe0bc, 2.4); sk.position.set(-2, 3, 3); shelf.add(sk);
      const sf = new THREE.DirectionalLight(0xa9bede, 0.6); sf.position.set(3, 0.5, 2); shelf.add(sf);
      const sr = new THREE.DirectionalLight(0xff7a2a, 2.4); sr.position.set(2, 1.5, -3); shelf.add(sr);
      shelf.add(new THREE.HemisphereLight(0xc4d2e6, 0x2c2118, 0.4));
      const shelfCam = new THREE.PerspectiveCamera(24, 1, 0.01, 50);
      VK.v = {THREE, rig, renderer, scene, camera, turn, shelf, shelfCam,
        builder: new rig.RigBuilder(THREE, new GLTFLoader(), {api, shadows: true, aniso: renderer.capabilities.getMaxAnisotropy(), anisoCap: 16, surfaces: true})};
      return VK.v;
    });
    return VK.ready;
  }
  // the library's index, fetched again only when asked to (the library moved and a look may have gained a part)
  function library(v, models, again){
    if(!VK.lib || again){
      const lib = VK.lib = {rev: models};
      lib.p = MapCore.fetchJSON(api, `/prefabs?v=${models}`)
        .then(j => { if(v.builder.setLibrary(new Map(Object.entries(j.prefabs || {}).map(([h, e]) => [+h, e])))) VK.gen++; })
        .catch(() => { if(VK.lib === lib) VK.lib = null; });
    }
    return VK.lib.p;
  }
  // name's rig in look, captioned "online now" or "as last seen"; models: the library's revision, from /state
  VK.show = async (name, look, online, models) => {
    const el = VK.el, me = VK.want = {};
    if(!look || !(look.parts || []).length){ still(); return; }
    let v;
    try{ v = await load(); }catch(e){ still(); return; }   // no WebGL: no card
    if(VK.want !== me) return;
    const key = v.rig.lookKey(look);
    el.classList.toggle("ok", !!online);
    el.querySelector("figcaption").textContent = online ? I18N.t("online now") : I18N.t("as last seen");
    if(name !== VK.name) still();                  // never someone else's rig under this name
    // the index again only when the library moved and this look may have gained a part
    await library(v, models, !!VK.lib && VK.lib.rev !== models && (key !== VK.key || !!VK.missing));
    if(VK.want !== me) return;
    VK.name = name;
    if(key === VK.key && VK.built === VK.gen){ if(VK.rig) turning(); return; }
    const gen = VK.gen;
    let g = null;
    try{ g = await v.builder.build(look); }catch(e){ console.warn("rig", e.message || e); }
    if(VK.want !== me) return;
    if(VK.rig) v.turn.remove(VK.rig);
    VK.rig = g; VK.key = key; VK.built = gen; VK.missing = g ? g.userData.missing : 1;
    if(!g){ still(); return; }                     // the library has no body yet
    // the framing: the top of the head (or helmet), and how far out from the axis it reaches
    const b = new v.THREE.Box3().setFromObject(g);
    VK.fit = {top: Math.max(1.6, b.max.y), r: Math.min(0.8, Math.max(0.45, ...[b.min.x, b.max.x].flatMap(px => [b.min.z, b.max.z].map(pz => Math.hypot(px, pz)))))};
    v.turn.add(g); turning();
  };
  // put away; a rig still being built is not shown
  VK.hide = () => { VK.want = null; still(); };
  // the card gone: its rig let go and what was baked for it freed; the renderer waits for the next
  VK.drop = () => {
    VK.hide();
    if(VK.rig) VK.v.turn.remove(VK.rig);
    if(VK.v) VK.v.builder.dispose();
    VK.rig = null; VK.key = undefined; VK.name = null;
  };
  function turning(){ VK.el.hidden = false; wake(); }
  function still(){ VK.el.hidden = true; cancelAnimationFrame(VK.raf); VK.raf = 0; VK.last = 0; }
  function wake(){ if(VK.v && !VK.el.hidden && !VK.raf) VK.raf = requestAnimationFrame(spin); }
  // The camera on its circle round the figure's middle, a little below it (a hero's angle), raised
  // by the tilt; as close as the whole body allows, head to feet, with room for a cape to swing past.
  const EL0 = -0.05;
  function aim(cam){
    const f = VK.fit || {top: 1.85, r: 0.55}, t = Math.tan(cam.fov*Math.PI/360), mid = f.top*0.5 - 0.04;
    const dist = Math.max(2.4, (f.top + 0.38)/2/t, (f.r + 0.12)/(t*cam.aspect));
    const e = EL0 + VK.tilt;
    cam.position.set(0, mid + dist*Math.sin(e), dist*Math.cos(e)); cam.lookAt(0, mid, 0);
  }
  // a turn every 25 s; with reduced motion, one still from a little to the side that only a drag turns.
  // A drag holds the turn, and three seconds after it the turn picks up again from where the hand left it.
  function spin(t){
    VK.raf = 0;
    const v = VK.v, c = v.renderer.domElement, w = c.clientWidth, h = c.clientHeight;
    if(VK.el.hidden || !w || !h){ VK.last = 0; return; }
    if(w !== VK.w || h !== VK.h){ VK.w = w; VK.h = h; v.renderer.setSize(w, h, false); v.camera.aspect = w/h; v.camera.updateProjectionMatrix(); }
    const dt = VK.last ? Math.min(100, t - VK.last) : 0, moving = !STILL.matches;
    VK.last = t;
    if(moving && !VK.drag && t >= VK.hold){
      VK.ang += dt*0.00025*VK.auto;
      VK.auto = Math.min(1, VK.auto + dt/1500);                       // back up to speed over a second and a half
      if(VK.tilt){ VK.tilt *= Math.pow(0.5, dt/450); if(Math.abs(VK.tilt) < 1e-3) VK.tilt = 0; }   // and the eye back to its height
    }
    v.turn.rotation.y = VK.ang; aim(v.camera);
    // a breath: the figure sways a hair from the feet up
    if(VK.rig) VK.rig.rotation.z = moving ? 0.008*Math.sin(t/1900) : 0;
    v.renderer.render(v.scene, v.camera);
    if(moving || VK.drag) VK.raf = requestAnimationFrame(spin);
    else VK.last = 0;
  }
  addEventListener("resize", wake);
  // ---------- turned by hand ----------
  // A drag across the figure turns it, up and down tilts the eye a little (a mouse or a pen: on a
  // touch screen an upward swipe is the page's scroll, which touch-action: pan-y leaves to it).
  const cv = VK.el.querySelector("canvas");
  cv.addEventListener("pointerdown", e => {
    if(e.pointerType === "mouse" && e.button !== 0) return;
    VK.drag = {id: e.pointerId, x: e.clientX, y: e.clientY};
    try{ cv.setPointerCapture(e.pointerId); }catch(err){}
    VK.el.classList.add("drag"); VK.auto = 0; wake();
    if(e.pointerType === "mouse") e.preventDefault();                 // no text selected on the way
  });
  cv.addEventListener("pointermove", e => {
    const d = VK.drag; if(!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    VK.ang += dx*0.012;
    if(e.pointerType !== "touch") VK.tilt = Math.max(-0.1, Math.min(0.4, VK.tilt + dy*0.004));
    wake();
  });
  const letGo = e => {
    if(!VK.drag || VK.drag.id !== e.pointerId) return;
    VK.drag = null; VK.el.classList.remove("drag");
    VK.hold = performance.now() + 3000; VK.auto = 0; wake();
  };
  for(const ev of ["pointerup", "pointercancel", "lostpointercapture"]) cv.addEventListener(ev, letGo);
  // ---------- the items, one at a time ----------
  // A small picture of an item as the library draws it (the part a player wore it as), rendered
  // once with the figure's renderer and kept as a data URL; null when no player has worn it yet
  // where the server could see it. kind: the slot, which says how it is turned to the eye.
  const THUMBS = new Map(), WORN = {helmet: 1, chest: 1, legs: 1, shoulder: 1, utility: 1, trinket: 1};
  VK.thumb = (item, kind, models) => {
    const k = `${item}|${kind}|${VK.gen}`;
    if(!THUMBS.has(k)) THUMBS.set(k, (async () => {
      let v; try{ v = await load(); }catch(e){ return null; }
      await library(v, models);
      const h = v.builder.partFor(item); if(h == null) return null;
      const entry = v.builder.index.get(h) || {}, worn = !!WORN[kind];
      // a garment that paints the body is shown on it: the body and the garment, its chest or its legs
      if(worn && (kind === "chest" || kind === "legs") && (entry.ct || entry.lt) && v.builder.names.has("Player@body0")){
        const g = await v.builder.build({model: 0, skin: [0.78, 0.68, 0.6], hair: [0.3, 0.25, 0.2], parts: ["Player@body0", entry.n]});
        return g ? shoot(v, g, kind === "chest" ? [0.86, 1.62] : [0.02, 1.08], 0.42) : null;
      }
      const pieces = await v.builder.part(h);
      if(!pieces || !pieces.length) return null;
      const g = new v.THREE.Group();
      for(const pc of pieces){ const m = new v.THREE.Mesh(pc.geometry, pc.material); m.rotation.y = Math.PI; g.add(m); }
      if(worn) return shoot(v, g, null, kind === "shoulder" ? 0.5 : 0.45);
      turnToEye(v.THREE, g);
      return shoot(v, g, null, null);
    })().catch(e => { console.warn("item picture", item, e.message || e); return null; }));
    return THUMBS.get(k);
  };
  // A held item turned as the game's icons draw them: its length along the diagonal, head up and
  // to the right, its flat side to the eye. The axes are the item's own (its points' spread).
  function turnToEye(T, g){
    g.updateMatrixWorld(true);
    const pts = [], v3 = new T.Vector3();
    g.traverse(o => {
      if(!o.isMesh) return;
      const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count/1500));
      for(let i = 0; i < p.count; i += step) pts.push(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
    });
    if(pts.length < 4) return;
    const c = pts.reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(1/pts.length), C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for(const p of pts){ const d = [p.x - c.x, p.y - c.y, p.z - c.z]; for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++) C[i*3 + j] += d[i]*d[j]; }
    const mul = v => new T.Vector3(C[0]*v.x + C[1]*v.y + C[2]*v.z, C[3]*v.x + C[4]*v.y + C[5]*v.z, C[6]*v.x + C[7]*v.y + C[8]*v.z);
    const power = (v, not) => { for(let i = 0; i < 40; i++){ v = mul(v); if(not) v.addScaledVector(not, -v.dot(not)); if(v.lengthSq() < 1e-12) break; v.normalize(); } return v; };
    const a1 = power(new T.Vector3(0.3, 1, 0.2).normalize()), a2 = power(new T.Vector3(1, 0.1, 0.3).normalize(), a1);
    if(a1.lengthSq() < 0.5 || a2.lengthSq() < 0.5) return;
    const spread = a => { let lo = Infinity, hi = -Infinity, sum = 0; for(const p of pts){ const t = v3.subVectors(p, c).dot(a); lo = Math.min(lo, t); hi = Math.max(hi, t); sum += t; } return {lo, hi, len: hi - lo, mean: sum/pts.length}; };
    const s1 = spread(a1), s2 = spread(a2);
    // the heavier end (a head, a blade) up: the points crowd towards it
    if(s1.hi > -s1.lo) a1.negate();
    const a3 = new T.Vector3().crossVectors(a1, a2);
    const long = s1.len >= 1.8*s2.len, up = long ? new T.Vector3(0.62, 0.78, 0).normalize() : new T.Vector3(0, 1, 0), z = new T.Vector3(0, 0, 1);
    const side = new T.Vector3().crossVectors(up, z).negate();
    const from = new T.Matrix4().makeBasis(a1, a2, a3), to = new T.Matrix4().makeBasis(up, side, z);
    const r = to.multiply(from.transpose());
    const q = new T.Quaternion().setFromRotationMatrix(r).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), 0.35));
    const wrap = new T.Group();
    while(g.children.length) wrap.add(g.children[0]);
    wrap.position.copy(c).negate().applyQuaternion(q);
    wrap.quaternion.copy(q); g.add(wrap);
  }
  // g framed and drawn at 128 x 128 onto a data URL. band: the heights kept, for a garment on the
  // body; yaw: the turn to give it (null when already turned). The figure's canvas is borrowed for
  // the moment and its figure drawn again.
  const SH = 128;
  function shoot(v, g, band, yaw){
    const T = v.THREE, r = v.renderer, cam = v.shelfCam;
    if(yaw != null) g.rotation.y = yaw;
    g.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(g);
    if(band){ b.min.y = Math.max(b.min.y, band[0]); b.max.y = Math.min(b.max.y, band[1]); }
    if(b.isEmpty()) return null;
    const ctr = b.getCenter(new T.Vector3()), size = b.getSize(new T.Vector3());
    const half = Math.max(size.y, size.x)/2*1.1, t = Math.tan(cam.fov*Math.PI/360), dist = half/t + size.z/2, el = 0.16;
    cam.position.set(ctr.x, ctr.y + dist*Math.sin(el), ctr.z + dist*Math.cos(el)); cam.lookAt(ctr);
    v.shelf.add(g);
    const pr = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(SH, SH, false);
    r.render(v.shelf, cam);
    const c = document.createElement("canvas"); c.width = c.height = SH;
    c.getContext("2d").drawImage(r.domElement, 0, 0, SH, SH);
    v.shelf.remove(g);
    r.setPixelRatio(pr); VK.w = VK.h = 0;
    if(!VK.raf && VK.rig && !VK.el.hidden) spin(performance.now());
    return c.toDataURL("image/png");
  }
  // ---------- a picture of it ----------
  // The figure as it stands now, drawn at w x h onto a 2D context: rendered at that size for the
  // occasion and put back, all in one task, so the drawing buffer is still whole when it is copied
  // and nothing on screen moves. false when there is no figure to draw.
  VK.paint = (ctx, x, y, w, h) => {
    const v = VK.v; if(!v || !VK.rig || VK.el.hidden) return false;
    const r = v.renderer, pr = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(w, h, false);
    v.camera.aspect = w/h; v.camera.updateProjectionMatrix();
    v.turn.rotation.y = VK.ang; aim(v.camera);
    r.render(v.scene, v.camera);
    ctx.drawImage(r.domElement, x, y, w, h);
    r.setPixelRatio(pr); VK.w = VK.h = 0;                              // the next frame sizes it back to its box
    if(!VK.raf) spin(performance.now());
    return true;
  };
  return VK;
}

// ---------- the card as a picture ----------
// A PNG of one player, 360 x 520 drawn at twice that: the figure, the name and class, six figures,
// the pentagon and the credit, in the site's dark and ember; with o.thumbs, a row of what they wear
// under the figure (the card then 46 px taller). o: {vk, world, online, thumbs: [{src, label}]}. A Blob.
const INKS = {bg: "#141110", bg2: "#1b1715", well: "#100d0c", stage: "#0c0a09", card: "#221d1a", line: "#3a2f28", ink: "#f3ede4", ink2: "#d6cbbd", muted: "#a89c92", faint: "#75685e",
  bright: "#fff", gold: "#f97316", ok: "#6faf68", nil: "#5e534b"};
const FLAME_PATH = "M12 23a7.5 7.5 0 0 1-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14 1 0 2.5 0 5-2.47.27.773.5 1.604.5 2.47A7.5 7.5 0 0 1 12 23z";
const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace', SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
// the six figures a card shows, [value, label, nothing?]
function sixFigures(p){
  const d = num(p.deaths), m = num(p.dist_m), k = num(p.kills), pc = num(p.pieces), h = num(p.hops);
  return [[I18N.num(d), lab(d, "death", "deaths"), !d], [km(m), "km", !m], [per(d, m).replace(/^1\D*?(?=\d)/, ""), I18N.t("per death"), !(d && m)],
    [I18N.num(k), lab(k, "kill", "kills"), !k], [I18N.num(pc), lab(pc, "piece", "pieces"), !pc], [I18N.num(h), lab(h, "hop", "hops"), !h]];
}
async function picture(p, roster, o){
  o = o || {};
  rim(roster);
  // the gear's pictures, decoded before the drawing starts (a picture that fails is left out)
  const thumbs = (await Promise.all((o.thumbs || []).slice(0, 10).map(t => new Promise(ok => {
    if(!t || !t.src){ ok(null); return; }
    const im = new Image(); im.onload = () => ok({im, label: t.label || ""}); im.onerror = () => ok(null); im.src = t.src;
  })))).filter(Boolean);
  const off = thumbs.length ? 46 : 0;
  const S = 2, W = 360, H = 520 + off, C = INKS;
  const cv = document.createElement("canvas"); cv.width = W*S; cv.height = H*S;
  const x = cv.getContext("2d"); x.scale(S, S);
  try{ await Promise.all([document.fonts.load(`700 24px ${MONO}`), document.fonts.load(`400 12px ${MONO}`)]); }catch(e){}
  const spaced = v => { if("letterSpacing" in x) x.letterSpacing = v; };
  const fit = (t, w) => { t = String(t); if(x.measureText(t).width <= w) return t; while(t.length > 1 && x.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; };
  const box = (bx, by, bw, bh, r) => { x.beginPath(); x.roundRect ? x.roundRect(bx, by, bw, bh, r) : x.rect(bx, by, bw, bh); };
  // the card
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg2); g.addColorStop(1, C.well);
  box(.5, .5, W - 1, H - 1, 14); x.fillStyle = g; x.fill(); x.strokeStyle = C.line; x.lineWidth = 1; x.stroke();
  x.fillStyle = C.gold; x.fillRect(16, 0, 44, 2);                       // an ember mark along the top edge
  // the strip: ForgeMap's flame and name, the world at the right
  x.save(); x.translate(16, 15); x.scale(12/24, 12/24); x.fillStyle = C.gold; x.fill(new Path2D(FLAME_PATH)); x.restore();
  x.textBaseline = "alphabetic"; x.font = `700 10px ${MONO}`; spaced("1.5px"); x.fillStyle = C.gold; x.textAlign = "left"; x.fillText("FORGEMAP", 32, 25);
  if(o.world){ x.font = `400 10px ${MONO}`; spaced("0px"); x.fillStyle = C.muted; x.textAlign = "right"; x.fillText(fit(o.world, 200), W - 16, 25); }
  // the name, the class, online or when last seen
  x.textAlign = "left"; spaced("0px"); x.font = `700 24px ${MONO}`; x.fillStyle = C.bright; x.fillText(fit(p.name || "", W - 32), 16, 62);
  const c = classify(p, roster);
  let sx = 16;
  if(c){
    x.font = `600 9.5px ${SANS}`; spaced("1px");
    const t = fit(c.title.toUpperCase(), 200), tw = x.measureText(t).width + 16;
    box(16, 72, tw, 19, 9.5); x.fillStyle = "rgba(255,255,255,.035)"; x.fill(); x.strokeStyle = C.line; if(c.early) x.setLineDash([3, 2]); x.stroke(); x.setLineDash([]);
    x.fillStyle = c.early ? C.muted : C.gold; x.fillText(t, 24, 85); sx = 16 + tw + 10;
  }
  spaced("0px"); x.font = `500 11px ${SANS}`;
  if(o.online){ x.beginPath(); x.arc(sx + 4, 81.5, 3.5, 0, 7); x.fillStyle = C.ok; x.fill(); sx += 12; }
  x.fillStyle = o.online ? C.ok : C.muted; x.fillText(fit(o.online ? I18N.t("online now") : seen(num(p.last_seen)), W - 16 - sx), sx, 85.5);
  // the figure, on the map's ground
  const FX = 16, FY = 104, FW = 150, FH = 236;
  // the stage: a warm dark vignette round the figure, as on the page
  const vg = x.createRadialGradient(FX + FW/2, FY + FH*0.56, 8, FX + FW/2, FY + FH*0.56, FH*0.62);
  vg.addColorStop(0, "#2b1c13"); vg.addColorStop(.55, "#181210"); vg.addColorStop(1, C.stage);
  box(FX, FY, FW, FH, 10); x.fillStyle = vg; x.fill();
  x.save(); box(FX, FY, FW, FH, 10); x.clip();
  const drawn = o.vk && o.vk.paint ? o.vk.paint(x, FX, FY, FW, FH) : false;
  if(!drawn){ x.save(); x.translate(FX + FW/2 - 24, FY + FH/2 - 30); x.scale(2, 2); x.fillStyle = C.line; x.fill(new Path2D(FLAME_PATH)); x.restore(); }
  x.restore();
  box(FX, FY, FW, FH, 10); x.strokeStyle = C.line; x.stroke();
  // six figures, two by three, beside it
  const six = sixFigures(p), GX = 178, GW = (W - 16 - GX)/2, GH = FH/3;
  six.forEach(([v, k, nil], i) => {
    const cx = GX + (i % 2)*GW, cy = FY + Math.floor(i/2)*GH;
    box(cx + (i % 2 ? 4 : 0), cy + (i > 1 ? 4 : 0), GW - 4, GH - 4, 8); x.fillStyle = C.card; x.fill(); x.strokeStyle = C.line; x.stroke();
    const ix = cx + (i % 2 ? 4 : 0) + 10, iy = cy + (i > 1 ? 4 : 0);
    x.font = `700 20px ${MONO}`; spaced("0px"); x.fillStyle = nil ? C.nil : C.bright; x.fillText(fit(v, GW - 22), ix, iy + 36);
    x.font = `600 8.5px ${SANS}`; spaced(".6px"); x.fillStyle = C.muted; x.fillText(fit(String(k).toUpperCase(), GW - 22), ix, iy + 53);
  });
  // what they wear, in small slot frames under the figure
  if(thumbs.length){
    const TS = 30, gap = 4, ty = FY + FH + 10, tx0 = (W - (thumbs.length*TS + (thumbs.length - 1)*gap))/2;
    thumbs.forEach((t, i) => {
      const tx = tx0 + i*(TS + gap);
      box(tx, ty, TS, TS, 6); x.fillStyle = C.card; x.fill(); x.strokeStyle = C.line; x.stroke();
      x.drawImage(t.im, tx + 2, ty + 2, TS - 4, TS - 4);
    });
  }
  // the pentagon, its corners named
  const PC = {x: W/2, y: 418 + off}, R = 44;
  const corner = (i, r) => { const a = -Math.PI/2 + i*2*Math.PI/5; return [PC.x + r*Math.cos(a), PC.y + r*Math.sin(a), a]; };
  x.strokeStyle = C.line; x.lineWidth = 1;
  for(const k of [.25, .5, .75, 1]){ x.beginPath(); for(let i = 0; i < 5; i++){ const [px, py] = corner(i, R*k); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); }
  x.beginPath(); AXES.forEach(([, keys], i) => { const [px, py] = corner(i, R*Math.sqrt(share(p, keys))); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath();
  x.fillStyle = "rgba(249,115,22,.22)"; x.fill(); x.strokeStyle = C.gold; x.lineWidth = 1.6; x.lineJoin = "round"; x.stroke(); x.lineWidth = 1;
  AXES.forEach(([, keys], i) => { const [px, py] = corner(i, R*Math.sqrt(share(p, keys))); x.beginPath(); x.arc(px, py, 2.4, 0, 7); x.fillStyle = C.gold; x.fill(); });
  x.font = `600 9px ${SANS}`; spaced(".8px"); x.fillStyle = C.muted;
  AXES.forEach(([name], i) => {
    const [lx, ly, a] = corner(i, R + 10), cos = Math.cos(a), sin = Math.sin(a);
    x.textAlign = Math.abs(cos) < .2 ? "center" : cos > 0 ? "left" : "right";
    x.fillText(I18N.t(name).toUpperCase(), lx, ly + (sin > .5 ? 9 : sin < -.5 ? -3 : 3));
  });
  // the credit
  x.textAlign = "left"; spaced("0px"); x.strokeStyle = C.line; x.beginPath(); x.moveTo(16, 488.5 + off); x.lineTo(W - 16, 488.5 + off); x.stroke();
  x.font = `400 9.5px ${MONO}`; x.fillStyle = C.faint; x.fillText(I18N.date(Date.now(), {day: "numeric", month: "short", year: "numeric"}), 16, 507 + off);
  x.textAlign = "right"; x.font = `700 9.5px ${MONO}`; x.fillStyle = C.ink2;
  const tail = "ForgeServer.fr", tw = x.measureText(tail).width; x.fillText(tail, W - 16, 507 + off);
  x.fillStyle = C.gold; x.fillText("ForgeMap · ", W - 16 - tw, 507 + off);
  return new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(new Error("toBlob")), "image/png"));
}
// hand a Blob to the browser as a file, by a link with download
function save(blob, file){
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = file; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// a file name from a player's name: letters and digits kept, the rest a dash
const fileName = name => "forgemap-" + (String(name || "player").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "player") + ".png";

// ForgeMap: an online player's ping (ms, the server's 1-minute average), coloured by how it plays; "" when unknown
function ping(ms){
  if(typeof ms !== "number" || !(ms >= 0)) return "";
  const q = ms < 80 ? "good" : ms < 150 ? "fair" : "bad";
  return ` <span class="fm-ping ${q}" title="${I18N.t("Ping: network delay between this player and the server")}">${I18N.t("{n} ms", {n: Math.round(ms)})}</span>`;
}
return {seen, sea, kpd, kit, BEST, rim, radar, classify, pill, figures, sixFigures, viking, picture, save, fileName, ping};
})();
