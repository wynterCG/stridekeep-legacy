import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Team } from '../types';

// target_pixels is { "<idx>": "<color_id>", ... } as stored on the seasons
// row by seed_next_mural. ~1024 entries for a 32x32 canvas (~30 KB JSON
// over the wire). Loaded once per active season at canvas mount and
// stashed in gameStore — server data, never persisted.
export async function loadSeasonTargetPixels(
  seasonNumber: number,
): Promise<Record<number, string>> {
  const { data, error } = await supabase
    .from('seasons')
    .select('target_pixels')
    .eq('number', seasonNumber)
    .maybeSingle();
  if (error) throw error;
  const raw = (data?.target_pixels ?? {}) as Record<string, unknown>;
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const idx = Number(k);
    if (!Number.isInteger(idx) || idx < 0) continue;
    if (typeof v !== 'string') continue;
    out[idx] = v;
  }
  return out;
}

export interface PlacedPixel {
  pixelIdx: number;
  colorId: string;
}

// Loads the team's current placed-pixel state. At most pixel_count rows
// (1024 for a 32x32 canvas). Sized small enough that we read full rows
// rather than paging — the column projection (pixel_idx, color_id) keeps
// the wire payload tight without a dedicated bitmap RPC.
export async function loadTeamCanvas(
  team: Team,
  seasonNumber: number,
): Promise<PlacedPixel[]> {
  const { data, error } = await supabase
    .from('canvas_pixels')
    .select('pixel_idx,color_id')
    .eq('season_number', seasonNumber)
    .eq('team', team);
  if (error) throw error;
  const out: PlacedPixel[] = [];
  for (const row of data ?? []) {
    const idx = Number(row.pixel_idx);
    const colorId = row.color_id;
    if (!Number.isInteger(idx) || typeof colorId !== 'string') continue;
    out.push({ pixelIdx: idx, colorId });
  }
  return out;
}

// Realtime subscription on canvas_pixels filtered to the current season +
// team. We subscribe per-team (not "all canvas changes") because the Home
// hero only renders the player's team — opponent updates don't need to
// drive re-renders here. (Town's side-by-side previews are S4.D scope and
// will subscribe separately.) INSERT-only is sufficient: place_tile only
// inserts; pixels are never updated or deleted.
export function subscribeCanvasPixels(
  team: Team,
  seasonNumber: number,
  onPlace: (pixel: PlacedPixel) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`canvas:${seasonNumber}:${team}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'canvas_pixels',
        filter: `season_number=eq.${seasonNumber}`,
      },
      (payload) => {
        const row = payload.new as
          | { team?: string; pixel_idx?: number | string; color_id?: string }
          | null;
        if (!row) return;
        if (row.team !== team) return;
        const idx = Number(row.pixel_idx);
        if (!Number.isInteger(idx) || typeof row.color_id !== 'string') return;
        onPlace({ pixelIdx: idx, colorId: row.color_id });
      },
    )
    .subscribe();
  return channel;
}
