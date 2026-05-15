import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Team,
  CaseTier,
  CaseState,
  ColorDef,
  CraftRecipe,
  Badge,
  PlaceResult,
  SeasonEndSnapshot,
  LifetimeStats,
} from '../types';
import { CASES } from '../data/cases';
import { BALANCE } from '../balance';
import { todayKey } from '../native/healthConnect';
import { rollColorFromCase, rawNextSellPrice } from '../data/colors';
import { serverPlaceTile } from '../lib/teams';
import { logFeedEvent } from '../lib/feedEvents';
import { JIT_FLOWS, ONBOARDING_CARDS, type JitFlowKey } from '../data/tutorial';

// Derived from the tutorial data file. Centralising here means
// startOnboarding / advanceOnboarding / advanceFlowStep all detect the
// final card / final step uniformly without each call site re-importing
// the arrays.
const ONBOARDING_CARD_COUNT = ONBOARDING_CARDS.length;
const JIT_FLOW_LENGTHS: Record<JitFlowKey, number> = {
  'first-case': JIT_FLOWS['first-case'].length,
};

// Runtime resolver for the currently-active JIT step's targetKey. Some
// step keys are dynamic (e.g. `case-open-${tier}` depends on which tier
// just transitioned 0→1; `inv-cell-${colorId}` depends on the colorId
// rolled in the opened case and seeded into tutorialFlowColorId). Static
// keys ('cases-tab', 'bottom-inventory') resolve to themselves.
//
// Kept in this file (not in data/tutorial.ts) because the resolution
// reads GameState — importing the GameState type from the store would
// circle back through the import graph. The data file stays dependency-
// free of store types; this helper stays inside the store.
function resolveJitTargetKey(
  flow: JitFlowKey,
  stepIdx: number,
  state: GameState,
): string {
  if (flow === 'first-case') {
    switch (stepIdx) {
      case 0:
        return 'cases-tab';
      case 1: {
        // First tier with pending>0 — the case that just unlocked.
        // We check tier-order so multi-fill scenarios resolve deterministically
        // (starter first, then quality, then fine).
        const tiers: CaseTier[] = ['starter', 'quality', 'fine'];
        for (const tier of tiers) {
          if (state.caseState[tier].pending > 0) return `case-open-${tier}`;
        }
        // No pending — the open happened before the resolver ran. Fall
        // through to a sentinel so the TutorialTarget never matches and
        // we advance via explicit advanceFlowStep call from CaseCard.
        return 'case-open';
      }
      case 2:
        return 'bottom-inventory';
      case 3:
        return state.tutorialFlowColorId
          ? `inv-cell-${state.tutorialFlowColorId}`
          : 'inv-cell';
      case 4:
        return state.tutorialFlowColorId
          ? `inv-place-${state.tutorialFlowColorId}`
          : 'inv-place';
      default:
        return '';
    }
  }
  return '';
}

// Public-from-the-store helper so consumers (TutorialTarget, JitTutorial)
// can read the currently-active targetKey without duplicating the switch
// above. NOT exposed on GameActions because it's pure and idempotent.
export function getActiveJitTargetKey(state: GameState): string | null {
  if (!state.tutorialActiveFlow) return null;
  return resolveJitTargetKey(
    state.tutorialActiveFlow,
    state.tutorialFlowStep,
    state,
  );
}

// Lenient matcher used by advanceFlowStep. resolveJitTargetKey reads
// current state and can return a stale sentinel when the underlying
// state has shifted between render and the advance call (e.g. CaseCard
// calls advanceFlowStep AFTER openCase decrements pending → step 1's
// resolver no longer sees a tier with pending>0). Prefix-matching
// avoids the race while still rejecting wrong-step advances.
function isExpectedJitKey(
  flow: JitFlowKey,
  stepIdx: number,
  expectedKey: string,
): boolean {
  if (flow === 'first-case') {
    switch (stepIdx) {
      case 0:
        return expectedKey === 'cases-tab';
      case 1:
        return expectedKey.startsWith('case-open-');
      case 2:
        return expectedKey === 'bottom-inventory';
      case 3:
        return expectedKey.startsWith('inv-cell-');
      case 4:
        return expectedKey.startsWith('inv-place-');
      default:
        return false;
    }
  }
  return false;
}

interface GameState {
  team: Team | null;
  // Player's display nickname. Loaded by bootstrap from the user row;
  // server assigns a `Stridekeeper-XXXXXX` default on signup
  // (handle_new_user trigger, migration 0006). Persisted so cold-start
  // can render without an extra round-trip; bootstrap re-syncs on
  // foreground. Null only on first launch before bootstrap completes
  // OR after resetSessionState (sign-out path); subsequent bootstraps
  // populate it via fetchMyProfile.
  //
  // NicknameOnboardingModal at App root format-checks this against
  // the auto-default pattern — a match prompts the player to pick one.
  nickname: string | null;
  steps: number;
  lastSyncedTotal: number | null;
  lastSyncedDate: string | null;
  caseState: CaseState;
  purse: number;
  teamTotals: { red: number; blue: number };
  // Phase-4 inventory: colorId → qty. Replaces the Phase-3 KeptItem[] array.
  // Phase-3 callers that did inventory.length / inventory.map iteration WILL
  // break in Step 4 — that's the intended bisect-boundary breakage.
  inventory: Record<string, number>;
  // Persistent across seasons.
  badges: Badge[];
  // Active season number — written by applySeasonReset, used at boot to
  // detect "did I miss a rollover offline?" against the server's active
  // season. null while no season is active (between rollovers, or fresh
  // install before applySeasonReset has run).
  seasonNumber: number | null;
  // ISO timestamps mirrored from the server's seasons row. seasonStartedAt
  // drives "DAY N" computation; seasonSoftCapAt drives the round countdown.
  // Both null in awaiting-mural state. Persisted so cold-start renders the
  // header correctly before the first foreground syncSeason completes.
  seasonStartedAt: string | null;
  seasonSoftCapAt: string | null;
  // Display name for the current mural (e.g. "WINE CANYON"). Mirrored
  // from `seasons.mural_name`. Persisted so SeasonCard's title renders
  // correctly on cold-start before bootstrap completes; null in
  // awaiting-mural state, in which case SeasonCard falls back to
  // `SEASON {n}`.
  seasonMuralName: string | null;
  // Per-season server data — non-persisted (re-fetched on launch / rollover).
  seasonPalette: Record<string, ColorDef> | null;
  seasonCraftRecipes: Record<string, CraftRecipe> | null;
  // Canvas state for the player's team. Lazily populated by
  // useCanvasLiveSync on mount; not persisted (server is the source of
  // truth + realtime keeps it fresh while the screen is open). Maps
  // pixel_idx → color_id; absence means unfilled.
  //
  // canvasTargetPixels is the seed_next_mural target (per-pixel goal
  // color). canvasFilled[team] is the team's placed pixels.
  canvasTargetPixels: Record<number, string> | null;
  canvasFilled: { red: Record<number, string>; blue: Record<number, string> };
  // Server-maintained filled_count from teams_canvas_progress, refreshed by
  // useTownFeed's poll. Drives TugOfWar's "RED 247 · BLUE 198" display.
  // Independent from canvasFilled (which only mirrors the player's team for
  // the canvas hero render); this tracks BOTH teams for the Mural tab.
  teamsCanvasProgress: { red: number; blue: number };
  // Pity counter. Increments on each FINE-tier case open whose roll did NOT
  // produce a fine-tier color; resets when a fine-tier color drops or at
  // season rollover. When pityCounter.fine >= BALANCE.pity.fine.threshold,
  // the next FINE-tier open forces a fine-tier color. Lower-tier opens
  // (starter/quality) never touch this counter — gating it would let a
  // string of starter cases yank a tier-3 legendary out of a 200-step case
  // (the loot-box jackpot anti-pattern in SKILL.md §8).
  pityCounter: { fine: number };
  // Intra-day sell-decay history. Resets at midnight (when date changes)
  // and at season rollover.
  sellHistory: { date: string; counts: Record<string, number> };
  lastSimulateAt: number;
  // Cached account state. True when the current Supabase session is a
  // linked email-password account, false for anonymous. Hydrated at boot
  // by bootstrapAuthAndSeason (via getAccountStatus); kept fresh by
  // AccountModal callbacks. Drives the TopHeader AccountChip's brass-fill
  // vs dim-outline state without needing a render-time getSession().
  accountLinked: boolean;
  // Email of the linked account, when accountLinked is true. Stored
  // separately from `accountLinked` because Supabase's getSession()
  // cache doesn't refresh immediately after updateUser — relying on
  // it for the display email surfaced "Anonymous" briefly after a
  // successful link. AccountSection writes the form-input email
  // here directly on link success; bootstrap re-syncs from
  // getAccountStatus on every cold-start. Null when anon. Persisted
  // so SettingsModal can render the snippet without an async fetch.
  accountEmail: string | null;
  // Transient. Set by bootstrap.ts when a rollover is detected (boot or
  // realtime); read by App.tsx to render <SeasonEndCeremony />. Not
  // persisted — recomputed on every detection so a CONTINUE-less quit
  // re-fires the ceremony on next boot.
  pendingSeasonEnd: SeasonEndSnapshot | null;
  // Persisted. Highest prev-season-number whose ceremony the user has
  // pressed CONTINUE on. Bootstrap skips snapshot capture if this is
  // already >= the just-ended season number, so a rapid re-launch after
  // CONTINUE doesn't re-fire the ceremony. Survives season resets — it
  // tracks user-facing acknowledgement, not intra-season state.
  lastShownCeremonySeason: number | null;
  // Transient. Set by CaseCard's handleOpen on a successful openCase()
  // roll; read by App.tsx to render <CaseRevealModal />. Not persisted
  // — a force-quit mid-reveal silently drops the ceremony (the rolled
  // color is already in inventory regardless), which is fine for a
  // single-tap interaction. The struct stores both `tier` (the case
  // tier the user opened) and `rolledTier` (which may differ under a
  // pity-clamp upgrade) so the modal can render the right tier label.
  pendingCaseReveal: { tier: CaseTier; colorId: string; rolledTier: CaseTier } | null;
  // Transient. Drives <TileFlightOverlay /> at App root. Set by both
  // place-tile call sites (CanvasPanel for the canvas TilePicker, and
  // ColorsPanel for the inventory PLACE ON CANVAS shortcut). The
  // overlay renders a 140 dp tile in the center of the screen and
  // animates it down to the destination cell. `target === null` is the
  // inventory hand-off state — the canvas isn't mounted yet, so the
  // tile sits centered until CanvasPanel mounts and resolves the cell
  // rect. Cleared when the flight animation completes (or on RPC
  // failure for the inventory branch where there's no in-canvas
  // animation context to fall back to).
  pendingTileFlight: {
    colorId: string;
    pixelIdx: number;
    target: { x: number; y: number; size: number } | null;
  } | null;
  // Transient. Map of pixel_idx → epoch ms when the local player
  // initiated a placement. Set by `placeTile` before the optimistic
  // deduction; cleared either by the realtime echo (applyPlacedPixel)
  // or a 10s TTL timer in `placeTile`'s setTimeout, whichever comes
  // first. CanvasView's Pulse spawn loop reads this to render
  // self-placements with a heavier variant (B2 polish pass). Not
  // persisted — a force-quit before the realtime echo is a transient
  // miss that doesn't affect correctness (the pixel is on the server).
  selfPlacementMarks: Record<number, number>;
  // Persisted. Lifetime / cross-season counters surfaced on the
  // JournalModal (A1 polish). See LifetimeStats type for field
  // semantics. Bumped from applyRealSteps / openCase / placeTile;
  // best_season_* updated by recordSeasonBest before
  // applySeasonReset.
  lifetimeStats: LifetimeStats;
  // Persisted. UI preferences for push notifications. Backend
  // wiring (Expo Notifications) ships in Phase 5; the toggles
  // persist now so prefs are ready when push lands. All true by
  // default — opt-out, not opt-in (per the locked design philosophy
  // of "respect the player's time" — they expect a daily-cadence
  // walking app to remind them; granular opt-out is the right
  // ergonomic).
  notificationPrefs: {
    dailyWalkReminder: boolean;
    seasonEndingSoon: boolean;
    teamActivity: boolean;
  };
  // Persisted. True after the player has either DONE'd or SKIP'd the
  // Persistent one-shot flags for the tutorial system. Replaces the old
  // single `tutorialCompleted` boolean. Each entry is a tutorial flow that
  // only ever fires once on this device:
  //   - `onboarding`: the 2-card welcome modal shown after nickname pick.
  //   - `firstCaseFlow`: the JIT chain triggered when the player's first
  //      case fills (cases-tab → OPEN → INVENTORY → cell → PLACE).
  // Migration: existing testers with the legacy `tutorialCompleted=true`
  // get `tutorialFlags.onboarding=true` so they don't see the welcome again.
  tutorialFlags: {
    onboarding: boolean;
    firstCaseFlow: boolean;
  };
  // Transient. True while the 2-card OnboardingTutorial modal is visible.
  // Not persisted — force-quit mid-onboarding re-fires next launch since
  // tutorialFlags.onboarding only flips on Done / Skip.
  onboardingActive: boolean;
  // Transient. Current onboarding card index (0..N-1 of ONBOARDING_CARDS).
  onboardingCardIdx: number;
  // Transient. Currently-running JIT flow, or null when no JIT overlay
  // is active. JIT flows are driven by JIT_FLOWS in src/data/tutorial.ts.
  tutorialActiveFlow: 'first-case' | null;
  // Transient. Index into the active flow's step array.
  tutorialFlowStep: number;
  // Transient. The colorId of the most-recently-opened case during a JIT
  // flow. Used to resolve dynamic targetKeys like `inv-cell-${colorId}`
  // and `inv-place-${colorId}` for the inventory-side spotlights.
  tutorialFlowColorId: string | null;
  // Transient. Latest measureInWindow-derived rect of the active flow
  // step's target element. Written by TutorialTarget when its targetKey
  // matches the current step; read by JitTutorial / OnboardingTutorial to
  // position the cutout. Null while waiting for the next target to mount.
  tutorialTargetRect: { x: number; y: number; width: number; height: number } | null;
  // Transient. Which Home sub-tab is currently active (mural / cases /
  // profile). Lifted out of HomeScreen local state so the tutorial-step
  // effect can drive it during the spotlight sequence. Default 'mural'.
  activeSubTab: 'mural' | 'cases' | 'profile';
}

interface GameActions {
  simulateWalk: () => void;
  applyRealSteps: (total: number) => void;
  openCase: (tier: CaseTier) => { colorId: string; tier: CaseTier } | null;
  // Server-authoritative tile placement. Optimistic deduction; rollback on
  // every PlaceResult error branch. Returns the result so UI consumers
  // (TilePicker in S4.B-canvas) can switch on the discriminated union and
  // surface user-visible feedback for `pixel_taken` / `wrong_color` etc.
  placeTile: (colorId: string, pixelIdx: number) => Promise<PlaceResult>;
  sellTile: (colorId: string, qty: number) => void;
  craftTile: (recipeId: string, qty: number) => void;
  buyShopTile: (colorId: string, qty: number) => void;
  // Called by SeasonEndCeremony's CONTINUE button. Wipes intra-season
  // state, swaps in the new palette + recipes + target pixels and
  // writes the new season number + server-side timestamps. Badges and
  // team persist.
  //
  // `newTargetPixels` is pre-loaded by SeasonEndCeremony (via
  // loadSeasonEndSnapshot) so the post-CONTINUE state has the new
  // mural's target ready before useCanvasLiveSync re-mounts —
  // otherwise the user sees a flash of empty canvas while the hook
  // re-fetches.
  //
  // All five "new*" params accept null to support the no-queue rollover
  // path (cap_no_queue / completion_no_queue rollover reasons). In that
  // case seasonNumber goes to null and the player sits in "between
  // seasons" state until the next mural is queued + promoted.
  applySeasonReset: (
    newSeasonNumber: number | null,
    newPalette: Record<string, ColorDef> | null,
    newRecipes: Record<string, CraftRecipe> | null,
    newTargetPixels: Record<number, string> | null,
    startedAt: string | null,
    softCapAt: string | null,
    muralName: string | null,
  ) => void;
  // Refresh path — same season, server timestamps may have moved (cap
  // extension on completion-no-queue, etc.). Called from App.tsx's
  // syncSeason whenever the active season number matches what's persisted.
  setSeasonTimes: (startedAt: string | null, softCapAt: string | null) => void;
  setSeasonMuralName: (name: string | null) => void;
  setTeam: (team: Team) => void;
  setNickname: (nickname: string | null) => void;
  setTeamTotals: (totals: { red: number; blue: number }) => void;
  setTeamTotal: (color: 'red' | 'blue', total: number) => void;
  setSeasonPalette: (palette: Record<string, ColorDef> | null) => void;
  setSeasonCraftRecipes: (recipes: Record<string, CraftRecipe> | null) => void;
  setBadges: (badges: Badge[]) => void;
  // Canvas-state actions — driven by useCanvasLiveSync's load + realtime
  // callbacks. Bulk loaders replace the whole map; applyPlacedPixel is the
  // realtime hot path (one INSERT row → one pixel update).
  setCanvasTargetPixels: (pixels: Record<number, string> | null) => void;
  setTeamCanvas: (team: Team, pixels: Record<number, string>) => void;
  applyPlacedPixel: (team: Team, pixelIdx: number, colorId: string) => void;
  setTeamsCanvasProgress: (progress: { red: number; blue: number }) => void;
  setAccountLinked: (linked: boolean) => void;
  setAccountEmail: (email: string | null) => void;
  // Set by bootstrap.ts after loadSeasonEndSnapshot resolves on rollover
  // detection. Pass null to clear (called by SeasonEndCeremony on
  // CONTINUE before applySeasonReset runs).
  setPendingSeasonEnd: (snap: SeasonEndSnapshot | null) => void;
  // Mark a prev-season ceremony as user-acknowledged. Bootstrap reads
  // this to skip snapshot capture for already-shown ceremonies. Stored
  // as a number (the highest prev-season-number acknowledged) so a user
  // who skipped multiple offline rollovers only sees the most recent.
  markCeremonyShown: (seasonNumber: number) => void;
  // Set by CaseCard's handleOpen on a successful openCase() roll. Pass
  // null from CaseRevealModal's CONTINUE handler to dismiss the modal.
  setPendingCaseReveal: (
    payload: { tier: CaseTier; colorId: string; rolledTier: CaseTier } | null,
  ) => void;
  setPendingTileFlight: (
    payload: {
      colorId: string;
      pixelIdx: number;
      target: { x: number; y: number; size: number } | null;
    } | null,
  ) => void;
  // Mark / clear a self-placement (B2 polish). markSelfPlacementWithTtl
  // schedules an automatic clear after 10s as a safety net for
  // realtime-never-arrived; the action returns nothing because
  // CanvasView spawn-loop reads selfPlacementMarks directly via
  // useGameStore selector.
  markSelfPlacement: (pixelIdx: number) => void;
  clearSelfPlacement: (pixelIdx: number) => void;
  // Called by SeasonEndCeremony's CONTINUE handler BEFORE
  // applySeasonReset wipes intra-season state — at that moment the
  // captured snapshot still has snap.myContribution available. Updates
  // lifetimeStats.best_season_* iff the new contribution beats the
  // stored best (ties prefer the older record so a re-fire of the
  // ceremony for the same season doesn't bump number unnecessarily).
  recordSeasonBest: (seasonNumber: number, contribution: number) => void;
  setNotificationPref: (
    key: keyof GameState['notificationPrefs'],
    value: boolean,
  ) => void;
  // Tutorial controls. See GameState's tutorial* fields for semantics.
  // Onboarding (2-card welcome modal):
  startOnboarding: () => void;
  advanceOnboarding: () => void; // NEXT — moves to next card or completes
  completeOnboarding: () => void; // Done/Skip — flips flag + closes modal
  // JIT flow controls (cases / inventory / place chain):
  startTutorialFlow: (flow: 'first-case', seedColorId?: string) => void;
  // Stash the colorId that the just-opened case rolled, so subsequent
  // inventory-side flow steps (inv-cell-X / inv-place-X) can resolve
  // their dynamic targetKeys against it. Called from CaseCard.handleOpen
  // before advanceFlowStep to ensure tutorialFlowColorId is set before
  // resolveJitTargetKey is queried for step 2/3/4.
  setTutorialFlowColorId: (colorId: string | null) => void;
  // Validates the expected key matches the current step's resolved targetKey
  // before advancing. Prevents stale advance calls (e.g. a tap on a cell
  // that isn't the spotlit one) from skipping ahead.
  advanceFlowStep: (expectedTargetKey: string) => void;
  // SKIP — flips the active flow's persistent flag and clears transient state.
  cancelTutorialFlow: () => void;
  // Dev-only: clear all tutorial flags and active flow state so the entire
  // onboarding + JIT chain can be re-tested without `adb pm clear`.
  resetTutorials: () => void;
  setTutorialTargetRect: (
    rect: { x: number; y: number; width: number; height: number } | null,
  ) => void;
  setActiveSubTab: (tab: 'mural' | 'cases' | 'profile') => void;
  // Dev-only: grant one of every case-category color in the active
  // season's palette so testing the placement / sell / craft flows
  // doesn't require walking thousands of steps to roll the right
  // colors. Only callable from a __DEV__-gated UI surface.
  devGrantOneOfEach: () => void;
  // Wipe every account-scoped field back to initialState. Called by
  // AccountModal before re-bootstrapping a different auth session
  // (sign-in on new device / sign-out → fresh anon). The next bootstrap
  // pass repopulates team / inventory / badges / canvas state from the
  // server for whichever UUID is now active.
  resetSessionState: () => void;
}

type GameStore = GameState & GameActions;

const defaultCaseState: CaseState = {
  starter: { progress: 0, pending: 0 },
  quality: { progress: 0, pending: 0 },
  fine: { progress: 0, pending: 0 },
};

// Extracted so onRehydrateStorage can reset the store cleanly when it
// detects a stale Phase-3 persisted blob (see persist config below).
const initialState: GameState = {
  team: null,
  nickname: null,
  steps: 0,
  lastSyncedTotal: null,
  lastSyncedDate: null,
  caseState: defaultCaseState,
  purse: 0,
  teamTotals: { red: 0, blue: 0 },
  inventory: {},
  badges: [],
  seasonNumber: null,
  seasonStartedAt: null,
  seasonSoftCapAt: null,
  seasonMuralName: null,
  seasonPalette: null,
  seasonCraftRecipes: null,
  canvasTargetPixels: null,
  canvasFilled: { red: {}, blue: {} },
  teamsCanvasProgress: { red: 0, blue: 0 },
  pityCounter: { fine: 0 },
  sellHistory: { date: todayKey(), counts: {} },
  lastSimulateAt: 0,
  accountLinked: false,
  accountEmail: null,
  pendingSeasonEnd: null,
  lastShownCeremonySeason: null,
  pendingCaseReveal: null,
  pendingTileFlight: null,
  selfPlacementMarks: {},
  lifetimeStats: {
    steps_lifetime: 0,
    cases_opened: { starter: 0, quality: 0, fine: 0 },
    tiles_placed_lifetime: 0,
    best_season_contribution: 0,
    best_season_number: null,
  },
  notificationPrefs: {
    dailyWalkReminder: true,
    seasonEndingSoon: true,
    teamActivity: true,
  },
  tutorialFlags: {
    onboarding: false,
    firstCaseFlow: false,
  },
  onboardingActive: false,
  onboardingCardIdx: 0,
  tutorialActiveFlow: null,
  tutorialFlowStep: 0,
  tutorialFlowColorId: null,
  tutorialTargetRect: null,
  activeSubTab: 'mural',
};

function addStepsToCase(
  state: CaseState,
  tier: CaseTier,
  steps: number,
): { progress: number; pending: number } {
  const required = CASES[tier].stepsRequired;
  let progress = state[tier].progress + steps;
  let pending = state[tier].pending;

  while (progress >= required) {
    progress -= required;
    pending += 1;
  }

  return { progress, pending };
}

// Detect persisted state from before Phase 4 (which had no persist `version`,
// so Zustand's migrate callback never fires for it — see comment on the
// persist config below for the full Zustand-internals reasoning).
function looksLikePhase3State(s: Record<string, unknown>): boolean {
  return (
    Array.isArray(s.inventory) ||
    'forTheTown' in s ||
    'pendingBatch' in s ||
    'pendingBatchEndsAt' in s ||
    'strideLevel' in s ||
    'maxSlots' in s
  );
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      applyRealSteps: (total: number) => {
        // Defensive gate: App.tsx already waits for onFinishHydration before
        // dispatching this action, but a future caller (e.g. an explicit refresh
        // button) might fire pre-hydration. Without this guard a `total` would be
        // diffed against the default lastSyncedTotal=null and silently re-anchor.
        if (!useGameStore.persist.hasHydrated()) return;

        const { lastSyncedTotal, lastSyncedDate, caseState, purse } = get();
        const today = todayKey();

        // Baseline for delta math. On a new local day (or first install) HC's
        // daily counter has reset, so all of `total` represents today's steps;
        // baseline is 0 and we mint for the whole amount. On the same day,
        // baseline is the previous reading and we mint only the new delta.
        const sameDay = lastSyncedTotal != null && lastSyncedDate === today;
        const baseline = sameDay ? lastSyncedTotal! : 0;
        const delta = Math.max(0, total - baseline);

        // Same-day no-op: nothing to mint AND display already mirrors HC.
        if (delta === 0 && sameDay) return;

        // Phase 4: flat $1/step. Stride Power upgrade is gone.
        const earnedPurse = delta * BALANCE.stride.baseValue;
        const newCaseState: CaseState = {
          starter: addStepsToCase(caseState, 'starter', delta),
          quality: addStepsToCase(caseState, 'quality', delta),
          fine: addStepsToCase(caseState, 'fine', delta),
        };

        // `steps` mirrors HC's absolute today total (not a cumulative
        // game-internal counter) so the InfoStrip "X STEPS" display matches
        // what Samsung Health / Health Connect report. simulateWalk can
        // temporarily push past HC; the next sync overwrites back.
        set((s) => ({
          steps: total,
          lastSyncedTotal: total,
          lastSyncedDate: today,
          caseState: newCaseState,
          purse: purse + earnedPurse,
          lifetimeStats: {
            ...s.lifetimeStats,
            steps_lifetime: s.lifetimeStats.steps_lifetime + delta,
          },
        }));
      },

      simulateWalk: () => {
        const now = Date.now();
        const { lastSimulateAt, steps, caseState, purse } = get();

        if (now - lastSimulateAt < BALANCE.simulate.cooldownMs) {
          return;
        }

        const added = 300 + Math.floor(Math.random() * 201);
        const newSteps = steps + added;
        const earnedPurse = added * BALANCE.stride.baseValue;

        const newCaseState: CaseState = {
          starter: addStepsToCase(caseState, 'starter', added),
          quality: addStepsToCase(caseState, 'quality', added),
          fine: addStepsToCase(caseState, 'fine', added),
        };

        set({
          steps: newSteps,
          caseState: newCaseState,
          purse: purse + earnedPurse,
          lastSimulateAt: now,
        });
      },

      openCase: (tier: CaseTier): { colorId: string; tier: CaseTier } | null => {
        const { caseState, seasonPalette, pityCounter, inventory } = get();
        if (caseState[tier].pending <= 0) return null;

        // Palette-null guard: caseState[tier].pending is left intact so the
        // reveal fires once palette loads. Step pressure is already absorbed
        // into caseState.progress by applyRealSteps; nothing is lost.
        if (seasonPalette === null) return null;

        // Pity only fires on fine-tier opens. Cheaper tiers can't roll fine
        // colors anyway, and gating pity globally would convert a streak of
        // starters into a tier-3 jackpot (see pityCounter doc-comment).
        const pityHit =
          tier === 'fine' && pityCounter.fine >= BALANCE.pity.fine.threshold;
        const colorId = rollColorFromCase(seasonPalette, tier, pityHit);
        if (colorId === null) return null;

        const rolledTier = (seasonPalette[colorId]?.tier ?? tier) as CaseTier;
        const newPending = caseState[tier].pending - 1;
        // Only fine-tier opens move the counter. Reset on a fine drop;
        // increment when a fine-tier open misses; lower-tier opens leave
        // it alone.
        const newPity =
          tier === 'fine'
            ? rolledTier === 'fine'
              ? { fine: 0 }
              : { fine: pityCounter.fine + 1 }
            : pityCounter;
        const newInventory: Record<string, number> = {
          ...inventory,
          [colorId]: (inventory[colorId] ?? 0) + 1,
        };

        set((s) => ({
          caseState: {
            ...caseState,
            [tier]: { ...caseState[tier], pending: newPending },
          },
          pityCounter: newPity,
          inventory: newInventory,
          // Bump the by-tier counter on the OPENED tier (not the
          // rolled tier — a starter open that pity-clamps a fine
          // color is still a "starter case opened" for stats).
          lifetimeStats: {
            ...s.lifetimeStats,
            cases_opened: {
              ...s.lifetimeStats.cases_opened,
              [tier]: s.lifetimeStats.cases_opened[tier] + 1,
            },
          },
        }));

        // Fire-and-forget atmospheric event. Tier is the rolled-color's
        // actual tier (which may differ from p_tier under pity-clamp);
        // the RPC validates tier coherence against the color's row.
        void logFeedEvent('case_opened', { colorId, tier: rolledTier });
        return { colorId, tier: rolledTier };
      },

      placeTile: async (colorId: string, pixelIdx: number): Promise<PlaceResult> => {
        const { inventory } = get();
        const have = inventory[colorId] ?? 0;
        if (have <= 0) {
          return { ok: false, error: 'not_owned' };
        }
        // Mark BEFORE optimistic deduction so the eventual realtime echo
        // (applyPlacedPixel) finds the self-mark and renders the heavy
        // self-placement pulse (B2 polish). 10s TTL is the safety net
        // for "realtime never came back" — if the echo arrived first the
        // clear is a no-op against the now-empty mark.
        get().markSelfPlacement(pixelIdx);
        const ttlTimer = setTimeout(() => {
          get().clearSelfPlacement(pixelIdx);
        }, 10_000);
        // Optimistic deduction. The discriminated PlaceResult branches are
        // returned to the caller so TilePicker can route per-error UI feedback
        // (per plan §302-307); this action just owns inventory state.
        set({ inventory: { ...inventory, [colorId]: have - 1 } });
        try {
          const result = await serverPlaceTile(colorId, pixelIdx);
          if (!result.ok) {
            set((s) => ({
              inventory: {
                ...s.inventory,
                [colorId]: (s.inventory[colorId] ?? 0) + 1,
              },
            }));
            // Roll back the self-mark too: the pulse is meaningless
            // when the placement didn't take. Cancel the TTL timer.
            clearTimeout(ttlTimer);
            get().clearSelfPlacement(pixelIdx);
          } else {
            // A1 polish: bump the journal's lifetime counter ONLY on
            // server-confirmed success. Optimistic-then-rollback paths
            // (above) leave it untouched, so the counter is a true
            // record of "tiles I actually placed on the canvas".
            set((s) => ({
              lifetimeStats: {
                ...s.lifetimeStats,
                tiles_placed_lifetime: s.lifetimeStats.tiles_placed_lifetime + 1,
              },
            }));
          }
          // Server may signal season completion via `seasonEnded` /
          // `badgeAwarded`; SeasonEndWatcher (S4.D) listens to
          // subscribeSeasonRollover and drives applySeasonReset.
          return result;
        } catch (err) {
          set((s) => ({
            inventory: {
              ...s.inventory,
              [colorId]: (s.inventory[colorId] ?? 0) + 1,
            },
          }));
          clearTimeout(ttlTimer);
          get().clearSelfPlacement(pixelIdx);
          const message = err instanceof Error ? err.message : String(err);
          console.warn('[stridekeep] placeTile failed:', err);
          return { ok: false, error: 'network_error', message };
        }
      },

      sellTile: (colorId: string, qty: number) => {
        if (qty <= 0) return;
        const { inventory, seasonPalette, sellHistory, purse } = get();
        const have = inventory[colorId] ?? 0;
        if (have < qty) return;

        // Reset history bucket on date rollover.
        const today = todayKey();
        const history =
          sellHistory.date === today
            ? sellHistory
            : { date: today, counts: {} as Record<string, number> };
        const soldToday = history.counts[colorId] ?? 0;

        // Per-unit decay: each successive same-day sell of the same colorId
        // is worth factor × the previous, floored at floor × baseValue.
        // The unfloored helper lives in data/colors.ts so InventoryScreen's
        // "SELL 1 · $X" preview reads from the same formula — no view drift.
        // We accumulate floats and floor once at the end so multi-qty sales
        // don't lose a few cents to per-item rounding.
        let earned = 0;
        for (let i = 0; i < qty; i += 1) {
          earned += rawNextSellPrice(seasonPalette, colorId, soldToday + i);
        }
        earned = Math.floor(earned);

        set({
          inventory: { ...inventory, [colorId]: have - qty },
          purse: purse + earned,
          sellHistory: {
            date: today,
            counts: { ...history.counts, [colorId]: soldToday + qty },
          },
        });
        void logFeedEvent('sold', { colorId, qty });
      },

      craftTile: (recipeId: string, qty: number) => {
        if (qty <= 0) return;
        const { inventory, seasonCraftRecipes } = get();
        if (!seasonCraftRecipes) return;
        const recipe = seasonCraftRecipes[recipeId];
        if (!recipe) return;

        // Verify enough of every input × qty.
        for (const [inputId, perUnit] of Object.entries(recipe.inputs)) {
          if ((inventory[inputId] ?? 0) < perUnit * qty) return;
        }

        const newInventory: Record<string, number> = { ...inventory };
        for (const [inputId, perUnit] of Object.entries(recipe.inputs)) {
          newInventory[inputId] = (newInventory[inputId] ?? 0) - perUnit * qty;
        }
        newInventory[recipe.outputColorId] =
          (newInventory[recipe.outputColorId] ?? 0) + qty;

        set({ inventory: newInventory });
        void logFeedEvent('crafted', { colorId: recipe.outputColorId, qty });
      },

      buyShopTile: (colorId: string, qty: number) => {
        if (qty <= 0) return;
        const { seasonPalette, inventory, purse } = get();
        if (!seasonPalette) return;
        const def = seasonPalette[colorId];
        if (!def || def.category !== 'shop' || def.shopPrice == null) return;
        const totalCost = def.shopPrice * qty;
        if (purse < totalCost) return;
        set({
          purse: purse - totalCost,
          inventory: {
            ...inventory,
            [colorId]: (inventory[colorId] ?? 0) + qty,
          },
        });
        void logFeedEvent('shop_bought', { colorId, qty });
      },

      applySeasonReset: (
        newSeasonNumber: number | null,
        newPalette: Record<string, ColorDef> | null,
        newRecipes: Record<string, CraftRecipe> | null,
        newTargetPixels: Record<number, string> | null,
        startedAt: string | null,
        softCapAt: string | null,
        muralName: string | null,
      ) => {
        set({
          inventory: {},
          purse: 0,
          pityCounter: { fine: 0 },
          sellHistory: { date: todayKey(), counts: {} },
          caseState: defaultCaseState,
          seasonNumber: newSeasonNumber,
          seasonStartedAt: startedAt,
          seasonSoftCapAt: softCapAt,
          seasonMuralName: muralName,
          seasonPalette: newPalette,
          seasonCraftRecipes: newRecipes,
          canvasTargetPixels: newTargetPixels,
          canvasFilled: { red: {}, blue: {} },
          teamsCanvasProgress: { red: 0, blue: 0 },
        });
      },

      setSeasonTimes: (startedAt: string | null, softCapAt: string | null) =>
        set({ seasonStartedAt: startedAt, seasonSoftCapAt: softCapAt }),

      setSeasonMuralName: (name: string | null) =>
        set({ seasonMuralName: name }),

      setTeam: (team: Team) => set({ team }),

      setNickname: (nickname: string | null) => set({ nickname }),

      setTeamTotals: (totals: { red: number; blue: number }) =>
        set({ teamTotals: totals }),

      setTeamTotal: (color: 'red' | 'blue', total: number) =>
        set((state) => ({ teamTotals: { ...state.teamTotals, [color]: total } })),

      setSeasonPalette: (palette: Record<string, ColorDef> | null) =>
        set({ seasonPalette: palette }),

      setSeasonCraftRecipes: (recipes: Record<string, CraftRecipe> | null) =>
        set({ seasonCraftRecipes: recipes }),

      setBadges: (badges: Badge[]) => set({ badges }),

      setCanvasTargetPixels: (pixels: Record<number, string> | null) =>
        set({ canvasTargetPixels: pixels }),

      setTeamCanvas: (team: Team, pixels: Record<number, string>) =>
        set((s) => ({ canvasFilled: { ...s.canvasFilled, [team]: pixels } })),

      applyPlacedPixel: (team: Team, pixelIdx: number, colorId: string) =>
        set((s) => ({
          canvasFilled: {
            ...s.canvasFilled,
            [team]: { ...s.canvasFilled[team], [pixelIdx]: colorId },
          },
        })),
      // NOTE: applyPlacedPixel intentionally does NOT clear the
      // self-mark even when the realtime echo is for a self-placement.
      // CanvasView's spawn loop runs in the SAME tick as this set()
      // (the `filled` selector change retriggers it) and snapshots
      // selfPlacementMarks via getState() — if we cleared here, the
      // snapshot would already be empty and the heavy self-pulse
      // would never render. The 10s TTL on placeTile is the actual
      // cleanup path. Stale marks past 10s are benign (no pixel can
      // be placed twice in a season, so the next placement at the
      // same idx is impossible).

      setTeamsCanvasProgress: (progress: { red: number; blue: number }) =>
        set({ teamsCanvasProgress: progress }),

      setAccountLinked: (linked: boolean) => set({ accountLinked: linked }),

      setAccountEmail: (email: string | null) => set({ accountEmail: email }),

      setPendingSeasonEnd: (snap: SeasonEndSnapshot | null) =>
        set({ pendingSeasonEnd: snap }),

      markCeremonyShown: (seasonNumber: number) =>
        set((s) => {
          const prev = s.lastShownCeremonySeason ?? -Infinity;
          if (seasonNumber <= prev) return {};
          return { lastShownCeremonySeason: seasonNumber };
        }),

      setPendingCaseReveal: (payload) => set({ pendingCaseReveal: payload }),

      setPendingTileFlight: (payload) => set({ pendingTileFlight: payload }),

      markSelfPlacement: (pixelIdx: number) =>
        set((s) => ({
          selfPlacementMarks: { ...s.selfPlacementMarks, [pixelIdx]: Date.now() },
        })),

      clearSelfPlacement: (pixelIdx: number) =>
        set((s) => {
          if (s.selfPlacementMarks[pixelIdx] === undefined) return {};
          // Object spread + delete keeps the rest immutable so the Zustand
          // selector consumers (CanvasView spawn loop) only re-render when
          // the map identity actually changes.
          const next = { ...s.selfPlacementMarks };
          delete next[pixelIdx];
          return { selfPlacementMarks: next };
        }),

      recordSeasonBest: (seasonNumber: number, contribution: number) =>
        set((s) => {
          if (contribution <= s.lifetimeStats.best_season_contribution) return {};
          return {
            lifetimeStats: {
              ...s.lifetimeStats,
              best_season_contribution: contribution,
              best_season_number: seasonNumber,
            },
          };
        }),

      setNotificationPref: (key, value) =>
        set((s) => ({
          notificationPrefs: { ...s.notificationPrefs, [key]: value },
        })),

      setTutorialTargetRect: (rect) => set({ tutorialTargetRect: rect }),

      startOnboarding: () =>
        set({ onboardingActive: true, onboardingCardIdx: 0 }),
      advanceOnboarding: () => {
        const s = get();
        if (!s.onboardingActive) return;
        const next = s.onboardingCardIdx + 1;
        if (next >= ONBOARDING_CARD_COUNT) {
          set({
            onboardingActive: false,
            onboardingCardIdx: 0,
            tutorialFlags: { ...s.tutorialFlags, onboarding: true },
          });
        } else {
          set({ onboardingCardIdx: next });
        }
      },
      completeOnboarding: () =>
        set((s) => ({
          onboardingActive: false,
          onboardingCardIdx: 0,
          tutorialFlags: { ...s.tutorialFlags, onboarding: true },
        })),

      startTutorialFlow: (flow, seedColorId) =>
        set({
          tutorialActiveFlow: flow,
          tutorialFlowStep: 0,
          tutorialFlowColorId: seedColorId ?? null,
          tutorialTargetRect: null,
        }),
      setTutorialFlowColorId: (colorId) =>
        set({ tutorialFlowColorId: colorId }),
      advanceFlowStep: (expectedTargetKey) => {
        const s = get();
        if (!s.tutorialActiveFlow) return;
        // Prefix-match (not strict equality) — see isExpectedJitKey docs
        // for why. Rejects calls from the wrong step but tolerates the
        // state-mutation race where the spotlit action's own reducer
        // has already moved the state out from under resolveJitTargetKey.
        if (
          !isExpectedJitKey(s.tutorialActiveFlow, s.tutorialFlowStep, expectedTargetKey)
        ) {
          return;
        }
        const flowLen = JIT_FLOW_LENGTHS[s.tutorialActiveFlow];
        const nextIdx = s.tutorialFlowStep + 1;
        if (nextIdx >= flowLen) {
          // Final step → complete the flow + flip its persistent flag.
          set({
            tutorialActiveFlow: null,
            tutorialFlowStep: 0,
            tutorialFlowColorId: null,
            tutorialTargetRect: null,
            tutorialFlags: {
              ...s.tutorialFlags,
              firstCaseFlow: true,
            },
          });
        } else {
          set({
            tutorialFlowStep: nextIdx,
            tutorialTargetRect: null,
          });
        }
      },
      cancelTutorialFlow: () => {
        const s = get();
        if (!s.tutorialActiveFlow) return;
        // Flip the relevant persistent flag so the flow doesn't re-fire.
        const nextFlags = {
          ...s.tutorialFlags,
          firstCaseFlow:
            s.tutorialActiveFlow === 'first-case' ? true : s.tutorialFlags.firstCaseFlow,
        };
        set({
          tutorialActiveFlow: null,
          tutorialFlowStep: 0,
          tutorialFlowColorId: null,
          tutorialTargetRect: null,
          tutorialFlags: nextFlags,
        });
      },
      resetTutorials: () =>
        set({
          tutorialFlags: { onboarding: false, firstCaseFlow: false },
          onboardingActive: false,
          onboardingCardIdx: 0,
          tutorialActiveFlow: null,
          tutorialFlowStep: 0,
          tutorialFlowColorId: null,
          tutorialTargetRect: null,
        }),

      setActiveSubTab: (tab) => set({ activeSubTab: tab }),

      devGrantOneOfEach: () =>
        set((s) => {
          if (!s.seasonPalette) return {};
          const next = { ...s.inventory };
          for (const color of Object.values(s.seasonPalette)) {
            if (color.category !== 'case') continue;
            next[color.id] = (next[color.id] ?? 0) + 1;
          }
          return { inventory: next };
        }),

      resetSessionState: () => set(initialState),
    }),
    {
      name: 'stridekeep-game-state',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      // Zustand only invokes `migrate` when the persisted blob has a numeric
      // `version` field. Phase-3's persist config didn't set one, so a
      // Phase-3 → Phase-4 upgrade DOES NOT trigger this migrate at all — the
      // unversioned blob shallow-merges over the Phase-4 initial state and
      // corrupts it (Phase-3 inventory: KeptItem[] shadows Phase-4 inventory:
      // Record<string, number>, every reducer breaks). The shape detection in
      // onRehydrateStorage below is the actual safety net; this migrate exists
      // only to handle FUTURE versioned migrations (Phase-4 → Phase-5+).
      //
      // v1 → v2: tutorial fields added. Persisted blobs from v1 don't have
      // `tutorialCompleted` — default to false so the spotlight tutorial
      // fires once for existing testers on next launch (correct behavior:
      // they haven't seen it yet). Zustand merges over initialState, so
      // returning the persisted blob as-is is enough; tutorialCompleted
      // picks up its initialState default of false during the merge.
      //
      // v2 → v3: tutorial system rewritten from a single linear walkthrough
      // (driven by `tutorialCompleted`) into a 2-card onboarding modal +
      // JIT flows triggered by gameplay events (driven by `tutorialFlags`).
      // The legacy `tutorialCompleted=true` value MUST be carried forward as
      // `tutorialFlags.onboarding=true` — existing testers have already seen
      // the welcome content and shouldn't have it re-fire. We intentionally
      // do NOT preset `firstCaseFlow=true` from the legacy flag: existing
      // testers who never opened a case will still benefit from the JIT
      // chain when their first one fills, which is the whole point of the
      // redesign.
      migrate: (persisted, version) => {
        if (version === 1) {
          return persisted as GameStore;
        }
        if (version === 2) {
          const p = persisted as Record<string, unknown> & {
            tutorialCompleted?: boolean;
          };
          const legacyOnboardingDone = p.tutorialCompleted === true;
          // Drop the legacy field so it doesn't linger and confuse readers;
          // it has no consumers in the new code path.
          delete p.tutorialCompleted;
          return {
            ...p,
            tutorialFlags: {
              onboarding: legacyOnboardingDone,
              firstCaseFlow: false,
            },
          } as GameStore;
        }
        if (version === 3) {
          return persisted as GameStore;
        }
        // Future-you bumped the version without writing a migration step.
        // Returning undefined would crash hydration silently; throwing
        // surfaces the missing migration during the next dev launch.
        throw new Error(
          `[stridekeep] no migration registered for persist version ${version}`,
        );
      },
      // seasonPalette + seasonCraftRecipes + canvas state are server data,
      // re-fetched on every launch / rollover / canvas mount — never persist.
      // pendingSeasonEnd / pendingCaseReveal are transient: force-quit
      // mid-ceremony / mid-reveal must NOT re-fire the modal on next
      // boot (the inventory effect of the case open is already
      // committed; the season ceremony recomputes from server state).
      // selfPlacementMarks are session-scoped — a placement initiated
      // before quit shouldn't render a heavy pulse two days later when
      // the realtime echo finally lands.
      partialize: (state) => {
        const {
          seasonPalette: _p,
          seasonCraftRecipes: _r,
          canvasTargetPixels: _t,
          canvasFilled: _f,
          teamsCanvasProgress: _tp,
          pendingSeasonEnd: _pse,
          pendingCaseReveal: _pcr,
          pendingTileFlight: _ptf,
          selfPlacementMarks: _spm,
          // Tutorial overlay state is per-session. Only `tutorialFlags`
          // persists (one-shot bools for onboarding + each JIT flow);
          // everything below is transient and resets to its initialState
          // value on each launch (overlay closed, on the Mural sub-tab).
          onboardingActive: _oa,
          onboardingCardIdx: _oci,
          tutorialActiveFlow: _taf,
          tutorialFlowStep: _tfs,
          tutorialFlowColorId: _tfc,
          tutorialTargetRect: _ttr,
          activeSubTab: _ast,
          ...rest
        } = state;
        return rest as GameStore;
      },
      // Phase-3 → Phase-4 schema rescue. Detects the old shape post-rehydrate
      // and resets every Phase-4 field to clean defaults. See
      // looksLikePhase3State and the migrate-comment above for why this
      // can't live in `migrate`.
      //
      // Implementation note: this uses default merge-mode setState, NOT
      // replace mode. With replace=true Zustand would wipe the action
      // functions too (they're stored alongside state) and the verbose
      // pick-and-restore-every-action would invite drift. Merge mode means
      // every key in initialState overrides the contaminated current value
      // (inventory: KeptItem[] → Record<string, number>, etc.). Phase-3-
      // only fields like forTheTown / strideLevel that aren't in
      // initialState linger in memory as dead weight for this session
      // only — they aren't read by any Phase-4 code path, and the next
      // launch reads cleared storage and starts fresh.
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        if (looksLikePhase3State(state as unknown as Record<string, unknown>)) {
          void useGameStore.persist.clearStorage();
          useGameStore.setState(initialState);
          console.warn(
            '[stridekeep] detected Phase-3 persisted state; cleared storage and reset Phase-4 fields',
          );
        }
      },
    },
  ),
);
