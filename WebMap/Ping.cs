using System;
using System.Runtime.CompilerServices;

namespace WebMap
{
    // Each connected player's round trip to the server, in milliseconds, averaged over the
    // last minute: the "ping" of /players and /state.
    //
    // Two sources, read once a player snapshot (every player_update_interval) on the game
    // thread, never per frame:
    //   * the socket's own measure, ISocket.GetConnectionQuality's ping: on a Steam
    //     connection, Steam's networking's (SteamNetConnectionRealTimeStatus_t.m_nPing);
    //   * else the game's own heartbeat. ZRpc sends a ping every second (m_pingInterval)
    //     and resets m_pingTimer as it does; the client answers at once, and the answer
    //     resets m_timeSinceLastPing. Both then grow by the same frame times, so once the
    //     answer is in, m_pingTimer - m_timeSinceLastPing is the time from ping to answer:
    //     the round trip, to a server frame. That is the measure for a crossplay
    //     (PlayFab) connection, whose socket reports none.
    // Unknown (no sample yet, or none in the last minute): -1, and the field is left out.
    internal static class Ping
    {
        public const float WindowSeconds = 60f;
        private const int Slots = 64;                 // one sample a second at most: a minute fits
        private const int SocketTries = 5;            // answers without a ping before the heartbeat is the measure

        internal sealed class Window
        {
            private readonly float[] at = new float[Slots];
            private readonly int[] ms = new int[Slots];
            private int head, count;
            private float last = float.NegativeInfinity;
            public int socketMisses;                   // the socket's answers without a ping, before it gave one

            // A sample at `now` (seconds); a second sample within the same second is ignored.
            public void Add(int value, float now)
            {
                if (value < 0 || now - last < 1f) return;
                last = now;
                at[head] = now; ms[head] = value;
                head = (head + 1) % Slots;
                if (count < Slots) count++;
            }

            // The mean of the last minute's samples, rounded; -1 with none.
            public int Average(float now)
            {
                long sum = 0; int n = 0;
                for (int i = 0; i < count; i++)
                    if (now - at[i] <= WindowSeconds) { sum += ms[i]; n++; }
                return n == 0 ? -1 : (int)Math.Round(sum / (double)n, MidpointRounding.AwayFromZero);
            }
        }

        // a window per connection, gone with it
        private static readonly ConditionalWeakTable<ZNetPeer, Window> windows = new ConditionalWeakTable<ZNetPeer, Window>();
        private static readonly ConditionalWeakTable<ZNetPeer, Window>.CreateValueCallback make = _ => new Window();

        // The heartbeat's round trip in ms from ZRpc's two clocks (seconds), or -1 while the
        // answer to the last ping is not in (it never is past the interval: the next ping resets the clock).
        internal static int FromHeartbeat(float pingTimer, float timeSinceLastPing, float interval)
        {
            if (!(pingTimer >= 0f) || !(timeSinceLastPing >= 0f) || timeSinceLastPing >= pingTimer) return -1;
            float rtt = pingTimer - timeSinceLastPing;
            if (rtt > interval) return -1;
            return (int)Math.Round(rtt * 1000f, MidpointRounding.AwayFromZero);
        }

        // Game thread, from the player snapshot.
        public static void Sample(ZNetPeer peer, float now)
        {
            if (peer == null || peer.m_server) return;
            var w = windows.GetValue(peer, make);
            int value = -1;
            if (w.socketMisses < SocketTries)
            {
                try
                {
                    var socket = peer.m_socket ?? peer.m_rpc?.GetSocket();
                    if (socket != null)
                    {
                        socket.GetConnectionQuality(out _, out _, out int ping, out _, out _);
                        if (ping > 0) value = ping;
                    }
                }
                catch { }
                // PlayFab answers 0 every time (a LAN's 0 ms reads the same, and Steam's first
                // answers can be 0 too): after a few such, the heartbeat is the measure and the
                // socket is not asked again for this connection. One real answer: always the socket's.
                w.socketMisses = value < 0 ? w.socketMisses + 1 : int.MinValue;
            }
            if (value < 0)
            {
                var rpc = peer.m_rpc;
                if (rpc != null) value = FromHeartbeat(rpc.m_pingTimer, rpc.m_timeSinceLastPing, ZRpc.m_pingInterval);
            }
            w.Add(value, now);
        }

        // Game thread (the snapshot builds the players' JSON there): the minute's average, -1 when unknown.
        public static int Of(ZNetPeer peer, float now)
        {
            if (peer == null || !windows.TryGetValue(peer, out var w)) return -1;
            return w.Average(now);
        }
    }
}
