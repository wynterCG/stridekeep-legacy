import * as Haptics from 'expo-haptics';

// Thin wrappers around expo-haptics. Centralised so a future "haptics off"
// accessibility setting touches one file. Calls are fire-and-forget — we
// don't await the promise (haptic completion isn't on any UX critical path)
// and we don't catch errors (older devices / vibration disabled silently
// no-op via a rejected promise we ignore).

export const tapLight = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const tapMedium = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const tapHeavy = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

export const success = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
