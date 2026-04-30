import type { ColorDef, PlaceResult } from '../types';

// Maps a non-OK PlaceResult to a single user-facing line. Used by both
// TilePicker (status line) and InventoryScreen's PLACE-from-action-sheet
// path so the two surfaces stay in sync — adding a new error discriminator
// only needs to be wired here.
//
// `palette` is consulted for `wrong_color` so we can show the human color
// name instead of an opaque colorId. Pass null when no palette is loaded;
// the function falls back to a generic phrasing.
export function placeErrorMessage(
  result: Extract<PlaceResult, { ok: false }>,
  palette: Record<string, ColorDef> | null,
): string {
  switch (result.error) {
    case 'pixel_taken':
      return 'Beat you to it!';
    case 'wrong_color': {
      const expectedName =
        result.expected && palette ? palette[result.expected]?.name : null;
      return expectedName
        ? `That pixel needs ${expectedName}.`
        : 'That pixel needs a different color.';
    }
    case 'canvas_complete':
      return 'Canvas complete — season just ended.';
    case 'season_mismatch':
      return 'Season changed — refreshing.';
    case 'not_owned':
      return "You don't have this color.";
    case 'not_authenticated':
      return 'Not signed in.';
    case 'network_error':
      return 'Network error — try again.';
    case 'unknown':
      return 'Server returned an unknown response. Update the app.';
  }
}
