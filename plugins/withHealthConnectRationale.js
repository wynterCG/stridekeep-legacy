const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android 14+ Health Connect requires an activity-alias declaring it handles
 * VIEW_PERMISSION_USAGE under the HEALTH_PERMISSIONS category. Without it, the
 * permissions screen returns to a dead end and grants are silently revoked on
 * some Samsung One UI builds.
 *
 * The upstream react-native-health-connect plugin only adds the Android <=13
 * rationale intent-filter on MainActivity. This complements it.
 */
module.exports = function withHealthConnectRationale(config) {
  return withAndroidManifest(config, async (cfg) => {
    const application = cfg.modResults.manifest.application[0];

    application['activity-alias'] = application['activity-alias'] || [];

    const exists = application['activity-alias'].some(
      (a) => a.$?.['android:name'] === 'ViewPermissionUsageActivity',
    );
    if (exists) return cfg;

    application['activity-alias'].push({
      $: {
        'android:name': 'ViewPermissionUsageActivity',
        'android:exported': 'true',
        'android:targetActivity': '.MainActivity',
        'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } },
          ],
        },
      ],
    });

    return cfg;
  });
};
