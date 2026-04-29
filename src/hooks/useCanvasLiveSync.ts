import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  loadSeasonTargetPixels,
  loadTeamCanvas,
  subscribeCanvasPixels,
} from '../lib/canvas';
import { useGameStore } from '../store/gameStore';
import type { Team } from '../types';

/**
 * Subscribes to canvas_pixels realtime updates for the player's team only
 * when the calling screen is focused AND the app is in the foreground.
 * Mirrors useTeamsLiveSync's lifecycle — see that file's cost rationale.
 *
 * On each (re)open this also bulk-loads the team canvas + the season's
 * target_pixels so we catch up on placements that landed while we were
 * unsubscribed (or that haven't been loaded yet on cold start).
 *
 * Pre-conditions enforced by Home screen rendering: this hook only does
 * useful work once `seasonNumber` is non-null. We early-return if it is.
 * The closure recaptures via the `team`/`seasonNumber` deps so a season
 * rollover or team change re-subscribes cleanly.
 */
export function useCanvasLiveSync(team: Team | null, seasonNumber: number | null): void {
  useFocusEffect(
    useCallback(() => {
      let activeRef = true;
      let channel: RealtimeChannel | null = null;

      const close = () => {
        if (channel) {
          channel.unsubscribe();
          channel = null;
        }
      };

      const open = async () => {
        if (team === null || seasonNumber === null) return;
        close();

        // Subscribe-before-load to close the race window where INSERTs
        // land between the SELECT snapshot and the realtime JOIN: those
        // updates would otherwise be dropped silently and the player
        // would see "missing" pixels until the next focus-regain.
        // Events arriving before `loaded === true` are buffered and
        // replayed once the snapshot lands. applyPlacedPixel is
        // idempotent (key replace), so any pixel that appears in BOTH
        // the snapshot and the buffer is overwritten with the same
        // value — duplicates are safe.
        const buffer: { pixelIdx: number; colorId: string }[] = [];
        let loaded = false;
        channel = subscribeCanvasPixels(team, seasonNumber, ({ pixelIdx, colorId }) => {
          if (!activeRef) return;
          if (loaded) {
            useGameStore.getState().applyPlacedPixel(team, pixelIdx, colorId);
          } else {
            buffer.push({ pixelIdx, colorId });
          }
        });

        try {
          // Parallel load: target_pixels (~30 KB jsonb on the seasons row)
          // and the team's placed pixels. Both fire-and-forget into the
          // store; rendering can run with either one populated.
          const [target, placed] = await Promise.all([
            loadSeasonTargetPixels(seasonNumber),
            loadTeamCanvas(team, seasonNumber),
          ]);
          if (!activeRef) return;
          const store = useGameStore.getState();
          store.setCanvasTargetPixels(target);
          const placedMap: Record<number, string> = {};
          for (const p of placed) placedMap[p.pixelIdx] = p.colorId;
          store.setTeamCanvas(team, placedMap);
          loaded = true;
          for (const p of buffer) {
            store.applyPlacedPixel(team, p.pixelIdx, p.colorId);
          }
        } catch (err) {
          console.warn('[stridekeep] canvas live-sync open failed:', err);
        }
      };

      if (AppState.currentState === 'active') {
        void open();
      }

      const sub = AppState.addEventListener('change', (state) => {
        if (!activeRef) return;
        if (state === 'active') {
          void open();
        } else {
          close();
        }
      });

      return () => {
        activeRef = false;
        close();
        sub.remove();
      };
    }, [team, seasonNumber]),
  );
}
