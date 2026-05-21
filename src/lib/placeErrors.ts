import type { ColorDef, PlaceResult } from '../types';
import { t } from '../i18n';

// Maps a non-OK PlaceResult to a single user-facing line. Used by both
// TilePicker (status line) and InventoryScreen's PLACE-from-action-sheet
// path so the two surfaces stay in sync — adding a new error discriminator
// only needs to be wired here.
//
// `palette` is consulted for `wrong_color` so we can show the human color
// name instead of an opaque colorId. Pass null when no palette is loaded;
// the function falls back to a generic phrasing.
//
// Uses the snapshot `t()` rather than the React hook because callers are
// outside the component tree (Alert.alert + the inventory action-sheet
// utility). Snapshot reads the active language at call time so a mid-
// session Settings → Language flip is honoured on the next error.
export function placeErrorMessage(
  result: Extract<PlaceResult, { ok: false }>,
  palette: Record<string, ColorDef> | null,
): string {
  switch (result.error) {
    case 'pixel_taken':
      return t('place.pixelTaken');
    case 'wrong_color': {
      const expectedName =
        result.expected && palette ? palette[result.expected]?.name : null;
      return expectedName
        ? t('place.wrongColorWithName', { name: expectedName })
        : t('place.wrongColor');
    }
    case 'canvas_complete':
      return t('place.canvasComplete');
    case 'season_mismatch':
      return t('place.seasonMismatch');
    case 'not_owned':
      return t('place.notOwned');
    case 'not_authenticated':
      return t('place.notAuthenticated');
    case 'network_error':
      return t('place.networkError');
    case 'unknown':
      return t('place.unknown');
  }
}
