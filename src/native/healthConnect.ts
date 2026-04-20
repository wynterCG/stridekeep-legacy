import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
} from 'react-native-health-connect';

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
