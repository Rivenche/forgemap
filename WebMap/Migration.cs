using System;
using System.Collections.Generic;
using System.IO;

namespace WebMap
{
    // ForgeMap is its own mod since 1.1.0: its own GUID, so its own config file, and its
    // own DLL, ForgeMap.dll, often in its own plugins folder. Nobody should lose anything
    // over that, so on start:
    //   * the config: BepInEx names the file after the GUID. When ForgeMap's does not exist
    //     yet and WebMap's does, WebMap's is copied under the new name before anything is
    //     bound, so every value carries over;
    //   * the data: map_data (fog, pins, names, stats, the model library...) and
    //     announce.token live beside the DLL. When ForgeMap's own map_data is missing or
    //     empty and another plugins folder holds a WebMap.dll with a map_data, that
    //     map_data and token are copied (never moved: the old folder stays as it was);
    //   * a WebMap.dll still installed would load beside ForgeMap and fight it for the
    //     port: the log says where it is.
    internal static class Migration
    {
        public const string OldGuid = "com.github.h0tw1r3.valheim.webmap";
        public const string OldDll = "WebMap.dll";
        public const string DataDir = "map_data";
        public const string TokenFile = "announce.token";

        // The new config file, a copy of WebMap's when it has none yet. The old file copied, or null.
        public static string Config(string newPath)
        {
            try
            {
                if (string.IsNullOrEmpty(newPath) || File.Exists(newPath)) return null;
                string old = Path.Combine(Path.GetDirectoryName(newPath) ?? "", OldGuid + ".cfg");
                if (!File.Exists(old)) return null;
                File.Copy(old, newPath, false);
                return old;
            }
            catch (Exception e)
            {
                ZLog.LogWarning("ForgeMap: could not copy WebMap's config: " + e.Message);
                return null;
            }
        }

        // Nothing kept yet: no folder, or one with nothing in it.
        public static bool IsEmpty(string dir)
        {
            try
            {
                if (!Directory.Exists(dir)) return true;
                using (var e = Directory.EnumerateFileSystemEntries(dir).GetEnumerator()) return !e.MoveNext();
            }
            catch { return false; }       // unreadable: never copy over it
        }

        // Every WebMap.dll under the plugins folder, wherever BepInEx would load it from.
        public static List<string> OldDlls(string pluginsRoot)
        {
            var found = new List<string>();
            try
            {
                if (!string.IsNullOrEmpty(pluginsRoot) && Directory.Exists(pluginsRoot))
                    found.AddRange(Directory.GetFiles(pluginsRoot, OldDll, SearchOption.AllDirectories));
            }
            catch (Exception e) { ZLog.LogWarning("ForgeMap: could not look for an old WebMap: " + e.Message); }
            found.Sort(StringComparer.Ordinal);
            return found;
        }

        // The old install whose data to take: a folder other than ours holding a WebMap.dll and a
        // map_data with something in it; of several, the one written to last. Null when none.
        public static string FindOldData(string pluginsRoot, string ownDir)
        {
            string best = null; DateTime bestAt = DateTime.MinValue;
            string own = Full(ownDir);
            foreach (string dll in OldDlls(pluginsRoot))
            {
                string dir = Path.GetDirectoryName(dll);
                if (dir == null || string.Equals(Full(dir), own, StringComparison.OrdinalIgnoreCase)) continue;
                string data = Path.Combine(dir, DataDir);
                if (IsEmpty(data)) continue;
                DateTime at = Newest(data);
                if (best == null || at > bestAt) { best = dir; bestAt = at; }
            }
            return best;
        }

        // Copies oldDir's map_data and announce.token into ownDir, leaving oldDir as it was and
        // never overwriting a file ownDir already has. The number of files copied.
        public static int CopyData(string oldDir, string ownDir)
        {
            int n = CopyTree(Path.Combine(oldDir, DataDir), Path.Combine(ownDir, DataDir));
            string token = Path.Combine(oldDir, TokenFile), mine = Path.Combine(ownDir, TokenFile);
            if (File.Exists(token) && !File.Exists(mine)) { File.Copy(token, mine, false); n++; }
            return n;
        }

        // All of it, in the order the plugin needs it: the config before it is bound, the data
        // before map_data is created. Logs what it did. True when a config was copied, so the
        // caller reloads its ConfigFile.
        public static bool Run(string configPath, string pluginsRoot, string ownDir)
        {
            bool configCopied = false;
            string oldCfg = Config(configPath);
            if (oldCfg != null)
            {
                configCopied = true;
                ZLog.Log($"ForgeMap: first start as ForgeMap: WebMap's config {oldCfg} copied to {configPath}, every setting kept (the old file is left as it was)");
            }

            try
            {
                if (IsEmpty(Path.Combine(ownDir, DataDir)))
                {
                    string old = FindOldData(pluginsRoot, ownDir);
                    if (old != null)
                    {
                        int n = CopyData(old, ownDir);
                        ZLog.Log($"ForgeMap: no map data of its own yet: copied {n} files (map_data, announce.token) from the WebMap install in {old}; the originals are left in place");
                    }
                }
            }
            catch (Exception e) { ZLog.LogWarning("ForgeMap: could not copy the old WebMap's map data: " + e.Message); }

            foreach (string dll in OldDlls(pluginsRoot))
                ZLog.LogWarning($"ForgeMap: {dll} is installed too. ForgeMap replaces WebMap: both would load and fight over the map's port. "
                              + "Stop the server and delete that WebMap.dll (ForgeMap has already copied what it needs).");
            return configCopied;
        }

        private static int CopyTree(string src, string dst)
        {
            if (!Directory.Exists(src)) return 0;
            int n = 0;
            Directory.CreateDirectory(dst);
            foreach (string f in Directory.GetFiles(src))
            {
                string to = Path.Combine(dst, Path.GetFileName(f));
                if (File.Exists(to)) continue;
                File.Copy(f, to, false);
                n++;
            }
            foreach (string d in Directory.GetDirectories(src))
                n += CopyTree(d, Path.Combine(dst, Path.GetFileName(d)));
            return n;
        }

        private static DateTime Newest(string dir)
        {
            DateTime t = DateTime.MinValue;
            try { foreach (string f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories)) { var w = File.GetLastWriteTimeUtc(f); if (w > t) t = w; } }
            catch { }
            return t;
        }

        private static string Full(string dir)
        {
            try { return Path.GetFullPath(dir ?? "").TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
            catch { return dir ?? ""; }
        }
    }
}
