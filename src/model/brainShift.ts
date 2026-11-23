/**
 * Translates the hypothetical trajectory into an *illustrative* state of the
 * aMCC highlight on the 3D brain. Purely visual storytelling: it is not a
 * prediction of brain volume, tissue change or any health outcome.
 */

import type { Horizon } from './trajectory';

export type BrainTrend = 'none' | 'stable' | 'weaker' | 'stronger';

export interface BrainShift {
  trend: BrainTrend;
  /** −1 (visibly weakened) … 0 (unchanged) … +1 (visibly strengthened) */
  amount: number;
  /** Short status for the label on the brain */
  tag: string;
  /** One-line explanation for the label on the brain */
  short: string;
  /** Heading of the "brain check" card */
  title: string;
  /** Explanation in the "brain check" card */
  body: string;
}

/** Below this change in the index (on a 0–1 scale) the brain is shown as unchanged. */
const THRESHOLD = 0.02;

export function brainShift(final: number, horizon: Horizon): BrainShift {
  const d = final - 0.5;

  if (horizon === '10m') {
    return {
      trend: 'none',
      amount: 0,
      tag: 'No change',
      short: 'Ten minutes is far too short.',
      title: 'No visible change',
      body: 'A single session barely registers. Whatever you choose in ten minutes, nothing changes in the brain picture — only months of repetition would.',
    };
  }

  if (Math.abs(d) < THRESHOLD) {
    return {
      trend: 'stable',
      amount: 0,
      tag: 'Stable',
      short: 'Effort and avoidance balance out.',
      title: 'Holding steady',
      body: 'Your pattern mixes pushing through and giving in about equally, so in this illustration the aMCC region stays roughly where it started.',
    };
  }

  const long = horizon === '10y';
  const size = Math.min(1, 0.3 + Math.abs(d) * 2.5) * (long ? 1 : 0.8);

  if (d < 0) {
    return {
      trend: 'weaker',
      amount: -size,
      tag: long ? 'Weakened' : 'Starting to weaken',
      short: 'Less used — pushing through gets harder.',
      title: long ? 'Weakened from disuse' : 'Starting to lose drive',
      body: long
        ? 'Years of mostly taking the easy way out: in this illustration the aMCC region looks thinner and duller. The brain has adapted to avoidance — getting started feels heavier, motivation fades quickly, and the comfortable option has become the default.'
        : 'After months of mostly avoiding the hard thing, the aMCC region in the picture begins to look slightly faded and thinner. Motivation starts to slip and the brain adapts more and more to the easy option — each new effort feels a little heavier.',
    };
  }

  return {
    trend: 'stronger',
    amount: size,
    tag: long ? 'Strengthened' : 'Starting to strengthen',
    short: 'Used often — pushing through gets easier.',
    title: long ? 'Strengthened by use' : 'Starting to build drive',
    body: long
      ? 'Years of mostly choosing the harder option: in this illustration the aMCC region looks fuller and more active. The brain has adapted to effort — starting is less of a struggle and pushing through has become the default.'
      : 'After months of mostly doing the hard thing anyway, the aMCC region in the picture begins to look slightly fuller and brighter. Motivation becomes steadier and the brain adapts to effort — each new push feels a little lighter.',
  };
}
