import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export async function ensureSignedIn(): Promise<User> {
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('signInAnonymously returned no user');
  return data.user;
}

export async function fetchMyProfile(): Promise<{
  team: 'red' | 'blue';
  nickname: string;
}> {
  // Retry loop to absorb the trigger-vs-signup race: signInAnonymously() resolves
  // the moment the auth.users row is inserted, but handle_new_user runs in an
  // AFTER INSERT trigger — there's a small window on fresh installs where the
  // public.users row hasn't committed yet and a single() read errors with PGRST116.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from('users')
      .select('team, nickname')
      .maybeSingle();
    if (error) throw error;
    if (data) {
      if (data.team !== 'red' && data.team !== 'blue') {
        throw new Error(`unexpected team value: ${data.team}`);
      }
      if (typeof data.nickname !== 'string' || data.nickname.length === 0) {
        throw new Error('user row missing nickname');
      }
      return { team: data.team, nickname: data.nickname };
    }
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  throw new Error('user row never appeared after signup');
}
