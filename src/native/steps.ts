import {
  getHealthConnectStatus,
  ensureStepsPermission as ensureHcStepsPermission,
  readDailySteps as readDailyStepsFromHc,
} from './healthConnect';
import {
  isStepCounterAvailable,
  ensureStepCounterPermission,
  readDailyStepsFromCounter,
} from './stepCounter';

// Sync result returned by syncSteps(). Source records WHICH path
// actually delivered the count (so the store + gate can react to
// fall-through), and steps is the daily total in the same shape
// `applyRealSteps` expects — or null if no source could deliver.
export interface StepsSyncResult {
  source: StepsSource;
  steps: number | null;
}

// The unified step-source facade. Two real sources (Health Connect +
// the custom Sensor.TYPE_STEP_COUNTER module) plus an 'unavailable'
// terminal. Resolution order is INTENTIONAL:
//   1. Try HC first. When present (Android 14+ system service OR
//      a user-installed HC on Android 13-) it's strictly better than
//      the sensor — multi-source aggregation (Fitbit / Wear OS /
//      Samsung Health), historical query before app launch, no
//      midnight-baseline math, no reboot edge cases.
//   2. Fall back to the custom step-counter module. Reads the same
//      hardware sensor every Android step-tracker app used before HC
//      was the unified layer. Works without HC, no install prompt,
//      no persistent notification. Trade-off: phone-pedometer only
//      (no wearable steps).
//   3. 'unavailable' terminal — device has neither HC capable of
//      working nor a step counter sensor. The gate UI surfaces a
//      dead-end message so the user understands why nothing is
//      tracking.
//
// "step-counter" is the second-class citizen on purpose. Most users
// already have HC (built into Android 14+) and will get it; those
// who don't can play the game frictionlessly via the sensor. Only
// the small intersection of "no HC + has-a-watch" loses something
// meaningful (their watch steps), and they can opt back into HC at
// any time by installing it.
export type StepsSource = 'health-connect' | 'step-counter' | 'unavailable';

// Full step-source orchestration with permission-denial fall-through.
// This is the single entry point App.tsx calls per cold-start or
// foreground transition. It tries each source in priority order, and
// IMPORTANTLY falls through on permission denial — not just on source
// unavailability:
//   1. HC SDK available?
//      → request HC permission → granted? read HC steps, return.
//      → denied? continue to (2). This is the case where the user
//        revoked Stridekeep's permission inside Health Connect; we
//        don't strand them, we fall back to the sensor.
//   2. Step counter sensor available?
//      → request ACTIVITY_RECOGNITION → granted? read sensor, return.
//      → denied? continue to (3).
//   3. Both failed — return 'unavailable' so the gate UI shows.
//
// Returns the source that ACTUALLY produced data (which may differ
// from the highest-priority available source if permission was denied
// upstream). App.tsx writes this into the store so HealthConnectGate
// only fires for the terminal 'unavailable' case.
export async function syncSteps(): Promise<StepsSyncResult> {
  const hcStatus = await getHealthConnectStatus();
  if (hcStatus === 'available') {
    const granted = await ensureHcStepsPermission();
    if (granted) {
      const steps = await readDailyStepsFromHc();
      return { source: 'health-connect', steps };
    }
    // HC installed + ready but the user revoked Stridekeep's permission
    // (or denied the initial prompt). HC's permission UI uses "don't
    // ask again" by default on subsequent requests, so we can't reliably
    // re-prompt — fall through to the sensor instead.
  }

  const counterAvailable = await isStepCounterAvailable();
  if (counterAvailable) {
    const granted = await ensureStepCounterPermission();
    if (granted) {
      const steps = await readDailyStepsFromCounter();
      return { source: 'step-counter', steps };
    }
    // Sensor available but ACTIVITY_RECOGNITION was denied. Fall through
    // to 'unavailable' so the gate explains what's happening.
  }

  return { source: 'unavailable', steps: null };
}
