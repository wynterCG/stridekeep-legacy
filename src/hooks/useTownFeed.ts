import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadDeposits, type DepositRow } from '../lib/deposits';
import { loadInitialTeams } from '../lib/teams';
import { useGameStore } from '../store/gameStore';

// Incremental polling: every 1s we fetch "deposits with id > lastSeenId".
// Caught-up ticks return ZERO rows (~100-byte response) instead of "the
// last 50 again" (~5KB). Full snapshot only fires on focus / re-entry to
// catch up on whatever happened while we were away.
//
// Net egress: ~360 KB/hr per active Town viewer (vs the old 30s full
// snapshot's 600 KB/hr). Feels fully real-time; free-tier-safe up to
// ~20 concurrent Town viewers. For more, raise POLL_MS to 3-5s or move
// to a realtime broadcast model.
const POLL_MS = 1_000;
const FEED_CAP = 50;

/**
 * Polls public.deposits every 30s while the calling screen is focused AND
 * the app is in the foreground. Polling stops on blur/background; an immediate
 * refresh fires on the next focus or AppState=active transition.
 *
 * Intentionally NOT realtime: the live feed is the highest-fanout candidate
 * (every deposit broadcast × every subscriber), so we eat a 30s latency to
 * keep the project comfortably inside Supabase's free tier.
 */
export function useTownFeed(): { deposits: DepositRow[]; loading: boolean } {
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Highest deposit id we've already merged into local state. Each
  // subsequent poll only fetches strictly newer rows.
  const lastSeenIdRef = useRef<number | null>(null);
  // Overlap guard: setInterval fires every POLL_MS regardless of whether
  // the previous tick() has returned. Without this, on slow networks two
  // polls can read the same sinceId and both append the same rows to the
  // feed, causing visible key-collision dupes.
  const inFlightRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let activeRef = true;
      // Reset on every focus so re-entering Town does a clean snapshot
      // (catches up on whatever happened while we were away).
      lastSeenIdRef.current = null;
      inFlightRef.current = false;

      const fullSnapshot = async () => {
        const [rows, totals] = await Promise.all([
          loadDeposits({ limit: FEED_CAP }),
          loadInitialTeams(),
        ]);
        if (!activeRef) return;
        setDeposits(rows);
        useGameStore.getState().setTeamTotals(totals);
        if (rows.length > 0) lastSeenIdRef.current = rows[0].id;
      };

      const incrementalPoll = async () => {
        const sinceId = lastSeenIdRef.current;
        if (sinceId === null) {
          await fullSnapshot();
          return;
        }
        const [newRows, totals] = await Promise.all([
          loadDeposits({ sinceId, limit: FEED_CAP }),
          loadInitialTeams(),
        ]);
        if (!activeRef) return;
        // teamTotals is small (2 rows × ~64 bytes) and the chart needs it
        // fresh — refresh on every poll regardless of whether deposits
        // changed.
        useGameStore.getState().setTeamTotals(totals);
        if (newRows.length === 0) return;
        lastSeenIdRef.current = newRows[0].id;
        setDeposits((prev) => [...newRows, ...prev].slice(0, FEED_CAP));
      };

      const tick = async () => {
        if (inFlightRef.current) return;
        if (AppState.currentState !== 'active') return;
        inFlightRef.current = true;
        try {
          setLoading(true);
          if (lastSeenIdRef.current === null) await fullSnapshot();
          else await incrementalPoll();
        } catch (err) {
          console.warn('[stridekeep] town feed load failed:', err);
        } finally {
          inFlightRef.current = false;
          if (activeRef) setLoading(false);
        }
      };

      void tick();
      const id = setInterval(() => void tick(), POLL_MS);

      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void tick();
      });

      return () => {
        activeRef = false;
        clearInterval(id);
        sub.remove();
      };
    }, []),
  );

  return { deposits, loading };
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}
