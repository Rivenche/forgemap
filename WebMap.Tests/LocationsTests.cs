using System.IO;
using System.Linq;
using UnityEngine;
using Xunit;

namespace WebMap.Tests
{
    public class LocationsTests
    {
        [Fact]
        public void ALocationInUnwalkedGroundIsNotReported()
        {
            Locations.ResetForTests();
            Locations.ObserveForTests("Crypt3", 100f, -200f, true);
            Locations.ObserveForTests("GoblinKing", 5000f, 5000f, false);
            Locations.Finish();
            var doc = J.Parse(Locations.GetJson());
            Assert.Equal(new[] { "Crypt3" }, doc.GetProperty("locations").EnumerateArray().Select(l => l.Str("kind")));
            Assert.Equal(1, doc.Int("count"));
        }

        [Fact]
        public void AnAltarAVegvisirPointedToIsReportedAndRemembered()
        {
            string dir = Path.Combine(Path.GetTempPath(), "fm-loc-" + System.Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            try
            {
                Locations.ResetForTests(dir);
                Locations.Revealed(new Vector3(5000f, 30f, 5000f));
                Locations.Revealed(new Vector3(5002f, 30f, 4999f));      // the same altar read twice
                Locations.WaitSavedForTests();
                Assert.Single(File.ReadAllLines(Path.Combine(dir, "vegvisir.tsv")));

                Locations.ResetForTests(dir);                            // as after a restart
                Locations.ObserveForTests("GoblinKing", 5000f, 5000f, false);
                Locations.ObserveForTests("Dragonqueen", -3000f, 800f, false);
                Locations.ObserveForTests("Eikthyrnir", 100f, 100f, true);
                Locations.Finish();
                var all = J.Parse(Locations.GetJson()).GetProperty("locations").EnumerateArray().ToList();
                Assert.Equal(new[] { "GoblinKing", "Eikthyrnir" }, all.Select(l => l.Str("kind")));
                Assert.Equal(1, all[0].GetProperty("v").GetInt32());
                Assert.False(all[1].TryGetProperty("v", out _));
            }
            finally { Locations.ResetForTests(); Directory.Delete(dir, true); }
        }
    }
}
