module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin MUST be the last entry. The plugin
    // hoists worklet declarations and breaks if other plugins run after.
    // We're pinned to Reanimated v3.x because v4 requires the new
    // architecture, which conflicts with react-native-health-connect@3.5.0
    // (see project_stridekeep memory). Re-evaluate when Health Connect
    // ships a bridgeless-compatible release.
    plugins: ['react-native-reanimated/plugin'],
  };
};
