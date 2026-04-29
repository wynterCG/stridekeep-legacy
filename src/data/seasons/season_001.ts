// Season 1 mural payload — skeleton stub.
//
// Step 5 lands the real values after the Godot mural-prep tool runs and
// seed_next_mural() inserts the canonical row into Supabase: at that point
// the .png asset gets bundled into assets/ + require()'d here, and pixels
// gets the flat pixelIdx→colorId map derived from the seeded target_pixels.
//
// Until then this file just establishes the shape so consumers (CanvasView,
// SeasonEndCeremony, badge gallery) have a concrete import target.

export interface SeasonMuralData {
  seasonNumber: number;
  startedAt: string | null;       // ISO timestamp; null while queued
  imageAsset: number | null;      // require()'d PNG resource id; null until asset ships
  pixels: Record<number, string>; // pixelIdx → season-scoped colorId
}

export const SEASON_001: SeasonMuralData = {
  seasonNumber: 1,
  startedAt: null,
  imageAsset: null,
  pixels: {},
};
