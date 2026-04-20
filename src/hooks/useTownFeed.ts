import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadRecentDeposits, type DepositRow } from '../lib/deposits';

const POLL_MS = 30_000;

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

  // useFocusEffect-scoped poll lifecycle. We need useState to carry the
  // results across focus cycles (so the list isn't blank on re-entry while
  // the first load resolves).
  useFocusEffect(
    useCallback(() => {
      let activeRef = true;

      const load = async () => {
        if (AppState.currentState !== 'active') return;
        try {
          setLoading(true);
          const rows = await loadRecentDeposits();
          if (activeRef) setDeposits(rows);
        } catch (err) {
          console.warn('[stridekeep] deposits load failed:', err);
        } finally {
          if (activeRef) setLoading(false);
        }
      };

      void load();
      const id = setInterval(() => void load(), POLL_MS);

      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
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
