// i18n entry point. Components consume strings via `useTranslation()`;
// non-React code (store actions, lib/ utilities) can use the bare
// `t()` snapshot. Both resolve through the same dictionary so a
// language flip mid-session takes effect everywhere on the next render
// (components subscribed via the hook re-render automatically; the
// snapshot variant just reads the latest store value at call time).

import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { en, type TKey } from './en';
import { pt } from './pt';

const DICTIONARIES = { en, pt } as const;

type Vars = Record<string, string | number>;

// Resolve a key to its localised string for the currently-active
// language. `language === null` means the boot-time auto-detect
// hasn't fired yet (extremely rare — the App.tsx effect runs
// synchronously after the first render) — fall back to English so
// nothing renders blank in that one-frame window.
//
// Variable interpolation: tokens like `{n}` or `{name}` in the
// dictionary string are replaced with the matching key in `vars`.
// Both languages MUST use the same placeholder tokens (enforced
// by inspection during translation, not the type system).
function resolve(key: TKey, lang: 'en' | 'pt' | null, vars?: Vars): string {
  let str: string = DICTIONARIES[lang ?? 'en'][key];
  if (vars !== undefined) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

// React hook. Components subscribe to `language` so they re-render
// when the user flips it in Settings. The returned `t` reference is
// stable per language so consumers can safely pass it down as a prop
// without churning equality checks downstream.
export function useTranslation(): (key: TKey, vars?: Vars) => string {
  const lang = useGameStore((s) => s.language);
  return useCallback((key: TKey, vars?: Vars) => resolve(key, lang, vars), [lang]);
}

// Snapshot variant — for callers outside the React tree (lib/sounds,
// store actions emitting toast copy, etc.). Re-reads the store on
// every call, so a flip during a long-running action is honoured on
// the next `t()` invocation.
export function t(key: TKey, vars?: Vars): string {
  return resolve(key, useGameStore.getState().language, vars);
}

export type { TKey } from './en';
