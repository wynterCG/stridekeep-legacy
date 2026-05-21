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

// Probes both sources and returns the FIRST that's available. Cheap
// (<200ms on the slow path; <50ms when HC is the answer). Caller
// (App.tsx) runs this on cold start + every foreground transition;
// the store field stays fresh as users install/uninstall HC between
// sessions or grant/revoke permissions.
export async function detectStepsSource(): Promise<StepsSource> {
  const hcStatus = await getHealthConnectStatus();
  if (hcStatus === 'available') return 'health-connect';
  const counterAvailable = await isStepCounterAvailable();
  if (counterAvailable) return 'step-counter';
  return 'unavailable';
}

// Source-aware permission ensure. The HC path uses the package's
// permission flow (a system dialog routed via HealthConnectPermissionDelegate);
// the step-counter path uses our custom module's ACTIVITY_RECOGNITION
// runtime request. Same boolean return so App.tsx doesn't need to fork
// downstream logic.
export async function ensureStepsPermission(
  source: StepsSource,
): Promise<boolean> {
  if (source === 'health-connect') return ensureHcStepsPermission();
  if (source === 'step-counter') return ensureStepCounterPermission();
  return false;
}

// Source-aware daily step read. Both paths return "today's step count
// since local midnight" in the same shape so the existing
// applyRealSteps action in the store doesn't need to know which source
// produced the number. Note: on the step-counter path, the FIRST read
// after install returns 0 (we need a baseline before we can compute
// deltas) — the next foreground transition is when real numbers start
// flowing. Documented in stepCounter.ts.
export async function readDailySteps(source: StepsSource): Promise<number> {
  if (source === 'health-connect') return readDailyStepsFromHc();
  if (source === 'step-counter') return readDailyStepsFromCounter();
  return 0;
}
