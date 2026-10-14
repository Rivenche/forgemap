using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Shared = ItemDrop.ItemData.SharedData;
using ItemType = ItemDrop.ItemData.ItemType;

namespace WebMap
{
    // GET /items?ids=SwordIron,ArmorBronzeChest: each item's own data, from the game's
    // ObjectDB, for the players page to show what a player wears and holds.
    //
    // The index (prefab name -> the item's shared data) is built on the game thread, the
    // one place a GameObject may be asked for its components, once ObjectDB has its items
    // and again only should it change (another ObjectDB, or a mod adding items late).
    // The shared data are plain fields, set when the game loads and never written after,
    // so the HTTP thread reads them as they are; each item's JSON is built once and kept.
    internal static class Items
    {
        public const int MaxIds = 40, MaxIdLength = 64;

        private static volatile Dictionary<string, Shared> index;   // replaced whole, never changed in place
        private static readonly Dictionary<string, string> cache = new Dictionary<string, string>(StringComparer.Ordinal);
        private static object indexedFor;                           // the ObjectDB it was built from (game thread)
        private static int indexedCount = -1;
        private static bool warned;

        public static bool Ready => index != null;

        // Game thread, once a player snapshot: a reference and a count compared, nothing more,
        // once the index is built.
        public static void Index()
        {
            try
            {
                var db = ObjectDB.instance;
                if ((object)db == null || db.m_items == null || db.m_items.Count == 0) return;
                if (ReferenceEquals(db, indexedFor) && db.m_items.Count == indexedCount) return;
                var map = new Dictionary<string, Shared>(db.m_items.Count, StringComparer.Ordinal);
                foreach (var go in db.m_items)
                {
                    if (go == null) continue;
                    var drop = go.GetComponent<ItemDrop>();
                    var s = drop != null ? drop.m_itemData?.m_shared : null;
                    if (s != null) map[go.name] = s;
                }
                Publish(map);
                indexedFor = db; indexedCount = db.m_items.Count;
            }
            catch (Exception e)
            {
                if (!warned) { warned = true; ZLog.LogWarning("WebMap: items: reading ObjectDB failed: " + e.Message); }
            }
        }

        private static void Publish(Dictionary<string, Shared> map)
        {
            lock (cache) { cache.Clear(); index = map; }
        }

        internal static void SetForTests(Dictionary<string, Shared> map) { Publish(map); indexedFor = null; indexedCount = -1; }

        // A prefab name as the game spells them; anything else is refused before any lookup.
        public static bool ValidId(string id)
        {
            if (string.IsNullOrEmpty(id) || id.Length > MaxIdLength) return false;
            foreach (char c in id)
                if (!(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_')) return false;
            return true;
        }

        // The answer to ?ids=: null and an error for a malformed list; unknown ids are left
        // out, and every id is unknown while ObjectDB is not ready.
        public static string Json(string ids, out string error)
        {
            error = null;
            if (string.IsNullOrEmpty(ids)) { error = "ids is required: prefab names, comma separated"; return null; }
            var parts = ids.Split(',');
            var wanted = new List<string>(Math.Min(parts.Length, MaxIds));
            foreach (var raw in parts)
            {
                string id = raw.Trim();
                if (id.Length == 0) continue;
                if (!ValidId(id)) { error = "an id is a prefab name: letters, digits and _ only"; return null; }
                if (wanted.Contains(id)) continue;
                if (wanted.Count == MaxIds) { error = "at most " + MaxIds + " ids"; return null; }
                wanted.Add(id);
            }
            var sb = new StringBuilder("{\"items\":{");
            var map = index;
            bool first = true;
            if (map != null)
                foreach (var id in wanted)
                {
                    string one = One(map, id);
                    if (one == null) continue;
                    if (!first) sb.Append(',');
                    first = false;
                    sb.Append('"').Append(id).Append("\":").Append(one);
                }
            return sb.Append("}}").ToString();
        }

        private static string One(Dictionary<string, Shared> map, string id)
        {
            lock (cache)
            {
                if (!ReferenceEquals(map, index)) return null;            // rebuilt meanwhile: the next request has it
                if (cache.TryGetValue(id, out string json)) return json;
                if (!map.TryGetValue(id, out Shared s)) return null;
                json = Of(s);
                cache[id] = json;
                return json;
            }
        }

        // What a page needs to show an item and its figures at a given quality: the base
        // figure and what each level above the first adds. Zero figures are left out.
        public static string Of(Shared s)
        {
            var sb = new StringBuilder("{");
            sb.Append("\"type\":\"").Append(s.m_itemType.ToString()).Append('"');
            if (!string.IsNullOrEmpty(s.m_name)) sb.Append(",\"token\":\"").Append(Esc(s.m_name)).Append('"');
            // Every item carries every figure, the unused ones at the class's defaults (armour
            // 10 on a sword, block 10 on a helmet): each is given only where the game uses it.
            bool held = Held(s.m_itemType);
            if (held && s.m_skillType != Skills.SkillType.None) sb.Append(",\"skill\":\"").Append(s.m_skillType.ToString()).Append('"');
            if (Worn(s.m_itemType)) { Num(sb, "armor", s.m_armor); Num(sb, "armorPerLevel", s.m_armorPerLevel); }
            if (Blocks(s.m_itemType))
            {
                Num(sb, "block", s.m_blockPower); Num(sb, "blockPerLevel", s.m_blockPowerPerLevel);
                Num(sb, "deflection", s.m_deflectionForce); Num(sb, "deflectionPerLevel", s.m_deflectionForcePerLevel);
            }
            if (held) { Damages(sb, "damages", s.m_damages); Damages(sb, "damagesPerLevel", s.m_damagesPerLevel); }
            sb.Append(",\"maxQuality\":").Append(Math.Max(1, s.m_maxQuality));
            if (s.m_useDurability) { Num(sb, "durability", s.m_maxDurability); Num(sb, "durabilityPerLevel", s.m_durabilityPerLevel); }
            Num(sb, "weight", s.m_weight);
            Num(sb, "movement", s.m_movementModifier);
            Num(sb, "eitrRegen", s.m_eitrRegenModifier);
            if (!string.IsNullOrEmpty(s.m_setName) && s.m_setSize > 0)
                sb.Append(",\"set\":{\"name\":\"").Append(Esc(s.m_setName)).Append("\",\"size\":").Append(s.m_setSize).Append('}');
            if (s.m_damageModifiers != null)
            {
                bool any = false;
                foreach (var m in s.m_damageModifiers)
                {
                    if (m.m_modifier == HitData.DamageModifier.Normal) continue;
                    sb.Append(any ? ",\"" : ",\"damageMods\":{\"").Append(Lower(m.m_type.ToString())).Append("\":\"").Append(m.m_modifier.ToString()).Append('"');
                    any = true;
                }
                if (any) sb.Append('}');
            }
            return sb.Append('}').ToString();
        }

        // What a hand holds, and the arrows and bolts it shoots: these have a skill that means something.
        internal static bool Held(ItemType t) =>
            t == ItemType.OneHandedWeapon || t == ItemType.TwoHandedWeapon || t == ItemType.TwoHandedWeaponLeft || t == ItemType.Bow
            || t == ItemType.Shield || t == ItemType.Tool || t == ItemType.Torch || t == ItemType.Ammo;
        // The four slots the body armour adds up (Player.GetBodyArmor).
        internal static bool Worn(ItemType t) => t == ItemType.Helmet || t == ItemType.Chest || t == ItemType.Legs || t == ItemType.Shoulder;
        // What a hand blocks with: a shield, else the weapon itself.
        internal static bool Blocks(ItemType t) =>
            t == ItemType.Shield || t == ItemType.OneHandedWeapon || t == ItemType.TwoHandedWeapon || t == ItemType.TwoHandedWeaponLeft
            || t == ItemType.Bow || t == ItemType.Torch;

        private static void Num(StringBuilder sb, string key, float v)
        {
            if (v == 0f || float.IsNaN(v) || float.IsInfinity(v)) return;
            sb.Append(",\"").Append(key).Append("\":").Append(v.ToString("0.###", CultureInfo.InvariantCulture));
        }

        private static void Damages(StringBuilder sb, string key, HitData.DamageTypes d)
        {
            int at = sb.Length;
            sb.Append(",\"").Append(key).Append("\":{");
            int open = sb.Length;
            One(sb, open, "damage", d.m_damage); One(sb, open, "blunt", d.m_blunt); One(sb, open, "slash", d.m_slash);
            One(sb, open, "pierce", d.m_pierce); One(sb, open, "chop", d.m_chop); One(sb, open, "pickaxe", d.m_pickaxe);
            One(sb, open, "fire", d.m_fire); One(sb, open, "frost", d.m_frost); One(sb, open, "lightning", d.m_lightning);
            One(sb, open, "poison", d.m_poison); One(sb, open, "spirit", d.m_spirit);
            if (sb.Length == open) sb.Length = at;                      // all zero: no key at all
            else sb.Append('}');
        }
        private static void One(StringBuilder sb, int open, string key, float v)
        {
            if (v == 0f || float.IsNaN(v) || float.IsInfinity(v)) return;
            if (sb.Length > open) sb.Append(',');
            sb.Append('"').Append(key).Append("\":").Append(v.ToString("0.###", CultureInfo.InvariantCulture));
        }

        private static string Lower(string s) => s.Length == 0 ? s : char.ToLowerInvariant(s[0]) + s.Substring(1);
        private static string Esc(string s)
        {
            var sb = new StringBuilder(s.Length);
            foreach (char c in s)
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.ToString();
        }
    }
}
