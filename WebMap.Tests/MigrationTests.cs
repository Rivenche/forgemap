using System;
using System.IO;
using System.Reflection;
using BepInEx;
using BepInEx.Configuration;
using Xunit;
using Mod = WebMap.WebMap;

namespace WebMap.Tests
{
    // ForgeMap 1.1.0 is its own mod: its own GUID, config file and DLL. A WebMap (or
    // ForgeMap 1.0) install hands over its config and its map data on the first start.
    public class MigrationTests : WithDir
    {
        string Plugins => Path.Combine(Dir, "plugins");
        string Configs => Path.Combine(Dir, "config");
        string NewCfg => Path.Combine(Configs, Mod.GUID + ".cfg");
        string OldCfg => Path.Combine(Configs, Migration.OldGuid + ".cfg");

        public MigrationTests() { Directory.CreateDirectory(Plugins); Directory.CreateDirectory(Configs); }

        // a plugins folder holding a WebMap.dll, with map data if asked
        string OldInstall(string name, string world = "Midgard", string token = null)
        {
            string d = Path.Combine(Plugins, name);
            Directory.CreateDirectory(d);
            File.WriteAllText(Path.Combine(d, "WebMap.dll"), "old");
            if (world != null)
            {
                Directory.CreateDirectory(Path.Combine(d, "map_data", world));
                File.WriteAllText(Path.Combine(d, "map_data", world, "pins.csv"), "Steam_1,1-1,dot,Grant,1.00,2.00,camp");
                File.WriteAllText(Path.Combine(d, "map_data", "settings.tsv"), "explore_radius\t150\tadmin\t0\n");
            }
            if (token != null) File.WriteAllText(Path.Combine(d, "announce.token"), token);
            return d;
        }
        string Own() { string d = Path.Combine(Plugins, "ForgeServer-ForgeMap"); Directory.CreateDirectory(d); return d; }

        [Fact]
        public void ForgeMapIsItsOwnModNowAndNoLongerWebMap()
        {
            var meta = typeof(Mod).GetCustomAttribute<BepInPlugin>(false);
            Assert.Equal("fr.forgeserver.forgemap", meta.GUID);
            Assert.Equal("ForgeMap", meta.Name);
            Assert.NotEqual(Migration.OldGuid, meta.GUID);
            Assert.Equal("ForgeMap", typeof(Mod).Assembly.GetName().Name);
        }

        [Fact]
        public void WebMapsConfigIsCopiedUnderTheNewNameWithEveryValue()
        {
            File.WriteAllText(OldCfg, "[Server]\nserver_port = 3456\ndiscord_guild = 123\n\n[User]\nmax_pins_per_user = 7\n");
            Assert.Equal(OldCfg, Migration.Config(NewCfg));
            Assert.True(File.Exists(OldCfg));                       // copied, not moved
            var cfg = new ConfigFile(NewCfg, false);
            Assert.Equal(3456, cfg.Bind("Server", "server_port", 3000, "").Value);
            Assert.Equal("123", cfg.Bind("Server", "discord_guild", "", "").Value);
            Assert.Equal(7, cfg.Bind("User", "max_pins_per_user", 50, "").Value);
        }

        [Fact]
        public void AReloadAfterTheCopyGivesAConfigAlreadyOpenTheOldValues()
        {
            // BepInEx opens the plugin's ConfigFile before Awake: the copy lands under it, then Reload
            var cfg = new ConfigFile(NewCfg, false);
            File.WriteAllText(OldCfg, "[Server]\nserver_port = 4567\n");
            Assert.True(Migration.Run(NewCfg, Plugins, Own()));
            cfg.Reload();
            Assert.Equal(4567, cfg.Bind("Server", "server_port", 3000, "").Value);
        }

        [Fact]
        public void ANewConfigIsNeverOverwrittenAndNoOldOneIsNoCopy()
        {
            Assert.Null(Migration.Config(NewCfg));                 // nothing to copy
            File.WriteAllText(NewCfg, "[Server]\nserver_port = 1111\n");
            File.WriteAllText(OldCfg, "[Server]\nserver_port = 2222\n");
            Assert.Null(Migration.Config(NewCfg));
            Assert.Contains("1111", File.ReadAllText(NewCfg));
        }

        [Fact]
        public void AnOldInstallsMapDataAndTokenAreCopiedAndLeftInPlace()
        {
            string old = OldInstall("WebMap", token: "secret"), own = Own();
            Assert.False(Migration.Run(NewCfg, Plugins, own));
            Assert.Equal("Steam_1,1-1,dot,Grant,1.00,2.00,camp", File.ReadAllText(Path.Combine(own, "map_data", "Midgard", "pins.csv")));
            Assert.True(File.Exists(Path.Combine(own, "map_data", "settings.tsv")));
            Assert.Equal("secret", File.ReadAllText(Path.Combine(own, "announce.token")));
            Assert.True(File.Exists(Path.Combine(old, "map_data", "Midgard", "pins.csv")));   // the old folder as it was
            Assert.True(File.Exists(Path.Combine(old, "announce.token")));
        }

        [Fact]
        public void MapDataOfItsOwnIsNeverReplaced()
        {
            OldInstall("Mubs-WebMap");
            string own = Own();
            Directory.CreateDirectory(Path.Combine(own, "map_data", "Other"));
            File.WriteAllText(Path.Combine(own, "map_data", "Other", "pins.csv"), "mine");
            Migration.Run(NewCfg, Plugins, own);
            Assert.False(Directory.Exists(Path.Combine(own, "map_data", "Midgard")));
            Assert.Equal("mine", File.ReadAllText(Path.Combine(own, "map_data", "Other", "pins.csv")));
        }

        [Fact]
        public void AnEmptyMapDataFolderIsFilledAndAnOldInstallWithoutDataIsPassedOver()
        {
            string own = Own();
            Directory.CreateDirectory(Path.Combine(own, "map_data"));      // a start before the old data was there
            OldInstall("Empty", world: null);
            Assert.Null(Migration.FindOldData(Plugins, own));
            OldInstall("WebMap");
            Assert.Equal(Path.Combine(Plugins, "WebMap"), Migration.FindOldData(Plugins, own));
            Migration.Run(NewCfg, Plugins, own);
            Assert.True(File.Exists(Path.Combine(own, "map_data", "Midgard", "pins.csv")));
        }

        [Fact]
        public void ItsOwnFolderIsNoOldInstallAndTheNewestOfSeveralWins()
        {
            string own = Own();
            File.WriteAllText(Path.Combine(own, "WebMap.dll"), "forgemap 1.0, still in its folder");
            Assert.Null(Migration.FindOldData(Plugins, own));
            string a = OldInstall("A"), b = OldInstall("B");
            File.SetLastWriteTimeUtc(Path.Combine(a, "map_data", "Midgard", "pins.csv"), DateTime.UtcNow.AddDays(-3));
            File.SetLastWriteTimeUtc(Path.Combine(a, "map_data", "settings.tsv"), DateTime.UtcNow.AddDays(-3));
            Assert.Equal(b, Migration.FindOldData(Plugins, own));
        }

        [Fact]
        public void EveryWebMapDllUnderThePluginsIsFoundForTheWarning()
        {
            string own = Own();
            File.WriteAllText(Path.Combine(own, "WebMap.dll"), "left over");
            OldInstall("Mubs-WebMap", world: null);
            Assert.Equal(2, Migration.OldDlls(Plugins).Count);
            Assert.Empty(Migration.OldDlls(Path.Combine(Dir, "nowhere")));
        }
    }
}
