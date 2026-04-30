import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import {
  linkEmailPassword,
  signInWithEmailPassword,
  signOutAccount,
  getAccountStatus,
  type AccountStatus,
  type LinkResult,
  type SignInResult,
} from '../lib/account';
import { bootstrapAuthAndSeason } from '../lib/bootstrap';
import { success } from '../lib/haptics';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type ModalView =
  | { kind: 'status' }
  | { kind: 'link-form' }
  | { kind: 'signin-form' };

const MIN_PASSWORD = 8;

// Optional-account-upgrade modal. Shows the player's current sign-in
// state (anon vs linked email) and offers explicit actions to upgrade,
// recover, or sign out. Anon stays the default cold-start behaviour;
// nothing in this modal runs unless the user opens it.
//
// Forms validate locally (email contains '@', password length) before
// hitting Supabase. Server errors map to a single inline line so the
// player can retry without losing input.
//
// On successful sign-in OR sign-out, we wipe the local Zustand store
// and call bootstrapAuthAndSeason() to re-populate from whichever UUID
// is now active. Linking does NOT trigger a reset — the UUID is
// preserved and all data carries through.
export default function AccountModal({ visible, onClose }: Props): React.JSX.Element {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [view, setView] = useState<ModalView>({ kind: 'status' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Refresh status every time the modal opens. Cheap (one local
  // getSession() call) and avoids stale-state UI when the player
  // signs out elsewhere or session expiry shifts the discriminant.
  useEffect(() => {
    if (!visible) return;
    setView({ kind: 'status' });
    setEmail('');
    setPassword('');
    setError(null);
    void getAccountStatus().then(setStatus).catch(() => setStatus({ kind: 'anon' }));
  }, [visible]);

  const validateForm = (): string | null => {
    // Cheap client-side gate; server is the real validator.
    if (!email.includes('@')) return 'Enter a valid email.';
    if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
    return null;
  };

  // After a session swap (sign-in or sign-out), every previous-account
  // value in the local store and on disk needs to be wiped before the
  // bootstrap chain re-populates from the new UUID. Failure mode if we
  // skip clearStorage: the persist middleware can flush a stale value
  // to AsyncStorage during the gap, and a force-kill mid-bootstrap
  // leaves the previous account's purse/inventory on disk under the
  // new anon UUID.
  const swapSession = async () => {
    await useGameStore.persist.clearStorage();
    useGameStore.getState().resetSessionState();
    await bootstrapAuthAndSeason();
  };

  const handleLink = async () => {
    const v = validateForm();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    const result: LinkResult = await linkEmailPassword(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(linkErrorMessage(result));
      return;
    }
    // Same UUID — no store reset needed. Just refresh the status view.
    useGameStore.getState().setAccountLinked(true);
    success();
    setStatus({ kind: 'linked', email: email.trim() });
    setView({ kind: 'status' });
    setPassword('');
  };

  const handleSignIn = async () => {
    const v = validateForm();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    const result: SignInResult = await signInWithEmailPassword(email.trim(), password);
    if (!result.ok) {
      setBusy(false);
      setError(signInErrorMessage(result));
      return;
    }
    // Different UUID now active — clear persisted blob, reset in-memory
    // store, then re-bootstrap so the new account's data loads. The
    // bootstrap re-hydrates `accountLinked` via getAccountStatus, so we
    // don't need to setAccountLinked here.
    await swapSession();
    setBusy(false);
    success();
    setStatus({ kind: 'linked', email: email.trim() });
    setView({ kind: 'status' });
    setPassword('');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      "You'll go back to a fresh anonymous account. Your linked account stays safe — sign in to recover it.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await signOutAccount();
              await swapSession();
              success();
              setStatus({ kind: 'anon' });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Sign out failed.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // While an auth call is in flight (sign-in / sign-out), an Android
      // back gesture would otherwise dismiss the modal mid-network. Block
      // the dismiss so the busy state remains tied to the modal lifecycle
      // and busy can't survive an unmount-remount.
      onRequestClose={busy ? () => {} : onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <Text style={styles.header}>ACCOUNT</Text>
              <Pressable onPress={onClose} disabled={busy}>
                <Text style={styles.closeBtn}>CLOSE</Text>
              </Pressable>
            </View>

            {status === null ? (
              <Text style={styles.dim}>Loading…</Text>
            ) : view.kind === 'status' ? (
              <StatusView
                status={status}
                onLink={() => {
                  setError(null);
                  setEmail('');
                  setPassword('');
                  setView({ kind: 'link-form' });
                }}
                onSignIn={() => {
                  setError(null);
                  setEmail('');
                  setPassword('');
                  setView({ kind: 'signin-form' });
                }}
                onSignOut={handleSignOut}
                busy={busy}
              />
            ) : (
              <FormView
                kind={view.kind}
                email={email}
                password={password}
                error={error}
                busy={busy}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={view.kind === 'link-form' ? handleLink : handleSignIn}
                onCancel={() => {
                  setView({ kind: 'status' });
                  setError(null);
                  setEmail('');
                  setPassword('');
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function StatusView({
  status,
  onLink,
  onSignIn,
  onSignOut,
  busy,
}: {
  status: AccountStatus;
  onLink: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  busy: boolean;
}): React.JSX.Element {
  if (status.kind === 'linked') {
    return (
      <View>
        <Text style={styles.kicker}>SIGNED IN</Text>
        <Text style={styles.email}>{status.email}</Text>
        <Text style={styles.body}>
          Your badges and team travel with this account. Sign in on another phone to
          continue where you left off.
        </Text>
        <Pressable
          style={[styles.dangerBtn, busy && styles.btnDisabled]}
          onPress={onSignOut}
          disabled={busy}
        >
          <Text style={styles.dangerBtnText}>{busy ? 'WORKING…' : 'SIGN OUT'}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.kicker}>ANONYMOUS PLAYER</Text>
      <Text style={styles.body}>
        Add an email and password to keep your team and badges if you switch phones.
        You can keep playing without an account — this is optional.
      </Text>
      <Pressable
        style={[styles.primaryBtn, busy && styles.btnDisabled]}
        onPress={onLink}
        disabled={busy}
      >
        <Text style={styles.primaryBtnText}>LINK ACCOUNT</Text>
      </Pressable>
      <Pressable
        style={[styles.secondaryBtn, busy && styles.btnDisabled]}
        onPress={onSignIn}
        disabled={busy}
      >
        <Text style={styles.secondaryBtnText}>SIGN IN ON THIS DEVICE</Text>
      </Pressable>
      <Text style={styles.fineprint}>
        Forgot your password? Email support@stridekeep.app for now — recovery in-app
        is coming soon.
      </Text>
    </View>
  );
}

function FormView({
  kind,
  email,
  password,
  error,
  busy,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onCancel,
}: {
  kind: 'link-form' | 'signin-form';
  email: string;
  password: string;
  error: string | null;
  busy: boolean;
  onEmailChange: (s: string) => void;
  onPasswordChange: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const isLink = kind === 'link-form';
  return (
    <View>
      <Text style={styles.kicker}>{isLink ? 'LINK ACCOUNT' : 'SIGN IN'}</Text>
      {!isLink && (
        <Text style={styles.body}>
          Signing in replaces this device's anonymous data with your account's team and
          badges.
        </Text>
      )}
      {isLink && (
        <Text style={styles.body}>
          Choose an email and password. Your team, badges, and inventory stay exactly
          where they are.
        </Text>
      )}
      <Text style={styles.label}>EMAIL</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={onEmailChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        placeholderTextColor={colors.text.dim}
        editable={!busy}
      />
      <Text style={styles.label}>PASSWORD</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={isLink ? 'newPassword' : 'password'}
        placeholder={`At least ${MIN_PASSWORD} characters`}
        placeholderTextColor={colors.text.dim}
        editable={!busy}
      />
      {error && <Text style={styles.errorLine}>{error}</Text>}
      <Pressable
        style={[styles.primaryBtn, busy && styles.btnDisabled]}
        onPress={onSubmit}
        disabled={busy}
      >
        <Text style={styles.primaryBtnText}>
          {busy ? 'WORKING…' : isLink ? 'LINK' : 'SIGN IN'}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.secondaryBtn, busy && styles.btnDisabled]}
        onPress={onCancel}
        disabled={busy}
      >
        <Text style={styles.secondaryBtnText}>BACK</Text>
      </Pressable>
    </View>
  );
}

function linkErrorMessage(r: Extract<LinkResult, { ok: false }>): string {
  switch (r.error) {
    case 'email_taken':
      return 'That email is already in use. Try Sign In instead.';
    case 'invalid_email':
      return 'That email looks invalid.';
    case 'weak_password':
      return r.message || 'Password too weak — try something longer.';
    case 'rate_limited':
      return 'Too many tries. Wait a minute and retry.';
    case 'network_error':
      return r.message || 'Network error — try again.';
  }
}

function signInErrorMessage(r: Extract<SignInResult, { ok: false }>): string {
  switch (r.error) {
    case 'invalid_credentials':
      return 'Wrong email or password.';
    case 'email_not_confirmed':
      return 'Confirm your email before signing in.';
    case 'rate_limited':
      return 'Too many tries. Wait a minute and retry.';
    case 'network_error':
      return r.message || 'Network error — try again.';
  }
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
    fontFamily: fonts.playfairItalic,
    fontSize: 28,
    color: colors.accent.brassLight,
  },
  closeBtn: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.text.muted,
    letterSpacing: 2,
  },
  kicker: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brassDeep,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  email: {
    fontFamily: fonts.bebasNeue,
    fontSize: 22,
    color: colors.accent.brassLight,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.outfitRegular,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  fineprint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  dim: {
    fontFamily: fonts.outfitRegular,
    fontSize: 14,
    color: colors.text.muted,
  },
  label: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.outfitRegular,
    fontSize: 16,
    color: colors.text.cream,
    borderWidth: 1,
    borderColor: colors.bg.cardHi,
  },
  errorLine: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.team.red,
    marginTop: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 16,
    color: colors.bg.overlay,
    letterSpacing: 2,
  },
  secondaryBtn: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.bg.cardHi,
  },
  secondaryBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 2,
  },
  dangerBtn: {
    backgroundColor: colors.team.red,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dangerBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 2,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
