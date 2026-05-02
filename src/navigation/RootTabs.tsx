import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import InventoryScreen from '../screens/InventoryScreen';
import { colors, fonts } from '../theme';

const Tab = createBottomTabNavigator();

function tabIcon(emoji: string): () => React.JSX.Element {
  return function Icon() {
    return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
  };
}

// Phase-4 redesign: 2-tab bottom nav (HOME / INVENTORY). The 3rd tab
// (MURAL) was dropped — its content (banner, scoreboard, feed) migrated
// into the persistent SeasonCard + the inline RECENT feed on Home's
// CANVAS sub-tab. Future MARKET tab can slide in as a 3rd slot when
// shop UI is needed.
export default function RootTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.primary,
          borderTopColor: colors.accent.brassDeep,
          borderTopWidth: 2,
        },
        tabBarActiveTintColor: colors.accent.brassLight,
        tabBarInactiveTintColor: colors.text.dim,
        tabBarLabelStyle: {
          fontFamily: fonts.pressStart,
          fontSize: 8,
          letterSpacing: 1.5,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'HOME',
          tabBarIcon: tabIcon('🏠'),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarLabel: 'INVENTORY',
          tabBarIcon: tabIcon('🎒'),
        }}
      />
    </Tab.Navigator>
  );
}
