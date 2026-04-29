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

// Returns the active season's number, or null if the database is in
// "awaiting mural" / "no active" state. Read-direct from the seasons
// table — RLS allows authenticated SELECT (0009).
export async function loadActiveSeasonNumber(): Promise<number | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('number')
    .not('started_at', 'is', null)
    .is('ended_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.number) : null;
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

// Idempotent foreground heartbeat. Safe to call on every cold start +
// every AppState transition to active. Server figures out whether
// anything actually rolls over.
export async function serverRolloverSeason(): Promise<RolloverResult> {
  const { data, error } = await supabase.rpc('rollover_season');
  if (error) throw error;
  return data as RolloverResult;
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
        filledByTeam:
          d.filled_by_team === 'red' || d.filled_by_team === 'blue'
            ? (d.filled_by_team as Team)
            : 'red',
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
    default:
      return {
        ok: false,
        error: 'network_error',
        message: `unrecognised place_tile error: ${String(d.error)}`,
      };
  }
}
