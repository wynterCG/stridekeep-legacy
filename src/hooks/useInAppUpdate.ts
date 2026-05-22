import { Platform } from 'react-native';
import SpInAppUpdates, {
  IAUUpdateKind,
  type StartUpdateOptions,
} from 'sp-react-native-in-app-updates';

/**
 * Hook to manage native in-app update checks on startup.
 * Integrates Google Play In-App Updates (Android) and Siren (iOS).
 * Degrades gracefully on emulators, non-Google ROMs, and offline mode.
 */
export const useInAppUpdate = () => {
  const checkUpdate = async (onComplete: (hasUpdate: boolean) => void) => {
    try {
      // In-app updates are only supported on physical devices with Google Play (Android)
      // or App Store (iOS). We instantiate the updater with debug logs in dev environment.
      const inAppUpdates = new SpInAppUpdates(__DEV__);

      console.log('[Stridekeep Auto-Update] Querying store for updates...');
      const result = await inAppUpdates.checkNeedsUpdate();

      if (result.shouldUpdate) {
        console.log(
          `[Stridekeep Auto-Update] Update available: storeVersion=${result.storeVersion}. Triggering IMMEDIATE update flow.`
        );

        let updateOptions: StartUpdateOptions = {};
        if (Platform.OS === 'android') {
          // Play Store immediate update is a native full-screen blocking UI.
          // Once the download finishes, the Play Store automatically restarts the app.
          updateOptions = {
            updateType: IAUUpdateKind.IMMEDIATE,
          };
        } else {
          // App Store Siren-based update prompts the user and deep-links to App Store.
          updateOptions = {
            title: 'Update Available',
            message: 'A new version of Stridekeep is available. Please update to continue playing.',
            buttonUpgradeText: 'Update Now',
            buttonCancelText: 'Later',
          };
        }

        await inAppUpdates.startUpdate(updateOptions);
        onComplete(true);
      } else {
        console.log('[Stridekeep Auto-Update] App is up to date.');
        onComplete(false);
      }
    } catch (error) {
      // Catch native errors gracefully (e.g. running on emulator, developer error, offline, etc.)
      console.warn('[Stridekeep Auto-Update] Check failed gracefully:', error);
      onComplete(false);
    }
  };

  return { checkUpdate };
};
