import { useGameStore } from '../store/gameStore';
import { ensureSignedIn, fetchMyProfile } from './auth';
import { getAccountStatus } from './account';
import { loadActiveSeason, serverRolloverSeason } from './teams';
import { loadSeasonPalette, loadSeasonCraftRecipes } from '../data/colors';
import { loadSeasonTargetPixels } from './canvas';
import { loadMyBadges } from './badges';
import { loadSeasonEndSnapshot } from './seasonEnd';

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
    const fresh = useGameStore.getState();
    const prevNumber = fresh.seasonNumber;
    const newNumber = active === null ? null : active.number;

    // Same-season refresh path. Server timestamps may have moved (cap
    // extension on completion-no-queue, etc.), and the palette/recipes
    // load is idempotent. No rollover, no ceremony.
    if (active !== null && prevNumber === newNumber) {
      try {
        const [palette, recipes] = await Promise.all([
          loadSeasonPalette(active.number),
          loadSeasonCraftRecipes(active.number),
        ]);
        fresh.setSeasonPalette(palette);
        fresh.setSeasonCraftRecipes(recipes);
        fresh.setSeasonTimes(active.startedAt, active.softCapAt);
        fresh.setSeasonMuralName(active.muralName);
      } catch (err) {
        console.warn('[stridekeep] palette/recipes load failed:', err);
      }
      return;
    }

    // First-ever launch (no prev season persisted) — no ceremony to
    // show. Initialize directly.
    if (prevNumber === null) {
      if (active === null) {
        fresh.setSeasonPalette(null);
        fresh.setSeasonCraftRecipes(null);
        fresh.setSeasonTimes(null, null);
        fresh.setSeasonMuralName(null);
        return;
      }
      try {
        const [palette, recipes, targetPixels] = await Promise.all([
          loadSeasonPalette(active.number),
          loadSeasonCraftRecipes(active.number),
          loadSeasonTargetPixels(active.number),
        ]);
        fresh.applySeasonReset(
          active.number,
          palette,
          recipes,
          targetPixels,
          active.startedAt,
          active.softCapAt,
          active.muralName,
        );
      } catch (err) {
        console.warn('[stridekeep] palette/recipes load failed:', err);
      }
      return;
    }

    // Rollover detected (prevNumber != null, prevNumber != newNumber).
    // If the user already pressed CONTINUE on this prev-season's ceremony
    // (lastShownCeremonySeason >= prevNumber), don't re-show — silent reset.
    const ackUpTo = fresh.lastShownCeremonySeason ?? -Infinity;
    if (ackUpTo >= prevNumber) {
      await silentReset(active);
      return;
    }

    // Mid-ceremony guard. Once the snapshot is captured for prevNumber,
    // any subsequent realtime event (a `mural_name` edit, a follow-up
    // rollover, or a duplicate `seasons` UPDATE delivery) that drives a
    // re-bootstrap MUST NOT overwrite pendingSeasonEnd — doing so
    // re-fires SeasonEndCeremony's snap-keyed effect and restarts the
    // animation timeline from beat 0 mid-watch. The user pressing
    // CONTINUE clears pendingSeasonEnd → next sync proceeds normally.
    if (
      fresh.pendingSeasonEnd !== null &&
      fresh.pendingSeasonEnd.prevSeasonNumber === prevNumber
    ) {
      return;
    }

    // Show ceremony: capture snapshot, defer applySeasonReset to CONTINUE.
    try {
      const snap = await loadSeasonEndSnapshot(prevNumber, newNumber);
      fresh.setPendingSeasonEnd(snap);
    } catch (err) {
      console.warn(
        '[stridekeep] loadSeasonEndSnapshot failed; falling back to silent reset:',
        err,
      );
      await silentReset(active);
    }
  } finally {
    syncInFlight = false;
  }
}

// Used in the "ceremony already acknowledged" and "snapshot load failed"
// branches: jump straight to applySeasonReset without showing the modal.
async function silentReset(
  active: Awaited<ReturnType<typeof loadActiveSeason>>,
): Promise<void> {
  const fresh = useGameStore.getState();
  if (active === null) {
    fresh.applySeasonReset(null, null, null, null, null, null, null);
    return;
  }
  try {
    const [palette, recipes, targetPixels] = await Promise.all([
      loadSeasonPalette(active.number),
      loadSeasonCraftRecipes(active.number),
      loadSeasonTargetPixels(active.number),
    ]);
    fresh.applySeasonReset(
      active.number,
      palette,
      recipes,
      targetPixels,
      active.startedAt,
      active.softCapAt,
      active.muralName,
    );
  } catch (err) {
    console.warn('[stridekeep] silentReset palette/recipes load failed:', err);
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
      const profile = await fetchMyProfile();
      useGameStore.getState().setTeam(profile.team);
      useGameStore.getState().setNickname(profile.nickname);
    } catch (err) {
      console.warn('[stridekeep] auth bootstrap failed:', err);
      return;
    }
    // Hydrate the cached link-state for TopHeader's AccountChip. Cheap
    // one local-session read; non-fatal if it fails (chip stays in its
    // last-known state, which defaults to anon).
    try {
      const status = await getAccountStatus();
      useGameStore.getState().setAccountLinked(status.kind === 'linked');
      useGameStore
        .getState()
        .setAccountEmail(status.kind === 'linked' ? status.email : null);
    } catch (err) {
      console.warn('[stridekeep] getAccountStatus failed:', err);
    }
    await Promise.all([syncSeasonOnce(), bootstrapBadges()]);
  } finally {
    bootstrapInFlight = false;
  }
}
