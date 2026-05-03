import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { placeErrorMessage } from '../lib/placeErrors';
import { tapLight } from '../lib/haptics';
import ColorCell from './ColorCell';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  pixelIdx: number;
  targetColorId: string;
  onClose: () => void;
}

// Modal that opens when an unfilled canvas pixel is tapped. Shows the
// pixel's target color, the player's owned-tile count, and a PLACE
// button. PLACE delegates to gameStore.placeTile which owns the
// optimistic-deduction + RPC-call + rollback flow; this component
// just routes the discriminated PlaceResult into a status line so the
// player sees what happened.
//
// Empty-inventory state: shows "You don't have this color yet" + a hint
// to open more cases. Cross-screen navigation links (CRAFT / SHOP /
// CASES) are S4.C scope.
export default function TilePicker({
  pixelIdx,
  targetColorId,
  onClose,
}: Props): React.JSX.Element {
  const palette = useGameStore((s) => s.seasonPalette);
  const inventoryQty = useGameStore((s) => s.inventory[targetColorId] ?? 0);
  const placeTile = useGameStore((s) => s.placeTile);

  const [status, setStatus] = useState<{ kind: 'idle' | 'pending' | 'done'; message?: string }>({
    kind: 'idle',
  });

  const targetDef = palette?.[targetColorId];

  const handlePlace = async () => {
    if (status.kind !== 'idle' || inventoryQty <= 0) return;
    setStatus({ kind: 'pending' });
    const result = await placeTile(targetColorId, pixelIdx);
    if (result.ok) {
      tapLight();
      setStatus({ kind: 'done', message: 'Placed.' });
      // Close shortly after a successful placement so realtime can
      // animate the new pixel in. 600ms is long enough to register the
      // success copy without holding up the next tap.
      setTimeout(onClose, 600);
      return;
    }
    setStatus({ kind: 'done', message: placeErrorMessage(result, palette) });
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{`PIXEL #${pixelIdx}`}</Text>

          {targetDef ? (
            <View style={styles.preview}>
              <ColorCell color={targetDef} size={64} qty={undefined} showCode />
              <View style={styles.previewText}>
                <Text style={styles.targetLabel}>This pixel needs</Text>
                <Text style={styles.targetName}>{targetDef.name}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.targetLabel}>Loading palette…</Text>
          )}

          <Text style={styles.ownedLine}>
            {`You have `}
            <Text style={styles.ownedQty}>{inventoryQty}</Text>
            {inventoryQty === 1 ? ' tile' : ' tiles'}
          </Text>

          <Pressable
            style={[
              styles.placeBtn,
              (inventoryQty <= 0 || status.kind !== 'idle') && styles.placeBtnDisabled,
            ]}
            onPress={handlePlace}
            disabled={inventoryQty <= 0 || status.kind !== 'idle'}
          >
            <Text style={styles.placeBtnText}>
              {status.kind === 'pending' ? 'PLACING…' : 'PLACE'}
            </Text>
          </Pressable>

          {status.message && (
            <Text style={styles.statusLine}>{status.message}</Text>
          )}

          {inventoryQty <= 0 && status.kind === 'idle' && (
            <Text style={styles.hint}>Open more cases to roll this color.</Text>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 2, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bg.card, // parchment-hi
    borderWidth: 2.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.card,
    padding: 18,
    alignItems: 'center',
  },
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10,
    color: colors.accent.brassDeep,
    letterSpacing: 2.5,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  previewText: {
    alignItems: 'flex-start',
  },
  targetLabel: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  targetName: {
    fontFamily: fonts.outfitBlack,
    fontSize: 22,
    color: colors.text.cream,
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  ownedLine: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 14,
    textAlign: 'center',
  },
  ownedQty: {
    fontFamily: fonts.outfitBlack,
    fontSize: 16,
    color: colors.team.redSoft,
  },
  placeBtn: {
    paddingVertical: 12,
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  placeBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
    borderColor: colors.ui.border,
  },
  placeBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statusLine: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.cream,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  closeBtn: {
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  closeBtnText: {
    fontFamily: fonts.outfitBold,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
