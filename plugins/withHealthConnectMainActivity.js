const { withMainActivity } = require('@expo/config-plugins');

/**
 * react-native-health-connect requires HealthConnectPermissionDelegate.setPermissionDelegate(this)
 * to be called from MainActivity#onCreate so its ActivityResultLauncher (the lateinit
 * `requestPermission`) gets registered before any JS-triggered permission request.
 *
 * The upstream config plugin only patches AndroidManifest, NOT MainActivity. Without this
 * registration the app crashes with:
 *   kotlin.UninitializedPropertyAccessException: lateinit property requestPermission has not
 *   been initialized
 * the moment requestPermission() is called from JS.
 */
const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const REGISTER_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectMainActivity(config) {
  return withMainActivity(config, async (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error(
        'withHealthConnectMainActivity only supports Kotlin MainActivity (got ' +
          cfg.modResults.language +
          ').',
      );
    }

    let src = cfg.modResults.contents;

    if (!src.includes(IMPORT_LINE)) {
      const after = src.replace(
        /^(package [^\n]+\n)/m,
        `$1\n${IMPORT_LINE}\n`,
      );
      if (after === src) {
        throw new Error(
          'withHealthConnectMainActivity: failed to inject import — no `package ...` line found in MainActivity.kt.',
        );
      }
      src = after;
    }

    if (!src.includes(REGISTER_CALL)) {
      const ON_CREATE = /super\.onCreate\([^)]*\)/;
      const match = src.match(ON_CREATE);
      if (!match) {
        throw new Error(
          'withHealthConnectMainActivity: failed to inject setPermissionDelegate — no `super.onCreate(...)` call found in MainActivity.kt.',
        );
      }
      src = src.replace(ON_CREATE, `${match[0]}\n    ${REGISTER_CALL}`);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
