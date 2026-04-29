// For now: a single forever-season. SKILL.md §11 Phase-3-full will introduce
// weekly seasons with server-side scheduling — when that lands, this file
// becomes the only thing that needs to change. Component code stays the same.

import { BALANCE } from '../balance';

export const CURRENT_SEASON = {
  number: 1,
  startedAt: new Date('2026-04-20T20:30:00Z'),
} as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function dayOfSeason(now: Date = new Date()): number {
  const elapsed = now.getTime() - CURRENT_SEASON.startedAt.getTime();
  return Math.max(1, Math.floor(elapsed / MS_PER_DAY) + 1);
}

export function endOfSeason(): Date {
  // Phase 4: client estimate based on soft-cap fallback. Server's
  // seasons.soft_cap_at is the canonical end (and a season can also end
  // early when a team completes the canvas). Step 6 swaps this to read
  // from the seasons row.
  return new Date(
    CURRENT_SEASON.startedAt.getTime() + BALANCE.season.softCapDays * MS_PER_DAY,
  );
}

export function msLeftInSeason(now: Date = new Date()): number {
  return Math.max(0, endOfSeason().getTime() - now.getTime());
}

// Countdown formatter — switches granularity as the round closes in so
// urgency increases without becoming noisy when there's still days left.
export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'ROUND OVER';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hours}h LEFT`;
  if (hours > 0) return `${hours}h ${mins}m LEFT`;
  if (mins > 0) return `${mins}m ${secs}s LEFT`;
  return `${secs}s LEFT`;
}
