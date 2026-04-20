import { supabase } from './supabase';

export interface DepositRow {
  id: number;
  team: 'red' | 'blue';
  amount: number;
  nickname: string;
  createdAt: string;
}

export async function loadRecentDeposits(limit = 50): Promise<DepositRow[]> {
  return loadDeposits({ limit });
}

interface LoadOpts {
  limit?: number;
  sinceId?: number;
}

/**
 * Incremental fetch. With sinceId, returns only deposits newer than that
 * id — typical poll response when caught-up is empty (zero rows). Without
 * sinceId, returns the most-recent `limit` deposits as a full snapshot.
 */
export async function loadDeposits(opts: LoadOpts = {}): Promise<DepositRow[]> {
  const limit = opts.limit ?? 50;
  let q = supabase
    .from('deposits')
    .select('id,team,amount,nickname,created_at')
    .order('id', { ascending: false })
    .limit(limit);
  if (typeof opts.sinceId === 'number') {
    q = q.gt('id', opts.sinceId);
  }
  const { data, error } = await q;
  if (error) throw error;

  const rows: DepositRow[] = [];
  for (const r of data ?? []) {
    if (r.team !== 'red' && r.team !== 'blue') continue;
    rows.push({
      id: Number(r.id),
      team: r.team,
      amount: Number(r.amount) || 0,
      nickname: typeof r.nickname === 'string' ? r.nickname : 'unknown',
      createdAt: String(r.created_at),
    });
  }
  return rows;
}
