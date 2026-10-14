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
