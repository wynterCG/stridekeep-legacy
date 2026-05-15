import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ShopScreen from '../screens/ShopScreen';
import IconHome from '../components/icons/IconHome';
import IconBag from '../components/icons/IconBag';
import IconShop from '../components/icons/IconShop';
import TutorialTarget from '../components/TutorialTarget';
import { useGameStore } from '../store/gameStore';
import { colors, fonts } from '../theme';

const Tab = createBottomTabNavigator();

// Custom icon-with-active-label renderer. The mockup shows the active
// tab's icon + label PLUS a small green "Active" sub-label underneath
// — that's what makes the active tab pop on the wood-canyon bottom nav.
// React-Navigation's default tab label can't show a second line, so we
// render the icon + both labels ourselves and hide the default label.
type IconKind = 'home' | 'bag' | 'shop';

// Saturated gold for the active state; moderate brass for inactive.
// Active pops at-a-glance ("you are here"); inactive stays bright
// enough to read as a clickable tab (brassDeep was too dark — read
// as locked/disabled).
const TAB_ACTIVE_TINT = colors.accent.activeGold;
const TAB_INACTIVE_TINT = colors.accent.brassLight;

function tabRenderer(
  label: string,
  kind: IconKind,
  tutorialTargetKey?: string,
): (props: { focused: boolean }) => React.JSX.Element {
  return function TabContent({ focused }) {
    const tint = focused ? TAB_ACTIVE_TINT : TAB_INACTIVE_TINT;
    const Icon = kind === 'home' ? IconHome : kind === 'bag' ? IconBag : IconShop;
    const content = (
      <View style={styles.tabContent}>
        <Icon size={22} color={tint} />
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      </View>
    );
    // When the JIT tutorial system wants to spotlight this tab, wrap the
    // tab's icon+label column in a TutorialTarget. The wrapper inherits
    // the column's bounds so measureInWindow returns a tap-target-sized
    // rect (not the whole bottom bar) — the cutout hugs the icon.
    if (tutorialTargetKey) {
      return (
        <TutorialTarget targetKey={tutorialTargetKey}>{content}</TutorialTarget>
      );
    }
    return content;
  };
}

// Wood-canyon bottom nav (2026-05-03 redesign). Same 2-tab structure
// as before (HOME / INVENTORY); the visual chrome is rebuilt to match
// the banner blue at the top — bottom + top now act as bookends around
// the parchment middle.
//
// React-Navigation's tabBarLabel + tabBarIcon system can't render a
// second line of text below the label, so the default label is hidden
// (tabBarShowLabel: false) and we render icon + label + "Active"
// sub-label as a single column inside tabBarIcon. tabBarIconStyle and
// tabBarItemStyle are tuned to give the column the correct breathing
// room.
//
// Bottom inset handling: useSafeAreaInsets() pulls the system gesture
// bar height (Android navigation bar / iOS home indicator). We bake it
// into paddingBottom + total height so the brass icons + green Active
// badge never sit under the gesture pill. A previous build hard-coded
// height: 70 which collided with the Samsung A52s gesture bar.
export default function RootTabs(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);
  // Read advanceFlowStep eagerly so the screenListener can call it
  // synchronously on tab press without re-subscribing per event.
  const advanceFlowStep = useGameStore((s) => s.advanceFlowStep);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.bar,
          {
            height: 64 + safeBottom,
            paddingBottom: safeBottom,
          },
        ],
        tabBarItemStyle: styles.item,
        tabBarIconStyle: styles.iconWrap,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: tabRenderer('HOME', 'home') }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarIcon: tabRenderer('INVENTORY', 'bag', 'bottom-inventory'),
        }}
        listeners={{
          // JIT first-case step 3: tapping the spotlit INVENTORY tab
          // advances the flow. Store action is a no-op when the current
          // step's resolved key !== 'bottom-inventory', so the listener
          // is safe to fire on every press regardless of tutorial state.
          tabPress: () => {
            advanceFlowStep('bottom-inventory');
          },
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{ tabBarIcon: tabRenderer('SHOP', 'shop') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.banner.mid,
    borderTopColor: colors.banner.edge,
    borderTopWidth: 2,
    paddingTop: 6,
  },
  item: {
    flex: 1,
  },
  iconWrap: {
    width: '100%',
    height: '100%',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    paddingTop: 2,
  },
  tabLabel: {
    fontFamily: fonts.outfitBold,
    fontSize: 10,
    color: TAB_INACTIVE_TINT,
    letterSpacing: 1,
  },
  tabLabelActive: {
    color: TAB_ACTIVE_TINT,
  },
});
