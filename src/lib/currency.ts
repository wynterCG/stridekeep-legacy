import * as Localization from 'expo-localization';
import { useGameStore } from '../store/gameStore';

// Locale-aware currency formatter.
//
// Stridekeep's in-game purse is a fantasy currency, not real money,
// but the *symbol* and *format* still follow the player's device
// locale because:
//   - A Portuguese user in Lisbon expects `457 €`, not `$457`.
//   - A US user expects `$457`, not `€457`.
//   - A Dutch user expects `€ 457`, even if their UI language is set
//     to English.
//
// Two-axis design:
//   1. Currency CODE  comes from the store's `currency` field. Either
//      'auto' (read from device via expo-localization) or an explicit
//      override ('EUR' / 'USD' / 'GBP') so the player can correct the
//      common case where an en-GB device locale on a NL resident
//      reports GBP when they want EUR.
//   2. Number FORMAT (digit grouping, symbol position) always follows
//      the device's languageTag — Intl.NumberFormat picks the correct
//      conventions per locale automatically (en-US: "$457", pt-PT:
//      "457 €", nl-NL: "€ 457").
//
// Implementation: cache one Intl.NumberFormat instance per currency
// code (the formatters themselves are expensive to construct, ~1ms on
// device). Calls read the current store value and resolve to a
// concrete code at format time, so a Settings → Currency flip is
// honoured on the next call without reconstruction.

const locales = Localization.getLocales();
const primary = locales[0];
const localeTag = primary?.languageTag ?? 'en-US';
const deviceCurrencyCode = primary?.currencyCode ?? 'USD';

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currencyCode: string): Intl.NumberFormat {
  const existing = formatters.get(currencyCode);
  if (existing) return existing;
  try {
    const fmt = new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: currencyCode,
      // In-game purse is always integer — drop the .00 suffix that
      // currencies like EUR would otherwise show by default.
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatters.set(currencyCode, fmt);
    return fmt;
  } catch {
    // Invalid currency code or missing ICU — fall back to en-US/USD
    // so the call site still renders something readable.
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
}

function resolveCode(choice: 'auto' | 'EUR' | 'USD' | 'GBP'): string {
  return choice === 'auto' ? deviceCurrencyCode : choice;
}

// Snapshot variant — for callers outside the React tree (lib helpers,
// store actions, the obtainment-line helper inside ColorDetailSheet).
// Reads the store at call time so a mid-session currency change is
// honoured on the next render that touches this function.
export function formatCurrency(n: number): string {
  const choice = useGameStore.getState().currency;
  return getFormatter(resolveCode(choice)).format(n);
}

// React hook variant — components subscribe to `currency` so they
// re-render when the user flips the Settings → Currency picker.
// Returns a stable formatter per choice value.
export function useFormatCurrency(): (n: number) => string {
  const choice = useGameStore((s) => s.currency);
  return (n: number) => getFormatter(resolveCode(choice)).format(n);
}

// Diagnostics — used by the Currency settings screen to show the
// auto-detected currency in parentheses next to the "Auto" radio.
export function deviceCurrencyDiagnostic(): {
  code: string;
  symbol: string | null;
  localeTag: string;
} {
  return {
    code: deviceCurrencyCode,
    symbol: primary?.currencySymbol ?? null,
    localeTag,
  };
}
