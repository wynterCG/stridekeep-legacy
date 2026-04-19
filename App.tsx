import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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
