// The 3D view's rig logic that needs no three.js, under `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lookKey, RigBuilder } from "../../WebMap/web/js/rig.js";

const look = () => ({ model: 0, skin: [1, 0.82, 0.68], hair: [0.55, 0.32, 0.14], slots: { helmet: "HelmetBronze" },
  parts: ["Player@body0", "HelmetBronze@Helmet_attach", "Hair5_2@Helmet_attach"] });

test("a player is dressed again only when what they wear changes, not on every poll", () => {
  assert.equal(lookKey(look()), lookKey(look()));
  const bare = look(); bare.parts = ["Player@body0", "Hair5@Helmet_attach"];
  assert.notEqual(lookKey(bare), lookKey(look()));
  const grey = look(); grey.hair = [0.5, 0.5, 0.5];
  assert.notEqual(lookKey(grey), lookKey(look()));
  assert.equal(lookKey(undefined), null);                       // a mod from before the rigs: a plain figure
});

test("a rig part exported or re-exported stands the players again; the rest of the library does not", () => {
  const lib = (...e) => new Map(e.map(([h, n, c, v]) => [h, { n, c, m: true, v }]));
  const rigs = new RigBuilder(null, null);
  assert.equal(rigs.setLibrary(lib([1, "Player@body0", "rig", 1], [2, "Beech1", "tree", 1])), true);
  assert.equal(rigs.setLibrary(lib([1, "Player@body0", "rig", 1], [2, "Beech1", "tree", 2])), false);
  assert.equal(rigs.setLibrary(lib([1, "Player@body0", "rig", 1], [3, "HelmetBronze@Helmet_attach", "rig", 1])), true);
  assert.equal(rigs.setLibrary(lib([1, "Player@body0", "rig", 2], [3, "HelmetBronze@Helmet_attach", "rig", 1])), true);
});

test("an item's picture comes from the part a hand holds first, else the helmet, the armour, a back joint", async () => {
  const { partOf } = await import("../../WebMap/web/js/rig.js");
  const names = new Map([["BowFineWood@BackBow_attach", 1], ["BowFineWood@LeftHand_Attach", 2], ["HelmetIron@Helmet_attach", 3],
    ["ArmorIronChest@armor", 4], ["Hammer@BackTool_attach", 5], ["HammerX@RightHand_Attach", 6]]);
  assert.equal(partOf("BowFineWood", names), 2);
  assert.equal(partOf("HelmetIron", names), 3);
  assert.equal(partOf("ArmorIronChest", names), 4);
  assert.equal(partOf("Hammer", names), 5);                    // not HammerX's
  assert.equal(partOf("SwordIron", names), null);
  assert.equal(partOf("", names), null);
});

test("metal, leather and skin read apart by their names", async () => {
  const { surfaceOf } = await import("../../WebMap/web/js/rig.js");
  assert.ok(surfaceOf("helmet_iron_mat").metalness > 0.3);
  assert.equal(surfaceOf("TrollLeatherChest_mat").metalness, 0);
  assert.equal(surfaceOf("webmap:skin").metalness, 0);
  assert.ok(surfaceOf("webmap:hair").roughness < 0.7);
});

// ---- the optional full-quality maps (map_data/models/hd/, from tools/textures-hd.py) ----
import { hdFor, wantsHd, loadHd } from "../../WebMap/web/js/rig.js";

const HD = {
  "tex_helmet_iron_d.png": { n: "tex_helmet_iron_d_n.png", mr: "tex_helmet_iron_d_mr.png", ns: 0.8, v: "19b37160" },
  "tex_PlayerCharacter_01.png": { n: "tex_PlayerCharacter_01_n.png", rf: 0.8, mf: 0, v: "9db6b21e" },
  "tex_Skeleton_d.png": { n: "tex_Skeleton_d_n.png", rf: 0.56, mf: 0, e: 1, m: { Skeleton_burned: { e: "tex_Skeleton_d_e.png", ei: 6.422 } }, v: "bcc6fc24" },
};

test("a material takes the maps of its base colour's file, and a glow only under its own name", () => {
  const helm = hdFor(HD, "tex_helmet_iron_d.png", "helmet_iron_mat");
  assert.deepEqual([helm.n, helm.mr, helm.ns, helm.e, helm.rf], ["tex_helmet_iron_d_n.png", "tex_helmet_iron_d_mr.png", 0.8, null, undefined]);
  const body = hdFor(HD, "tex_PlayerCharacter_01.png", "webmap:skin");
  assert.deepEqual([body.mr, body.rf, body.mf, body.ns], [null, 0.8, 0, 1]);      // no metal map: the material's numbers
  assert.equal(hdFor(HD, "tex_Skeleton_d.png", "Skeleton").e, null);               // the plain skeleton does not burn
  assert.deepEqual([hdFor(HD, "tex_Skeleton_d.png", "Skeleton_burned").e, hdFor(HD, "tex_Skeleton_d.png", "Skeleton_burned").ei], ["tex_Skeleton_d_e.png", 6.422]);
  assert.equal(hdFor(HD, "tex_wood.png", "wood"), null);                            // nothing for it: the light texture as before
  assert.equal(hdFor(null, "tex_helmet_iron_d.png"), null);                         // no hd folder on the server
  assert.equal(hdFor(HD, undefined), null);                                         // a material without a texture
});

test("a computer loads the full-quality maps; a phone or a small-memory device keeps the light ones", () => {
  assert.equal(wantsHd({ deviceMemory: 8 }, { width: 1920, height: 1080 }), true);
  assert.equal(wantsHd({}, { width: 1440, height: 900 }), true);                    // Firefox and Safari say nothing of memory
  assert.equal(wantsHd({ deviceMemory: 8 }, { width: 390, height: 844 }), false);   // a phone, however strong
  assert.equal(wantsHd({ deviceMemory: 2 }, { width: 1366, height: 768 }), false);  // a weak laptop
  assert.equal(wantsHd({}, { width: 820, height: 1180 }), true);                    // a tablet
});

test("the index is one request, and anything but a good answer means the light textures", async () => {
  const pc = { nav: { deviceMemory: 8 }, scr: { width: 1920, height: 1080 } };
  const asked = [];
  const answer = (status, body) => async (url) => { asked.push(url); return { ok: status === 200, status, json: async () => body }; };
  assert.deepEqual(await loadHd("/carte", { ...pc, fetch: answer(200, { format: 1, maps: HD }) }), HD);
  assert.deepEqual(asked, ["/carte/models/hd/index.json"]);
  assert.equal(await loadHd("", { ...pc, fetch: answer(404, { error: "no such map" }) }), null);   // no folder, or an older mod
  assert.equal(await loadHd("", { ...pc, fetch: answer(200, { format: 2, maps: HD }) }), null);   // a format this viewer does not know
  assert.equal(await loadHd("", { ...pc, fetch: async () => { throw new Error("offline"); } }), null);
  asked.length = 0;
  assert.equal(await loadHd("", { nav: {}, scr: { width: 390, height: 844 }, fetch: answer(200, { format: 1, maps: HD }) }), null);
  assert.deepEqual(asked, []);                                                      // a phone does not even ask
});
