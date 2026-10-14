using Xunit;

namespace WebMap.Tests
{
    // Each player's round trip, as /players and /state carry it: averaged over a minute.
    public class PingTests
    {
        [Fact]
        public void TheAverageIsOverTheLastMinute()
        {
            var w = new Ping.Window();
            Assert.Equal(-1, w.Average(0f));                     // nothing yet: unknown
            for (int s = 0; s < 30; s++) w.Add(200, s);
            for (int s = 30; s < 60; s++) w.Add(100, s);
            Assert.Equal(150, w.Average(59f));
            Assert.Equal(100, w.Average(89.5f));                 // the 200s are more than a minute old
            Assert.Equal(-1, w.Average(200f));                   // nothing in the last minute: unknown again
        }

        [Fact]
        public void OneSampleASecondAndNoneUnknown()
        {
            var w = new Ping.Window();
            w.Add(40, 10f);
            w.Add(400, 10.5f);                                    // within the same second: ignored
            w.Add(-1, 11f);                                       // unknown: not a sample
            Assert.Equal(40, w.Average(11f));
            w.Add(61, 11.2f);
            Assert.Equal(51, w.Average(12f));                    // (40 + 61) / 2, rounded
        }

        [Fact]
        public void AWindowNeverOutgrowsItsSlots()
        {
            var w = new Ping.Window();
            for (int s = 0; s < 1000; s++) w.Add(s < 990 ? 500 : 20, s);
            Assert.Equal(421, w.Average(999f));      // the last 61 seconds: (51 x 500 + 10 x 20) / 61
        }

        [Theory]
        [InlineData(0.30f, 0.25f, 50)]          // ping sent 300 ms ago, answer in 250 ms ago: 50 ms
        [InlineData(0.80f, 0.01f, 790)]
        [InlineData(0.20f, 0.20f, -1)]          // the answer to this ping is not in yet
        [InlineData(0.10f, 1.10f, -1)]
        [InlineData(1.50f, 0.20f, -1)]          // longer than the interval: not this ping's answer
        [InlineData(-1f, 0f, -1)]
        public void TheHeartbeatsRoundTrip(float pingTimer, float sinceLast, int ms) =>
            Assert.Equal(ms, Ping.FromHeartbeat(pingTimer, sinceLast, 1f));
    }
}
