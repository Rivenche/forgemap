using System.IO;
using System.Text.RegularExpressions;

namespace WebMap.Models
{
    // The optional full-quality maps beside the model library: map_data/models/hd/, written by
    // tools/textures-hd.py from a server owner's own copy of the game (normal, metal/roughness
    // and glow maps the dedicated server never exports, and a base colour when the game's is
    // bigger than the library's). Nothing in the mod writes or reads them but the web server,
    // which streams them from disk: they cost disk space, never memory. No folder, no change.
    internal static class HdMaps
    {
        public const string Dir = "hd";
        // a streamed file goes out this much at a time: the most of it ever held in memory
        public const int Chunk = 64 * 1024;
        private static readonly Regex File = new Regex(@"^(index\.json|tex_[A-Za-z0-9_-]{1,160}\.png)$");

        // A file of the hd folder by name (no subfolders, no dots but the extension), or null.
        public static string PathOf(string modelsRoot, string name) =>
            modelsRoot != null && name != null && File.IsMatch(name) ? Path.Combine(Path.Combine(modelsRoot, Dir), name) : null;

        // src to dst a Chunk at a time, flushed after each, so a chunked HTTP response sends
        // each piece as it is read; returns the bytes copied.
        public static long Copy(Stream src, Stream dst)
        {
            var buf = new byte[Chunk];
            long total = 0;
            int n;
            while ((n = src.Read(buf, 0, buf.Length)) > 0)
            {
                dst.Write(buf, 0, n);
                dst.Flush();
                total += n;
            }
            return total;
        }
    }
}
