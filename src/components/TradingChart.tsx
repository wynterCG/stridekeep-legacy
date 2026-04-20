import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useGameStore } from '../store/gameStore';
import type { DepositRow } from '../lib/deposits';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  deposits: DepositRow[];
}

const W = 320;
const H = 130;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 8;

interface SeriesPoint {
  t: number;
  v: number;
}

// Window the chart shows. Older deposits get clipped from the chart but
// stay in the log (LiveFeed still shows them by recency).
const WINDOW_MS = 60 * 60 * 1000; // last hour

/**
 * Reframes the chart as "cumulative deposits IN THIS WINDOW per team".
 * Both lines start at $0 on the left and step up at each deposit timestamp.
 * Visible movement even with a single deposit; flat $35K backgrounds (e.g.,
 * SQL test fixtures) no longer dominate the frame.
 */
function buildCumulativeSeries(
  deposits: DepositRow[],
  now: number,
): { red: SeriesPoint[]; blue: SeriesPoint[]; tMin: number; vMax: number } {
  const tMin = now - WINDOW_MS;

  // deposits arrive newest-first; reverse to chronological for cumulative sum.
  const chrono = [...deposits].reverse().filter((d) => {
    const t = new Date(d.createdAt).getTime();
    return t >= tMin;
  });

  const red: SeriesPoint[] = [{ t: tMin, v: 0 }];
  const blue: SeriesPoint[] = [{ t: tMin, v: 0 }];
  let r = 0;
  let b = 0;
  for (const d of chrono) {
    const t = new Date(d.createdAt).getTime();
    if (d.team === 'red') {
      // Two points: hold the previous value just before the step, then jump.
      // Renders as a true stair-step instead of a diagonal slope.
      red.push({ t: t - 1, v: r });
      r += d.amount;
      red.push({ t, v: r });
    } else {
      blue.push({ t: t - 1, v: b });
      b += d.amount;
      blue.push({ t, v: b });
    }
  }
  // Cap each series at the right edge with the current value.
  red.push({ t: now, v: r });
  blue.push({ t: now, v: b });

  const vMax = Math.max(r, b, 1) * 1.15;
  return { red, blue, tMin, vMax };
}

function project(p: SeriesPoint, tMin: number, tMax: number, vMax: number) {
  const tSpan = Math.max(1, tMax - tMin);
  const x = PAD_L + ((p.t - tMin) / tSpan) * (W - PAD_L - PAD_R);
  const y = PAD_T + (1 - p.v / vMax) * (H - PAD_T - PAD_B);
  return { x, y };
}

function linePath(series: SeriesPoint[], tMin: number, tMax: number, vMax: number) {
  if (series.length === 0) return '';
  return series
    .map((p, i) => {
      const { x, y } = project(p, tMin, tMax, vMax);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function areaPath(series: SeriesPoint[], tMin: number, tMax: number, vMax: number) {
  if (series.length < 2) return '';
  const baseY = H - PAD_B;
  const first = project(series[0], tMin, tMax, vMax);
  const last = project(series[series.length - 1], tMin, tMax, vMax);
  return [
    `M ${first.x.toFixed(1)} ${baseY}`,
    ...series.map((p) => {
      const { x, y } = project(p, tMin, tMax, vMax);
      return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }),
    `L ${last.x.toFixed(1)} ${baseY}`,
    'Z',
  ].join(' ');
}

export default function TradingChart({ deposits }: Props): React.JSX.Element {
  const teamTotals = useGameStore((s) => s.teamTotals);

  const { red, blue, tMin, tMax, vMax, redGathered, blueGathered, leadKind, leadAmount } =
    useMemo(() => {
      const now = Date.now();
      const series = buildCumulativeSeries(deposits, now);
      const r = series.red[series.red.length - 1].v;
      const b = series.blue[series.blue.length - 1].v;
      const diff = r - b;
      const lk: 'red' | 'blue' | 'tie' = diff > 0 ? 'red' : diff < 0 ? 'blue' : 'tie';
      return {
        red: series.red,
        blue: series.blue,
        tMin: series.tMin,
        tMax: now,
        vMax: series.vMax,
        redGathered: r,
        blueGathered: b,
        leadKind: lk,
        leadAmount: Math.abs(diff),
      };
    }, [deposits]);

  const redEnd = project(red[red.length - 1], tMin, tMax, vMax);
  const blueEnd = project(blue[blue.length - 1], tMin, tMax, vMax);

  const leadText =
    leadKind === 'tie'
      ? redGathered === 0
        ? 'NO ACTIVITY YET'
        : 'PERFECTLY TIED'
      : `${leadKind === 'red' ? '🟥' : '🟦'}  ${leadKind === 'red' ? 'RED' : 'BLUE'} +$${leadAmount.toLocaleString()}`;
  const leadColor =
    leadKind === 'red'
      ? colors.team.red
      : leadKind === 'blue'
        ? colors.team.blue
        : colors.text.muted;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>LAST HOUR</Text>
          <Text style={styles.subtitle}>cumulative deposits per team</Text>
        </View>
        <Text style={[styles.lead, { color: leadColor }]} numberOfLines={1}>
          {leadText}
        </Text>
      </View>

      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.team.red} stopOpacity="0.55" />
            <Stop offset="1" stopColor={colors.team.red} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.team.blue} stopOpacity="0.55" />
            <Stop offset="1" stopColor={colors.team.blue} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* horizontal gridlines at 25/50/75% of vMax */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = PAD_T + (1 - frac) * (H - PAD_T - PAD_B);
          return (
            <Line
              key={frac}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke={colors.ui.border}
              strokeWidth={0.5}
              opacity={0.25}
            />
          );
        })}

        <Path d={areaPath(red, tMin, tMax, vMax)} fill="url(#redGrad)" />
        <Path d={areaPath(blue, tMin, tMax, vMax)} fill="url(#blueGrad)" />

        <Path
          d={linePath(red, tMin, tMax, vMax)}
          fill="none"
          stroke={colors.team.red}
          strokeWidth={2.4}
          strokeLinejoin="miter"
          strokeLinecap="round"
        />
        <Path
          d={linePath(blue, tMin, tMax, vMax)}
          fill="none"
          stroke={colors.team.blue}
          strokeWidth={2.4}
          strokeLinejoin="miter"
          strokeLinecap="round"
        />

        <Circle cx={redEnd.x} cy={redEnd.y} r={7} fill={colors.team.red} opacity={0.25} />
        <Circle cx={redEnd.x} cy={redEnd.y} r={3.2} fill={colors.team.red} />

        <Circle cx={blueEnd.x} cy={blueEnd.y} r={7} fill={colors.team.blue} opacity={0.25} />
        <Circle cx={blueEnd.x} cy={blueEnd.y} r={3.2} fill={colors.team.blue} />
      </Svg>

      <View style={styles.footer}>
        <View style={styles.legendBlock}>
          <View style={[styles.swatch, { backgroundColor: colors.team.red }]} />
          <Text style={styles.legendValue}>+${redGathered.toLocaleString()}</Text>
        </View>
        <Text style={styles.totals} numberOfLines={1}>
          {`Total: 🟥 $${teamTotals.red.toLocaleString()}  ·  🟦 $${teamTotals.blue.toLocaleString()}`}
        </Text>
        <View style={styles.legendBlock}>
          <View style={[styles.swatch, { backgroundColor: colors.team.blue }]} />
          <Text style={styles.legendValue}>+${blueGathered.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.accent.brass,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  lead: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    letterSpacing: 1.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  legendBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: spacing.xs,
  },
  legendValue: {
    fontFamily: fonts.outfitBold,
    fontSize: 12,
    color: colors.text.cream,
  },
  totals: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.muted,
    flexShrink: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
});
