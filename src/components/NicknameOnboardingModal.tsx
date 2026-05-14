import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useGameStore } from '../store/gameStore';
import { setMyNickname } from '../lib/account';
import { tapLight } from '../lib/haptics';
import { colors, fonts, radii, spacing } from '../theme';

// Format of the auto-default assigned by handle_new_user trigger in
// migration 0006: 'Stridekeeper-' + first 6 hex chars of the user's
// UUID (with dashes stripped). When the player's nickname matches
// this pattern, they haven't picked one yet — we prompt before
// letting them play. Custom nicknames don't match (different prefix
// OR custom-set name) so the modal stays unmounted.
const DEFAULT_NICKNAME_PATTERN = /^Stridekeeper-[a-f0-9]{6}$/;

const MIN_LEN = 3;
const MAX_LEN = 20;

// First-launch nickname onboarding. Mounted at App root, self-gates
// on `nickname` from gameStore — null while bootstrap is in flight,
// `Stridekeeper-XXXXXX` immediately after first server signup, custom
// once the player has set one. Returns null in the first and third
// cases so it has zero overhead in the common path.
//
// Server is the source of truth. We don't track a client-side
// "nickname_set" flag because (a) sign-out → new anon assigns a new
// auto-default which the format check naturally re-detects, and (b)
// avoiding the flag keeps the migration footprint zero (the SQL trigger
// + RPC shipped in 0006 are everything the server needs).
//
// The modal is INTENTIONALLY blocking — no backdrop tap, no Android
// back-button dismiss, no CLOSE button. The player must pick a name
// before reaching the canvas. This matches the privacy-policy
// expectation that user-generated identifiers are explicitly
// opted-into rather than assigned silently.
export default function NicknameOnboardingModal(): React.JSX.Element | null {
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const needsPrompt =
    nickname !== null && DEFAULT_NICKNAME_PATTERN.test(nickname);

  if (!needsPrompt) return null;

  const trimmedLen = input.trim().length;
  const validLen = trimmedLen >= MIN_LEN && trimmedLen <= MAX_LEN;
  const submitDisabled = busy || !validLen;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    setBusy(true);
    setErrorMsg(null);
    const result = await setMyNickname(input);
    setBusy(false);
    if (result.ok) {
      tapLight();
      setNickname(result.nickname);
      // Modal unmounts on the next render because needsPrompt flips
      // false — the new nickname won't match DEFAULT_NICKNAME_PATTERN.
      return;
    }
    if (result.error === 'too_short') {
      setErrorMsg(`At least ${MIN_LEN} characters, please.`);
    } else if (result.error === 'too_long') {
      setErrorMsg(`At most ${MAX_LEN} characters.`);
    } else if (result.error === 'network_error') {
      setErrorMsg('Network error. Try again in a moment.');
    } else {
      setErrorMsg('Could not save nickname. Try again.');
    }
  };

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="fade"
      // Android back-button is a no-op — first-launch is mandatory.
      // Returning nothing from onRequestClose keeps the modal up.
      onRequestClose={() => {}}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.kicker}>WELCOME TO STRIDEKEEP</Text>
            <Text style={styles.headline}>Pick your nickname</Text>
            <Text style={styles.body}>
              Other players will see this on the live feed when you place
              tiles or open cases.
            </Text>

            <TextInput
              value={input}
              onChangeText={(t) => {
                setInput(t);
                if (errorMsg) setErrorMsg(null);
              }}
              maxLength={MAX_LEN}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              placeholder="3-20 characters"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              editable={!busy}
            />
            <Text
              style={[styles.counter, validLen ? styles.counterOk : null]}
            >{`${trimmedLen}/${MAX_LEN}`}</Text>

            <Pressable
              style={[styles.primaryBtn, submitDisabled && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitDisabled}
            >
              {busy ? (
                <ActivityIndicator color={colors.text.cream} />
              ) : (
                <Text style={styles.primaryBtnText}>CONFIRM</Text>
              )}
            </Pressable>

            {errorMsg !== null && (
              <Text style={styles.errorLine}>{errorMsg}</Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 2, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bg.card,
    borderWidth: 2.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.accent.brassDeep,
    letterSpacing: 2.5,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headline: {
    fontFamily: fonts.outfitBlack,
    fontSize: 22,
    color: colors.text.cream,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.bg.primary,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.outfitRegular,
    fontSize: 16,
    color: colors.text.cream,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
  },
  counter: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  counterOk: {
    color: colors.accent.brassDeep,
    fontFamily: fonts.outfitExtraBold,
  },
  primaryBtn: {
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
    borderColor: colors.ui.border,
  },
  primaryBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  errorLine: {
    fontFamily: fonts.outfitBold,
    fontSize: 13,
    color: colors.team.redSoft,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
