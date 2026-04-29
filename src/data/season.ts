// Pure timing helpers for the active season. The server's seasons row is
// the single source of truth: `started_at` drives "DAY N" computation,
// `soft_cap_at` drives the round-end countdown. Both are mirrored into
// the gameStore by App.tsx's syncSeason flow; components subscribe and
// pass them into the helpers below.

import { BALANCE } from '../balance';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Returns null when no season is active (awaiting-mural / fresh install).
export function dayOfSeason(
  startedAt: string | Date | null,
  now: Date = new Date(),
): number | null {
  if (startedAt === null) return null;
  const startMs =
    startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return null;
  const elapsed = now.getTime() - startMs;
  return Math.max(1, Math.floor(elapsed / MS_PER_DAY) + 1);
}

// Prefer the server's authoritative soft_cap_at. Fall back to
// startedAt + softCapDays only if the server hasn't assigned a cap yet
// (queued seasons; should not happen for ACTIVE seasons but keeps the
// helper total). Returns null when neither is known.
export function endOfSeason(
  startedAt: string | Date | null,
  softCapAt: string | Date | null,
): Date | null {
  if (softCapAt !== null) {
    const ms =
      softCapAt instanceof Date ? softCapAt.getTime() : Date.parse(softCapAt);
    if (Number.isFinite(ms)) return new Date(ms);
  }
  if (startedAt === null) return null;
  const startMs =
    startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs + BALANCE.season.softCapDays * MS_PER_DAY);
}

export function msLeftInSeason(
  startedAt: string | Date | null,
  softCapAt: string | Date | null,
  now: Date = new Date(),
): number | null {
  const end = endOfSeason(startedAt, softCapAt);
  if (end === null) return null;
  return Math.max(0, end.getTime() - now.getTime());
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
