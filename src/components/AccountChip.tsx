import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  linked: boolean;
  size?: number;
}

// Account-state SVG chip for TopHeader. Replaces the 👤 emoji that shipped
// with the account-auth feature. Two visual states:
//   - linked:false → outline ring + dim silhouette (anonymous)
//   - linked:true  → brass-filled ring + cream silhouette (signed in)
//
// The silhouette is a tight circle (head) + a hemispheric arc (shoulders)
// to read at 18px without aliasing. SVG is preferred over PNG so the chip
// scales cleanly at any density.
export default function AccountChip({ linked, size = 18 }: Props): React.JSX.Element {
  const ringColor = linked ? colors.accent.brass : colors.text.dim;
  const ringFill = linked ? colors.accent.brass : 'transparent';
  const figureColor = linked ? colors.bg.overlay : colors.text.dim;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* outer ring */}
      <Circle cx="12" cy="12" r="10.5" stroke={ringColor} strokeWidth={1.5} fill={ringFill} />
      {/* head */}
      <Circle cx="12" cy="9.5" r="3" fill={figureColor} />
      {/* shoulders (clipped by the ring via ringStrokeOver) */}
      <Path
        d="M5.5 18 a6.5 6.5 0 0 1 13 0"
        fill={figureColor}
      />
    </Svg>
  );
}
