import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { MILESTONES } from '../data/cases';
import type { Milestone } from '../types';
import CelebrationOverlay from './CelebrationOverlay';

export default function MilestoneCelebrationWatcher(): React.JSX.Element | null {
  const team = useGameStore((s) => s.team);
  const total = useGameStore((s) => (team ? s.teamTotals[team] : 0));

  // Tracks the previously-observed total so we can detect a crossing rather
  // than just "current >= threshold". null on first render so we baseline
  // without celebrating: a player who launches the app at $30,000 already
  // shouldn't get a Village Fountain pop-up.
  const prevRef = useRef<number | null>(null);
  const [crossed, setCrossed] = useState<Milestone | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = total;
    if (prev === null || !team) return;
    if (total <= prev) return;

    // findLast: if a single deposit crosses multiple thresholds at once,
    // celebrate the highest one (more impressive achievement).
    const justCrossed = [...MILESTONES]
      .reverse()
      .find((m) => prev < m.threshold && total >= m.threshold);
    if (justCrossed) setCrossed(justCrossed);
  }, [total, team]);

  if (!crossed) return null;
  return <CelebrationOverlay milestone={crossed} onDismiss={() => setCrossed(null)} />;
}
