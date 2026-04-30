import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

type Kind = 'palette' | 'badge' | 'canvas';

interface Props {
  kind: Kind;
  size?: number;
}

// Reusable empty-state illustration. One visual language across screens
// (slate-on-slate fills + brass-deep strokes) so the dim state on Inventory
// palette / badge gallery / Home canvas placeholder reads as a coherent
// "waiting for something" surface, not a stack of unrelated icons.
//
// Strokes use brassDeep (dim, not attention-grabbing); fills use cardHi
// (subtle inner shape). Sizing is fixed per usage — caller passes the
// desired pixel size.
export default function EmptyStateIcon({ kind, size = 56 }: Props): React.JSX.Element {
  const stroke = colors.accent.brassDeep;
  const fill = colors.bg.cardHi;
  const strokeWidth = 1.5;

  switch (kind) {
    case 'palette':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          {/* artist palette outline */}
          <Path
            d="M32 8 C16 8 6 19 6 32 C6 41 14 47 22 45 C24 44 26 45 26 47 C26 51 28 56 34 56 C50 56 58 44 58 30 C58 18 48 8 32 8 Z"
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill={fill}
          />
          {/* paint dots */}
          <Circle cx="20" cy="22" r="2.5" fill={stroke} />
          <Circle cx="32" cy="18" r="2.5" fill={stroke} />
          <Circle cx="44" cy="22" r="2.5" fill={stroke} />
          <Circle cx="46" cy="34" r="2.5" fill={stroke} />
          {/* thumb hole */}
          <Circle cx="22" cy="40" r="3" fill={colors.bg.primary} stroke={stroke} strokeWidth={1} />
        </Svg>
      );
    case 'badge':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          {/* badge ribbon top */}
          <Path
            d="M22 6 L32 14 L42 6 L42 30 L32 36 L22 30 Z"
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill={fill}
          />
          {/* badge shield bottom */}
          <Path
            d="M16 30 L32 24 L48 30 L48 46 C48 52 40 58 32 60 C24 58 16 52 16 46 Z"
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill={fill}
          />
          {/* center star */}
          <Path
            d="M32 36 L34.5 42 L41 42.5 L36 46.5 L37.5 53 L32 49.5 L26.5 53 L28 46.5 L23 42.5 L29.5 42 Z"
            fill={stroke}
          />
        </Svg>
      );
    case 'canvas':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          {/* canvas frame */}
          <Rect x="8" y="12" width="48" height="40" rx="3" stroke={stroke} strokeWidth={strokeWidth} fill={fill} />
          {/* paint-by-numbers cells, dotted-grid feel */}
          <Rect x="16" y="20" width="8" height="8" fill={stroke} opacity={0.3} />
          <Rect x="28" y="20" width="8" height="8" fill={stroke} opacity={0.5} />
          <Rect x="40" y="20" width="8" height="8" fill={stroke} opacity={0.3} />
          <Rect x="16" y="32" width="8" height="8" fill={stroke} opacity={0.5} />
          <Rect x="28" y="32" width="8" height="8" fill={stroke} opacity={0.7} />
          <Rect x="40" y="32" width="8" height="8" fill={stroke} opacity={0.5} />
          {/* easel legs */}
          <Path d="M16 52 L12 60" stroke={stroke} strokeWidth={strokeWidth} />
          <Path d="M48 52 L52 60" stroke={stroke} strokeWidth={strokeWidth} />
        </Svg>
      );
  }
}
