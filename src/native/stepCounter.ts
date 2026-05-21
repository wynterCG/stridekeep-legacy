import AsyncStorage from '@react-native-async-storage/async-storage';
import ExpoStepCounter from '../../modules/expo-step-counter';
import { todayKey } from './healthConnect';

// AsyncStorage keys for the step-counter fallback state. The hardware
// sensor exposes "cumulative steps since last device boot"; we maintain
// our own daily counter on top of it by:
//   - Saving the last-known cumulative value (delta math anchor)
//   - Saving today's accumulated count (the number we feed the game)
//   - Saving today's date (for midnight rollover detection)
const STORAGE_KEYS = {
  lastCumulative: 'stepCounter.lastCumulative',
  todayCount: 'stepCounter.todayCount',
  todayDate: 'stepCounter.todayDate',
} as const;

// Outlier guard. A single delta this large between two app foregrounds
// is almost certainly a sensor glitch or a stale persisted baseline
// crossing a reboot we failed to detect (rare but possible). Treat as
// "take a fresh baseline, skip this update" rather than crediting the
// user with 50k phantom steps.
const MAX_REASONABLE_DELTA = 50000;

// Probes whether the device has a Sensor.TYPE_STEP_COUNTER at all. Used
// by the steps.ts facade to decide between the HC path and the sensor
// fallback. Returns false on any native error (defensive — we'd rather
// fall through to the unavailable gate than crash boot).
export async function isStepCounterAvailable(): Promise<boolean> {
  try {
    return await ExpoStepCounter.isAvailableAsync();
  } catch (err) {
    console.warn('[stridekeep] isStepCounterAvailable failed:', err);
    return false;
  }
}

// Requests ACTIVITY_RECOGNITION at runtime (Android 10+). Pre-Android 10
// the permission is implicit and the native module returns granted=true
// without showing a prompt. Returns false if user denies; the caller
// (steps.ts) then surfaces the unavailable gate.
export async function ensureStepCounterPermission(): Promise<boolean> {
  try {
    const current = await ExpoStepCounter.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const fresh = await ExpoStepCounter.requestPermissionsAsync();
    return fresh.granted;
  } catch (err) {
    console.warn('[stridekeep] ensureStepCounterPermission failed:', err);
    return false;
  }
}

// Reads the hardware sensor's current cumulative count, computes the
// delta vs the last persisted reading, accumulates it into today's
// total, and returns "steps today" in the same shape as HC's
// readDailySteps. Edge cases:
//   - Midnight rollover (savedDate !== today) → reset todayCount to 0,
//     take a fresh baseline (no carry-over from yesterday).
//   - Reboot detected (cumulative < lastCumulative) → don't add the
//     negative delta; today's count is preserved, cumulative reset to
//     the new low value.
//   - Outlier delta (>= MAX_REASONABLE_DELTA) → ignore the update, take
//     a fresh baseline. The user effectively loses one update worth of
//     steps in exchange for not getting credited with thousands of
//     phantom steps from a sensor glitch.
//   - First-ever call on this device (no persisted lastCumulative) →
//     just save the baseline; return 0 for this read. The user won't
//     see steps until their NEXT call (typically the next foreground
//     transition) when we have a baseline to diff against. This matches
//     the inherent limitation of "no historical query on Android sensor"
//     — we genuinely don't know how many steps were walked before our
//     first read.
export async function readDailyStepsFromCounter(): Promise<number> {
  const cumulative = await ExpoStepCounter.getCumulativeStepsAsync();
  const today = todayKey();

  const [savedDate, savedTodayStr, savedLastStr] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.todayDate),
    AsyncStorage.getItem(STORAGE_KEYS.todayCount),
    AsyncStorage.getItem(STORAGE_KEYS.lastCumulative),
  ]);

  let todayCount = Number(savedTodayStr ?? '0');
  const lastCumulative = savedLastStr != null ? Number(savedLastStr) : null;

  // Midnight rollover. Reset today's accumulator but keep the cumulative
  // baseline so the delta math stays valid across days (sensor doesn't
  // reset at midnight; only at device reboot).
  if (savedDate !== today) {
    todayCount = 0;
    await AsyncStorage.setItem(STORAGE_KEYS.todayDate, today);
  }

  if (lastCumulative !== null) {
    const delta = cumulative - lastCumulative;
    if (delta > 0 && delta < MAX_REASONABLE_DELTA) {
      todayCount += delta;
    }
    // delta < 0 → reboot or sensor counter reset. Take the new value as
    //              baseline without crediting any steps; today's count
    //              is preserved.
    // delta === 0 → no movement since last read; nothing to add.
    // delta >= MAX_REASONABLE_DELTA → outlier guard. Skip credit, take
    //                                 fresh baseline.
  }

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.lastCumulative, String(cumulative)),
    AsyncStorage.setItem(STORAGE_KEYS.todayCount, String(todayCount)),
  ]);

  return todayCount;
}
