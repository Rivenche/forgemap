using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;
using HarmonyLib;
using UnityEngine;

namespace WebMap
{
    // The world's locations -- altars, crypts, caves, camps, ruins, wrecks, runestones -- where
    // the generator put them, for the tour to visit and the map to mark. Told only in walked
    // ground, the site's honour rule: what a player's own map would show. And a player's map
    // shows one more: the boss altar a Vegvisir pointed to, which the server itself answers
    // (Game.RPC_DiscoverClosestLocation), so it is remembered here, kept across restarts.
    internal static class Locations
    {
        private struct Entry { public string kind; public float x, z; public bool explored, revealed; }
        // filled on the game thread as a sweep begins, read by its finish on the pool thread
        private static readonly List<Entry> found = new List<Entry>();
        private static volatile string json = "{\"locations\":[],\"count\":0}";

        // where a Vegvisir pointed, x, z pairs; the game thread adds, the pool thread saves a copy
        private static readonly List<Vector2> revealed = new List<Vector2>();
        private const string RevealedFile = "vegvisir.tsv";
        private const float Near = 8f;     // the answer is the location's own position; a little slack
        private static string dir;
        private static volatile bool saving;

        public static void Load(string worldDataPath)
        {
            dir = worldDataPath;
            lock (revealed)
            {
                revealed.Clear();
                try
                {
                    string path = Path.Combine(dir, RevealedFile);
                    if (File.Exists(path))
                        foreach (string line in File.ReadAllLines(path))
                        {
                            var f = line.Split('\t');
                            if (f.Length >= 2
                                && float.TryParse(f[0], NumberStyles.Float, CultureInfo.InvariantCulture, out float x)
                                && float.TryParse(f[1], NumberStyles.Float, CultureInfo.InvariantCulture, out float z))
                                revealed.Add(new Vector2(x, z));
                        }
                }
                catch (Exception e) { ZLog.LogWarning("WebMap: Vegvisir finds not loaded: " + e.Message); }
            }
        }

        // A Vegvisir's answer, as the server sends it to the reader.
        public static void Revealed(Vector3 pos)
        {
            lock (revealed)
            {
                foreach (var r in revealed)
                    if (Mathf.Abs(r.x - pos.x) < Near && Mathf.Abs(r.y - pos.z) < Near) return;
                revealed.Add(new Vector2(pos.x, pos.z));
            }
            Save();
        }

        // one write at a time; a find landing during one is written by the next
        private static bool dirty;
        private static void Save()
        {
            string text, path;
            lock (revealed)
            {
                if (dir == null) return;
                if (saving) { dirty = true; return; }
                var sb = new StringBuilder();
                foreach (var r in revealed)
                    sb.Append(r.x.ToString("0.#", CultureInfo.InvariantCulture)).Append('\t')
                      .Append(r.y.ToString("0.#", CultureInfo.InvariantCulture)).Append('\n');
                text = sb.ToString();
                path = Path.Combine(dir, RevealedFile);
                saving = true; dirty = false;
            }
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    string tmp = path + ".new";
                    File.WriteAllText(tmp, text);
                    if (File.Exists(path)) File.Replace(tmp, path, null); else File.Move(tmp, path);
                }
                catch (Exception ex) { ZLog.LogWarning("WebMap: Vegvisir finds not saved: " + ex.Message); }
                finally { bool again; lock (revealed) { saving = false; again = dirty; } if (again) Save(); }
            });
        }

        private static bool IsRevealed(float x, float z)
        {
            lock (revealed)
                foreach (var r in revealed)
                    if (Mathf.Abs(r.x - x) < Near && Mathf.Abs(r.y - z) < Near) return true;
            return false;
        }

        // Game thread, once a sweep: the instance list is the game's, and the fog moves.
        public static void Scan()
        {
            found.Clear();
            try
            {
                var zs = ZoneSystem.instance;
                if (zs == null || zs.m_locationInstances == null) return;
                foreach (var li in zs.m_locationInstances.Values)
                {
                    string kind = li.m_location != null ? li.m_location.m_prefabName : null;
                    if (string.IsNullOrEmpty(kind)) continue;
                    float x = li.m_position.x, z = li.m_position.z;
                    found.Add(new Entry { kind = kind, x = x, z = z, explored = MapFog.Explored(x, z), revealed = IsRevealed(x, z) });
                }
            }
            catch (Exception e) { ZLog.LogWarning("WebMap: location scan failed: " + e.Message); }
        }

        public static void Finish()
        {
            var sb = new StringBuilder("{\"locations\":[");
            int n = 0;
            foreach (var e in found)
            {
                if (!e.explored && !e.revealed) continue;
                if (n++ > 0) sb.Append(',');
                sb.Append(FormattableString.Invariant($"{{\"kind\":\"{e.kind.Replace("\\", "").Replace("\"", "")}\",\"x\":{e.x:0.#},\"z\":{e.z:0.#}"));
                if (e.revealed && !e.explored) sb.Append(",\"v\":1");   // seen only through a Vegvisir
                sb.Append('}');
            }
            json = sb.Append("],\"count\":").Append(n).Append('}').ToString();
        }

        public static string GetJson() => json;

        // ---------- for the tests (WebMap.Tests) ----------
        internal static void ResetForTests(string worldDataPath = null)
        {
            System.Threading.SpinWait.SpinUntil(() => !saving, 5000);
            found.Clear();
            if (worldDataPath != null) Load(worldDataPath); else lock (revealed) { revealed.Clear(); dir = null; }
        }
        internal static void ObserveForTests(string kind, float x, float z, bool explored) =>
            found.Add(new Entry { kind = kind, x = x, z = z, explored = explored, revealed = IsRevealed(x, z) });
        internal static void WaitSavedForTests() => System.Threading.SpinWait.SpinUntil(() => !saving, 5000);
    }

    // The server's answer to a Vegvisir: RPC_DiscoverClosestLocation finds the closest location
    // of the kind and sends its position back to the reader as RPC_DiscoverLocationResponse
    // (pin name, pin type, position, show map). A plain string compare on every routed call.
    [HarmonyPatch(typeof(ZRoutedRpc), nameof(ZRoutedRpc.InvokeRoutedRPC), new[] { typeof(long), typeof(string), typeof(object[]) })]
    internal class VegvisirAnswerPatch
    {
        private static void Prefix(string methodName, object[] parameters)
        {
            if (methodName != "RPC_DiscoverLocationResponse" || parameters == null || parameters.Length < 3) return;
            try { if (parameters[2] is Vector3 pos) Locations.Revealed(pos); }
            catch (Exception e) { ZLog.LogWarning("WebMap: Vegvisir answer not read: " + e.Message); }
        }
    }
}
