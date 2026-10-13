/* spot.js — the spotlight: one figure at a time with a line of context and a small picture, turned
 * every few seconds, held by a hover, stepped by a click. The map, the World page and a player's page
 * each hand init the element's id, their entries as a function, the pace, when it may turn, and its
 * shape: a card, or the players' strip of fixed height.
 */
const Spot = (() => {
"use strict";
const esc = MapCore.esc, num = MapCore.num, km = MapCore.km;

// ---------- the turn ----------
// One spotlight a page. An entry is {k, v, c, svg}: its name (English, as the tour picks by it,
// translated here when shown), the figure and the line (both html),
// and the picture, from MapCore.pic.
const S = {id: "spot", entries: () => [], every: 7000, when: () => true, wide: false, el: null, list: [], i: -1, timer: 0, held: false, html: ""};
function init(o){ Object.assign(S, {id: o.id || "spot", entries: o.entries, every: o.every || 7000, when: o.when || (() => true), wide: o.shape === "strip"}); }
function render(){
  const el = document.getElementById(S.id); if(!el) return;
  S.list = S.entries();
  el.hidden = !S.list.length; if(el.hidden) return;
  if(S.i < 0) S.i = Math.floor(Math.random()*S.list.length);
  S.i %= S.list.length;
  // a page that draws the element afresh (the players page does) has each one wired, drawn into
  // and given a whole turn before the next
  if(S.el !== el){
    S.el = el; S.html = "";
    el.classList.toggle("wide", S.wide);
    el.onmouseenter = () => { S.held = true; }; el.onmouseleave = () => { S.held = false; };
    el.onclick = () => show(true);
    clearInterval(S.timer); S.timer = 0;
  }
  show(false);
  if(!S.timer) S.timer = setInterval(() => { if(!S.held && document.visibilityState === "visible" && S.when()) show(true); }, S.every);
}
function show(advance){
  const el = S.el; if(!el || !S.list.length) return;
  if(advance) S.i = (S.i + 1) % S.list.length;
  const s = S.list[S.i], n = S.list.length;
  const html = `<div class="in${advance ? " out" : ""}"><div class="eyebrow"><span>${esc(I18N.t(s.k))}</span><span class="n">${S.i + 1}/${n}</span></div>`
    + `<div class="v">${s.v}</div><div class="c">${s.c}</div>${s.svg}</div>`
    + `<div class="dots">${S.list.map((_, i) => `<i${i === S.i ? ' class="on"' : ""}></i>`).join("")}</div>`;
  if(!advance && html === S.html) return;      // the minute's data said nothing new: no flicker
  el.innerHTML = html; S.html = html;
  if(advance) requestAnimationFrame(() => requestAnimationFrame(() => { const i = el.querySelector(".in"); if(i) i.classList.remove("out"); S.html = el.innerHTML; }));
}
// a fresh start, as a new pick on the players page wants: anywhere in the list, the clock from nought
function reset(){ S.i = -1; clearInterval(S.timer); S.timer = 0; }

// ---------- the map's entries ----------
// One thing about the world at a time, under the tiles: how much is walked, who built the most
// of what stands, the boats by kind, the gates linked, the bosses down, where people die, the
// graves out there, the names given, and the roster's farthest, deadliest and loudest -- from
// the world as the map page holds it (W), which the tour's figures read too.
function world(W){
  const out = [], P = (W.stats && Array.isArray(W.stats.players)) ? W.stats.players : [], pic = MapCore.pic;
  const top = get => P.length ? P.slice().sort((a, b) => get(b) - get(a))[0] : null;
  const sum = get => P.reduce((t, q) => t + get(q), 0);
  if(W.explored != null) out.push({k: "Explored", v: I18N.t("{pct}% <small>of the world</small>", {pct: I18N.num(+(W.explored*100).toFixed(1), {minimumFractionDigits: 1, maximumFractionDigits: 1})}), c: I18N.t("walked by someone since the fog first lifted"), svg: pic.ring(W.explored, I18N.t("walked, the rest still under fog"))});
  if(W.pieces){ const b = top(q => num(q.pieces)), all = sum(q => num(q.pieces));
    out.push({k: "Standing", v: I18N.tn(W.pieces.length, "{n} <small>piece</small>", "{n} <small>pieces</small>"), c: b && num(b.pieces) ? I18N.t("{name} built the most of it", {name: esc(b.name)}) : I18N.t("built by everyone"), svg: b && all ? pic.ring(num(b.pieces)/all, I18N.t("of it is {name}'s", {name: b.name})) : ""}); }
  if(W.forest.stumps != null){ const b = top(q => num(q.trees));
    out.push({k: "Felled", v: I18N.tn(num(W.forest.stumps), "{n} <small>tree</small>", "{n} <small>trees</small>"), c: b && num(b.trees) ? I18N.t("{name} felled the most", {name: esc(b.name)}) : I18N.t("stumps standing where trees were"), svg: b && num(b.trees) ? pic.strip(P, b, q => num(q.trees)) : ""}); }
  const K = W.stats && W.stats.kitchen;   // none from a mod without a kitchen
  if(K && num(K.cooked) + num(K.brewed) + num(K.smelted)){ const cook = top(q => num((q.kitchen || {}).cooked)), mine = cook ? num((cook.kitchen || {}).cooked) : 0;
    out.push({k: "Kitchen", v: I18N.tn(num(K.cooked), "{n} <small>meal cooked</small>", "{n} <small>meals cooked</small>"), c: `${I18N.tn(num(K.brewed), "{n} mead brewed", "{n} meads brewed")} · ${I18N.tn(num(K.smelted), "{n} bar smelted", "{n} bars smelted")}`,
              svg: mine && num(K.cooked) ? pic.ring(mine/num(K.cooked), I18N.t("of it cooked by {name}", {name: cook.name})) : ""}); }
  const boats = (W.vehicles || []).filter(v => v.kind === "boat");
  if(boats.length){ const kinds = {}; boats.forEach(v => { const k = MapCore.vehicleStyle(v).label; kinds[k] = (kinds[k] || 0) + 1; });
    const rows = Object.entries(kinds).sort((a, b) => b[1] - a[1]);
    // the hulls the game names, counted in words; a hull it does not name keeps its own name
    const HULLS = {Raft: ["{n} raft", "{n} rafts"], Karve: ["{n} karve", "{n} karves"], Longship: ["{n} longship", "{n} longships"], Boat: ["{n} boat", "{n} boats"]};
    const hulls = (k, n) => HULLS[k] ? I18N.tn(n, HULLS[k][0], HULLS[k][1]) : `${n} ${k.toLowerCase()}${n > 1 ? "s" : ""}`;
    out.push({k: "Afloat", v: I18N.tn(boats.length, "{n} <small>boat</small>", "{n} <small>boats</small>"), c: rows.map(([k, n]) => hulls(k, n)).join(" \u00b7 "), svg: pic.bars(rows.slice(0, 3).map(([k, n]) => ({frac: n/boats.length, label: `${n} ${I18N.t(k)}`})))}); }
  if(W.portals.length){ const by = new Map(W.portals.map(p => [p.id, p])); const linked = W.portals.filter(p => p.to && p.to !== "0" && p.to !== p.id && by.has(p.to)).length;
    out.push({k: "Gates", v: I18N.tn(W.portals.length, "{n} <small>portal</small>", "{n} <small>portals</small>"), c: `${I18N.tn(Math.floor(linked/2), "{n} pair linked", "{n} pairs linked")} \u00b7 ${I18N.t("{n} waiting for a twin", {n: W.portals.length - linked})}`, svg: pic.ring(linked/W.portals.length, I18N.t("linked to another"))}); }
  if(W.stats && Array.isArray(W.stats.bosses)){ const down = MapCore.BOSSES.down(W.stats.bosses), N = Math.max(MapCore.BOSSES.order.length, down.length);
    out.push({k: "Bosses", v: I18N.t("{n} <small>of {total} fallen</small>", {n: down.length, total: N}), c: down.length ? I18N.t("the last to fall: {name}", {name: esc(MapCore.BOSSES.label(down[down.length - 1]))}) : I18N.t("every one still standing"), svg: pic.ring(down.length/N, I18N.t("of the bosses"))}); }
  const deaths = sum(q => num(q.deaths));
  if(deaths){ const by = {}; P.forEach(q => (q.biomes || []).forEach(b => { by[b.biome] = (by[b.biome] || 0) + num(b.deaths); }));
    const rows = Object.entries(by).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 3), placed = rows.reduce((t, r) => t + r[1], 0);
    // the ground under a death has been kept for less long than the deaths themselves: it speaks only once it covers a fair share
    const ground = placed >= deaths/4;
    out.push({k: "Deaths", v: `${deaths}`, c: ground ? I18N.t("most of them in the {biome}", {biome: esc(I18N.t(rows[0][0]))}) : I18N.t("since the count began"), svg: ground ? pic.bars(rows.map(([b, n]) => ({frac: n/placed, label: `${n} ${I18N.t(b)}`, colour: MapCore.BIOME_INK[b]}))) : ""}); }
  if(W.graves.length){ const by = {}; W.graves.forEach(g => { by[g.name] = (by[g.name] || 0) + 1; }); const rows = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3);
    out.push({k: "Graves", v: I18N.t("{n} <small>out there</small>", {n: W.graves.length}), c: I18N.t("gear still lying where someone fell"), svg: pic.bars(rows.map(([n, c]) => ({frac: c/W.graves.length, label: `${c} ${n}`})))}); }
  if(W.features && W.features.length){ const named = W.features.filter(f => f.by); if(named.length){ const last = named.slice().sort((a, b) => num(b.t) - num(a.t))[0];
    out.push({k: "Named", v: I18N.tn(named.length, "{n} <small>place named</small>", "{n} <small>places named</small>"), c: I18N.t("the latest: {name}, by {by}", {name: esc(last.name), by: esc(last.by)}), svg: pic.ring(named.length/W.features.length, I18N.t("of the places carry a given name"))}); } }
  const far = top(q => num(q.dist_m)); if(far && num(far.dist_m)) out.push({k: "Farthest", v: esc(far.name), c: I18N.t("{n} km on foot and by boat", {n: km(far.dist_m)}), svg: pic.strip(P, far, q => num(q.dist_m))});
  const kill = top(q => num(q.kills)); if(kill && num(kill.kills)) out.push({k: "Slayer", v: esc(kill.name), c: I18N.tn(num(kill.kills), "{n} kill", "{n} kills"), svg: pic.strip(P, kill, q => num(q.kills))});
  const dead = top(q => num(q.deaths)); if(dead && num(dead.deaths)) out.push({k: "Most deaths", v: esc(dead.name), c: I18N.tn(num(dead.deaths), "{n} death in {km} km", "{n} deaths in {km} km", {km: km(dead.dist_m)}), svg: pic.strip(P, dead, q => num(q.deaths))});
  const loud = top(q => num(q.chat)); if(loud && num(loud.chat)) out.push({k: "Loudest", v: esc(loud.name), c: I18N.tn(num(loud.chat), "{n} line said in chat", "{n} lines said in chat"), svg: pic.strip(P, loud, q => num(q.chat))});
  if(W.deaths.length){ const d = W.deaths[W.deaths.length - 1], w = MapCore.toWorld(d.px, d.py);
    out.push({k: "Latest death", v: esc(d.name), c: I18N.t("{ago} at {x}, {z}", {ago: MapCore.ago(d.t*1000), x: Math.round(w.x), z: Math.round(w.z)}), svg: ""}); }
  return out;
}

return {init, render, reset, world};
})();
