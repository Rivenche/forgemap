using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Reflection;
using BepInEx.Configuration;
using WebMap.Models;
using Xunit;
using Mod = WebMap.WebMap;

namespace WebMap.Tests
{
    // The optional full-quality maps (map_data/models/hd/, made by tools/textures-hd.py): served
    // from disk a piece at a time and never kept in memory; no folder, nothing changes.
    public class HdMapsTests : WithDir
    {
        [Fact]
        public void TheMemoryCacheTakesSmallViewerFilesOnlyAndNothingUnderHd()
        {
            Assert.True(MapDataServer.Cacheable("js/rig.js", 40 * 1024));
            Assert.True(MapDataServer.Cacheable("index.html", MapDataServer.CacheMax));
            Assert.False(MapDataServer.Cacheable("vendor/three/three.core.js", MapDataServer.CacheMax + 1));
            Assert.False(MapDataServer.Cacheable("hd/tex_a_n.png", 10));
            Assert.False(MapDataServer.Cacheable("models/hd/index.json", 10));
        }

        [Fact]
        public void OnlyPlainMapNamesOfTheHdFolderAreServed()
        {
            string root = Path.Combine(Dir, "models");
            Assert.Equal(Path.Combine(root, "hd", "tex_helmet_iron_d_n.png"), HdMaps.PathOf(root, "tex_helmet_iron_d_n.png"));
            Assert.Equal(Path.Combine(root, "hd", "index.json"), HdMaps.PathOf(root, "index.json"));
            foreach (var bad in new[] { "../index.json", "sub/tex_a.png", "tex_a.png.tmp", "a1b2c3d4.glb", "tex_a b.png", "", "..\\tex_a.png" })
                Assert.Null(HdMaps.PathOf(root, bad));
            Assert.Null(HdMaps.PathOf(null, "index.json"));
        }

        // A sink that remembers the most it was handed between two flushes.
        private sealed class Sink : MemoryStream
        {
            public long Pending, MostPending;
            public override void Write(byte[] b, int o, int n) { base.Write(b, o, n); Pending += n; MostPending = Math.Max(MostPending, Pending); }
            public override void Flush() { Pending = 0; }
        }

        [Fact]
        public void AFileGoesOutAChunkAtATimeNeverWhole()
        {
            var data = new byte[5 * 1024 * 1024 + 123];
            new Random(7).NextBytes(data);
            var sink = new Sink();
            Assert.Equal(data.Length, HdMaps.Copy(new MemoryStream(data), sink));
            Assert.True(sink.MostPending <= HdMaps.Chunk, $"held {sink.MostPending} bytes before a flush");
            Assert.Equal(data, sink.ToArray());
        }

        [Fact]
        public async System.Threading.Tasks.Task TheMapsAreStreamedOverHttpCachedByTheirVersionAndAbsentWithoutTheFolder()
        {
            var l = new TcpListener(IPAddress.Loopback, 0);
            l.Start(); int port = ((IPEndPoint)l.LocalEndpoint).Port; l.Stop();
            int was = WebMapConfig.SERVER_PORT;
            string wasRoot = ModelStore.Root;
            string cfg = Path.Combine(Dir, "webmap.cfg");
            File.WriteAllText(cfg, $"[Server]\nserver_port = {port}\n");
            WebMapConfig.ReadConfigFile(new ConfigFile(cfg, false));
            Settings.ResetForTests(Dir);
            Mod.worldDataPath = Dir;
            string models = Path.Combine(Dir, "models"), hd = Path.Combine(models, "hd");
            Directory.CreateDirectory(hd);
            ModelStore.SetRootForTests(models);
            var map = new byte[3 * 1024 * 1024 + 17];
            new Random(3).NextBytes(map);
            File.WriteAllBytes(Path.Combine(hd, "tex_a_n.png"), map);
            File.WriteAllText(Path.Combine(hd, "index.json"), "{\"format\":1,\"maps\":{\"tex_a.png\":{\"n\":\"tex_a_n.png\",\"v\":\"1\"}}}");
            var server = new MapDataServer(IPAddress.Loopback);
            try
            {
                server.ListenAsync();
                using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}") };
                var r = (await http.GetAsync("/models/hd/tex_a_n.png?v=1"));
                Assert.Equal(HttpStatusCode.OK, r.StatusCode);
                Assert.True(r.Headers.TransferEncodingChunked == true, "sent as it is read, not buffered whole");
                Assert.Equal("image/png", r.Content.Headers.ContentType?.MediaType);
                Assert.Equal("public, max-age=604800, immutable", r.Headers.CacheControl?.ToString());
                Assert.Equal(map, await r.Content.ReadAsByteArrayAsync());
                string etag = r.Headers.ETag?.Tag;
                Assert.NotNull(etag);
                var again = new HttpRequestMessage(HttpMethod.Get, "/models/hd/tex_a_n.png?v=1");
                again.Headers.TryAddWithoutValidation("If-None-Match", etag);
                Assert.Equal(HttpStatusCode.NotModified, (await http.SendAsync(again)).StatusCode);

                var idx = (await http.GetAsync("/models/hd/index.json"));
                Assert.Equal(HttpStatusCode.OK, idx.StatusCode);
                Assert.Equal("public, max-age=300", idx.Headers.CacheControl?.ToString());
                Assert.Contains("tex_a_n.png", await idx.Content.ReadAsStringAsync());

                Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/models/hd/tex_b_n.png")).StatusCode);
                Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/models/hd/..%2Findex.json")).StatusCode);

                // nothing of it was kept in memory by the server
                var cache = (IDictionary)typeof(MapDataServer).GetField("fileCache", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(server);
                Assert.DoesNotContain(cache.Keys.Cast<string>(), k => k.Contains("hd/") || k.EndsWith(".png"));

                // no folder: exactly as before, the viewer gets a 404 and keeps the light textures
                Directory.Delete(hd, true);
                Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/models/hd/index.json")).StatusCode);
            }
            finally
            {
                server.Stop();
                WebMapConfig.SERVER_PORT = was;
                Mod.worldDataPath = null;
                ModelStore.SetRootForTests(wasRoot);
            }
        }
    }
}
