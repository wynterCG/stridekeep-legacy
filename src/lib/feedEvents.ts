import { supabase } from './supabase';
import type { FeedEvent, FeedEventKind, Team } from '../types';

// Phase-4 replacement for src/lib/deposits.ts. Reads feed_events (5-kind
// table from migration 0012) and wraps the log_feed_event RPC for
// real-player atmospheric events.

interface LoadOpts {
  limit?: number;
  sinceId?: number;
}

// Incremental fetch. With sinceId, returns only events newer than that id
// — typical poll response when caught-up is empty (zero rows). Without
// sinceId, returns the most-recent `limit` events as a full snapshot.
export async function loadFeedEvents(opts: LoadOpts = {}): Promise<FeedEvent[]> {
  const limit = opts.limit ?? 50;
  let q = supabase
    .from('feed_events')
    .select('id,kind,nickname,team,color_id,qty,tier,is_bot,created_at')
    .order('id', { ascending: false })
    .limit(limit);
  if (typeof opts.sinceId === 'number') {
    q = q.gt('id', opts.sinceId);
  }
  const { data, error } = await q;
  if (error) throw error;

  const rows: FeedEvent[] = [];
  for (const r of data ?? []) {
    if (typeof r.kind !== 'string' || !isFeedEventKind(r.kind)) continue;
    rows.push({
      id: Number(r.id),
      kind: r.kind,
      nickname: typeof r.nickname === 'string' ? r.nickname : 'unknown',
      team: r.team === 'red' || r.team === 'blue' ? (r.team as Team) : null,
      color_id: typeof r.color_id === 'string' ? r.color_id : null,
      qty: Number(r.qty) || 1,
      tier: typeof r.tier === 'string' ? r.tier : null,
      // Defaults to false on missing column / null payload (covers
      // pre-0017 historical rows + edge race during migration apply).
      is_bot: r.is_bot === true,
      created_at: String(r.created_at),
    });
  }
  return rows;
}

function isFeedEventKind(s: string): s is FeedEventKind {
  return (
    s === 'tile_placed' ||
    s === 'case_opened' ||
    s === 'crafted' ||
    s === 'sold' ||
    s === 'shop_bought'
  );
}

interface LogOpts {
  colorId: string;
  qty?: number;
  tier?: string;
}

// Fire-and-forget event log. Clients call this from gameStore actions
// (sellTile / craftTile / buyShopTile / openCase) — UI never awaits.
//
// `tile_placed` is excluded at the type level via Exclude<>: callers can't
// pass it. Server-side log_feed_event RPC also rejects it independently
// (defense-in-depth) since place_tile is the only authoritative source.
export async function logFeedEvent(
  kind: Exclude<FeedEventKind, 'tile_placed'>,
  opts: LogOpts,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_feed_event', {
      p_kind: kind,
      p_color_id: opts.colorId,
      p_qty: opts.qty ?? 1,
      p_tier: opts.tier ?? null,
    });
    if (error) {
      console.warn('[stridekeep] log_feed_event failed:', error);
    }
  } catch (err) {
    console.warn('[stridekeep] log_feed_event threw:', err);
  }
}
