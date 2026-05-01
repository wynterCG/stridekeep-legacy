import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useGameStore } from '../store/gameStore';
import { loadSeasonPalette, loadSeasonCraftRecipes } from '../data/colors';
import { loadTeamCanvas, loadSeasonTargetPixels, loadTeamsCanvasProgress } from './canvas';
import type { SeasonEndSnapshot, Team } from '../types';

// Postgres' default replica identity emits ONLY the primary key in
// payload.old. We can't rely on `oldRow.ended_at == null` to distinguish
// "this update ended a season" from "this update edited an already-
// ended season's mural_name." Filter on (a) ended_at being non-null in
// new, AND (b) the row's number matching the season the client believes
// is active. Edits to historical (ended_at-already-set) rows have
// numbers that don't match the active seasonNumber, so they're ignored.
//
// We don't add `ALTER TABLE seasons REPLICA IDENTITY FULL` because that
// pulls the full old row into WAL on every UPDATE — extra storage +
// network for a class of events we can already filter client-side.

// One-shot snapshot for the SeasonEndCeremony. Fans out every read the
// ceremony needs in parallel so the modal mounts on a single state set.
//
// `newSeasonNumber` is whatever loadActiveSeason returned AFTER rollover.
// If the rollover reason was cap_no_queue / completion_no_queue (no
// queued mural to promote), pass `null` and the new* fields come back
// null — the ceremony renders a "Next mural coming soon" placeholder.
export async function loadSeasonEndSnapshot(
  prevSeasonNumber: number,
  newSeasonNumber: number | null,
): Promise<SeasonEndSnapshot> {
  const myTeam = useGameStore.getState().team;

  // Parallel fan-out for prev-season data. Every read is by season_number =
  // const, so RLS lets anon read public columns.
  const [
    prevSeasonRow,
    prevPalette,
    prevTargetPixels,
    prevRedPlaced,
    prevBluePlaced,
    prevProgress,
    myContribution,
  ] = await Promise.all([
    fetchSeasonRow(prevSeasonNumber),
    loadSeasonPalette(prevSeasonNumber),
    loadSeasonTargetPixels(prevSeasonNumber),
    loadTeamCanvas('red', prevSeasonNumber),
    loadTeamCanvas('blue', prevSeasonNumber),
    loadTeamsCanvasProgress(prevSeasonNumber),
    fetchMyContribution(prevSeasonNumber),
  ]);

  const prevFilled = {
    red: placedToMap(prevRedPlaced),
    blue: placedToMap(prevBluePlaced),
  };

  // Parallel fan-out for new-season data. Skipped on no-queue rollover.
  let newSeasonRow: SeasonRow | null = null;
  let newPalette: Awaited<ReturnType<typeof loadSeasonPalette>> | null = null;
  let newRecipes: Awaited<ReturnType<typeof loadSeasonCraftRecipes>> | null = null;
  let newTargetPixels: Record<number, string> | null = null;
  if (newSeasonNumber !== null) {
    [newSeasonRow, newPalette, newRecipes, newTargetPixels] = await Promise.all([
      fetchSeasonRow(newSeasonNumber),
      loadSeasonPalette(newSeasonNumber),
      loadSeasonCraftRecipes(newSeasonNumber),
      loadSeasonTargetPixels(newSeasonNumber),
    ]);
  }

  const winnerTeam = prevSeasonRow?.winner_team ?? null;

  return {
    prevSeasonNumber,
    winnerTeam,
    myTeam,
    iWon: myTeam !== null && winnerTeam === myTeam,
    myContribution,
    prevPalette,
    prevTargetPixels,
    prevFilled,
    prevCompletion: prevProgress,
    newSeasonNumber,
    newSeasonName: newSeasonRow?.mural_name ?? null,
    newPalette,
    newRecipes,
    newTargetPixels,
    newStartedAt: newSeasonRow?.started_at ?? null,
    newSoftCapAt: newSeasonRow?.soft_cap_at ?? null,
  };
}

interface SeasonRow {
  number: number;
  started_at: string | null;
  soft_cap_at: string | null;
  ended_at: string | null;
  mural_name: string | null;
  winner_team: Team | null;
}

async function fetchSeasonRow(seasonNumber: number): Promise<SeasonRow | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('number,started_at,soft_cap_at,ended_at,mural_name,winner_team')
    .eq('number', seasonNumber)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const winner =
    data.winner_team === 'red' || data.winner_team === 'blue'
      ? (data.winner_team as Team)
      : null;
  return {
    number: Number(data.number),
    started_at: typeof data.started_at === 'string' ? data.started_at : null,
    soft_cap_at: typeof data.soft_cap_at === 'string' ? data.soft_cap_at : null,
    ended_at: typeof data.ended_at === 'string' ? data.ended_at : null,
    mural_name: typeof data.mural_name === 'string' ? data.mural_name : null,
    winner_team: winner,
  };
}

export async function fetchMyContribution(seasonNumber: number): Promise<number> {
  // RPC defined in migration 0015a. Requires an authenticated session
  // (anon Supabase sessions count — anon UIDs are real auth.uid()
  // values). Returns the integer count of canvas_pixels placed by the
  // current user in the given season; counted server-side so RLS can't
  // leak other users' contribution counts. On RLS / network failure
  // we degrade to 0 so the ceremony still mounts.
  const { data, error } = await supabase.rpc('my_contribution_count', {
    p_season_number: seasonNumber,
  });
  if (error) {
    console.warn('[stridekeep] my_contribution_count failed:', error);
    return 0;
  }
  const n = Number(data);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function placedToMap(rows: { pixelIdx: number; colorId: string }[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const row of rows) out[row.pixelIdx] = row.colorId;
  return out;
}

// Realtime trigger for the SeasonEndWatcher. Subscribes to UPDATE events
// on the seasons table and fires `onRollover` when the locally-known
// active season's row gains a non-null ended_at. The watcher then re-
// runs bootstrapAuthAndSeason so the snapshot-capture path is a single
// code site. See header comment for why we filter on row number rather
// than on payload.old.
export function subscribeSeasonRollover(onRollover: () => void): RealtimeChannel {
  const channel = supabase
    .channel('public:seasons:rollover')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'seasons' },
      (payload) => {
        const newRow = payload.new as
          | { number?: number | string; ended_at?: string | null }
          | null;
        if (!newRow) return;
        const nowEnded =
          typeof newRow.ended_at === 'string' && newRow.ended_at.length > 0;
        if (!nowEnded) return;

        const rowNumber = Number(newRow.number);
        if (!Number.isFinite(rowNumber)) return;

        // Match against the locally-known active season. Edits to
        // historical rows (whose ended_at is already non-null in old)
        // have numbers that don't match localActive, so they're
        // ignored. First-launch with no persisted seasonNumber is
        // also no-op'd.
        const localActive = useGameStore.getState().seasonNumber;
        if (localActive === null) return;
        if (rowNumber !== localActive) return;

        onRollover();
      },
    )
    .subscribe();
  return channel;
}
