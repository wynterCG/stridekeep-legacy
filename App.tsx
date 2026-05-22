import React, { useEffect } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  PlayfairDisplay_900Black_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Outfit_400Regular,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import * as SplashScreen from 'expo-splash-screen';
import RootTabs from './src/navigation/RootTabs';
import SeasonEndCeremony from './src/components/SeasonEndCeremony';
import CaseRevealModal from './src/components/CaseRevealModal';
import TileFlightOverlay from './src/components/TileFlightOverlay';
import NicknameOnboardingModal from './src/components/NicknameOnboardingModal';
import OnboardingTutorial from './src/components/OnboardingTutorial';
import JitTutorial from './src/components/JitTutorial';
import HealthConnectGate from './src/components/HealthConnectGate';
import { colors } from './src/theme';
import { useGameStore } from './src/store/gameStore';
import {
  detectStepsSource,
  ensureStepsPermission,
  readDailySteps,
} from './src/native/steps';
import { supabase } from './src/lib/supabase';
import {
  bootstrapAuthAndSeason,
  isBootstrapInFlight,
} from './src/lib/bootstrap';
import { useSeasonEndWatcher } from './src/hooks/useSeasonEndWatcher';
import { applyMusicVolume, initAudioMode, preloadSfx, startMusic, stopMusic } from './src/lib/sounds';
import * as Localization from 'expo-localization';

const BOT_TICK_MS = 4_000;

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg.primary,
    card: colors.bg.primary,
    border: '#3a2a1e',
    primary: colors.accent.brass,
    text: colors.text.cream,
    notification: colors.accent.brass,
  },
};

export default function App(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    PlayfairDisplay_900Black_Italic,
    Outfit_400Regular,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
    PressStart2P_400Regular,
  });

  // Realtime trigger for SeasonEndCeremony — listens to seasons
  // table updates and re-runs bootstrapAuthAndSeason when a rollover
  // lands while the app is foregrounded. The boot path covers cold
  // starts; this hook covers mid-session.
  useSeasonEndWatcher();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // One-shot iOS audio-session + Android ducking config plus eager
  // preload of all sfx clips. Preloading during the splash window
  // means the first OPEN tap / first tile place / first ceremony
  // mount plays instantly — without it, expo-av decodes on the JS
  // thread at fire time and adds 100-300 ms of perceptible delay.
  // Sequential await: audio mode must be configured before any Sound
  // is created or the iOS silent switch / Android ducking won't apply
  // to the preloaded clips.
  useEffect(() => {
    void (async () => {
      await initAudioMode();
      await preloadSfx();
    })();
  }, []);

  // Boot-time language detection. Runs ONCE per install (more precisely:
  // once until the user sets a value). `language` persists across
  // launches, so on subsequent boots this effect re-reads the stored
  // value and short-circuits. A user who manually picks a language in
  // Settings overrides the detection permanently — moving the device
  // to a different locale later won't surprise-flip their pick.
  //
  // Strategy: read the FIRST locale from expo-localization's ordered
  // list (matches the device's primary language preference) and map
  // its languageCode → 'pt' if 'pt', else 'en'. Everything we don't
  // explicitly support falls back to English.
  useEffect(() => {
    const current = useGameStore.getState().language;
    if (current !== null) return; // already set; respect existing value
    const locales = Localization.getLocales();
    const primaryCode = locales[0]?.languageCode ?? 'en';
    const detected = primaryCode === 'pt' ? 'pt' : 'en';
    useGameStore.getState().setLanguage(detected);
  }, []);

  // Background music lifecycle. Two inputs:
  //   1. AppState — active → start, background/inactive → stop.
  //      Without this, BGM bleeds into other apps when you swipe away
  //      from Stridekeep, which is hostile UX for a casual game.
  //   2. musicEnabled — store toggle. Subscribe via zustand's vanilla
  //      .subscribe so we react to the flip without re-running this
  //      whole effect on every unrelated store update.
  // The startMusic() / stopMusic() helpers are idempotent + gated on
  // the store flag, so calling start while disabled is a safe no-op.
  useEffect(() => {
    // Initial start if hydration already brought musicEnabled = true.
    // If hydration hasn't completed yet, the toggle defaults to true
    // in initialState — startMusic() reads the live store value, so
    // disabling the toggle in persisted state pre-hydration is the
    // only edge that could play one frame of BGM. The cost (≤200 ms
    // of music for a returning user who disabled it) isn't worth a
    // hydration gate; matches how SFX behaves.
    void startMusic();

    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void startMusic();
      else void stopMusic();
    });

    const unsubStore = useGameStore.subscribe((state, prevState) => {
      if (state.musicEnabled !== prevState.musicEnabled) {
        if (state.musicEnabled) void startMusic();
        else void stopMusic();
      }
      // Live BGM volume update — dragging the slider in the dev
      // tuner changes the volume immediately without restart.
      if (state.musicVolume !== prevState.musicVolume) {
        void applyMusicVolume(state.musicVolume);
      }
    });

    return () => {
      appStateSub.remove();
      unsubStore();
      // Don't stopMusic() in cleanup — App.tsx mounts once for the
      // app's lifetime; the only time this effect tears down is on a
      // hot reload where the next mount immediately restarts the
      // music. Calling stop here would just add a 100 ms gap.
    };
  }, []);

  useEffect(() => {
    // The cancelled flag stops `applyRealSteps` from firing after unmount, but
    // does not abort in-flight Health Connect calls — react-native-health-connect
    // doesn't expose AbortController support. The native promise will resolve;
    // its result is just discarded.
    let cancelled = false;

    // Two-stage sync via the unified steps source. detectStepsSource
    // picks HC if available, falls back to the custom step-counter
    // sensor module, lands on 'unavailable' only if neither works. The
    // store field drives HealthConnectGate (which now only fires for
    // the 'unavailable' dead-end case — see HealthConnectGate.tsx).
    // Foreground transitions re-probe so installing HC or granting the
    // activity-recognition permission mid-session promotes the source
    // without an app restart.
    const sync = async () => {
      const source = await detectStepsSource();
      if (cancelled) return;
      useGameStore.getState().setStepsSource(source);
      if (source === 'unavailable') return;
      const ok = await ensureStepsPermission(source);
      if (!ok || cancelled) return;
      const total = await readDailySteps(source);
      if (cancelled) return;
      useGameStore.getState().applyRealSteps(total);
    };

    const run = () => {
      if (!cancelled) sync();
    };

    const unsubHydrate = useGameStore.persist.hasHydrated()
      ? (run(), () => {})
      : useGameStore.persist.onFinishHydration(run);

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });

    return () => {
      cancelled = true;
      unsubHydrate();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    // Cold-start: run the full bootstrap once persist has hydrated so
    // syncSeason reads the persisted seasonNumber (not the initial null).
    // bootstrapAuthAndSeason is module-level so AccountModal can re-run
    // it after sign-in / sign-out without going through this effect.
    const start = () => {
      void bootstrapAuthAndSeason();
    };
    const unsubHydrate = useGameStore.persist.hasHydrated()
      ? (start(), () => {})
      : useGameStore.persist.onFinishHydration(start);

    // Re-sync on foreground. We call the FULL bootstrap (not just
    // syncSeasonOnce) so a stranded post-signOut session — where
    // signOutAccount succeeded but the immediate ensureSignedIn failed
    // for network reasons — gets a chance to re-mint an anon session
    // on the next foreground transition. The internal guards short-
    // circuit if a bootstrap is already in flight (e.g. AccountModal
    // sign-in mid-call), so this is a no-op in the common case.
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (!useGameStore.persist.hasHydrated()) return;
      if (isBootstrapInFlight()) return;
      void bootstrapAuthAndSeason();
    });

    return () => {
      unsubHydrate();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    // Ambient bot activity. Server-side tick_bots() generates 2-5
    // synthetic deposits each call; we ping it every 4s while the app
    // is foregrounded so the live feed + chart never look empty when a
    // human is actually playing. Bots stop the moment the app is
    // backgrounded (saving cost AND keeping the world correlated with
    // real player activity).
    let cancelled = false;
    const tick = async () => {
      if (cancelled || AppState.currentState !== 'active') return;
      try {
        await supabase.rpc('tick_bots');
      } catch (err) {
        console.warn('[stridekeep] tick_bots failed:', err);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), BOT_TICK_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void tick();
    });
    return () => {
      cancelled = true;
      clearInterval(id);
      sub.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <View style={styles.root}>
          <RootTabs />
          {/* SeasonEndCeremony renders itself as a Modal when
              gameStore.pendingSeasonEnd is non-null (set by
              bootstrap.ts on rollover detection). Sits outside RootTabs
              so it overlays the bottom-tab bar. */}
          <SeasonEndCeremony />
          {/* CaseRevealModal renders itself as a Modal when
              gameStore.pendingTileReveal is non-null. Three dispatch
              sites: CaseCard.handleOpen ('case'), buyShopTile ('shop'),
              craftTile ('craft'). Mounted at root so the dimmed
              backdrop covers the entire UI including bottom nav, not
              just the case card row. */}
          <CaseRevealModal />
          {/* TileFlightOverlay renders the place-tile fly-to
              animation (big-in-center → cell). Driven by
              gameStore.pendingTileFlight; both place-tile call sites
              (canvas TilePicker + inventory PLACE ON CANVAS) set the
              field, the overlay handles the animation, the existing
              realtime cell-fill + self-pulse continue the visual on
              landing. */}
          <TileFlightOverlay />
          {/* NicknameOnboardingModal blocks first-launch UX until the
              player picks a nickname. Self-gates on
              gameStore.nickname matching the auto-default pattern
              (Stridekeeper-XXXXXX); renders nothing once a custom
              nickname is set. Sign-out → fresh anon → new
              auto-default re-triggers the prompt. */}
          <NicknameOnboardingModal />
          {/* OnboardingTutorial is the 2-card welcome modal that fires
              once after the nickname modal completes. HomeScreen owns the
              trigger effect (gates on nickname being custom +
              tutorialFlags.onboarding === false); this component self-
              gates on `onboardingActive` and renders a centered card
              stack. Skip = same as completing the last card. */}
          <OnboardingTutorial />
          {/* JitTutorial is the non-modal spotlight overlay for gameplay-
              triggered tutorial flows (currently only `first-case`:
              cases-tab → OPEN → INVENTORY → cell → PLACE). HomeScreen
              owns the first-case trigger effect (watches per-tier pending
              0→1 transitions); this component self-gates on
              `tutorialActiveFlow` and renders dim + cutout + tooltip with
              a SKIP-only button. The cutout area is taps-through so the
              player advances the flow by interacting with the spotlit
              element directly. */}
          <JitTutorial />
          {/* HealthConnectGate self-gates on store.healthConnectStatus.
              Renders a blocking modal when the device needs to install
              the Health Connect provider OR can't run it at all. The
              step-sync effect above re-probes status on every foreground
              transition so installing HC and returning auto-dismisses
              this gate. Mounted last so it sits on top of every other
              overlay (the user must resolve the HC situation before
              they can do anything else). */}
          <HealthConnectGate />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
});
