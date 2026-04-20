import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  unlockedCount: number;
}

// Horizon art: sun glow + hill silhouette + buildings earned + ghosted next.
// Building geometry is hand-authored (not procedural) so each silhouette
// feels distinct. We render at most 5 visible building slots: solid for
// milestones crossed, dashed for the next, nothing for the rest.
//
// Edge case: there are 7 MILESTONES but only 5 slots — once a team crosses
// milestone 5 the illustration shows all 5 solid and drops the ghost
// (cosmetic ceiling). The build-progress bar in BuildButton continues to
// track the real next-milestone band. If/when team progress sits at the
// $2M+ tier in practice we should add 2 more slots or implement cycling.
const VIEWBOX_W = 320;
const VIEWBOX_H = 132;

type BuildingVariant = 'fountain' | 'cottageA' | 'cottageB' | 'hut' | 'chapel';

interface Slot {
  x: number;
  y: number;
  variant: BuildingVariant;
}

const BUILDING_SLOTS: Slot[] = [
  { x: 40, y: 95, variant: 'fountain' },
  { x: 85, y: 88, variant: 'cottageA' },
  { x: 135, y: 92, variant: 'cottageB' },
  { x: 175, y: 100, variant: 'hut' },
  { x: 225, y: 70, variant: 'chapel' },
];

function Building({
  slot,
  ghosted,
}: {
  slot: Slot;
  ghosted: boolean;
}): React.JSX.Element {
  const solidFillA = colors.accent.brassLight;
  const solidFillB = colors.accent.brass;
  const solidFillC = colors.accent.brassDeep;
  const dash = ghosted ? '2.5,2' : undefined;
  const stroke = ghosted ? colors.accent.brass : undefined;
  const strokeWidth = ghosted ? 1 : 0;
  const opacity = ghosted ? 0.85 : 1;
  const fill = ghosted ? 'none' : undefined;

  switch (slot.variant) {
    case 'fountain':
      return (
        <G transform={`translate(${slot.x},${slot.y})`} opacity={opacity}>
          <Rect
            x={0}
            y={14}
            width={22}
            height={14}
            fill={fill ?? solidFillB}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <Circle
            cx={11}
            cy={10}
            r={6}
            fill={fill ?? solidFillB}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <Rect x={10} y={2} width={2} height={6} fill={fill ?? solidFillB} />
          {!ghosted && <Circle cx={11} cy={2} r={1.5} fill={solidFillA} />}
        </G>
      );
    case 'cottageA':
      return (
        <G transform={`translate(${slot.x},${slot.y})`} opacity={opacity}>
          <Rect
            x={0}
            y={14}
            width={26}
            height={18}
            fill={fill ?? solidFillA}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <Polygon
            points="-3,14 13,0 29,14"
            fill={fill ?? solidFillB}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          {!ghosted && (
            <>
              <Rect x={9} y={22} width={6} height={10} fill={colors.bg.overlay} />
              <Rect x={3} y={18} width={4} height={3} fill={colors.bg.overlay} />
              <Rect x={19} y={18} width={4} height={3} fill={colors.bg.overlay} />
            </>
          )}
        </G>
      );
    case 'cottageB':
      return (
        <G transform={`translate(${slot.x},${slot.y})`} opacity={opacity}>
          <Rect
            x={0}
            y={12}
            width={22}
            height={16}
            fill={fill ?? solidFillB}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <Polygon
            points="-2,12 11,0 24,12"
            fill={fill ?? solidFillC}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          {!ghosted && <Rect x={8} y={20} width={5} height={8} fill={colors.bg.overlay} />}
        </G>
      );
    case 'hut':
      return (
        <G transform={`translate(${slot.x},${slot.y})`} opacity={opacity}>
          <Rect
            x={0}
            y={8}
            width={14}
            height={10}
            fill={fill ?? solidFillA}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <Polygon
            points="-2,8 7,0 16,8"
            fill={fill ?? solidFillB}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
        </G>
      );
    case 'chapel':
      return (
        <G transform={`translate(${slot.x},${slot.y})`} opacity={opacity}>
          <Rect
            x={0}
            y={22}
            width={30}
            height={28}
            fill={fill ?? solidFillA}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <Polygon
            points="-3,22 15,4 33,22"
            fill={fill ?? solidFillB}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <Line
            x1={15}
            y1={4}
            x2={15}
            y2={-8}
            stroke={stroke ?? solidFillB}
            strokeWidth={1}
            strokeDasharray={ghosted ? '1.5,1.5' : undefined}
          />
          <Line
            x1={11}
            y1={-4}
            x2={19}
            y2={-4}
            stroke={stroke ?? solidFillB}
            strokeWidth={1}
            strokeDasharray={ghosted ? '1.5,1.5' : undefined}
          />
          {!ghosted && <Rect x={11} y={34} width={8} height={16} fill={colors.bg.overlay} />}
        </G>
      );
  }
}

export default function TownIllustration({ unlockedCount }: Props): React.JSX.Element {
  // Clamp to 0..N for visuals. When all visible slots are full we drop the
  // ghost; the backing data stays richer than the illustration intentionally.
  const solidCount = Math.min(unlockedCount, BUILDING_SLOTS.length);
  const showGhost = unlockedCount < BUILDING_SLOTS.length;
  const ghostIndex = unlockedCount;

  return (
    <Svg
      width="100%"
      height={VIEWBOX_H}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <Defs>
        <RadialGradient id="sunGlow" cx="50%" cy="100%" r="55%">
          <Stop offset="0%" stopColor={colors.accent.brassLight} stopOpacity="0.35" />
          <Stop offset="100%" stopColor={colors.accent.brassLight} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="hillGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.bg.overlay} />
          <Stop offset="100%" stopColor="#0f1216" />
        </LinearGradient>
      </Defs>

      {/* Sun glow rising from horizon */}
      <Ellipse cx={160} cy={125} rx={140} ry={80} fill="url(#sunGlow)" />
      <Circle cx={160} cy={118} r={22} fill={colors.accent.brass} opacity={0.15} />
      <Circle cx={160} cy={118} r={14} fill={colors.accent.brassLight} opacity={0.25} />

      {/* Distant hills */}
      <Path
        d="M0 110 Q60 96 130 104 Q220 112 320 100 L320 132 L0 132 Z"
        fill="#252a30"
        opacity={0.7}
      />

      {/* Foreground hill */}
      <Path
        d="M0 122 Q70 108 160 116 Q250 122 320 112 L320 132 L0 132 Z"
        fill="url(#hillGrad)"
      />

      {/* Built buildings */}
      {BUILDING_SLOTS.slice(0, solidCount).map((slot, i) => (
        <Building key={`solid-${i}`} slot={slot} ghosted={false} />
      ))}

      {/* Ghosted next building + label */}
      {showGhost && (
        <>
          <Building slot={BUILDING_SLOTS[ghostIndex]} ghosted />
          <SvgText
            x={BUILDING_SLOTS[ghostIndex].x + 15}
            y={BUILDING_SLOTS[ghostIndex].y - 10}
            textAnchor="middle"
            fontFamily="BebasNeue_400Regular"
            fontSize={9}
            fill={colors.accent.brass}
            opacity={0.9}
            letterSpacing={2}
          >
            NEXT
          </SvgText>
          <Line
            x1={BUILDING_SLOTS[ghostIndex].x + 15}
            y1={BUILDING_SLOTS[ghostIndex].y - 7}
            x2={BUILDING_SLOTS[ghostIndex].x + 15}
            y2={BUILDING_SLOTS[ghostIndex].y - 2}
            stroke={colors.accent.brass}
            strokeWidth={0.8}
          />
          <Polygon
            points={`${BUILDING_SLOTS[ghostIndex].x + 12},${BUILDING_SLOTS[ghostIndex].y - 3} ${BUILDING_SLOTS[ghostIndex].x + 18},${BUILDING_SLOTS[ghostIndex].y - 3} ${BUILDING_SLOTS[ghostIndex].x + 15},${BUILDING_SLOTS[ghostIndex].y + 1}`}
            fill={colors.accent.brass}
          />
        </>
      )}

      {/* Sparkles for atmosphere */}
      <Circle cx={20} cy={20} r={0.6} fill={colors.accent.brassLight} opacity={0.7} />
      <Circle cx={55} cy={14} r={0.4} fill={colors.accent.brassLight} opacity={0.5} />
      <Circle cx={280} cy={28} r={0.6} fill={colors.accent.brassLight} opacity={0.6} />
      <Circle cx={305} cy={18} r={0.4} fill={colors.accent.brassLight} opacity={0.5} />
    </Svg>
  );
}
