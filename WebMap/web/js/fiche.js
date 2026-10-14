/* fiche.js -- ForgeMap (ForgeServer.fr): one player's card, fiche.html?p=<name>[&lang=fr|en][&theme=transparent].
 * Made to be put in an iframe on another site: the figure turning (and turned by hand), the class, six
 * figures, the pentagon, and the credit. Read from the same /stats/players and /state as the players
 * page, again each minute. A PNG of the same card from the small button at the top right.
 */
(() => {
"use strict";
const API = MapCore.cfg.api, esc = MapCore.esc, num = MapCore.num;
const Q = new URLSearchParams(location.search);
const NAME = (Q.get("p") || "").trim(), LANG = Q.get("lang");
if(Q.get("theme") === "transparent") document.documentElement.classList.add("clear");
const card = document.getElementById("card"), body = document.getElementById("body"), btn = document.getElementById("png");
const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 23a7.5 7.5 0 0 1-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14 1 0 2.5 0 5-2.47.27.773.5 1.604.5 2.47A7.5 7.5 0 0 1 12 23z"/></svg>';
let DATA = [], ONLINE = [], MODELS = 0, WORLD = "", P = null, LOADED = false, LAST = "";
const VK = PlayerCard.viking(API);

// the world's name, when the server gives it (the Atelier's copy keeps /config to itself)
MapCore.fetchJSON(API, "/config").then(c => {
  WORLD = (c && c.world_name) || "";
  document.getElementById("world").textContent = WORLD;
}).catch(() => {});

// the name as written, else the same name in other capitals
const find = name => DATA.find(p => p.name === name) || DATA.find(p => String(p.name || "").toLowerCase() === name.toLowerCase());
function message(title, text){
  P = null; LAST = ""; VK.hide(); btn.hidden = true;
  card.classList.remove("ok");
  body.innerHTML = `<p class="msg"><b>${title}</b>${text}</p>`;
}
// ForgeMap: the card opened on its own on a big screen gets its own layout (see fiche.html)
const WIDE = typeof matchMedia === "function" ? matchMedia("(min-width:900px) and (min-height:560px)") : {matches: false, addEventListener(){}};
WIDE.addEventListener("change", () => { LAST = ""; render(); });
function render(){
  if(!NAME) return message(I18N.t("Which player?"), I18N.t("Add ?p= and a player's name to the address."));
  const p = find(NAME);
  if(!p) return message(I18N.t("No player called {name} here yet", {name: esc(NAME)}), I18N.t("Names are spelled as in the game. A player shows here once the server has seen them."));
  P = p;
  PlayerCard.rim(DATA);
  const on = !!p.online, cls = PlayerCard.classify(p, DATA), here = ONLINE.find(q => q.name === p.name);
  const full = `players.html${LANG ? `?lang=${encodeURIComponent(LANG)}` : ""}#p=${encodeURIComponent(p.name)}`;
  const six = PlayerCard.sixFigures(p).map(([v, k, nil]) => `<div class="stat${nil ? " nil" : ""}"><div class="v">${v}</div><div class="k">${k}</div></div>`).join("");
  const html = `<div class="head"><div class="nm"><a href="${esc(full)}" target="_blank" rel="noopener" title="${esc(I18N.t("Open their full page"))}">${esc(p.name)}</a></div>`
    + `<div class="sub2">${PlayerCard.pill(cls)}${on ? `<span class="dot ok"></span>` : ""}<span class="seen">${on ? I18N.t("online now") + PlayerCard.ping(here && here.ping) : PlayerCard.seen(num(p.last_seen))}</span></div></div>`
    + (WIDE.matches
      // a big screen: the figure the whole height on the left; on the right the figures and the pentagon
      // drawn at its own size with its details, then the full gear panel (names, stats, favourite weapon)
      ? `<div class="wide"><div class="fig3d" id="fig"><span class="none">${FLAME}</span></div><div class="side">`
        + `<div class="top"><div class="six">${six}</div><div class="pent">${PlayerCard.radar(p, 210, true)}</div></div>`
        + Gear.panel(p, lookOf(p, here)) + `</div></div>`
      : `<div class="mid"><div class="fig3d" id="fig"><span class="none">${FLAME}</span></div><div class="six">${six}</div></div>`
        + Gear.strip(p, lookOf(p, here))
        + `<div class="pent">${PlayerCard.radar(p, 112, true, true)}</div>`);
  card.classList.toggle("ok", on);
  if(html !== LAST){ body.innerHTML = html; LAST = html; if(!VK.big) document.getElementById("fig").appendChild(VK.el); }   // untouched DOM, so no flicker on the minute
  btn.hidden = false;
  document.title = `${p.name} · ForgeMap`;
  VK.show(p.name, lookOf(p, here), on, MODELS);
  // the gear's pictures, and its figures once for the frames' titles (a server without /items: the names alone)
  Gear.fill(body, VK, MODELS);
  Gear.want(API, Gear.ids(p, lookOf(p, here))).then(got => { if(got && P === p) render(); });
}
// the look a player is drawn in: /state's while they are online, the one the server remembers after
const lookOf = (p, here) => (p.online && here && here.look) || p.look || null;

btn.addEventListener("click", async () => {
  if(!P) return;
  btn.disabled = true;
  try{
    const here = ONLINE.find(q => q.name === P.name), thumbs = await Gear.pictures(P, lookOf(P, here), VK, MODELS).catch(() => []);
    const blob = await PlayerCard.picture(P, DATA, {vk: VK.name === P.name ? VK : null, world: WORLD, online: !!P.online, thumbs});
    PlayerCard.save(blob, PlayerCard.fileName(P.name));
  }catch(e){ console.warn("png", e.message || e); }
  btn.disabled = false;
});

async function load(){
  try{
    const j = await MapCore.fetchJSON(API, "/stats/players");
    DATA = Array.isArray(j.players) ? j.players : [];
    try{
      const st = await MapCore.fetchState(API);
      ONLINE = ((st.players || {}).players) || [];
      MODELS = (st.rev || {}).models || 0;
    }catch(e){}
    LOADED = true;
    render();
    document.getElementById("stamp").textContent = I18N.t("updated {time}", {time: new Date().toLocaleTimeString(I18N.locale, {hour: "2-digit", minute: "2-digit"})});
  }catch(e){
    // a stale card beats an empty one
    if(!LOADED) message(I18N.t("stats unavailable"), I18N.t("The server is not answering right now. This page retries every minute."));
  }
}
load();
MapCore.everyMinute(load);
})();
