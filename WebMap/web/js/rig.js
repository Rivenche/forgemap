// A player's rig, stood from the model library's parts, for the 3D view and a player's page.
// three.js comes in as an argument, so the parts that need none run under `node --test`.

// What a rig is built from: the body, the parts drawn and the two colours. The same look
// gives the same key, so a player is dressed again only when what they wear changes.
export function lookKey(look) {
  if (!look || !Array.isArray(look.parts) || !look.parts.length) return null;
  const c = (v) => (Array.isArray(v) ? v.map((x) => Math.round(x * 1000)).join(',') : '');
  return [look.model | 0, look.parts.join('|'), c(look.skin), c(look.hair)].join('/');
}

// The body's chest and legs paint: the garment worn over each, else the body's own
// (entries: the library's, in the look's order, body first; ct / lt the texture files).
export function paintOf(entries) {
  const body = entries[0] || {};
  let chest = body.ct || null, legs = body.lt || null;
  for (const e of entries.slice(1)) {
    if (e && e.ct) chest = e.ct;
    if (e && e.lt) legs = e.lt;
  }
  return { chest, legs };
}

// Rigs for everyone a page draws. Each part's glTF is baked once in its standing pose and
// shared by every rig that wears it; a skin is painted once per colour and paint.
// THREE: the three.js module; gltf: a GLTFLoader; api: the server ("" for the mod's own).
export class RigBuilder {
  // anisoCap: the most texture anisotropy wanted (4 for a world of rigs, the GPU's best for one
  // figure); surfaces: metal, leather and cloth told apart by their names (for a scene lit by an
  // environment map: without one a metal surface reads black)
  constructor(THREE, gltf, { api = '', shadows = true, aniso = 1, anisoCap = 4, surfaces = false } = {}) {
    this.THREE = THREE; this.gltf = gltf; this.api = api;
    this.shadows = shadows; this.aniso = Math.min(anisoCap, aniso); this.surfaces = surfaces;
    this.index = new Map();    // prefab hash -> the library's entry
    this.names = new Map();    // rig part name -> hash
    this.parts = new Map();    // rig part hash -> Promise<pieces[] | null>, baked in the standing pose
    this.images = new Map();   // texture file -> Promise<image | null>, for the body's paint
    this.mats = new Map();     // skin and hair materials in a player's colours
    this.hd = null;            // the server's full-quality maps (hdMaps), or null: the light textures alone
    this.hdReady = Promise.resolve();
    this.hdTex = new Map();    // url -> Promise<texture | null>
  }

  // The server's full-quality maps, as loadHd resolves them (null: none, or a device that should
  // not have them). Parts baked from now on wait for it; set it before the first build.
  useHd(maps) {
    this.hdReady = Promise.resolve(maps).then((m) => { this.hd = m || null; }, () => { this.hd = null; });
    return this.hdReady;
  }

  // One map of the hd folder as a texture, loaded once: the glTF's way (no flip, repeat), colour
  // maps in sRGB, the others as data. null when it fails: the material keeps what it had.
  hdTexture(file, v, srgb) {
    const T = this.THREE, url = `${this.api}/models/hd/${file}?v=${v || 0}`;
    if (!this.hdTex.has(url)) {
      if (!this.loader) { this.loader = new T.TextureLoader(); this.loader.setCrossOrigin('anonymous'); }
      this.hdTex.set(url, this.loader.loadAsync(url).then((t) => {
        t.flipY = false; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = this.aniso;
        t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.needsUpdate = true;
        return t;
      }, () => null));
    }
    return this.hdTex.get(url);
  }

  // A material drawn with the game's own maps where the server has them (see hdFor): its normal
  // map, its metal and roughness (map or the material's numbers), its glow, a bigger base colour.
  // False when there are none for it, and the material is left as it was.
  async dress(m) {
    const T = this.THREE, h = hdFor(this.hd, m && m.map && m.map.name, m && m.name);
    if (!h) return false;
    const [c, n, mr, e] = await Promise.all([h.c && this.hdTexture(h.c, h.v, true), h.n && this.hdTexture(h.n, h.v, false),
      h.mr && this.hdTexture(h.mr, h.v, false), h.e && this.hdTexture(h.e, h.v, true)]);
    if (c) m.map = c;
    if (n) {
      // no tangents in the export: three works them out on screen, and a glTF's unflipped UVs turn its Y over
      m.normalMap = n; m.normalScale = new T.Vector2(h.ns, -h.ns);
    }
    if (mr) { m.metalnessMap = m.roughnessMap = mr; m.metalness = 1; m.roughness = 1; }
    else if (h.rf !== undefined) { m.metalness = h.mf; m.roughness = h.rf; }
    if (e) { m.emissiveMap = e; m.emissive = new T.Color(0xffffff); m.emissiveIntensity = h.ei; }
    m.userData.hd = { n: n ? n.image : null, mr: mr ? mr.image : null, rf: h.rf, mf: h.mf };
    m.needsUpdate = true;
    return !!(c || n || mr || e || h.rf !== undefined);
  }

  // The library's index (/prefabs' entries by hash). True when a rig part is new or
  // re-exported: the rigs drawn from the old index should be built again.
  setLibrary(index) {
    const names = new Map();
    let moved = false;
    for (const [h, p] of index) {
      if (p.c !== 'rig') continue;
      names.set(p.n, h);
      const o = this.index.get(h);
      if (!o || o.m !== p.m || o.v !== p.v || o.ct !== p.ct || o.lt !== p.lt) { this.parts.delete(h); moved = true; }
    }
    this.index = index; this.names = names;
    return moved;
  }

  // The library's part that draws an item on its own, for a picture of it: the one a hand holds,
  // else the helmet's, the armour's, then any back joint's; null when no player has worn it yet.
  partFor(item) {
    return partOf(item, this.names);
  }

  // A look's parts stood together at the origin, facing +z; null while the library lacks the
  // body. Every part carries the same posed skeleton, so each lands where it belongs. The
  // meshes share the builder's geometry and materials: drop the group, dispose the builder.
  async build(look) {
    if (!lookKey(look)) return null;
    const hashes = look.parts.map((n) => this.names.get(n));
    const entries = hashes.map((h) => (h === undefined ? null : this.index.get(h)));
    if (!entries[0] || !entries[0].m) return null;
    const parts = await Promise.all(hashes.map((h) => (h === undefined ? null : this.part(h))));
    if (!parts[0]) return null;
    const paint = paintOf(entries), g = new this.THREE.Group();
    for (const pieces of parts)
      for (const pc of pieces || []) {
        const mat = pc.role === 'skin' ? await this.skin(pc.material, look.skin, paint)
          : pc.role === 'hair' ? this.tinted(pc.material, look.hair) : pc.material;
        const m = new this.THREE.Mesh(pc.geometry, mat);
        m.castShadow = this.shadows; m.receiveShadow = true;
        m.rotation.y = Math.PI;                       // the parts face north, -z
        g.add(m);
      }
    g.userData.missing = hashes.filter((h) => h === undefined).length;   // parts not exported yet
    return g;
  }

  // A rig part's glTF, its skinned meshes baked in the pose its skeleton stands in: plain
  // meshes, shared by every player who wears it. [] for a part that only paints the body.
  part(hash) {
    if (this.parts.has(hash)) return this.parts.get(hash);
    const T = this.THREE, info = this.index.get(hash);
    const file = (hash >>> 0).toString(16).padStart(8, '0');
    const p = !info || !info.m ? Promise.resolve([]) : Promise.all([this.gltf.loadAsync(`${this.api}/models/${file}.glb?v=${info.v || 0}`), this.hdReady]).then(async ([g]) => {
      const pieces = [], dressing = [];
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const geometry = o.isSkinnedMesh ? bakeSkin(T, o) : o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        const m = o.material;
        m.side = T.DoubleSide; m.metalness = 0; m.roughness = Math.max(0.7, m.roughness);
        if (this.hd) dressing.push(this.dress(m).then((done) => { if (!done) this.guess(m); }));
        else this.guess(m);
        if (m.map) m.map.anisotropy = this.aniso;
        pieces.push({ geometry, material: m, role: m.name === 'webmap:skin' ? 'skin' : m.name === 'webmap:hair' ? 'hair' : null });
      });
      await Promise.all(dressing);
      return pieces;
    }).catch((e) => { console.warn('rig part', file, e.message || e); return null; });
    this.parts.set(hash, p);
    return p;
  }

  // Without the game's maps: metal, leather and cloth told apart by their names (surfaces only).
  guess(m) {
    if (!this.surfaces) return;
    const sf = surfaceOf(m.name, m.map && m.map.name);
    Object.assign(m, sf);
    // metal shines only where its texture is grey: the leather and the paint on it stay matte
    if (sf.metalness > 0.3 && m.map && m.map.image) this.metalMap(m, m.map.image, null, sf);
  }

  // The body's skin: its texture in the player's skin colour, the legs' and then the chest's
  // paint laid over it (a garment's or the body's own), drawn once per look on a canvas.
  async skin(base, rgb, paint) {
    const T = this.THREE, key = ['skin', base.uuid, (rgb || []).join(), paint.chest, paint.legs].join('|');
    if (this.mats.has(key)) return this.mats.get(key);
    await this.hdReady;
    const [legs, chest] = await Promise.all([this.image(this.paintFile(paint.legs)), this.image(this.paintFile(paint.chest))]);
    if (this.mats.has(key)) return this.mats.get(key);
    const img = base.map && base.map.image, S = img ? img.width : 256;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (img) ctx.drawImage(img, 0, 0, S, S); else { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S); }
    const col = new T.Color().setRGB(...(rgb || [1, 1, 1]), T.SRGBColorSpace);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#' + col.getHexString(T.SRGBColorSpace); ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
    for (const over of [legs, chest]) if (over) ctx.drawImage(over, 0, 0, S, S);
    const t = new T.CanvasTexture(c);
    t.flipY = false; t.colorSpace = T.SRGBColorSpace; t.anisotropy = this.aniso;
    const mat = base.clone(); mat.map = t; mat.color.set(0xffffff);
    // the game's own relief, metal and gloss for the skin and each paint, where the server has them;
    // else a metal garment's paint (a mail, a cuirass) shines where it is grey, over the matte skin
    const real = this.hd ? await this.paintMaps(mat, base, [[legs, paint.legs], [chest, paint.chest]], S) : false;
    if (!real && this.surfaces) {
      const metal = [[legs, paint.legs], [chest, paint.chest]].filter(([im, f]) => im && METAL.test(f || '')).map(([im]) => im);
      if (metal.length) this.metalMap(mat, null, { size: S, layers: metal }, surfaceOf('webmap:skin'));
    }
    this.mats.set(key, mat);
    return mat;
  }

  // A body paint's colour file under /models/: the full-quality one when the server has a bigger one.
  paintFile(f) {
    const h = f && hdFor(this.hd, f);
    return h && h.c ? `hd/${h.c}?v=${h.v}` : f;
  }

  // The skin's normal and metal / roughness maps with each paint's own laid over it where the
  // paint covers (its alpha), as the game's player shader blends them. False when no paint has
  // any: the skin keeps its own (or the guess).
  async paintMaps(mat, base, layers, S) {
    const T = this.THREE;
    const on = (await Promise.all(layers.map(async ([im, f]) => {
      const h = im && hdFor(this.hd, f);
      if (!h || (!h.n && !h.mr && h.rf === undefined)) return null;
      const [n, mr] = await Promise.all([h.n && this.image(`hd/${h.n}?v=${h.v}`), h.mr && this.image(`hd/${h.mr}?v=${h.v}`)]);
      return { im, h, n, mr };
    }))).filter(Boolean);
    if (!on.length) return false;
    const bd = base.userData.hd || {};
    const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
    const scratch = canvas(), sx = scratch.getContext('2d');
    const masked = (ctx, draw, mask) => {
      sx.globalCompositeOperation = 'source-over'; sx.clearRect(0, 0, S, S); draw(sx);
      sx.globalCompositeOperation = 'destination-in'; sx.drawImage(mask, 0, 0, S, S);
      ctx.drawImage(scratch, 0, 0);
    };
    const flat = (r, m) => `rgb(255,${Math.round(r * 255)},${Math.round(m * 255)})`;
    const nc = canvas(), nx = nc.getContext('2d'), mc = canvas(), mx = mc.getContext('2d');
    if (bd.n) nx.drawImage(bd.n, 0, 0, S, S); else { nx.fillStyle = 'rgb(128,128,255)'; nx.fillRect(0, 0, S, S); }
    if (bd.mr) mx.drawImage(bd.mr, 0, 0, S, S); else { mx.fillStyle = flat(base.roughness, base.metalness); mx.fillRect(0, 0, S, S); }
    for (const L of on) {
      if (L.n) masked(nx, (x) => x.drawImage(L.n, 0, 0, S, S), L.im);
      masked(mx, L.mr ? (x) => x.drawImage(L.mr, 0, 0, S, S)
        : (x) => { x.fillStyle = flat(L.h.rf ?? 0.82, L.h.mf ?? 0); x.fillRect(0, 0, S, S); }, L.im);
    }
    const tex = (c) => { const t = new T.CanvasTexture(c); t.flipY = false; t.colorSpace = T.NoColorSpace; t.anisotropy = this.aniso; return t; };
    mat.normalMap = tex(nc); mat.normalScale = new T.Vector2(1, -1);
    mat.metalnessMap = mat.roughnessMap = tex(mc); mat.metalness = 1; mat.roughness = 1;
    mat.needsUpdate = true;
    return true;
  }

  // hair and beard: their grey texture in the player's hair colour
  tinted(base, rgb) {
    const key = ['hair', base.uuid, (rgb || []).join()].join('|');
    if (!this.mats.has(key)) {
      const mat = base.clone();
      mat.color.setRGB(...(rgb || [1, 1, 1]), this.THREE.SRGBColorSpace);
      this.mats.set(key, mat);
    }
    return this.mats.get(key);
  }

  // A metalness / roughness map (three reads roughness from green, metalness from blue): from img's
  // own pixels, metal where they are grey and opaque; or, with o.layers, the base's figures under
  // body paints laid over it, metal where a paint covers and is grey.
  metalMap(mat, img, o, base) {
    const T = this.THREE, S = Math.min(256, o ? o.size : img.width || 256);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    const out = x.createImageData(S, S), d = out.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 0; d[i + 1] = base.roughness * 255; d[i + 2] = base.metalness * 255; d[i + 3] = 255; }
    for (const im of o ? o.layers : [img]) {
      x.clearRect(0, 0, S, S); x.drawImage(im, 0, 0, S, S);
      const px = x.getImageData(0, 0, S, S).data;
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3] / 255; if (a < 0.05) continue;
        const hi = Math.max(px[i], px[i + 1], px[i + 2]), lo = Math.min(px[i], px[i + 1], px[i + 2]);
        const sat = hi ? (hi - lo) / hi : 0, k = Math.max(0, Math.min(1, (0.34 - sat) / 0.2)) * (hi > 40 ? 1 : 0.4);
        const metal = 0.7 * k, rough = 0.42 + (0.82 - 0.42) * (1 - k);
        d[i + 1] = d[i + 1] * (1 - a) + rough * 255 * a; d[i + 2] = d[i + 2] * (1 - a) + metal * 255 * a;
      }
    }
    x.putImageData(out, 0, 0);
    const t = new T.CanvasTexture(c);
    t.flipY = false; t.colorSpace = T.NoColorSpace; t.anisotropy = this.aniso;
    mat.metalnessMap = mat.roughnessMap = t; mat.metalness = 1; mat.roughness = 1; mat.needsUpdate = true;
  }

  image(file) {
    if (!file) return Promise.resolve(null);
    if (!this.images.has(file)) this.images.set(file, new Promise((resolve) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im); im.onerror = () => resolve(null);
      im.src = `${this.api}/models/${file}`;
    }));
    return this.images.get(file);
  }

  // Everything baked, loaded and painted, freed; the rigs built from it draw no more.
  dispose() {
    const free = (m) => { for (const t of ['map', 'normalMap', 'metalnessMap', 'emissiveMap']) if (m[t]) m[t].dispose(); m.dispose(); };
    for (const p of this.parts.values())
      p.then((pieces) => { for (const pc of pieces || []) { pc.geometry.dispose(); free(pc.material); } });
    for (const m of this.mats.values()) free(m);
    for (const t of this.hdTex.values()) t.then((x) => x && x.dispose());
    this.parts.clear(); this.mats.clear(); this.images.clear(); this.hdTex.clear();
  }
}

// ---- the full-quality maps (optional) ----
// A server owner can add the game's own normal, metal / roughness and glow maps, made from their
// copy of the game by tools/textures-hd.py, as map_data/models/hd/ (served as /models/hd/). Its
// index.json: {"format": 1, "maps": {"tex_<name>.png": {n, mr, ns, rf, mf, c, m: {material: {e, ei}}, v}}}.

// What there is for a material: by its base colour's library file (the glTF image's name,
// tex_<name>.png) and, for a glow, the material's own name. null when nothing.
export function hdFor(maps, texFile, matName) {
  const e = maps && texFile ? maps[texFile] : null;
  if (!e || typeof e !== 'object') return null;
  const g = e.m && matName ? e.m[matName] : null;
  const h = { v: e.v || 0, c: e.c || null, n: e.n || null, mr: e.mr || null, ns: typeof e.ns === 'number' ? e.ns : 1,
    e: g && g.e ? g.e : null, ei: g && typeof g.ei === 'number' ? g.ei : 1 };
  if (typeof e.rf === 'number') { h.rf = e.rf; h.mf = typeof e.mf === 'number' ? e.mf : 0; }
  return h.c || h.n || h.mr || h.e || h.rf !== undefined ? h : null;
}

// Whether this device should load them: a computer or a tablet does; a phone (the screen's
// short side under 600 px) or a device that says it has under 4 GB (Chrome's deviceMemory)
// keeps the light textures.
export function wantsHd(nav = globalThis.navigator, scr = globalThis.screen) {
  const mem = nav && nav.deviceMemory;
  if (typeof mem === 'number' && mem < 4) return false;
  const side = scr ? Math.min(scr.width || 0, scr.height || 0) : 0;
  return !(side > 0 && side < 600);
}

// The server's maps, or null: none there (a 404, as from a mod without the route), unreadable,
// or not for this device. One small request.
export async function loadHd(api, { fetch: get = globalThis.fetch, nav, scr } = {}) {
  if (!wantsHd(nav, scr) || !get) return null;
  try {
    const r = await get(`${api}/models/hd/index.json`);
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.format === 1 && j.maps && typeof j.maps === 'object' ? j.maps : null;
  } catch (e) { return null; }
}

// a body paint whose garment is metal, by its texture's name
const METAL = /iron|bronze|steel|metal|silver|chain|mail|padded|carapace|flametal/i;

// See RigBuilder.partFor. names: rig part name -> hash.
const JOINT_ORDER = ['RightHand_Attach', 'LeftHand_Attach', 'Helmet_attach', 'armor'];
export function partOf(item, names) {
  if (!item || !names) return null;
  for (const j of JOINT_ORDER) { const h = names.get(item + '@' + j); if (h !== undefined) return h; }
  for (const [n, h] of names) if (n.startsWith(item + '@')) return h;
  return null;
}

// What a material is made of, read off its name and its texture's: Valheim's own shaders
// keep their metal and gloss in maps the export leaves behind, so the names stand in for them.
// The figures are three.js's metalness / roughness for the game's look: dull iron, worn leather.
export function surfaceOf(name, tex) {
  const n = `${name || ''} ${tex || ''}`.toLowerCase();
  if (/hair|beard/.test(n)) return { metalness: 0, roughness: 0.62 };
  if (/webmap:skin|body|skin/.test(n)) return { metalness: 0, roughness: 0.72 };
  if (/iron|bronze|steel|metal|silver|copper|blackmetal|flametal|chain|mail|blade|sword|axe|mace|knife|spear|atgeir|pickaxe|helmet_(iron|bronze|drake|padded|carapace|fenris)|padded/.test(n))
    return { metalness: 0.55, roughness: 0.42 };
  if (/leather|hide|troll|deer|wolf|lox|fur|cloth|cape|linen|rag|feather|wood|bow|shield/.test(n)) return { metalness: 0, roughness: 0.82 };
  return { metalness: 0.05, roughness: 0.7 };
}

// A skinned mesh as its skeleton stands it, as plain geometry in the scene's frame: the
// pose never moves, so skinning it once beats skinning it every frame for every player.
function bakeSkin(T, o) {
  o.skeleton.update();
  const g = o.geometry, pos = g.attributes.position, nrm = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const bones = o.skeleton.boneMatrices, n = pos.count;
  const P = new Float32Array(n * 3), N = nrm ? new Float32Array(n * 3) : null;
  const acc = new T.Matrix4(), full = new T.Matrix4(), nm = new T.Matrix3(), v = new T.Vector3();
  const post = new T.Matrix4().multiplyMatrices(o.matrixWorld, o.bindMatrixInverse), e = acc.elements;
  for (let i = 0; i < n; i++) {
    e.fill(0);
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (!w) continue;
      const j = si.getComponent(i, k) * 16;
      for (let c = 0; c < 16; c++) e[c] += w * bones[j + c];
    }
    full.multiplyMatrices(post, acc).multiply(o.bindMatrix);
    v.fromBufferAttribute(pos, i).applyMatrix4(full);
    P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    if (N) { v.fromBufferAttribute(nrm, i).applyMatrix3(nm.getNormalMatrix(full)).normalize(); N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z; }
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(P, 3));
  if (N) out.setAttribute('normal', new T.BufferAttribute(N, 3));
  if (g.attributes.uv) out.setAttribute('uv', g.attributes.uv);
  if (g.index) out.setIndex(g.index);
  return out;
}
