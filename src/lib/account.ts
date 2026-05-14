import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Account helpers for the optional-upgrade auth model. The cold-start path
// (anonymous sign-in) lives in lib/auth.ts and is unchanged. Everything in
// this file is driven by AccountModal — explicit player actions to upgrade
// or recover an account.
//
// Key invariant: linkEmailPassword preserves the anon UUID. All FK-keyed
// data in public.users / canvas_pixels / user_badges / feed_events
// continues working unchanged.
//
// Error mapping discriminates on `error.status` (HTTP code) FIRST and
// falls back to the message string only when the status alone is
// ambiguous. Status is a public Supabase contract; message strings
// are not.

export type LinkResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'email_taken'
        | 'invalid_email'
        | 'weak_password'
        | 'rate_limited'
        | 'network_error';
      message: string;
    };

export type SignInResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'invalid_credentials'
        | 'email_not_confirmed'
        | 'rate_limited'
        | 'network_error';
      message: string;
    };

export type AccountStatus =
  | { kind: 'anon' }
  | { kind: 'linked'; email: string };

function classifyLink(error: AuthError): Extract<LinkResult, { ok: false }> {
  const status = error.status ?? 0;
  const msg = error.message ?? '';
  const lower = msg.toLowerCase();

  // 429 → rate limit (server-side cooldown). Stable across SDK versions.
  if (status === 429 || lower.includes('rate') || lower.includes('seconds')) {
    return { ok: false, error: 'rate_limited', message: msg };
  }
  // 422 / 409 → request rejected by server (validation OR conflict).
  // Need the message to distinguish "email already in use" from
  // "invalid format" from "password too weak". Stable Supabase phrasings:
  //   "User already registered" / "Email address ... already registered"
  //   "Unable to validate email address: invalid format"
  //   "Password should be at least N characters"
  if (status === 422 || status === 409 || status === 400) {
    if (lower.includes('already') && (lower.includes('registered') || lower.includes('exists'))) {
      return { ok: false, error: 'email_taken', message: msg };
    }
    if (lower.includes('password')) {
      return { ok: false, error: 'weak_password', message: msg };
    }
    if (lower.includes('email')) {
      return { ok: false, error: 'invalid_email', message: msg };
    }
  }
  return { ok: false, error: 'network_error', message: msg };
}

function classifySignIn(error: AuthError): Extract<SignInResult, { ok: false }> {
  const status = error.status ?? 0;
  const msg = error.message ?? '';
  const lower = msg.toLowerCase();

  if (status === 429 || lower.includes('rate') || lower.includes('seconds')) {
    return { ok: false, error: 'rate_limited', message: msg };
  }
  // 400 = invalid creds in current Supabase. Some configs return
  // "Email not confirmed" as a 400 too — distinguish on message.
  if (status === 400 || status === 401) {
    if (lower.includes('not confirmed')) {
      return { ok: false, error: 'email_not_confirmed', message: msg };
    }
    return { ok: false, error: 'invalid_credentials', message: msg };
  }
  return { ok: false, error: 'network_error', message: msg };
}

// Adds email + password to the current (anonymous) auth.users row. The
// UUID is preserved, so all of the player's existing data stays linked.
export async function linkEmailPassword(
  email: string,
  password: string,
): Promise<LinkResult> {
  const { error } = await supabase.auth.updateUser({ email, password });
  if (!error) return { ok: true };
  return classifyLink(error);
}

// Replaces the current session (typically a fresh-anon on a new device)
// with the linked-email account. The caller is expected to clear local
// store + re-bootstrap so the new account's team / inventory / badges
// load from the server.
export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  return classifySignIn(error);
}

// Ends the current session. The caller is expected to clear the local
// Zustand store + invoke the bootstrap chain so the next anonymous
// sign-in fires and the app lands on a clean fresh-anon state.
export async function signOutAccount(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Reads the current session and classifies it. The `is_anonymous` flag
// is the authoritative discriminant — Supabase sets it explicitly per
// session. Email may lag (e.g. mid-link, before refresh) but that
// shouldn't misroute the modal view, so we treat any non-anon session
// as linked even if the email field is briefly empty.
export async function getAccountStatus(): Promise<AccountStatus> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data.session?.user;
  if (!user) return { kind: 'anon' };
  if (user.is_anonymous === true) return { kind: 'anon' };
  return { kind: 'linked', email: user.email ?? '(pending)' };
}

export type SetNicknameResult =
  | { ok: true; nickname: string }
  | {
      ok: false;
      error: 'too_short' | 'too_long' | 'network_error' | 'unknown';
      message: string;
    };

// Wraps the `set_my_nickname(text)` RPC ([0006_nicknames.sql:41]). The
// RPC trims + validates length 3..20 and raises on out-of-range. We
// duplicate the bound check client-side so the UI can disable submit
// before a round-trip; this branch handles the case where someone
// bypasses the disabled state OR the server's bounds drift in the
// future. The RPC returns the cleaned (trimmed) nickname on success —
// callers should use THAT, not the original input, when persisting.
export async function setMyNickname(nickname: string): Promise<SetNicknameResult> {
  const { data, error } = await supabase.rpc('set_my_nickname', {
    p_nickname: nickname,
  });
  if (error) {
    const msg = error.message ?? '';
    // Server raises 'nickname must be 3..20 chars' for both bounds.
    // Use the trimmed-input length to discriminate which bound fired.
    if (msg.includes('3..20') || msg.toLowerCase().includes('length')) {
      const trimmedLen = nickname.trim().length;
      return {
        ok: false,
        error: trimmedLen < 3 ? 'too_short' : 'too_long',
        message: msg,
      };
    }
    // PGRST/HTTP errors carry a code; missing code typically means a
    // network/transport failure (no response, fetch threw, etc.).
    if (!error.code) return { ok: false, error: 'network_error', message: msg };
    return { ok: false, error: 'unknown', message: msg };
  }
  return {
    ok: true,
    nickname: typeof data === 'string' && data.length > 0 ? data : nickname.trim(),
  };
}

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: 'not_authenticated' | 'network_error' | 'unknown'; message: string };

// Calls the `delete_my_account()` RPC ([0020_delete_my_account.sql:34]),
// which cascade-deletes the caller's auth.users row + every FK'd public.*
// row. The local JWT now refers to a non-existent user, so we follow up
// with signOut() to clear AsyncStorage. Caller is expected to re-bootstrap
// (clearStorage + resetSessionState + bootstrapAuthAndSeason) so the app
// lands on a fresh anonymous account.
//
// Returns `{ ok: true }` even if signOut() throws — at that point the
// server-side deletion already succeeded, and a stale-but-orphaned local
// session is the recoverable failure mode (next launch's getSession()
// will fail-and-reauth into a new anon).
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    const msg = error.message ?? '';
    if (msg.toLowerCase().includes('not authenticated')) {
      return { ok: false, error: 'not_authenticated', message: msg };
    }
    if (!error.code) return { ok: false, error: 'network_error', message: msg };
    return { ok: false, error: 'unknown', message: msg };
  }
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[stridekeep] post-delete signOut failed (non-fatal):', err);
  }
  return { ok: true };
}
