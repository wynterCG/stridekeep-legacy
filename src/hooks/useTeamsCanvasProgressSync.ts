import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { loadTeamsCanvasProgress } from '../lib/canvas';

const POLL_MS = 1_000;

// Slim screen-level poller that keeps `gameStore.teamsCanvasProgress`
// fresh while the calling screen is focused AND the app is foregrounded.
// Drives the SeasonCard's red-vs-blue scoreboard regardless of which
// sub-tab inside Home/Inventory is currently rendered.
//
// Pre-redesign this work was bundled into useTownFeed (which also
// polled feed_events for the LiveFeed). After the compound-cards
// redesign the feed poll lives only inside CanvasPanel — which is
// conditionally mounted only when CANVAS sub-tab is active. The
// scoreboard needs to keep ticking on CASES, PROFILE, COLORS, MIXING
// too, so this is its dedicated hook.
//
// Keeping it slim (no React state, no return value) so it's free to
// mount on every screen that wants the scoreboard live. useTownFeed
// still calls refreshScoreboards itself; the double-poll on CANVAS is
// idempotent and the responses are tiny (4 row counters per call).
export function useTeamsCanvasProgressSync(): void {
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const tick = async () => {
        if (AppState.currentState !== 'active') return;
        const seasonNumber = useGameStore.getState().seasonNumber;
        if (seasonNumber === null) return;
        try {
          const progress = await loadTeamsCanvasProgress(seasonNumber);
          if (active) useGameStore.getState().setTeamsCanvasProgress(progress);
        } catch (err) {
          console.warn('[stridekeep] teams_canvas_progress poll failed:', err);
        }
      };

      void tick();
      const id = setInterval(() => void tick(), POLL_MS);
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') void tick();
      });

      return () => {
        active = false;
        clearInterval(id);
        sub.remove();
      };
    }, []),
  );
}
