import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import {
  linkEmailPassword,
  signInWithEmailPassword,
  signOutAccount,
  getAccountStatus,
  setMyNickname,
  type AccountStatus,
  type LinkResult,
  type SignInResult,
} from '../../lib/account';
import { bootstrapAuthAndSeason } from '../../lib/bootstrap';
import { success } from '../../lib/haptics';
import { colors, fonts, radii, spacing } from '../../theme';

const MIN_PASSWORD = 8;
const MIN_NICKNAME = 3;
const MAX_NICKNAME = 20;

// Hidden until monetization ships — nickname rename will be a paid
// (or otherwise gated) action so players have skin in the game when
// picking what shows up on the live feed. Flip to `true` once the
// gate UX is wired (purchase / cosmetic unlock / etc.). The
// NicknameSubsection component below is preserved as-is so the flip
// is a one-line change. First-launch onboarding (mandatory pick) is
// untouched — that's a separate flow in NicknameOnboardingModal.
const ALLOW_NICKNAME_RENAME = false;

type ViewKind =
  | { kind: 'status' }
  | { kind: 'link-form' }
  | { kind: 'signin-form' };

// Account section of the SettingsModal. Lifts the link / sign-in /
// sign-out logic that previously lived in AccountModal — chrome
// (Modal/SafeAreaView/header/close) is now owned by SettingsModal so
// this component renders pure content. Adds a nickname rename
// subsection at the bottom (CHANGE NICKNAME → TextInput → CONFIRM
// flow against the existing setMyNickname RPC).
export default function AccountSection(): React.JSX.Element {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [view, setView] = useState<ViewKind>({ kind: 'status' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Refresh status on mount. Cheap (one local getSession()) and
  // covers the case where the player navigated away from Settings,
  // signed out elsewhere (e.g., session-expiry), and came back —
  // status would otherwise be stale.
  useEffect(() => {
    void getAccountStatus()
      .then(setStatus)
      .catch(() => setStatus({ kind: 'anon' }));
  }, []);

  const validateForm = (): string | null => {
    if (!email.includes('@')) return 'Enter a valid email.';
    if (password.length < MIN_PASSWORD) {
      return `Password must be at least ${MIN_PASSWORD} characters.`;
    }
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
    const trimmedEmail = email.trim();
    // Supabase's session cache doesn't refresh immediately after
    // updateUser, so subsequent getSession() reads can still return
    // is_anonymous=true with no email. Write the form-input email to
    // the store directly — that's the source of truth for "what email
    // did the player just link" regardless of when the session
    // refreshes.
    useGameStore.getState().setAccountLinked(true);
    useGameStore.getState().setAccountEmail(trimmedEmail);
    success();
    setStatus({ kind: 'linked', email: trimmedEmail });
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

  if (status === null) {
    return <Text style={styles.dim}>Loading…</Text>;
  }

  return (
    <View>
      {view.kind === 'status' ? (
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
      {view.kind === 'status' && ALLOW_NICKNAME_RENAME && <NicknameSubsection />}
    </View>
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
      {error !== null && <Text style={styles.errorLine}>{error}</Text>}
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

// Nickname rename subsection. Read-only display by default; tap
// CHANGE NICKNAME to flip into edit mode (TextInput + CONFIRM).
// Reuses the existing `setMyNickname` helper that NicknameOnboardingModal
// already drives. Server enforces 3-20 char + trim — we mirror the
// length check client-side to disable submit before the round-trip.
function NicknameSubsection(): React.JSX.Element {
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startEdit = () => {
    setInput(nickname ?? '');
    setErrorMsg(null);
    setEditing(true);
  };

  const trimmedLen = input.trim().length;
  const validLen = trimmedLen >= MIN_NICKNAME && trimmedLen <= MAX_NICKNAME;
  const submitDisabled = busy || !validLen || input.trim() === nickname;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    setBusy(true);
    setErrorMsg(null);
    const result = await setMyNickname(input);
    setBusy(false);
    if (result.ok) {
      success();
      setNickname(result.nickname);
      setEditing(false);
      return;
    }
    if (result.error === 'too_short') {
      setErrorMsg(`At least ${MIN_NICKNAME} characters, please.`);
    } else if (result.error === 'too_long') {
      setErrorMsg(`At most ${MAX_NICKNAME} characters.`);
    } else if (result.error === 'network_error') {
      setErrorMsg('Network error. Try again in a moment.');
    } else {
      setErrorMsg('Could not save nickname. Try again.');
    }
  };

  return (
    <View style={styles.nicknameBlock}>
      <Text style={styles.kicker}>NICKNAME</Text>
      {editing ? (
        <View>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={(t) => {
              setInput(t);
              if (errorMsg) setErrorMsg(null);
            }}
            maxLength={MAX_NICKNAME}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            placeholder="3-20 characters"
            placeholderTextColor={colors.text.muted}
            editable={!busy}
          />
          <Text style={[styles.counter, validLen && styles.counterOk]}>
            {`${trimmedLen}/${MAX_NICKNAME}`}
          </Text>
          {errorMsg !== null && <Text style={styles.errorLine}>{errorMsg}</Text>}
          <Pressable
            style={[styles.primaryBtn, submitDisabled && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitDisabled}
          >
            <Text style={styles.primaryBtnText}>
              {busy ? 'WORKING…' : 'CONFIRM'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, busy && styles.btnDisabled]}
            onPress={() => {
              setEditing(false);
              setErrorMsg(null);
            }}
            disabled={busy}
          >
            <Text style={styles.secondaryBtnText}>CANCEL</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.email}>{nickname ?? '—'}</Text>
          <Pressable style={styles.secondaryBtn} onPress={startEdit}>
            <Text style={styles.secondaryBtnText}>CHANGE NICKNAME</Text>
          </Pressable>
        </View>
      )}
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
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.accent.brassDeep,
    letterSpacing: 2.5,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  email: {
    fontFamily: fonts.outfitBlack,
    fontSize: 20,
    color: colors.text.cream,
    letterSpacing: 0.5,
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
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.text.muted,
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.bg.card,
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
  },
  counterOk: {
    color: colors.accent.brassDeep,
    fontFamily: fonts.outfitExtraBold,
  },
  errorLine: {
    fontFamily: fonts.outfitBold,
    fontSize: 13,
    color: colors.team.redSoft,
    marginTop: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: radii.button,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.accent.brassDeep,
  },
  secondaryBtnText: {
    fontFamily: fonts.outfitBold,
    fontSize: 13,
    color: colors.text.secondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  dangerBtn: {
    backgroundColor: colors.team.redSoft,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dangerBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.lightCream,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  nicknameBlock: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.banner.edge,
  },
});
