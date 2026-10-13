// ForgeMap (ForgeServer.fr) -- the pages' language. English is the source text the code
// is written in; every other language is a table from that text to its translation, in
// js/lang/<code>.js, loaded after this file. A string with no entry stays English, so a
// new upstream text shows untranslated, never broken.
//
//   I18N.t("Players")                         -> "Joueurs"
//   I18N.t("{n} km per death", {n: 30})        -> "30 km par mort"
//   I18N.tn(n, "{n} piece", "{n} pieces")     -> the form for n, then t() of it
//   I18N.num(1192) / I18N.date(d, opts) / I18N.time(d)   -> in the page's locale
//
// The static text of the pages is translated once, at DOMContentLoaded: every text node
// whose trimmed text has an entry, the title / placeholder / aria-label / alt attributes,
// and, for an element marked data-i18n, its whole inner HTML (key: that HTML with its
// white space collapsed), for sentences that carry markup inside them.
(function(){
  const LANGS = ["fr", "en"];
  const TABLES = {};
  function pick(){
    try{
      const q = new URLSearchParams(location.search).get("lang");
      if(q && LANGS.includes(q)){ try{ localStorage.setItem("forgemap.lang", q); }catch(e){} return q; }
    }catch(e){}
    try{ const s = localStorage.getItem("forgemap.lang"); if(s && LANGS.includes(s)) return s; }catch(e){}
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    return /^fr\b/i.test(nav) ? "fr" : "en";
  }
  const lang = pick();
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  document.documentElement.lang = lang;

  function fill(s, vars){
    return vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : String(s);
  }
  function t(s, vars){
    const tab = TABLES[lang];
    const out = tab && Object.prototype.hasOwnProperty.call(tab, s) ? tab[s] : s;
    return fill(out, vars);
  }
  // plural: English picks by n === 1, French by n < 2 (0 and 1 are singular)
  function tn(n, one, many, vars){
    const single = lang === "fr" ? Math.abs(n) < 2 : n === 1;
    const v = Object.assign({n: num(n)}, vars || {});
    // the French table may carry its own plural pair under the English plural key
    return t(single ? one : many, v);
  }
  function num(n, opts){ return typeof n === "number" ? n.toLocaleString(locale, opts) : String(n); }
  // dates and times: French as France writes them; in English, the browser's own way (12 or 24 h, day/month order)
  const when = lang === "fr" ? locale : undefined;
  function date(d, opts){ return new Date(d).toLocaleDateString(when, opts); }
  function time(d){ const t = new Date(d === undefined ? Date.now() : d); return lang === "fr" ? t.toLocaleTimeString(when, {hour: "2-digit", minute: "2-digit", second: "2-digit"}) : t.toLocaleTimeString(); }
  function datetime(d){ return new Date(d).toLocaleString(when); }

  function add(code, table){ TABLES[code] = Object.assign(TABLES[code] || {}, table); }
  // the game's own names for a prefab (js/lang/noms.js): "ArmorIronChest" -> "Iron Scale Mail" /
  // "Armure d'écailles de fer"; "" for a prefab the table doesn't know, so callers keep their own
  const NAMES = {};
  function addNames(table){ Object.assign(NAMES, table); }
  function name(prefab){
    const n = NAMES[String(prefab || "").replace(/\(Clone\)$/, "").trim()];
    return n ? (lang === "fr" && n[1]) || n[0] : "";
  }
  // The choice is kept in this browser, and also in the address: a page served in a sandbox
  // (ForgeServer's Atelier serves the map so) may not touch localStorage at all, so the ?lang=
  // rides along on every link to another page of the map (see the click handler below).
  function setLang(code){
    if(!LANGS.includes(code)) return;
    try{ localStorage.setItem("forgemap.lang", code); }catch(e){}
    const u = new URL(location.href); u.searchParams.set("lang", code); location.replace(u.href);
  }
  let queried = false;
  try{ queried = LANGS.includes(new URLSearchParams(location.search).get("lang")); }catch(e){}
  if(queried && typeof document.addEventListener === "function")
    document.addEventListener("click", e => {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if(!a || a.target === "_blank") return;
      let u; try{ u = new URL(a.getAttribute("href"), location.href); }catch(err){ return; }
      if(u.origin !== location.origin || !/\.html$/.test(u.pathname) || u.searchParams.has("lang")) return;
      u.searchParams.set("lang", lang); a.href = u.href;   // the browser follows the link as rewritten
    }, true);

  // ---------- static text ----------
  const ATTRS = ["title", "placeholder", "aria-label", "alt"];
  const SKIP = {SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1};
  function has(k){ const tab = TABLES[lang]; return !!tab && Object.prototype.hasOwnProperty.call(tab, k); }
  function translateTree(root){
    if(lang === "en" || !TABLES[lang]) return;
    for(const el of root.querySelectorAll("[data-i18n]")){
      const k = el.innerHTML.replace(/\s+/g, " ").trim();
      if(has(k)) el.innerHTML = TABLES[lang][k];
    }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n){
        for(let p = n.parentElement; p; p = p.parentElement){ if(SKIP[p.tagName] || p.hasAttribute("data-i18n-skip")) return NodeFilter.FILTER_REJECT; }
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = []; for(let n; (n = w.nextNode());) nodes.push(n);
    for(const n of nodes){
      const v = n.nodeValue, k = v.replace(/\s+/g, " ").trim();
      if(has(k)) n.nodeValue = v.match(/^\s*/)[0] + TABLES[lang][k] + v.match(/\s*$/)[0];
    }
    for(const a of ATTRS)
      for(const el of root.querySelectorAll("[" + a + "]")){
        const k = el.getAttribute(a).replace(/\s+/g, " ").trim();
        if(has(k)) el.setAttribute(a, TABLES[lang][k]);
      }
    const md = document.querySelector('meta[name="description"]');
    if(md && has(md.content.trim())) md.content = TABLES[lang][md.content.trim()];
  }
  window.I18N = {lang, locale, LANGS, t, tn, num, date, time, datetime, add, addNames, name, setLang, translateTree};
  // the pages' own scripts run before DOMContentLoaded and may write markup with t() already
  // translated; walking it again finds no English key there, so it is left as it is
  document.addEventListener("DOMContentLoaded", () => translateTree(document.body));
})();
