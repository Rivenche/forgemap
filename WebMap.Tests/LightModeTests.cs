using System;
using System.IO;
using BepInEx.Configuration;
using Xunit;

namespace WebMap.Tests
{
    // [Performance] light_mode: one switch for small servers. It turns down the 3D view's
    // costs and the sweep's pace; nothing the 2D map draws from goes away.
    public class LightModeTests : WithDir
    {
        readonly (bool light, bool export, bool tex, bool mesh, string cats, int render, int texture) was =
            (WebMapConfig.LIGHT_MODE, WebMapConfig.EXPORT_MODELS, WebMapConfig.EXTRACT_TEXTURES, WebMapConfig.EXTRACT_MESHES,
             WebMapConfig.OBJECT_CATEGORIES, WebMapConfig.RENDER_SIZE, WebMapConfig.TEXTURE_SIZE);

        public override void Dispose()
        {
            (WebMapConfig.LIGHT_MODE, WebMapConfig.EXPORT_MODELS, WebMapConfig.EXTRACT_TEXTURES, WebMapConfig.EXTRACT_MESHES,
             WebMapConfig.OBJECT_CATEGORIES, WebMapConfig.RENDER_SIZE, WebMapConfig.TEXTURE_SIZE) = was;
            base.Dispose();
        }

        void Read(string cfg)
        {
            string path = Path.Combine(Dir, "forgemap.cfg");
            File.WriteAllText(path, cfg);
            WebMapConfig.ReadConfigFile(new ConfigFile(path, false));
        }

        [Fact]
        public void OffByDefaultAndThenItChangesNothing()
        {
            Read("");
            Assert.False(WebMapConfig.LIGHT_MODE);
            Assert.Empty(WebMapConfig.ApplyLightMode());
            Assert.True(WebMapConfig.EXPORT_MODELS);
            Assert.Equal("piece,other,rock,bush,tree", WebMapConfig.OBJECT_CATEGORIES);
            Assert.Equal(48L * Heights.N * Heights.N, Heights.KeepSamples);
            Assert.Equal(60_000, StructureMap.Floor);
        }

        [Fact]
        public void OnItTurnsDownThe3DViewAndTheSweepsPace()
        {
            Read("[Texture]\nrender_size = 4096\n\n[Performance]\nlight_mode = true\n");
            Assert.True(WebMapConfig.LIGHT_MODE);
            var did = WebMapConfig.ApplyLightMode();
            Assert.NotEmpty(did);
            Assert.False(WebMapConfig.EXPORT_MODELS);
            Assert.False(WebMapConfig.EXTRACT_TEXTURES);
            Assert.False(WebMapConfig.EXTRACT_MESHES);
            Assert.Equal("piece,other", WebMapConfig.OBJECT_CATEGORIES);
            Assert.Equal(WebMapConfig.TEXTURE_SIZE, WebMapConfig.RENDER_SIZE);
            Assert.Equal(12L * Heights.N * Heights.N, Heights.KeepSamples);
            Assert.Equal(300_000, StructureMap.Floor);
        }

        [Fact]
        public void ItKeepsWhatWasAskedOfBuildingsAndLocationsAndNeverLeavesTheViewEmpty()
        {
            WebMapConfig.LIGHT_MODE = true;
            WebMapConfig.OBJECT_CATEGORIES = "other, tree";
            WebMapConfig.ApplyLightMode();
            Assert.Equal("other", WebMapConfig.OBJECT_CATEGORIES);
            WebMapConfig.OBJECT_CATEGORIES = "tree,rock";
            WebMapConfig.ApplyLightMode();
            Assert.Equal("piece", WebMapConfig.OBJECT_CATEGORIES);
        }

        [Fact]
        public void TheConfigSaysWhatItDoesInFrenchAndEnglish()
        {
            string path = Path.Combine(Dir, "forgemap.cfg");
            var cfg = new ConfigFile(path, false);
            WebMapConfig.ReadConfigFile(cfg);
            cfg.Save();
            string text = File.ReadAllText(path);
            Assert.Contains("[Performance]", text);
            Assert.Contains("light_mode = false", text);
            Assert.Contains("FR : mode léger", text);
            Assert.Contains("EN: light mode", text);
        }

        [Fact]
        public void TheSiteCanSwitchItForTheNextRestart()
        {
            Settings.ResetForTests(Dir);
            Assert.Null(Settings.Set("light_mode", "true", "tester", out _, out bool restart));
            Assert.True(restart);
            Assert.True(WebMapConfig.LIGHT_MODE);
            Assert.Null(Settings.Set("light_mode", "", "tester", out _, out _));
            Assert.Equal(was.light, WebMapConfig.LIGHT_MODE);
        }
    }
}
