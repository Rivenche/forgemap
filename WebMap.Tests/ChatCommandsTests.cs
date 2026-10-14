using Xunit;
using K = WebMap.ChatCommands.Kind;

namespace WebMap.Tests
{
    // The pin commands of the game's chat, in English and in French.
    public class ChatCommandsTests
    {
        static ChatCommands.Command P(string m) => ChatCommands.Parse(m);

        [Theory]
        [InlineData("!pin")]
        [InlineData("!PIN")]
        [InlineData("!repere")]
        [InlineData("!repère")]
        [InlineData("!Repère")]
        [InlineData("!REPÈRE")]
        [InlineData("  !repere  ")]
        public void APinInEitherLanguage(string m)
        {
            var c = P(m);
            Assert.Equal(K.Pin, c.kind);
            Assert.Equal("dot", c.type);
            Assert.Equal("", c.text);
        }

        [Theory]
        [InlineData("!undoPin", "undo")]
        [InlineData("!undopin", "undo")]
        [InlineData("!annulerrepere", "undo")]
        [InlineData("!annulerrepère", "undo")]
        [InlineData("!AnnulerRepère", "undo")]
        [InlineData("!deletePin", "delete")]
        [InlineData("!DELETEPIN", "delete")]
        [InlineData("!supprrepere", "delete")]
        [InlineData("!supprrepère", "delete")]
        public void UndoAndDeleteInEitherLanguage(string m, string kind) => Assert.Equal(kind == "undo" ? K.Undo : K.Delete, P(m).kind);

        [Theory]
        [InlineData("hello")]
        [InlineData("")]
        [InlineData(null)]
        [InlineData("!")]
        [InlineData("!pins are cool")]          // a whole word, not a prefix
        [InlineData("!reperes")]
        [InlineData("pin !pin")]
        [InlineData("!help")]
        public void AnythingElseIsChat(string m) => Assert.Equal(K.None, P(m).kind);

        [Theory]
        [InlineData("!pin fire camp", "fire")]
        [InlineData("!pin feu camp", "fire")]
        [InlineData("!repère FEU camp", "fire")]
        [InlineData("!repere point camp", "dot")]
        [InlineData("!repere dot camp", "dot")]
        [InlineData("!repere mine camp", "mine")]
        [InlineData("!repere maison camp", "house")]
        [InlineData("!pin house camp", "house")]
        [InlineData("!repere grotte camp", "cave")]
        [InlineData("!pin Cave camp", "cave")]
        public void PinTypesInEitherLanguageAreKeptAsTheSiteKnowsThem(string m, string type)
        {
            var c = P(m);
            Assert.Equal(type, c.type);
            Assert.Equal("camp", c.text);
            Assert.Contains(c.type, WebMap.ALLOWED_PINS);
        }

        [Fact]
        public void AWordThatIsNoTypeIsTheLabel()
        {
            var c = P("!repère lac gelé");
            Assert.Equal("dot", c.type);
            Assert.Equal("lac gelé", c.text);            // accents kept in a label
        }

        [Fact]
        public void ALabelIsCleanedAndCut()
        {
            Assert.Equal("Camp nord-est", P("!pin Camp, nord-est!").text);
            Assert.Equal("ab", P("!pin a<b>").text);
            Assert.Equal(ChatCommands.MaxText, P("!pin " + new string('x', 40)).text.Length);
            Assert.DoesNotContain(",", P("!pin a,b,c").text);
        }

        [Fact]
        public void DeleteTakesTheLabelAsAPinKeepsIt()
        {
            var c = P("!supprrepère Grotte éloignée");
            Assert.Equal(K.Delete, c.kind);
            Assert.Equal("Grotte éloignée", c.text);     // not read as a type: delete has none
            Assert.Equal("", P("!deletePin").text);
            Assert.Equal("", P("!undoPin whatever").text);
        }

        [Fact]
        public void FoldDropsCaseAndAccents()
        {
            Assert.Equal("!annulerrepere", ChatCommands.Fold("!AnnulerRepère"));
            Assert.Equal("eeeacoui", ChatCommands.Fold("ÉÈÊÀÇÔÛÏ"));
        }
    }
}
