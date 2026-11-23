import { useMemo } from 'react';
import { sigmoid } from '../model/effortModel';
import type { ModelResult } from '../model/effortModel';
import { useSize } from './useSize';

interface Props {
  current: ModelResult | null;
  history: ModelResult[];
  k: number;
}

const VMIN = -2;
const VMAX = 1;

/** The sigmoid that maps action value V to simulated action tendency. */
export default function SigmoidPlot({ current, history, k }: Props) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const h = 150;
  const pad = { l: 30, r: 10, t: 10, b: 26 };
  const w = Math.max(200, width);
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const sx = (v: number) => pad.l + ((v - VMIN) / (VMAX - VMIN)) * iw;
  const sy = (p: number) => pad.t + (1 - p) * ih;

  const path = useMemo(() => {
    let d = '';
    for (let i = 0; i <= 120; i++) {
      const v = VMIN + (i / 120) * (VMAX - VMIN);
      d += `${i ? 'L' : 'M'}${sx(v).toFixed(1)},${sy(sigmoid(v, k)).toFixed(1)}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, k]);

  const clampV = (v: number) => Math.max(VMIN, Math.min(VMAX, v));

  return (
    <div ref={ref} className="sigmoid">
      <svg width={w} height={h} role="img" aria-label="Sigmoid curve mapping action value to simulated action tendency">
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <line x1={pad.l} x2={w - pad.r} y1={sy(p)} y2={sy(p)} className="grid" />
            <text x={pad.l - 6} y={sy(p) + 3} className="axis-t" textAnchor="end">
              {p * 100}
            </text>
          </g>
        ))}
        {[-2, -1, 0, 1].map((v) => (
          <text key={v} x={sx(v)} y={h - 8} className="axis-t" textAnchor="middle">
            {v > 0 ? `+${v}` : v}
          </text>
        ))}
        <line x1={sx(0)} x2={sx(0)} y1={pad.t} y2={pad.t + ih} className="grid strong" />
        <path d={path} className="sig-curve" />
        {history.map((r, i) => (
          <circle key={i} cx={sx(clampV(r.value))} cy={sy(r.tendency)} r={3} className="sig-past" />
        ))}
        {current && (
          <g className="sig-now" style={{ transform: `translate(${sx(clampV(current.value))}px, ${sy(current.tendency)}px)` }}>
            <circle r={9} className="sig-halo" />
            <circle r={4.5} className="sig-dot" />
          </g>
        )}
        <text x={w - pad.r} y={h - 8} className="axis-t" textAnchor="end" dx={0} dy={-12}>
          V →
        </text>
      </svg>
    </div>
  );
}
