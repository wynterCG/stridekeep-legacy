import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { subscribeSeasonRollover } from '../lib/seasonEnd';
import { bootstrapAuthAndSeason } from '../lib/bootstrap';

/**
 * Mid-session rollover trigger. Subscribes to the seasons table and
 * fires bootstrapAuthAndSeason when any row's ended_at flips from null
 * to non-null. Bootstrap then captures the SeasonEndSnapshot and sets
 * pendingSeasonEnd, which mounts SeasonEndCeremony.
 *
 * Mounted ONCE at the App.tsx root — not screen-scoped, because the
 * ceremony must fire regardless of which tab the player is on.
 *
 * Subscribes only while the app is foregrounded to keep Supabase
 * realtime usage in line with useTeamsLiveSync / useCanvasLiveSync's
 * focus-based pattern.
 */
export function useSeasonEndWatcher(): void {
  useEffect(() => {
    let activeRef = true;
    let channel: RealtimeChannel | null = null;

    const close = () => {
      if (channel) {
        channel.unsubscribe();
        channel = null;
      }
    };

    const open = () => {
      close();
      channel = subscribeSeasonRollover(() => {
        if (!activeRef) return;
        // bootstrapAuthAndSeason has its own in-flight guard, so a
        // realtime signal arriving while a boot bootstrap is mid-run
        // becomes a no-op rather than a double-fetch.
        void bootstrapAuthAndSeason();
      });
    };

    if (AppState.currentState === 'active') {
      open();
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (!activeRef) return;
      if (state === 'active') {
        open();
      } else {
        close();
      }
    });

    return () => {
      activeRef = false;
      close();
      sub.remove();
    };
  }, []);
}
