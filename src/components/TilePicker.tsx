import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { useGameStore } from '../store/gameStore';
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
      setStatus({ kind: 'done', message: 'Placed.' });
      // Close shortly after a successful placement so realtime can
      // animate the new pixel in. 600ms is long enough to register the
      // success copy without holding up the next tap.
      setTimeout(onClose, 600);
      return;
    }
    // Map every failure branch to a single user-facing line. We
    // intentionally don't try to recover or branch here — the modal's
    // job is to surface what happened and let the player retry by
    // tapping the canvas again.
    let message: string;
    switch (result.error) {
      case 'pixel_taken':
        message = 'Beat you to it!';
        break;
      case 'wrong_color': {
        const expectedName = result.expected && palette
          ? palette[result.expected]?.name
          : null;
        message = expectedName
          ? `That pixel needs ${expectedName}.`
          : 'That pixel needs a different color.';
        break;
      }
      case 'canvas_complete':
        message = 'Canvas complete — season just ended.';
        break;
      case 'season_mismatch':
        message = 'Season changed — refreshing.';
        break;
      case 'not_owned':
        message = "You don't have this color.";
        break;
      case 'not_authenticated':
        message = 'Not signed in.';
        break;
      case 'network_error':
        message = 'Network error — try again.';
        break;
      case 'unknown':
        message = 'Server returned an unknown response. Update the app.';
        break;
    }
    setStatus({ kind: 'done', message });
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
  },
  kicker: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.accent.brassDeep,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  previewText: {
    alignItems: 'flex-start',
  },
  targetLabel: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 2,
  },
  targetName: {
    fontFamily: fonts.bebasNeue,
    fontSize: 22,
    color: colors.accent.brassLight,
    letterSpacing: 1,
  },
  ownedLine: {
    fontFamily: fonts.outfitRegular,
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  ownedQty: {
    fontFamily: fonts.outfitBold,
    color: colors.accent.brassLight,
  },
  placeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: colors.accent.brass,
    borderRadius: radii.button,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  placeBtnDisabled: {
    backgroundColor: colors.ui.buttonDisabled,
  },
  placeBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 18,
    color: colors.bg.overlay,
    letterSpacing: 2,
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
  },
  closeBtn: {
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  closeBtnText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 13,
    color: colors.text.muted,
    letterSpacing: 2,
  },
});
