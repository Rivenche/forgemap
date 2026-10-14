/* gear.js -- ForgeMap (ForgeServer.fr): what a player wears and holds, as a game's inventory.
 * One frame per slot with a small 3D picture of the item (PlayerCard.viking's renderer draws it),
 * its name as the game writes it, the slot and the item's figures from /items; the favourite in
 * hand from /stats/players' gear.fav. Shared by the players page (the panel) and a player's card
 * (a strip). A server without /items shows the names alone.
 *
 * Honesty: the game sends the star level only for what is in the hands, on the back and the cape
 * (gear.wornQ); everything else is shown at level 1 with what a level adds.
 */
const Gear = (() => {
"use strict";
const esc = MapCore.esc, num = MapCore.num;

// the slots in the order the game's equipment reads; label: the slot's name on the frame
const SLOTS = [["helmet", "Head"], ["chest", "Chest"], ["legs", "Legs"], ["shoulder", "Cape"], ["utility", "Belt"], ["trinket", "Trinket"],
  ["right", "Right hand"], ["left", "Left hand"], ["rightBack", "On the back"], ["leftBack", "On the back"]];

// the game's own name for it (js/lang/noms.js), else the prefab spelled out
const word = n => I18N.name(n) || String(n || "").replace(/^(Armor|Helmet|Cape)/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();

// What the player has on, slot by slot: the look's set (every slot, as the game syncs it) when there
// is one, else the tally's last worn set, whose hand holds the sheathed item when the hand is empty.
function slots(p, look){
  const s = look && look.slots, w = (p && p.gear && p.gear.worn) || {}, out = [];
  for(const [k, label] of SLOTS){
    let item = s ? s[k] : w[k];
    if(!s && (k === "right" || k === "left") && item && item === w[k + "Back"]) item = null;
    if(item) out.push({slot: k, label, item, q: level(p, k, item)});
  }
  return out;
}
// the star level the game synced for that slot, when the tally saw this same item there
function level(p, slot, item){
  const g = (p && p.gear) || {}, q = g.wornQ && num(g.wornQ[slot]), w = g.worn || {};
  return q > 0 && w[slot] === item ? q : 0;
}

// ---------- the items' figures ----------
// /items once per item and page; NOROUTE: until when the server is taken to have none (an older mod:
// asked again ten minutes on, in case the mod was updated under an open page)
const STATS = new Map();
let NOROUTE = 0;
// the figures of these items fetched; true when something new arrived (the caller draws again)
async function want(api, ids){
  const need = [...new Set(ids)].filter(i => i && !STATS.has(i) && /^[A-Za-z0-9_]{1,64}$/.test(i));
  if(!need.length || Date.now() < NOROUTE) return false;
  let got = false;
  for(let i = 0; i < need.length; i += 40){
    const part = need.slice(i, i + 40);
    try{
      const j = await MapCore.fetchJSON(api, `/items?ids=${part.join(",")}`, {cache: "default"});
      const items = (j && j.items) || {};
      for(const id of part){ STATS.set(id, items[id] || null); if(items[id]) got = true; }
    }catch(e){
      if(e.status === 404 || e.status === 501){ NOROUTE = Date.now() + 600000; return got; }
      for(const id of part) STATS.set(id, null);
    }
  }
  return got;
}
const statsOf = item => STATS.get(item) || null;

const DMG = {damage: "Damage", blunt: "Blunt", slash: "Slash", pierce: "Pierce", chop: "Chop", pickaxe: "Pickaxe",
  fire: "Fire", frost: "Frost", lightning: "Lightning", poison: "Poison", spirit: "Spirit"};
const MODS = {Resistant: "Resistant", VeryResistant: "Very resistant", SlightlyResistant: "Slightly resistant",
  Weak: "Weak", VeryWeak: "Very weak", SlightlyWeak: "Slightly weak", Immune: "Immune", Ignore: "Immune"};
// "Resistant to frost": the preposition is the type's own in French (au givre, à la foudre)
const MOD_TO = {blunt: "{mod} to blunt", slash: "{mod} to slash", pierce: "{mod} to pierce", fire: "{mod} to fire", frost: "{mod} to frost",
  lightning: "{mod} to lightning", poison: "{mod} to poison", spirit: "{mod} to spirit", chop: "{mod} to chop", pickaxe: "{mod} to pickaxe"};
const SKILLS = {Swords: "Swords", Knives: "Knives", Clubs: "Clubs", Polearms: "Polearms", Spears: "Spears", Blocking: "Blocking", Axes: "Axes",
  Bows: "Bows", Crossbows: "Crossbows", ElementalMagic: "Elemental magic", BloodMagic: "Blood magic", Unarmed: "Unarmed", Pickaxes: "Pickaxes",
  WoodCutting: "Woodcutting", Fishing: "Fishing"};
const n1 = v => I18N.num(Math.round(v*10)/10);
// a figure at level q: base + (q - 1) x what a level adds
const at = (base, per, q) => num(base) + (q > 1 ? (q - 1)*num(per) : 0);

// The item's figures at a level (q, 0 when unknown: level 1 is shown): [{k, v, per}] for the leading
// ones (armour, damage, block), and the rest as short phrases.
function figures(s, q){
  if(!s) return null;
  const L = q || 1, lead = [], rest = [];
  if(s.armor) lead.push({k: I18N.t("Armour"), v: at(s.armor, s.armorPerLevel, L), per: num(s.armorPerLevel)});
  const d = s.damages || {}, dp = s.damagesPerLevel || {};
  for(const t of Object.keys(DMG)) if(num(d[t]) > 0) lead.push({k: I18N.t(DMG[t]), v: at(d[t], dp[t], L), per: num(dp[t])});
  if(s.block) lead.push({k: I18N.t("Block"), v: at(s.block, s.blockPerLevel, L), per: num(s.blockPerLevel)});
  if(s.deflection) rest.push(I18N.t("Block force {n}", {n: n1(at(s.deflection, s.deflectionPerLevel, L))}));
  if(s.durability) rest.push(I18N.t("Durability {n}", {n: n1(at(s.durability, s.durabilityPerLevel, L))}));
  if(s.weight) rest.push(I18N.t("Weight {n}", {n: n1(num(s.weight))}));
  if(s.movement) rest.push(I18N.t("{pct}% speed", {pct: (s.movement > 0 ? "+" : "") + I18N.num(Math.round(num(s.movement)*100))}));
  if(s.eitrRegen) rest.push(I18N.t("{pct}% eitr regeneration", {pct: (s.eitrRegen > 0 ? "+" : "") + I18N.num(Math.round(num(s.eitrRegen)*100))}));
  const mods = Object.entries(s.damageMods || {}).filter(([t, m]) => MODS[m] && MOD_TO[t]).map(([t, m]) => I18N.t(MOD_TO[t], {mod: I18N.t(MODS[m])}));
  const skill = s.skill && SKILLS[s.skill] ? I18N.t(SKILLS[s.skill]) : "";
  const set = s.set && s.set.name ? I18N.t("Set of {n}: {name}", {n: num(s.set.size), name: s.set.name.charAt(0).toUpperCase() + s.set.name.slice(1)}) : "";
  return {lead, rest, mods, skill, set, max: Math.max(1, num(s.maxQuality)), q};
}
// the leading figures in one line: "Armour 20 · Slash 35"
const leadLine = f => f.lead.slice(0, 3).map(x => `${esc(x.k)} <b>${n1(x.v)}</b>`).join(" · ");
// the level: pips when known, else "at level 1 · up to 4"
function levelLine(f){
  if(f.max <= 1) return "";
  if(f.q) return `<span class="eq-q" title="${esc(I18N.t("Level {q} of {max}", {q: f.q, max: f.max}))}">`
    + Array.from({length: f.max}, (_, i) => `<i${i < f.q ? ' class="on"' : ""}></i>`).join("") + `</span>`;
  const per = f.lead.find(x => x.per > 0);
  return `<span class="eq-l">${I18N.t("at level 1")}${per ? " · " + I18N.t("+{n} per level", {n: n1(per.per)}) : ""} · ${I18N.t("up to level {max}", {max: f.max})}</span>`;
}
// everything, for the frame opened
function detail(f, name, slotLabel){
  if(!f) return `<div class="eq-more"><b>${esc(name)}</b><span>${esc(slotLabel)}</span><span class="eq-dim">${I18N.t("No figures from this server yet.")}</span></div>`;
  const rows = f.lead.map(x => `<span class="eq-row"><span>${esc(x.k)}</span><b>${n1(x.v)}</b>${x.per > 0 ? `<i>${I18N.t("+{n}/lvl", {n: n1(x.per)})}</i>` : ""}</span>`).join("");
  return `<div class="eq-more"><b>${esc(name)}</b><span>${esc(slotLabel)}${f.skill ? " · " + esc(f.skill) : ""}</span>`
    + (rows ? `<span class="eq-rows">${rows}</span>` : "")
    + (f.rest.length ? `<span>${f.rest.map(esc).join(" · ")}</span>` : "")
    + (f.mods.length ? `<span class="eq-mod">${f.mods.map(esc).join(" · ")}</span>` : "")
    + (f.set ? `<span class="eq-dim">${esc(f.set)}</span>` : "")
    + `<span class="eq-dim">${f.q ? I18N.t("Figures at its level, {q} of {max}.", {q: f.q, max: f.max}) : f.max > 1 ? I18N.t("Figures at level 1: the server cannot see the level of this slot.") : ""}</span></div>`;
}

// ---------- the slots' own icons, while a picture is missing ----------
const ICON = {
  helmet: "M5 14a7 7 0 0 1 14 0v3h-3v-3h-8v3H5zM12 7V4",
  chest: "M8 4l4 2 4-2 4 3-2 4-1-1v10H7V10l-1 1-2-4z",
  legs: "M7 4h10l1 16h-4l-2-10-2 10H6z",
  shoulder: "M7 4h10l2 16-7-3-7 3z",
  utility: "M3 10h18v4H3zM10 9h4v6h-4z",
  trinket: "M8 3l4 6 4-6M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  right: "M14 4l6 0 0 6-9 9-3-3zM5 16l3 3M4 20l2-2",
  left: "M12 3c4 2 7 4 7 9s-3 7-7 9c-4-2-7-4-7-9s3-7 7-9z",
  rightBack: "M14 4l6 0 0 6-9 9-3-3zM5 16l3 3M4 20l2-2",
  leftBack: "M14 4l6 0 0 6-9 9-3-3zM5 16l3 3M4 20l2-2",
};
const icon = slot => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[slot] || ICON.right}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const pic = (item, kind, slot) => `<span class="eq-pic" data-item="${esc(item)}" data-kind="${kind}">${icon(slot || kind)}</span>`;

// ---------- the favourite in hand ----------
const TOOL = /^(Hammer|Hoe|Cultivator|Pickaxe|Torch|Lantern|FishingRod)/;
function favourites(p){
  const g = (p && p.gear) || {}, fav = Array.isArray(g.fav) ? g.fav.filter(f => f && f.item && num(f.s) > 0) : [];
  if(!fav.length) return byKind(g);
  const hand = g.hand || {}, held = Object.entries(hand).filter(([k]) => k !== "none" && k !== "twohanded").reduce((t, [, v]) => t + num(v), 0);
  const total = Math.max(held, fav.reduce((t, f) => t + num(f.s), 0));
  const weapon = fav.find(f => !TOOL.test(f.item) && (!statsOf(f.item) || !/^(Tool|Torch)$/.test(statsOf(f.item).type)));
  return {top: weapon || fav[0], weapon: !!weapon, list: fav.map(f => ({item: f.item, share: num(f.s)/total}))};
}
// Until the server has timed each item in hand (gear.fav, ForgeMap 1.2), the kind of weapon held the
// longest (gear.hand, kept from the start): its share, and the item itself when one of that kind is worn.
const KIND = {bow: [/^Bow/, "Bow"], crossbow: [/^Crossbow/, "Crossbow"], axe: [/^Axe/, "Axe"], battleaxe: [/^Battleaxe/, "Battleaxe"],
  sword: [/^Sword/, "Sword"], mace: [/^Mace/, "Mace"], club: [/^Club/, "Club"], sledge: [/^Sledge/, "Sledge"], spear: [/^Spear/, "Spear"],
  knife: [/^Knife/, "Knife"], atgeir: [/^Atgeir/, "Atgeir"], staff: [/^Staff/, "Staff"], fist: [/^Fist/, "Fists"]};
function byKind(g){
  const hand = g.hand || {}, held = Object.entries(hand).filter(([k]) => k !== "none" && k !== "twohanded");
  const total = held.reduce((t, [, v]) => t + num(v), 0); if(!total) return null;
  const best = held.filter(([k]) => KIND[k]).sort((a, b) => num(b[1]) - num(a[1]))[0]; if(!best) return null;
  const [k, v] = best, worn = Object.values(g.worn || {}).find(n => KIND[k][0].test(String(n || "")));
  return {top: {item: worn || ""}, weapon: true, kind: KIND[k][1], list: [{item: worn || "", share: num(v)/total}]};
}
function favBlock(p){
  const F = favourites(p); if(!F) return "";
  const it = F.top.item, name = it ? word(it) : I18N.t(F.kind), f = it ? figures(statsOf(it), level(p, "right", it) || level(p, "left", it)) : null;
  const share = F.list.find(x => x.item === it).share;
  return `<div class="eq fav" tabindex="0">${pic(it, "right", "right")}<span class="eq-txt">`
    + `<span class="eq-k">${F.weapon ? I18N.t("Favourite weapon") : I18N.t("Most in hand")}</span>`
    + `<span class="eq-n">${esc(name)}</span>`
    + `<span class="eq-s">${I18N.t("{pct}% of the time in hand", {pct: Math.max(1, Math.round(share*100))})}${f && f.lead.length ? " · " + leadLine(f) : ""}</span>`
    + (F.list.length > 1 ? `<span class="eq-l">${I18N.t("Most in hand: {list}", {list: F.list.map(x => esc(I18N.t("{what} {pct}%", {what: word(x.item), pct: Math.max(1, Math.round(x.share*100))}))).join(" · ")})}</span>` : "")
    + `</span>${detail(f, name, F.weapon ? I18N.t("Favourite weapon") : I18N.t("Most in hand"))}</div>`;
}

// ---------- the panel and the strip ----------
// The players page's panel: the favourite first, then a frame per slot. "" when nothing is known.
function panel(p, look){
  const list = slots(p, look), fav = favBlock(p);
  if(!list.length && !fav) return "";
  const frames = list.map(s => {
    const name = word(s.item), f = figures(statsOf(s.item), s.q);
    return `<div class="eq" tabindex="0" data-slot="${s.slot}">${pic(s.item, s.slot)}<span class="eq-txt">`
      + `<span class="eq-k">${I18N.t(s.label)}</span><span class="eq-n" title="${esc(name)}">${esc(name)}</span>`
      + (f && f.lead.length ? `<span class="eq-s">${leadLine(f)}</span>` : "")
      + (f ? levelLine(f) : "")
      + `</span>${detail(f, name, I18N.t(s.label))}</div>`;
  }).join("");
  return `<section class="group gear"><h3 class="eyebrow">${I18N.t("Gear")} <small>${I18N.t("last seen wearing")}</small></h3>`
    + `<div class="eqs">${fav}${frames}</div></section>`;
}
// A player's card: the slots as small frames in a row, the name and figures under the pointer
function strip(p, look){
  const list = slots(p, look); if(!list.length) return "";
  return `<div class="eqstrip">` + list.map(s => {
    const f = figures(statsOf(s.item), s.q), line = f && f.lead.length ? " · " + f.lead.slice(0, 2).map(x => `${x.k} ${n1(x.v)}`).join(" · ") : "";
    return `<span class="eqs-f" title="${esc(I18N.t("{slot}: {name}", {slot: I18N.t(s.label), name: word(s.item)}) + line)}">${pic(s.item, s.slot)}</span>`;
  }).join("") + `</div>`;
}
// The pictures put in: those drawn already at once, the others as they come. vk: PlayerCard.viking's.
const PICS = new Map();
function fill(root, vk, models){
  if(!root || !vk || !vk.thumb) return;
  for(const el of root.querySelectorAll(".eq-pic[data-item]:not(.has)")){
    const k = el.dataset.item + "|" + el.dataset.kind;
    const put = url => { if(url && el.isConnected && !el.classList.contains("has")){ el.innerHTML = `<img src="${url}" alt="" draggable="false">`; el.classList.add("has"); } };
    if(typeof PICS.get(k) === "string"){ put(PICS.get(k)); continue; }
    vk.thumb(el.dataset.item, el.dataset.kind, models).then(url => { if(url) PICS.set(k, url); put(url); });
  }
}
// the pictures of what they wear, for the PNG: [{src, label}], drawn first where missing
async function pictures(p, look, vk, models){
  const list = slots(p, look);
  if(!vk || !vk.thumb) return [];
  const urls = await Promise.all(list.map(s => vk.thumb(s.item, s.slot, models).catch(() => null)));
  return list.map((s, i) => ({src: urls[i], label: word(s.item)})).filter(x => x.src);
}
// the ids a panel needs figures for
const ids = (p, look) => slots(p, look).map(s => s.item).concat(((p && p.gear && p.gear.fav) || []).map(f => f && f.item));

// A frame tapped or clicked opens its figures (a phone has no pointer to hover with); another
// frame, or anywhere else, closes it; Escape too.
if(typeof document !== "undefined" && document.addEventListener){
  document.addEventListener("click", e => {
    const eq = e.target && e.target.closest ? e.target.closest(".eq") : null;
    for(const o of document.querySelectorAll(".eq.open")) if(o !== eq) o.classList.remove("open");
    if(eq) eq.classList.toggle("open");
  });
  document.addEventListener("keydown", e => {
    const eq = e.target && e.target.closest ? e.target.closest(".eq") : null;
    if(e.key === "Escape") for(const o of document.querySelectorAll(".eq.open")) o.classList.remove("open");
    else if(eq && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); eq.classList.toggle("open"); }
  });
}
// retry: ask /items again now (after a server update; also the console's way to test the panel)
return {SLOTS, word, slots, want, statsOf, figures, panel, strip, fill, pictures, ids, favourites, retry(){ NOROUTE = 0; }};
})();
