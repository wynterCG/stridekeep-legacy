import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import SettingsRow from './SettingsRow';
import AccountSection from '../screens/settings/AccountSection';
import PrivacySection from '../screens/settings/PrivacySection';
import NotificationsSection from '../screens/settings/NotificationsSection';
import AboutSection from '../screens/settings/AboutSection';
import { colors, fonts, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Section = 'list' | 'account' | 'privacy' | 'notifications' | 'about';

const SECTION_LABELS: Record<Exclude<Section, 'list'>, string> = {
  account: 'ACCOUNT',
  privacy: 'PRIVACY',
  notifications: 'NOTIFICATIONS',
  about: 'ABOUT',
};

// Settings shell. Replaces AccountModal as the gear-icon target;
// hosts a 4-row drill-in list (Account / Privacy / Notifications /
// About) and switches into per-section views on tap. Pure router —
// each section component owns its own logic.
//
// Login state surfaces ONLY on the Account row's status snippet (per
// design choice — gear icon stays neutral). The status is loaded
// fresh each time the modal opens so a session-swap elsewhere
// (sign-out via expiry, etc.) doesn't show stale "Linked" copy.
export default function SettingsModal({
  visible,
  onClose,
}: Props): React.JSX.Element {
  const [section, setSection] = useState<Section>('list');
  // Read auth state directly from the store. Bootstrap hydrates these
  // on cold-start; AccountSection writes them on link / sign-in /
  // sign-out. Subscribing here (vs an async getSession() call) means
  // the snippet is always in sync with the source of truth — no
  // stale "Anonymous" read after a successful link, no race with
  // Supabase's session-cache refresh.
  const accountLinked = useGameStore((s) => s.accountLinked);
  const accountEmail = useGameStore((s) => s.accountEmail);

  // Reset to list view every time the modal opens fresh.
  useEffect(() => {
    if (!visible) return;
    setSection('list');
  }, [visible]);

  const accountStatusSnippet =
    accountLinked && accountEmail !== null
      ? `Linked: ${accountEmail}`
      : accountLinked
        ? 'Linked'
        : 'Anonymous';

  const renderSection = () => {
    switch (section) {
      case 'account':
        return <AccountSection />;
      case 'privacy':
        return <PrivacySection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'about':
        return <AboutSection />;
      case 'list':
        return (
          <View>
            <SettingsRow
              label="Account"
              status={accountStatusSnippet}
              onPress={() => setSection('account')}
            />
            <SettingsRow label="Privacy" onPress={() => setSection('privacy')} />
            <SettingsRow
              label="Notifications"
              onPress={() => setSection('notifications')}
            />
            <SettingsRow label="About" onPress={() => setSection('about')} />
          </View>
        );
    }
  };

  const headerLabel =
    section === 'list' ? '⚙  SETTINGS' : `←  ${SECTION_LABELS[section]}`;

  const handleHeaderPress = () => {
    if (section === 'list') return;
    setSection('list');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      // Status bar inset is handled by SafeAreaView edges below; no
      // need to set statusBarTranslucent here.
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleHeaderPress}
                disabled={section === 'list'}
                hitSlop={8}
              >
                <Text style={styles.header}>{headerLabel}</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.closeBtn}>CLOSE</Text>
              </Pressable>
            </View>

            {renderSection()}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  header: {
    fontFamily: fonts.outfitBlack,
    fontSize: 22,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  closeBtn: {
    fontFamily: fonts.outfitBold,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
