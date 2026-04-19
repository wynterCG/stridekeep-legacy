import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { BALANCE } from '../balance';
import { colors, fonts, radii, spacing } from '../theme';

export default function InventoryScreen(): React.JSX.Element {
  const inventory = useGameStore((s) => s.inventory);
  const maxSlots = useGameStore((s) => s.maxSlots);
  const strideLevel = useGameStore((s) => s.strideLevel);
  const purse = useGameStore((s) => s.purse);
  const upgradeStridePower = useGameStore((s) => s.upgradeStridePower);
  const upgradeSlots = useGameStore((s) => s.upgradeSlots);

  const passiveIncomeHr = inventory.reduce(
    (sum, item) => sum + item.value * BALANCE.inventory.passiveIncomeRate,
    0,
  );

  const slots = Array.from({ length: maxSlots }, (_, i) => inventory[i] ?? null);

  const strideUpgradeCost = Math.floor(
    BALANCE.stride.costBase * Math.pow(BALANCE.stride.costMultiplier, strideLevel),
  );
  const canAffordStride = purse >= strideUpgradeCost;

  const slotUpgradesUsed = maxSlots - BALANCE.inventory.defaultSlots;
  const nextSlotCost =
    slotUpgradesUsed < BALANCE.inventory.slotUpgradeCost.length
      ? BALANCE.inventory.slotUpgradeCost[slotUpgradesUsed]
      : null;
  const canUpgradeSlots = maxSlots < BALANCE.inventory.maxSlots;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>INVENTORY</Text>

        <View style={styles.grid}>
          {slots.map((item, index) =>
            item ? (
              <View key={item.uid} style={styles.slot}>
                <Text style={styles.slotEmoji}>{item.emoji}</Text>
                <Text style={styles.slotName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.slotValue}>${item.value.toLocaleString()}</Text>
              </View>
            ) : (
              <View key={`empty-${index}`} style={[styles.slot, styles.slotEmpty]}>
                <Text style={styles.slotEmptyText}>+ EMPTY</Text>
              </View>
            ),
          )}
        </View>

        <View style={styles.incomeSummary}>
          <Text style={styles.incomeLabel}>PASSIVE INCOME</Text>
          <Text style={styles.incomeValue}>
            ${passiveIncomeHr.toFixed(2)}/hr → TEAM
          </Text>
        </View>

        <View style={styles.upgradeSection}>
          <Text style={styles.upgradeHeader}>STRIDE POWER</Text>
          <Text style={styles.upgradeDesc}>
            Level {strideLevel} — ${BALANCE.stride.baseValue + strideLevel}/step
          </Text>
          <TouchableOpacity
            style={[styles.upgradeBtn, !canAffordStride && styles.upgradeBtnDisabled]}
            onPress={upgradeStridePower}
            disabled={!canAffordStride}
          >
            <Text style={styles.upgradeBtnText}>
              UPGRADE — ${strideUpgradeCost.toLocaleString()} FROM PURSE
            </Text>
          </TouchableOpacity>
        </View>

        {canUpgradeSlots && nextSlotCost !== null && (
          <View style={styles.upgradeSection}>
            <Text style={styles.upgradeHeader}>INVENTORY SLOTS</Text>
            <Text style={styles.upgradeDesc}>
              {maxSlots} of {BALANCE.inventory.maxSlots} slots unlocked
            </Text>
            <TouchableOpacity
              style={[styles.upgradeBtn, purse < nextSlotCost && styles.upgradeBtnDisabled]}
              onPress={upgradeSlots}
              disabled={purse < nextSlotCost}
            >
              <Text style={styles.upgradeBtnText}>
                ADD SLOT — ${nextSlotCost.toLocaleString()} FROM PURSE
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    fontFamily: fonts.playfairItalic,
    fontSize: 28,
    color: colors.accent.brassLight,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  slot: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  slotEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.ui.border,
    backgroundColor: 'transparent',
  },
  slotEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  slotName: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.cream,
    textAlign: 'center',
  },
  slotValue: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.accent.brass,
    marginTop: 2,
  },
  slotEmptyText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.dim,
    letterSpacing: 1,
  },
  incomeSummary: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incomeLabel: {
    fontFamily: fonts.bebasNeue,
    fontSize: 15,
    color: colors.text.muted,
    letterSpacing: 1,
  },
  incomeValue: {
    fontFamily: fonts.outfitBold,
    fontSize: 14,
    color: colors.accent.brassLight,
  },
  upgradeSection: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  upgradeHeader: {
    fontFamily: fonts.bebasNeue,
    fontSize: 17,
    color: colors.text.cream,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  upgradeDesc: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  upgradeBtn: {
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  upgradeBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
  },
  upgradeBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.bg.primary,
    letterSpacing: 1,
  },
});
