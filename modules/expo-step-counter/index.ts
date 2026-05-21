import { requireNativeModule } from 'expo';
import type { PermissionResponse } from 'expo-modules-core';

// Bare native bindings for the custom Android step counter module.
// Higher-level persistence + delta math lives in src/native/stepCounter.ts;
// this file is just the typed wrapper around the native AsyncFunctions.
interface ExpoStepCounter {
  isAvailableAsync(): Promise<boolean>;
  getCumulativeStepsAsync(): Promise<number>;
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
}

const ExpoStepCounter = requireNativeModule<ExpoStepCounter>('ExpoStepCounter');

export default ExpoStepCounter;
