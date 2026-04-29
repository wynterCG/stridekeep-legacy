import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { PlaceResult, Team } from '../types';

export type TeamTotals = { red: number; blue: number };

export async function loadInitialTeams(): Promise<TeamTotals> {
  const { data, error } = await supabase.from('teams').select('color,total');
  if (error) throw error;
  const totals: TeamTotals = { red: 0, blue: 0 };
  for (const row of data ?? []) {
    if (row.color === 'red') totals.red = Number(row.total) || 0;
    else if (row.color === 'blue') totals.blue = Number(row.total) || 0;
  }
  return totals;
}

export function subscribeTeams(
  onChange: (color: 'red' | 'blue', total: number) => void,
): RealtimeChannel {
  const channel = supabase
    .channel('public:teams')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'teams' },
      (payload) => {
        const row = payload.new as { color?: string; total?: number | string } | null;
        if (!row) return;
        const total = Number(row.total);
        if ((row.color === 'red' || row.color === 'blue') && Number.isFinite(total)) {
          onChange(row.color, total);
        }
      },
    )
    .subscribe();
  return channel;
}

export interface ActiveSeason {
  number: number;
  startedAt: string;
  softCapAt: string | null;
}

// Returns the active season row (number + ISO timestamps), or null if
// the database is in "awaiting mural" / "no active" state. The client
// uses startedAt/softCapAt to drive day-of-season + countdown rendering;
// before this loader existed, those values were a hardcoded constant in
// src/data/season.ts that drifted by N days every time a real season
// rolled over (see Phase-4 follow-up).
export async function loadActiveSeason(): Promise<ActiveSeason | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('number,started_at,soft_cap_at')
    .not('started_at', 'is', null)
    .is('ended_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || typeof data.started_at !== 'string') return null;
  return {
    number: Number(data.number),
    startedAt: data.started_at,
    softCapAt: typeof data.soft_cap_at === 'string' ? data.soft_cap_at : null,
  };
}

// rollover_season RPC return shape (subset of fields per branch — see
// 0014's header comment for the full reason vocabulary).
export type RolloverReason =
  | 'still_active'
  | 'cap_no_queue'
  | 'ended_and_promoted'
  | 'promoted'
  | 'completion_no_queue'
  | 'no_active';

export interface RolloverResult {
  noop?: boolean;
  ended?: boolean;
  promoted?: number | null;
  cap_extended?: boolean;
  reason: RolloverReason;
}

function isRolloverReason(s: unknown): s is RolloverReason {
  return (
    s === 'still_active' ||
    s === 'cap_no_queue' ||
    s === 'ended_and_promoted' ||
    s === 'promoted' ||
    s === 'completion_no_queue' ||
    s === 'no_active'
  );
}

// Idempotent foreground heartbeat. Safe to call on every cold start +
// every AppState transition to active. Server figures out whether
// anything actually rolls over.
export async function serverRolloverSeason(): Promise<RolloverResult> {
  const { data, error } = await supabase.rpc('rollover_season');
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('rollover_season returned non-object response');
  }
  const d = data as Record<string, unknown>;
  if (!isRolloverReason(d.reason)) {
    // Schema drift between client and server (server added a new reason
    // string we don't know). Loud-log + safe fallback so the foreground
    // heartbeat doesn't crash the whole bootstrap.
    console.error('[stridekeep] rollover_season returned unknown reason:', d.reason);
    return { reason: 'still_active' };
  }
  return {
    noop: typeof d.noop === 'boolean' ? d.noop : undefined,
    ended: typeof d.ended === 'boolean' ? d.ended : undefined,
    promoted: typeof d.promoted === 'number' ? d.promoted : null,
    cap_extended: typeof d.cap_extended === 'boolean' ? d.cap_extended : undefined,
    reason: d.reason,
  };
}

// Real place_tile RPC wrapper. Maps the server's jsonb return shape into
// the PlaceResult discriminated union the client consumes.
//
// Caller pattern: gameStore.placeTile catches network exceptions and
// converts to { ok: false, error: 'network_error', message }. This
// function only handles the RPC happy path (RPC returned data, possibly
// with ok=false discriminated branch).
export async function serverPlaceTile(
  colorId: string,
  pixelIdx: number,
): Promise<PlaceResult> {
  const { data, error } = await supabase.rpc('place_tile', {
    p_color_id: colorId,
    p_pixel_idx: pixelIdx,
  });
  if (error) {
    return { ok: false, error: 'network_error', message: error.message };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'network_error', message: 'place_tile returned unexpected shape' };
  }
  return mapPlaceResult(data as Record<string, unknown>);
}

function mapPlaceResult(d: Record<string, unknown>): PlaceResult {
  if (d.ok === true) {
    return {
      ok: true,
      newFilledCount: Number(d.new_filled_count) || 0,
      pixelCount: Number(d.pixel_count) || 0,
      teamCompleted: Boolean(d.team_completed),
      seasonEnded: Boolean(d.season_ended),
      badgeAwarded: Boolean(d.badge_awarded),
    };
  }
  switch (d.error) {
    case 'pixel_taken':
      return {
        ok: false,
        error: 'pixel_taken',
        // Pass through whatever the RPC returned — null if absent, rather
        // than fabricating a team. UI must handle null-by-displaying a
        // generic "Beat you to it" rather than "Beat you to it (RED)."
        filledByTeam:
          d.filled_by_team === 'red' || d.filled_by_team === 'blue'
            ? (d.filled_by_team as Team)
            : null,
        filledWithColor:
          typeof d.filled_with_color === 'string' ? d.filled_with_color : null,
      };
    case 'canvas_complete':
      return { ok: false, error: 'canvas_complete' };
    case 'wrong_color':
      return {
        ok: false,
        error: 'wrong_color',
        expected: typeof d.expected === 'string' ? d.expected : null,
      };
    case 'season_mismatch':
      return {
        ok: false,
        error: 'season_mismatch',
        activeSeasonNumber:
          d.active_season_number == null ? null : Number(d.active_season_number),
      };
    default: {
      // The RPC ran (no network error) but returned an error discriminator
      // this client doesn't know. Indicates schema drift between client and
      // server. Loud-log so this surfaces in field debugging instead of
      // hiding behind a generic network_error label.
      const serverError = typeof d.error === 'string' ? d.error : String(d.error);
      console.error('[stridekeep] place_tile returned unknown error:', serverError, d);
      return { ok: false, error: 'unknown', serverError };
    }
  }
}
