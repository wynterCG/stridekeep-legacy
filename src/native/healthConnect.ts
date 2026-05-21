import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type HealthConnectStatus =
  | 'available'
  | 'needs-install'
  | 'unsupported'
  | 'unknown';

// Probes whether the Health Connect SDK / provider is usable on this
// device. Three meaningful outcomes:
//   - 'available'     — Health Connect installed + ready, proceed to
//                       initialize + requestPermission.
//   - 'needs-install' — device CAN use Health Connect but the provider
//                       app isn't installed (Android 13 and below) or
//                       the system provider needs updating. Deep-link
//                       the user to Play Store via HealthConnectGate.
//   - 'unsupported'   — device is too old (pre-Android 8) or otherwise
//                       can't run Health Connect. Surface a dead-end
//                       message; nothing we can do.
// A 4th 'unknown' state is reserved for "we haven't probed yet" — only
// the store uses it; this function always resolves to one of the three
// concrete statuses. On native errors (unexpected — usually means the
// package failed to link) we return 'unsupported' so the gate at least
// renders SOMETHING rather than letting the app silently fail to sync
// steps.
export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'needs-install';
    }
    return 'unsupported';
  } catch (err) {
    console.warn('[stridekeep] getSdkStatus failed:', err);
    return 'unsupported';
  }
}

export async function ensureStepsPermission(): Promise<boolean> {
  await initialize();
  const granted = await getGrantedPermissions();
  if (
    granted.some(
      (p) => p.recordType === 'Steps' && p.accessType === 'read',
    )
  ) {
    return true;
  }
  const fresh = await requestPermission([
    { accessType: 'read', recordType: 'Steps' },
  ]);
  return fresh.some(
    (p) => p.recordType === 'Steps' && p.accessType === 'read',
  );
}

export async function readDailySteps(): Promise<number> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { records } = await readRecords('Steps', {
    timeRangeFilter: {
      operator: 'after',
      startTime: midnight.toISOString(),
    },
  });
  return records.reduce((sum, r) => sum + r.count, 0);
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
