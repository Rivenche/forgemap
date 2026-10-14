#!/usr/bin/env python3
"""ForgeMap: full-quality texture maps for the 3D view, read from YOUR OWN Valheim install.

The dedicated server exports each model's base colour only (WebMap/Models/TextureExtractor.cs):
no normal map, no metal / gloss, no glow. The game's materials have them, and so does any copy
of the game. This reads them from a local client (or server) install and writes, for every
texture the server's model library uses (its map_data/models/textures.json):

  tex_<name>_n.png    the normal map, tangent space, OpenGL / glTF convention (+Y up), Z rebuilt
                      from Unity's packed two-channel form (DXT5nm / BC5: x = R * A, y = G)
  tex_<name>_mr.png   metal and roughness as glTF wants them: G = roughness, B = metalness
                      (from Unity's metal map: metal in R; gloss from the material's own
                      _Glossiness / _MetalGloss, or the map's alpha when the material says so)
  tex_<name>_e.png    the glow (emission map times the material's emission colour)
  tex_<name>.png      the base colour again, only when the install holds a bigger one than the
                      server's (never above --max px)
  index.json          what exists: {"format": 1, "maps": {"tex_<name>.png": {...}}}

Copy the output folder to the server as map_data/models/hd/ (beside the light textures); the
viewer then uses it on computers, and keeps the light textures on phones. Nothing here is
shipped with the mod: the textures are Iron Gate's, so each server owner makes them from a
copy of the game they own. Run with Python 3.9+ and UnityPy (pip install UnityPy).

  python tools/textures-hd.py --game "C:/Program Files (x86)/Steam/steamapps/common/Valheim" \
      --models <a copy of the server's map_data/models, or just its textures.json> --out hd

--models is the server's library: textures.json says which textures to look for, and the
tex_*.png beside it (when copied too) settle a name the game uses twice and tell whether the
install's base colour is any bigger. Game files are only read, never written.
"""
import argparse, json, math, os, re, sys, time, zlib

try:
    import UnityPy
    from PIL import Image
except ImportError:
    sys.exit("needs UnityPy and Pillow: pip install UnityPy")

FORMAT = 1
# a material's colour map, as the server's exporter looks for it (PrefabExporter.altColorProps)
COLOR = ["_MainTex", "_BaseMap", "_BaseColorMap", "_Albedo", "_AlbedoMap", "_Diffuse", "_ColorMap", "_Tex"]
# the maps that go with a colour map, by the slot it sits in: (normal, metal, emission)
WITH = {
    "_ChestTex": (["_ChestBumpMap"], ["_ChestMetal"], []),
    "_LegsTex": (["_LegsBumpMap"], ["_LegsMetal"], []),
}
MAIN = (["_BumpMap", "_SkinBumpMap", "_NormalTex", "_Normal"], ["_MetallicGlossMap", "_MetallicTex", "_MetalTex"], ["_EmissionMap", "_EmissiveTex"])
# the player's body draws a garment's paint with its own gloss, not the garment material's
PLAYER_MATERIAL = "PlayerMaterial"
# Valheim's own shaders read their gloss numbers their own way (a rock "glossiness 1" is no
# mirror): a metal map's gloss is kept under MAX_GLOSS, a plain material no smoother than this
MAX_GLOSS = 0.8
MIN_ROUGH_PLAIN = 0.5


def file_name(tex):
    """The library's file for a texture name (PrefabExporter.TextureFileName)."""
    return "tex_" + re.sub(r"[^a-zA-Z0-9_-]", "_", tex or "") + ".png"


def asset_files(game):
    """The game's asset files, in the order the server's extractor reads them."""
    data = None
    for d in ("valheim_Data", "valheim_server_Data"):
        if os.path.isdir(os.path.join(game, d)):
            data = os.path.join(game, d)
            break
    if data is None and os.path.isdir(os.path.join(game, "StreamingAssets")):
        data = game
    if data is None:
        sys.exit(f"no valheim_Data under {game}")
    out = []
    bundles = os.path.join(data, "StreamingAssets", "SoftRef", "Bundles")
    if os.path.isdir(bundles):
        for r, _, fs in os.walk(bundles):
            out += [os.path.join(r, f) for f in fs]
    aa = os.path.join(data, "StreamingAssets", "aa")
    if os.path.isdir(aa):
        for r, _, fs in os.walk(aa):
            out += [os.path.join(r, f) for f in fs if f.endswith(".bundle")]
    out.sort(key=lambda f: -os.path.getsize(f))
    out += [os.path.join(data, f) for f in sorted(os.listdir(data)) if f.endswith(".assets") or f == "globalgamemanagers"]
    return out


def ref(sf, p):
    """A PPtr as (serialized file, path id), the file named the way the others call it."""
    fid, pid = p["m_FileID"], p["m_PathID"]
    if not pid:
        return None
    if fid == 0:
        cab = sf.name
    else:
        try:
            cab = sf.externals[fid - 1].path
        except Exception:
            return None
    return (os.path.basename(cab).lower(), pid)


def scan(files, log):
    """Every Texture2D (key -> name, size, file) and every material's texture slots and numbers."""
    tex, mats = {}, []
    t0 = time.time()
    for i, f in enumerate(files):
        try:
            env = UnityPy.load(f)
        except Exception as e:
            log(f"  skipped {os.path.basename(f)}: {e}")
            continue
        for o in env.objects:
            tn = o.type.name
            if tn == "Texture2D":
                try:
                    t = o.read()
                except Exception:
                    continue
                tex[(os.path.basename(o.assets_file.name).lower(), o.path_id)] = (t.m_Name, t.m_Width, t.m_Height, f)
            elif tn == "Material":
                try:
                    d = o.read_typetree()
                except Exception:
                    continue
                sp = d.get("m_SavedProperties") or {}
                slots = {}
                for k, v in sp.get("m_TexEnvs", []):
                    r = ref(o.assets_file, v["m_Texture"])
                    if r:
                        slots[k] = r
                if slots:
                    mats.append({"name": d.get("m_Name", ""), "slots": slots,
                                 "floats": {k: v for k, v in sp.get("m_Floats", [])},
                                 "colors": {k: v for k, v in sp.get("m_Colors", [])}})
        if i % 100 == 0:
            log(f"  {i}/{len(files)} files, {len(tex)} textures, {len(mats)} materials, {time.time() - t0:.0f}s")
    return tex, mats


def similar(a, light):
    """Mean difference (0..255) between a candidate and the server's own copy, at the copy's size."""
    b = a.convert("RGB").resize(light.size, Image.BOX)
    l = light.convert("RGB")
    pa, pl = b.tobytes(), l.tobytes()
    step = max(1, len(pa) // 30000) * 3
    s = n = 0
    for i in range(0, len(pa) - 2, step):
        s += abs(pa[i] - pl[i]) + abs(pa[i + 1] - pl[i + 1]) + abs(pa[i + 2] - pl[i + 2])
        n += 3
    return s / max(1, n)


def capped(im, mx):
    w, h = im.size
    if max(w, h) <= mx:
        return im
    k = mx / max(w, h)
    return im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def normal_png(im, mx):
    """Unity's packed normal (x = R * A, y = G, as UnpackNormal reads it) -> a plain RGB normal map."""
    im = capped(im.convert("RGBA"), mx)
    px = im.tobytes()
    out = bytearray(len(px) // 4 * 3)
    for i in range(0, len(px), 4):
        x = (px[i] * px[i + 3] / 65025.0) * 2 - 1
        y = px[i + 1] / 127.5 - 1
        z = math.sqrt(max(0.0, 1 - x * x - y * y))
        j = i // 4 * 3
        out[j] = max(0, min(255, round((x * 0.5 + 0.5) * 255)))
        out[j + 1] = max(0, min(255, round((y * 0.5 + 0.5) * 255)))
        out[j + 2] = max(0, min(255, round((z * 0.5 + 0.5) * 255)))
    return Image.frombytes("RGB", im.size, bytes(out))


def mr_png(im, gloss, metal_gloss, alpha_gloss, mx):
    """Unity's metal map (metal in R) -> glTF metallicRoughness (G roughness, B metal).
    Gloss runs from the material's plain gloss to its metal gloss with the metal; times the
    map's alpha where the material reads gloss from it."""
    im = capped(im.convert("RGBA"), mx)
    px = im.tobytes()
    out = bytearray(len(px) // 4 * 3)
    for i in range(0, len(px), 4):
        m = px[i] / 255.0
        s = gloss + (metal_gloss - gloss) * m
        if alpha_gloss:
            s *= px[i + 3] / 255.0
        s = min(MAX_GLOSS, max(0.0, s))
        j = i // 4 * 3
        out[j] = 255
        out[j + 1] = max(0, min(255, round((1 - s) * 255)))
        out[j + 2] = px[i]
    return Image.frombytes("RGB", im.size, bytes(out))


def emission_png(im, rgb, mx):
    im = capped(im.convert("RGB"), mx)
    k = max(rgb)
    lut = []
    for c in rgb:
        lut += [max(0, min(255, round(v * c / k))) for v in range(256)]
    return im.point(lut)


def save(im, path):
    tmp = path + ".tmp"
    im.save(tmp, "PNG", optimize=True)
    os.replace(tmp, path)
    with open(path, "rb") as f:
        return zlib.crc32(f.read())


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--game", required=True, help="the Valheim install folder (holds valheim_Data), read only")
    ap.add_argument("--models", required=True, help="the server's map_data/models (a copy): textures.json, and tex_*.png if copied")
    ap.add_argument("--out", required=True, help="output folder, then copied to map_data/models/hd/ on the server")
    ap.add_argument("--max", type=int, default=1024, help="largest side of a written map (default 1024)")
    a = ap.parse_args()
    log = lambda s: print(s, flush=True)
    mx = max(64, min(4096, a.max))

    tj = os.path.join(a.models, "textures.json")
    wanted = [t["name"] for t in json.load(open(tj, encoding="utf-8"))["textures"]]
    log(f"{len(wanted)} textures in {tj}")
    files = asset_files(a.game)
    log(f"reading {len(files)} asset files of {a.game}")
    tex, mats = scan(files, log)
    byname = {}
    for k, (n, w, h, f) in tex.items():
        byname.setdefault(n, []).append(k)
    # what each texture is a colour map of: (material, slot)
    uses = {}
    for m in mats:
        for slot, k in m["slots"].items():
            if slot in COLOR or slot in WITH:
                uses.setdefault(k, []).append((m, slot))
    player = next((m for m in mats if m["name"] == PLAYER_MATERIAL), None)
    pf = player["floats"] if player else {}

    # pick the game's texture for each name, and the maps that go with it
    plan, need = {}, set()
    ambiguous = unmatched = 0
    for name in wanted:
        keys = byname.get(name) or []
        if not keys:
            unmatched += 1
            continue
        light_path = os.path.join(a.models, file_name(name))
        light = Image.open(light_path) if os.path.exists(light_path) else None
        if len(keys) > 1:
            ambiguous += 1
            plan[name] = {"keys": keys, "light": light}
        else:
            plan[name] = {"key": keys[0], "light": light}
        for k in keys:
            need.add(k)
    # the candidates of a name used twice are compared with the server's copy once decoded
    images = {}

    def decode(keys):
        byfile = {}
        for k in keys:
            if k not in images and k in tex:
                byfile.setdefault(tex[k][3], set()).add(k)
        for f, ks in byfile.items():
            env = UnityPy.load(f)
            for o in env.objects:
                if o.type.name != "Texture2D":
                    continue
                k = (os.path.basename(o.assets_file.name).lower(), o.path_id)
                if k in ks:
                    try:
                        images[k] = o.read().image
                    except Exception as e:
                        log(f"  could not decode {tex[k][0]}: {e}")
                        images[k] = None

    log("decoding the base colours")
    decode(need)
    for name, p in plan.items():
        if "keys" in p:
            cands = [k for k in p["keys"] if images.get(k) is not None]
            if p["light"] is not None and cands:
                p["key"] = min(cands, key=lambda k: similar(images[k], p["light"]))
            elif cands:
                # no copy to compare with: the one a material draws as its colour, then the biggest
                cands.sort(key=lambda k: (k not in uses, -tex[k][1] * tex[k][2]))
                p["key"] = cands[0]
            else:
                p["key"] = None

    # The maps that go with each texture. Several materials can draw one texture (a skeleton,
    # a burning one): the normal and metal maps are the ones most of them use; a glow belongs
    # to its material, so it is listed under the material's name (as the models' glTF name it).
    extra = set()
    for name, p in plan.items():
        k = p.get("key")
        normals, metals, glows = {}, {}, []
        for m, slot in uses.get(k, []):
            n_, m_, e_ = WITH.get(slot, MAIN)
            nk, mk, ek = [next((m["slots"][s] for s in group if s in m["slots"]), None) for group in (n_, m_, e_)]
            if nk:
                normals.setdefault(nk, []).append((m, slot))
            if mk:
                metals.setdefault(mk, []).append((m, slot))
            col = m["colors"].get("_EmissionColor") or m["colors"].get("_EmissiveColor")
            rgb = [max(0.0, float(col.get(c, 0))) for c in "rgb"] if col else [0, 0, 0]
            if ek and max(rgb) > 0.01:
                glows.append((m, ek, rgb))
        most = lambda d: max(d.items(), key=lambda kv: len(kv[1])) if d else (None, [])
        p["normal"], p["metal"], p["glows"] = most(normals), most(metals), glows
        p["paint"] = any(slot in WITH for _, slot in uses.get(k, []))
        for g in (p["normal"][0], p["metal"][0]):
            if g:
                extra.add(g)
        for _, ek, _ in glows:
            extra.add(ek)
    log(f"decoding {len(extra)} normal, metal and glow maps")
    decode(extra)

    os.makedirs(a.out, exist_ok=True)
    index, counts, total = {}, {"c": 0, "n": 0, "mr": 0, "e": 0}, 0
    for name in sorted(plan):
        p = plan[name]
        k = p.get("key")
        if k is None or images.get(k) is None:
            continue
        base = file_name(name)
        stem = base[:-4]
        entry, crc = {}, 0
        im = images[k]
        light = p["light"]
        if light is None or max(im.size) > max(light.size):
            c = capped(im, mx)
            if c.mode == "RGBA" and c.getchannel("A").getextrema()[0] >= 250:
                c = c.convert("RGB")
            crc ^= save(c, os.path.join(a.out, base))
            entry["c"] = base
        nk, nuses = p["normal"]
        mk, muses = p["metal"]
        first = (nuses or muses or [(None, None)])[0][0]
        fl = first["floats"] if first else {}
        if nk and images.get(nk) is not None:
            f = stem + "_n.png"
            crc ^= save(normal_png(images[nk], mx), os.path.join(a.out, f))
            entry["n"] = f
            bs = float(nuses[0][0]["floats"].get("_BumpScale", 1.0))
            if abs(bs - 1) > 0.01:
                entry["ns"] = round(bs, 3)
        if mk and images.get(mk) is not None:
            m, slot = muses[0]
            paint = slot in WITH
            src = pf if paint else m["floats"]
            gloss = float(src.get("_Glossiness", src.get("_Smoothness", 0.2)))
            metal_gloss = float(src.get("_MetalGloss", src.get("_MetalGlossiness", gloss)))
            alpha = (not paint) and float(m["floats"].get("_UseGlossmap", 0)) > 0.5
            f = stem + "_mr.png"
            crc ^= save(mr_png(images[mk], gloss, metal_gloss, alpha, mx), os.path.join(a.out, f))
            entry["mr"] = f
        elif "n" in entry:
            # no metal map: the numbers of the materials that draw it, the middle one of each
            # (one stray material -- a rock texture on a "metallic" prop -- does not make a rock metal)
            srcs = [pf] if p["paint"] else [m["floats"] for m, _ in uses.get(k, [])] or [fl]
            mid = lambda xs: sorted(xs)[len(xs) // 2]
            gloss = mid([float(f.get("_Glossiness", f.get("_Smoothness", 0.2))) for f in srcs])
            entry["rf"] = round(max(MIN_ROUGH_PLAIN, min(1.0, 1 - gloss)), 3)
            entry["mf"] = 0.0 if p["paint"] else round(max(0.0, min(1.0, mid([float(f.get("_Metallic", 0.0)) for f in srcs]))), 3)
        made = {}
        for m, ek, rgb in p["glows"]:
            if images.get(ek) is None or not m["name"]:
                continue
            key = (ek, tuple(round(c, 3) for c in rgb))
            if key not in made:
                f = stem + "_e" + (str(len(made)) if made else "") + ".png"
                crc ^= save(emission_png(images[ek], rgb, mx), os.path.join(a.out, f))
                made[key] = f
            entry.setdefault("m", {}).setdefault(m["name"], {"e": made[key], "ei": round(min(8.0, max(rgb)), 3)})
        if made:
            entry["e"] = 1
        if not any(x in entry for x in ("c", "n", "mr", "e")):
            continue
        entry["v"] = "%08x" % (crc & 0xFFFFFFFF)
        index[base] = entry
        for x in counts:
            if x in entry:
                counts[x] += 1
    with open(os.path.join(a.out, "index.json.tmp"), "w", encoding="utf-8", newline="\n") as f:
        json.dump({"format": FORMAT, "max": mx, "maps": index}, f, separators=(",", ":"), sort_keys=True)
    os.replace(os.path.join(a.out, "index.json.tmp"), os.path.join(a.out, "index.json"))
    for f in os.listdir(a.out):
        total += os.path.getsize(os.path.join(a.out, f))
    log(f"{len(index)} of {len(wanted)} textures with full-quality maps: {counts['n']} normal, {counts['mr']} metal/roughness, "
        f"{counts['e']} glow, {counts['c']} bigger base colours; {ambiguous} names used twice settled, {unmatched} not in the install")
    log(f"{a.out}: {total / 1024 / 1024:.1f} MB -> copy it to the server as map_data/models/hd/")


if __name__ == "__main__":
    main()
