using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.IO;
using BepInEx.Configuration;
using Xunit;
using Shared = ItemDrop.ItemData.SharedData;
using ItemType = ItemDrop.ItemData.ItemType;
using Skill = Skills.SkillType;
using Mod = WebMap.WebMap;

namespace WebMap.Tests
{
    // GET /items: the game's own figures for the items a page shows, from an index the
    // game thread builds off ObjectDB; here handed in as the shared data it would read.
    public class ItemsTests : WithDir
    {
        static Shared Sword() => new Shared
        {
            m_name = "$item_sword_iron", m_itemType = ItemType.OneHandedWeapon, m_skillType = Skill.Swords,
            m_damages = new HitData.DamageTypes { m_slash = 55f }, m_damagesPerLevel = new HitData.DamageTypes { m_slash = 6f },
            m_blockPower = 20f, m_blockPowerPerLevel = 0f, m_deflectionForce = 40f, m_maxQuality = 4,
            m_useDurability = true, m_maxDurability = 200f, m_durabilityPerLevel = 50f, m_weight = 1.5f,
        };
        static Shared Chest() => new Shared
        {
            m_name = "$item_chest_wolf", m_itemType = ItemType.Chest, m_skillType = Skill.Swords,   // the game's default skill: means nothing on armour
            m_armor = 24f, m_armorPerLevel = 2f, m_maxQuality = 4, m_useDurability = true, m_maxDurability = 1000f, m_durabilityPerLevel = 200f,
            m_weight = 15f, m_movementModifier = -0.05f, m_setName = "wolf", m_setSize = 3,
            m_damageModifiers = new List<HitData.DamageModPair>
            {
                new HitData.DamageModPair { m_type = HitData.DamageType.Frost, m_modifier = HitData.DamageModifier.Resistant },
                new HitData.DamageModPair { m_type = HitData.DamageType.Fire, m_modifier = HitData.DamageModifier.Normal },
            },
        };

        public ItemsTests() => Items.SetForTests(new Dictionary<string, Shared> { ["SwordIron"] = Sword(), ["ArmorWolfChest"] = Chest() });
        public override void Dispose() { Items.SetForTests(null); base.Dispose(); }

        static System.Text.Json.JsonElement Get(string ids)
        {
            string json = Items.Json(ids, out string err);
            Assert.Null(err);
            return J.Parse(json).GetProperty("items");
        }

        [Fact]
        public void AWeaponCarriesItsDamageBlockAndDurability()
        {
            Assert.Equal("{\"type\":\"OneHandedWeapon\",\"token\":\"$item_sword_iron\",\"skill\":\"Swords\",\"block\":20,\"deflection\":40,"
                       + "\"damages\":{\"slash\":55},\"damagesPerLevel\":{\"slash\":6},\"maxQuality\":4,\"durability\":200,\"durabilityPerLevel\":50,\"weight\":1.5}",
                         Get("SwordIron").GetProperty("SwordIron").GetRawText());
        }

        [Fact]
        public void ArmourCarriesItsArmourSetAndResistances()
        {
            var c = Get("ArmorWolfChest").GetProperty("ArmorWolfChest");
            Assert.Equal("Chest", c.Str("type"));
            Assert.False(c.TryGetProperty("skill", out _));
            Assert.False(c.TryGetProperty("damages", out _));
            Assert.Equal(24, c.Int("armor"));
            Assert.Equal(2, c.Int("armorPerLevel"));
            Assert.Equal(-0.05, c.Num("movement"), 3);
            Assert.Equal("{\"name\":\"wolf\",\"size\":3}", c.GetProperty("set").GetRawText());
            Assert.Equal("{\"frost\":\"Resistant\"}", c.GetProperty("damageMods").GetRawText());
        }

        [Fact]
        public void UnknownIdsAreLeftOutAndRepeatsAnsweredOnce()
        {
            var items = Get(" SwordIron,Nope,SwordIron,,ArmorWolfChest ");
            var keys = new List<string>();
            foreach (var p in items.EnumerateObject()) keys.Add(p.Name);
            Assert.Equal(new[] { "SwordIron", "ArmorWolfChest" }, keys);
        }

        [Fact]
        public void AMalformedListIsRefused()
        {
            Assert.Null(Items.Json(null, out string e1)); Assert.NotNull(e1);
            Assert.Null(Items.Json("Sword\"Iron", out string e2)); Assert.NotNull(e2);
            Assert.Null(Items.Json("../etc", out string e3)); Assert.NotNull(e3);
            var many = new string[Items.MaxIds + 1];
            for (int i = 0; i < many.Length; i++) many[i] = "Item" + i;
            Assert.Null(Items.Json(string.Join(",", many), out string e4)); Assert.NotNull(e4);
            Assert.NotNull(Items.Json(string.Join(",", many, 0, Items.MaxIds), out string e5)); Assert.Null(e5);
        }

        [Fact]
        public void BeforeObjectDBIsReadEveryIdIsUnknown()
        {
            Items.SetForTests(null);
            Assert.False(Items.Ready);
            Assert.Equal("{\"items\":{}}", Items.Json("SwordIron", out _));
        }

        [Fact]
        public void TheRouteAnswersOverHttp()
        {
            var l = new TcpListener(IPAddress.Loopback, 0);
            l.Start(); int port = ((IPEndPoint)l.LocalEndpoint).Port; l.Stop();
            int was = WebMapConfig.SERVER_PORT;
            string cfg = Path.Combine(Dir, "webmap.cfg");
            File.WriteAllText(cfg, $"[Server]\nserver_port = {port}\n");
            WebMapConfig.ReadConfigFile(new ConfigFile(cfg, false));
            Settings.ResetForTests(Dir);
            Mod.worldDataPath = Dir;
            var server = new MapDataServer(IPAddress.Loopback);
            try
            {
                server.ListenAsync();
                using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}") };
                var ok = http.GetAsync("/items?ids=SwordIron,Nope").Result;
                Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
                Assert.Equal("public, max-age=3600", ok.Headers.CacheControl?.ToString());
                var body = J.Parse(ok.Content.ReadAsStringAsync().Result).GetProperty("items");
                Assert.Equal(55, body.GetProperty("SwordIron").GetProperty("damages").Int("slash"));
                Assert.False(body.TryGetProperty("Nope", out _));
                Assert.Equal(HttpStatusCode.BadRequest, http.GetAsync("/items?ids=a%20b").Result.StatusCode);
                Assert.Equal(HttpStatusCode.BadRequest, http.GetAsync("/items").Result.StatusCode);
            }
            finally
            {
                server.Stop();
                WebMapConfig.SERVER_PORT = was;
                Mod.worldDataPath = null;
            }
        }
    }
}
