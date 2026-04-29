import React, { useEffect } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  PlayfairDisplay_900Black_Italic,
} from '@expo-google-fonts/playfair-display';
import { Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';
import RootTabs from './src/navigation/RootTabs';
import { colors } from './src/theme';
import { useGameStore } from './src/store/gameStore';
import { ensureStepsPermission, readDailySteps } from './src/native/healthConnect';
import { ensureSignedIn, fetchMyTeam } from './src/lib/auth';
import { supabase } from './src/lib/supabase';
import { loadActiveSeasonNumber, serverRolloverSeason } from './src/lib/teams';
import { loadSeasonPalette, loadSeasonCraftRecipes } from './src/data/colors';
import { loadMyBadges } from './src/lib/badges';

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
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // The cancelled flag stops `applyRealSteps` from firing after unmount, but
    // does not abort in-flight Health Connect calls — react-native-health-connect
    // doesn't expose AbortController support. The native promise will resolve;
    // its result is just discarded.
    let cancelled = false;

    const sync = async () => {
      const ok = await ensureStepsPermission();
      if (!ok || cancelled) return;
      const total = await readDailySteps();
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
    let cancelled = false;

    // Season sync: idempotent rollover heartbeat + palette/recipes load.
    // Decides reset-vs-refresh by comparing persisted store.seasonNumber
    // against the server's active season:
    //   - state.seasonNumber === activeNumber → setSeasonPalette /
    //     setSeasonCraftRecipes (refresh server data, keep intra-season
    //     state).
    //   - state.seasonNumber !== activeNumber (first install OR missed a
    //     rollover offline) → applySeasonReset (wipes intra-season state
    //     + swaps in new palette/recipes).
    //   - activeNumber === null (awaiting-mural state) → clear any stale
    //     palette so empty states render correctly.
    const syncSeason = async () => {
      try {
        await serverRolloverSeason();
      } catch (err) {
        console.warn('[stridekeep] rollover_season failed:', err);
      }
      if (cancelled) return;

      let activeNumber: number | null;
      try {
        activeNumber = await loadActiveSeasonNumber();
      } catch (err) {
        console.warn('[stridekeep] loadActiveSeasonNumber failed:', err);
        return;
      }
      if (cancelled) return;

      const store = useGameStore.getState();
      if (activeNumber === null) {
        store.setSeasonPalette(null);
        store.setSeasonCraftRecipes(null);
        return;
      }

      try {
        const [palette, recipes] = await Promise.all([
          loadSeasonPalette(activeNumber),
          loadSeasonCraftRecipes(activeNumber),
        ]);
        if (cancelled) return;
        const fresh = useGameStore.getState();
        if (fresh.seasonNumber !== activeNumber) {
          fresh.applySeasonReset(activeNumber, palette, recipes);
        } else {
          fresh.setSeasonPalette(palette);
          fresh.setSeasonCraftRecipes(recipes);
        }
      } catch (err) {
        console.warn('[stridekeep] palette/recipes load failed:', err);
      }
    };

    const bootstrapBadges = async () => {
      try {
        const badges = await loadMyBadges();
        if (cancelled) return;
        useGameStore.getState().setBadges(badges);
      } catch (err) {
        console.warn('[stridekeep] loadMyBadges failed:', err);
      }
    };

    const runBootstrap = async () => {
      try {
        await ensureSignedIn();
        if (cancelled) return;
        const team = await fetchMyTeam();
        if (cancelled) return;
        useGameStore.getState().setTeam(team);
        // Initial teamTotals load + ongoing realtime subscription is the
        // responsibility of useTeamsLiveSync (called from HomeScreen) so the
        // WebSocket only stays open while the user is actively watching.
      } catch (err) {
        console.warn('[stridekeep] auth bootstrap failed:', err);
        return;
      }
      // Season + badges run after auth. Season sync re-runs on every
      // foreground transition (below); badges only on cold start.
      await Promise.all([syncSeason(), bootstrapBadges()]);
    };

    // Gate bootstrap on persist hydration so syncSeason reads the correct
    // persisted seasonNumber rather than the initial-state null.
    const start = () => {
      if (!cancelled) void runBootstrap();
    };
    const unsubHydrate = useGameStore.persist.hasHydrated()
      ? (start(), () => {})
      : useGameStore.persist.onFinishHydration(start);

    // Re-sync on foreground. rollover_season is the heartbeat and the
    // function is idempotent — safe to call on every transition.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && useGameStore.persist.hasHydrated()) {
        void syncSeason();
      }
    });

    return () => {
      cancelled = true;
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
