// For now: a single forever-season. SKILL.md §11 Phase-3-full will introduce
// weekly seasons with server-side scheduling — when that lands, this file
// becomes the only thing that needs to change. Component code stays the same.

export const CURRENT_SEASON = {
  number: 1,
  startedAt: new Date('2026-04-20T00:00:00Z'),
} as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function dayOfSeason(now: Date = new Date()): number {
  const elapsed = now.getTime() - CURRENT_SEASON.startedAt.getTime();
  return Math.max(1, Math.floor(elapsed / MS_PER_DAY) + 1);
}
