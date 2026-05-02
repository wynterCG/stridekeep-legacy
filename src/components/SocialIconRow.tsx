import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import IconShare from './icons/IconShare';
import IconGlobe from './icons/IconGlobe';
import IconBuyMeACoffee from './icons/IconBuyMeACoffee';
import IconPatreon from './icons/IconPatreon';
import IconDiscord from './icons/IconDiscord';
import IconGear from './icons/IconGear';
import { tapLight } from '../lib/haptics';
import { colors, spacing } from '../theme';

interface Props {
  onSettings: () => void;
}

// TopHeader's right-cluster: 5 social/community access points + a settings
// gear. Per the locked redesign:
// - share + globe = teal-tinted (community/sharing affordance)
// - BMC + Patreon = brand-coloured (support/donate)
// - Discord = blurple + dashed border + dimmed (flagged "coming soon")
// - gear = brass-light (system/settings, opens AccountModal)
//
// Social buttons are VISUAL PLACEHOLDERS in v1 — onPress is a no-op
// (or just light haptic). Wire up Linking.openURL / Share.share /
// Discord-invite-URL in a follow-up pass once the URLs/Patreon page
// exist. The brand SVGs are bundled locally (src/components/icons/),
// not loaded from a CDN at runtime.
export default function SocialIconRow({ onSettings }: Props): React.JSX.Element {
  return (
    <View style={styles.row}>
      <PixelButton onPress={tapLight} accessibilityLabel="Share Play Store link">
        <IconShare />
      </PixelButton>
      <PixelButton onPress={tapLight} accessibilityLabel="stridekeep.app website">
        <IconGlobe />
      </PixelButton>
      <PixelButton onPress={tapLight} accessibilityLabel="Buy Me a Coffee">
        <IconBuyMeACoffee />
      </PixelButton>
      <PixelButton onPress={tapLight} accessibilityLabel="Patreon">
        <IconPatreon />
      </PixelButton>
      <PixelButton
        onPress={tapLight}
        accessibilityLabel="Discord (coming soon)"
        style={styles.discordBtn}
      >
        <IconDiscord />
      </PixelButton>
      <PixelButton
        onPress={() => {
          tapLight();
          onSettings();
        }}
        accessibilityLabel="Settings"
      >
        <IconGear color={colors.accent.brassLight} />
      </PixelButton>
    </View>
  );
}

interface BtnProps {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  style?: object;
}

function PixelButton({ onPress, accessibilityLabel, children, style }: BtnProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [
        styles.btn,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  btn: {
    width: 28,
    height: 28,
    backgroundColor: colors.bg.card,
    borderWidth: 2,
    borderColor: colors.accent.brassDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: colors.bg.cardHi,
  },
  discordBtn: {
    borderStyle: 'dashed',
    opacity: 0.7,
  },
});

// One-line export of all the underlying icon components in case a future
// surface (e.g. an "About" sheet) wants to render the same brand glyphs
// without going through this row component. Kept here so the icon
// imports above are co-located with their usage and the icons/ folder
// stays a pure asset dir.
export {
  IconShare,
  IconGlobe,
  IconBuyMeACoffee,
  IconPatreon,
  IconDiscord,
  IconGear,
};
