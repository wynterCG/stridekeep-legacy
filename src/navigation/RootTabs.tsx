import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import InventoryScreen from '../screens/InventoryScreen';
import MuralScreen from '../screens/MuralScreen';
import { colors, fonts } from '../theme';

const Tab = createBottomTabNavigator();

function tabIcon(emoji: string): () => React.JSX.Element {
  return function Icon() {
    return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
  };
}

export default function RootTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.primary,
          borderTopColor: '#3a2a1e',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent.brass,
        tabBarInactiveTintColor: colors.text.dim,
        tabBarLabelStyle: {
          fontFamily: fonts.bebasNeue,
          fontSize: 12,
          letterSpacing: 1,
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
      <Tab.Screen
        name="Mural"
        component={MuralScreen}
        options={{
          tabBarLabel: 'MURAL',
          tabBarIcon: tabIcon('🎨'),
        }}
      />
    </Tab.Navigator>
  );
}
