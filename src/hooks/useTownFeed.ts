import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadFeedEvents } from '../lib/feedEvents';
import { loadInitialTeams } from '../lib/teams';
import type { FeedEvent } from '../types';
import { useGameStore } from '../store/gameStore';

// Incremental polling: every 1s we fetch "feed_events with id > lastSeenId".
// Caught-up ticks return ZERO rows (~100-byte response) instead of "the
// last 50 again" (~5KB). Full snapshot only fires on focus / re-entry to
// catch up on whatever happened while we were away.
//
// Phase-4 feed_events replaces Phase-3 deposits — same polling pattern,
// new event-shape consumed by LiveFeed (5 kinds: tile_placed / case_opened /
// crafted / sold / shop_bought).
const POLL_MS = 1_000;
const FEED_CAP = 50;

// Polls public.feed_events while the calling screen is focused AND the
// app is in the foreground. Polling stops on blur/background; an
// immediate refresh fires on the next focus or AppState=active transition.
export function useTownFeed(): { events: FeedEvent[]; loading: boolean } {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  // Highest event id we've already merged into local state. Each subsequent
  // poll only fetches strictly newer rows.
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
          loadFeedEvents({ limit: FEED_CAP }),
          loadInitialTeams(),
        ]);
        if (!activeRef) return;
        setEvents(rows);
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
          loadFeedEvents({ sinceId, limit: FEED_CAP }),
          loadInitialTeams(),
        ]);
        if (!activeRef) return;
        // teamTotals is small (2 rows × ~64 bytes) and TugOfWar needs it
        // fresh — refresh on every poll regardless of whether feed
        // changed.
        useGameStore.getState().setTeamTotals(totals);
        if (newRows.length === 0) return;
        lastSeenIdRef.current = newRows[0].id;
        setEvents((prev) => [...newRows, ...prev].slice(0, FEED_CAP));
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

  return { events, loading };
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
