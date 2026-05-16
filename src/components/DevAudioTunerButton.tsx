import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { previewSfx } from '../lib/sounds';
import { colors, fonts, radii, spacing } from '../theme';

const STEP = 0.05;
const SFX_KEYS = [
  'caseOpenStarter',
  'caseOpenQuality',
  'caseOpenFine',
  'tilePlace',
  'ceremonyCelebrate',
  'errorBuzz',
] as const;

const ROW_LABELS: Record<(typeof SFX_KEYS)[number], string> = {
  caseOpenStarter: 'Case · Starter',
  caseOpenQuality: 'Case · Quality',
  caseOpenFine: 'Case · Fine',
  tilePlace: 'Tile place',
  ceremonyCelebrate: 'Ceremony',
  errorBuzz: 'Error buzz',
};

// __DEV__-gated audio tuner. Opens a modal with +/-5% adjusters and a
// preview button per sound. EXPORT button dumps the current values in
// an Alert dialog so Claude can read them back and bake them into the
// store's initialState defaults. After the defaults are locked, this
// button + its supporting fields can be removed.
export default function DevAudioTunerButton(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const sfxVolumes = useGameStore((s) => s.sfxVolumes);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const setSfxVolume = useGameStore((s) => s.setSfxVolume);
  const setMusicVolume = useGameStore((s) => s.setMusicVolume);

  function exportSnapshot(): void {
    const lines: string[] = [];
    lines.push(`musicVolume: ${musicVolume.toFixed(2)}`);
    lines.push('sfxVolumes: {');
    for (const key of SFX_KEYS) {
      lines.push(`  ${key}: ${sfxVolumes[key].toFixed(2)},`);
    }
    lines.push('}');
    Alert.alert('Audio tuner snapshot', lines.join('\n'));
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>DEV · AUDIO</Text>
      <TouchableOpacity style={styles.pill} onPress={() => setOpen(true)}>
        <Text style={styles.pillText}>🎚  AUDIO TUNER</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>AUDIO TUNER</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.closeBtn}>CLOSE</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.help}>
              Tap −/+ to step 5%, tap ▶ to preview, then EXPORT to dump the values.
            </Text>

            <TunerRow
              label="Background music"
              value={musicVolume}
              onPlus={() => setMusicVolume(musicVolume + STEP)}
              onMinus={() => setMusicVolume(musicVolume - STEP)}
              onPreview={null}
            />

            <View style={styles.divider} />

            {SFX_KEYS.map((key) => (
              <TunerRow
                key={key}
                label={ROW_LABELS[key]}
                value={sfxVolumes[key]}
                onPlus={() => setSfxVolume(key, sfxVolumes[key] + STEP)}
                onMinus={() => setSfxVolume(key, sfxVolumes[key] - STEP)}
                onPreview={() => previewSfx(key)}
              />
            ))}

            <TouchableOpacity style={styles.exportBtn} onPress={exportSnapshot}>
              <Text style={styles.exportText}>EXPORT VALUES</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function TunerRow({
  label,
  value,
  onPlus,
  onMinus,
  onPreview,
}: {
  label: string;
  value: number;
  onPlus: () => void;
  onMinus: () => void;
  onPreview: (() => void) | null;
}): React.JSX.Element {
  const pct = Math.round(value * 100);
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{pct}%</Text>
      </View>
      <View style={styles.rowButtons}>
        <TouchableOpacity style={styles.stepBtn} onPress={onMinus}>
          <Text style={styles.stepText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepBtn} onPress={onPlus}>
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
        {onPreview !== null && (
          <TouchableOpacity style={styles.previewBtn} onPress={onPreview}>
            <Text style={styles.previewText}>▶</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heading: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.text.dim,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  pill: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.ui.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pillText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 1,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.outfitBlack,
    fontSize: 22,
    color: colors.text.cream,
    letterSpacing: 1,
  },
  closeBtn: {
    fontFamily: fonts.outfitBold,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  help: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.ui.border,
    marginVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  rowLabelBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowLabel: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.cream,
    letterSpacing: 0.5,
  },
  rowValue: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.accent.brassLight,
    marginTop: 2,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.button,
    backgroundColor: colors.bg.overlay,
    borderWidth: 1,
    borderColor: colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: fonts.outfitBlack,
    fontSize: 18,
    color: colors.text.cream,
    lineHeight: 18,
  },
  previewBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.button,
    backgroundColor: colors.accent.brassDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontFamily: fonts.outfitBlack,
    fontSize: 14,
    color: colors.text.lightCream,
    lineHeight: 14,
  },
  exportBtn: {
    backgroundColor: colors.accent.brassLight,
    borderRadius: radii.button,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  exportText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 14,
    color: colors.text.cream,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
});
