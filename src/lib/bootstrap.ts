import { useGameStore } from '../store/gameStore';
import { ensureSignedIn, fetchMyTeam } from './auth';
import { loadActiveSeason, serverRolloverSeason } from './teams';
import { loadSeasonPalette, loadSeasonCraftRecipes } from '../data/colors';
import { loadMyBadges } from './badges';

// Module-level guards. The single-flight `syncInFlight` keeps two
// concurrent season syncs from racing. The `bootstrapInFlight` flag is
// set by `bootstrapAuthAndSeason` so AppState foreground listeners
// don't kick off a parallel `syncSeasonOnce` against a half-swapped
// session (AccountModal sign-in/sign-out → resetSessionState() → fetch
// new team's data window).
let syncInFlight = false;
let bootstrapInFlight = false;

export function isBootstrapInFlight(): boolean {
  return bootstrapInFlight;
}

export async function syncSeasonOnce(): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    try {
      await serverRolloverSeason();
    } catch (err) {
      console.warn('[stridekeep] rollover_season failed:', err);
    }
    let active: Awaited<ReturnType<typeof loadActiveSeason>>;
    try {
      active = await loadActiveSeason();
    } catch (err) {
      console.warn('[stridekeep] loadActiveSeason failed:', err);
      return;
    }
    const store = useGameStore.getState();
    if (active === null) {
      store.setSeasonPalette(null);
      store.setSeasonCraftRecipes(null);
      store.setSeasonTimes(null, null);
      return;
    }
    try {
      const [palette, recipes] = await Promise.all([
        loadSeasonPalette(active.number),
        loadSeasonCraftRecipes(active.number),
      ]);
      const fresh = useGameStore.getState();
      if (fresh.seasonNumber !== active.number) {
        fresh.applySeasonReset(
          active.number,
          palette,
          recipes,
          active.startedAt,
          active.softCapAt,
        );
      } else {
        fresh.setSeasonPalette(palette);
        fresh.setSeasonCraftRecipes(recipes);
        fresh.setSeasonTimes(active.startedAt, active.softCapAt);
      }
    } catch (err) {
      console.warn('[stridekeep] palette/recipes load failed:', err);
    }
  } finally {
    syncInFlight = false;
  }
}

async function bootstrapBadges(): Promise<void> {
  try {
    const badges = await loadMyBadges();
    useGameStore.getState().setBadges(badges);
  } catch (err) {
    console.warn('[stridekeep] loadMyBadges failed:', err);
  }
}

// Full bootstrap chain: ensure a session exists (anon if none), pull the
// player's team, then sync season + badges. Called from App.tsx mount,
// from the AppState 'active' listener (idempotent retry path), and from
// AccountModal after sign-in / sign-out swap the active session.
export async function bootstrapAuthAndSeason(): Promise<void> {
  if (bootstrapInFlight) return;
  bootstrapInFlight = true;
  try {
    try {
      await ensureSignedIn();
      const team = await fetchMyTeam();
      useGameStore.getState().setTeam(team);
    } catch (err) {
      console.warn('[stridekeep] auth bootstrap failed:', err);
      return;
    }
    await Promise.all([syncSeasonOnce(), bootstrapBadges()]);
  } finally {
    bootstrapInFlight = false;
  }
}
