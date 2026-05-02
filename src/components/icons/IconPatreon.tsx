import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

// Official Patreon brand logo (Simple Icons #patreon). 24x24 viewBox,
// monochrome path. Default colour is Patreon's official coral
// `#F96854`. Visual-only placeholder in v1 — Linking.openURL wired in
// a follow-up pass.
export default function IconPatreon({ size = 18, color = '#F96854' }: Props): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M0 .48v23.04h4.22V.48zm15.385 0c-4.764 0-8.641 3.88-8.641 8.65 0 4.755 3.877 8.623 8.641 8.623C20.135 17.753 24 13.885 24 9.13 24 4.36 20.135.48 15.385.48z"
        fill={color}
      />
    </Svg>
  );
}
