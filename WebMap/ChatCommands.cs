using System;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace WebMap
{
    // The pin commands players type in the game's chat, in English and in French:
    //   !pin [type] [text]    !repere / !repère          a pin where you stand
    //   !undoPin              !annulerrepere / !annulerrepère   your last pin taken up
    //   !deletePin [text]     !supprrepere / !supprrepère       your pin with that text taken up
    // The command is the first word, matched whole, case and accents ignored. A pin type
    // is the second word of a pin, English or French: dot/point, fire/feu, mine,
    // house/maison, cave/grotte.
    internal static class ChatCommands
    {
        public enum Kind { None, Pin, Undo, Delete }

        public struct Command
        {
            public Kind kind;
            public string type;     // a pin's type as it is kept (dot, fire, mine, house, cave)
            public string text;     // the pin's label, cleaned; "" for none
        }

        public const int MaxText = 20;

        // words as Fold leaves them: lower case, no accents
        private static readonly string[] PinWords = { "!pin", "!repere" };
        private static readonly string[] UndoWords = { "!undopin", "!annulerrepere" };
        private static readonly string[] DeleteWords = { "!deletepin", "!supprrepere" };
        // French name -> the type a pin keeps; the English names are WebMap.ALLOWED_PINS themselves
        private static readonly string[,] FrenchTypes = { { "point", "dot" }, { "feu", "fire" }, { "maison", "house" }, { "grotte", "cave" } };

        // Kind.None for anything that is not a pin command: it is chat, and goes on as chat.
        public static Command Parse(string message)
        {
            var cmd = new Command { kind = Kind.None, type = "dot", text = "" };
            message = (message ?? "").Trim();
            if (message.Length < 2 || message[0] != '!') return cmd;
            string[] parts = message.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            string word = Fold(parts[0]);
            if (Array.IndexOf(PinWords, word) >= 0) cmd.kind = Kind.Pin;
            else if (Array.IndexOf(UndoWords, word) >= 0) cmd.kind = Kind.Undo;
            else if (Array.IndexOf(DeleteWords, word) >= 0) cmd.kind = Kind.Delete;
            else return cmd;

            int start = 1;
            if (cmd.kind == Kind.Pin && parts.Length > 1)
            {
                string t = PinType(parts[1]);
                if (t != null) { cmd.type = t; start = 2; }
            }
            if (cmd.kind != Kind.Undo && start < parts.Length)
                cmd.text = CleanText(string.Join(" ", parts, start, parts.Length - start));
            return cmd;
        }

        // A pin type in English or French as the type a pin keeps; null when the word is none.
        public static string PinType(string word)
        {
            string w = Fold(word);
            if (Array.IndexOf(WebMap.ALLOWED_PINS, w) >= 0) return w;
            for (int i = 0; i < FrenchTypes.GetLength(0); i++)
                if (FrenchTypes[i, 0] == w) return FrenchTypes[i, 1];
            return null;
        }

        // A label as a pin keeps it: letters of any language (accents too), digits, spaces and
        // hyphens, at most MaxText characters. No comma (the pins file is CSV), no line break
        // (the websocket frames are lines), nothing a page could read as markup.
        private static readonly Regex NotLabel = new Regex(@"[^\p{L}\p{N} \-]");
        public static string CleanText(string text)
        {
            text = text ?? "";
            if (text.Length > MaxText) text = text.Substring(0, MaxText);
            return NotLabel.Replace(text, "").Trim();
        }

        // Lower case without accents: "!Repère" -> "!repere".
        public static string Fold(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            string d = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (char c in d)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return sb.ToString().ToLowerInvariant();
        }
    }
}
