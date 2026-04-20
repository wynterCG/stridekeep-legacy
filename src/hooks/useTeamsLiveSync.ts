import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { loadInitialTeams, subscribeTeams } from '../lib/teams';
import { useGameStore } from '../store/gameStore';

/**
 * Subscribes to public.teams realtime updates only when the calling screen is
 * focused AND the app is in the foreground. Unsubscribes aggressively so that
 * idle / backgrounded users don't burn through Supabase's realtime quota.
 *
 * Each (re)subscribe also calls loadInitialTeams to catch up on changes that
 * landed while we were unsubscribed.
 *
 * Cost rationale: average concurrent-subscriber count drops by ~50× compared
 * to "subscribe once on mount, never unsubscribe". The Free-tier 2M
 * realtime-messages/month cap is calculated as broadcasts × subscribers, so
 * cutting subscribers cuts the bill linearly.
 */
export function useTeamsLiveSync(): void {
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
        // Close before re-opening so we never accumulate orphan WebSockets
        // on rapid AppState toggles or Fast Refresh.
        close();
        try {
          const totals = await loadInitialTeams();
          if (!activeRef) return;
          useGameStore.getState().setTeamTotals(totals);
          channel = subscribeTeams((color, total) => {
            useGameStore.getState().setTeamTotal(color, total);
          });
        } catch (err) {
          console.warn('[stridekeep] teams live-sync open failed:', err);
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
    }, []),
  );
}
