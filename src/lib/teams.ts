import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { PlaceResult } from '../types';

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

export async function serverDeposit(amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('deposit_for_town', { p_amount: amount });
  if (error) throw error;
  const total = Number(data);
  if (!Number.isFinite(total)) throw new Error('deposit_for_town returned non-numeric value');
  return total;
}

// Phase-4 place_tile RPC wrapper — stub until Step 6 wires it to the real RPC
// (which itself depends on migration 0011 in Step 5). gameStore.placeTile
// imports this so the type surface stays stable through Step 3 / Step 4.
export async function serverPlaceTile(
  _colorId: string,
  _pixelIdx: number,
): Promise<PlaceResult> {
  throw new Error('serverPlaceTile: not yet implemented (Phase-4 Step 6)');
}
