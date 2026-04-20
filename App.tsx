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
