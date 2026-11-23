import { useEffect, useMemo, useRef, useState } from 'react';
import { useSize } from './useSize';

export interface ChartSeries {
  id: string;
  label: string;
  points: { x: number; y: number }[];
  variant: 'main' | 'ref-high' | 'ref-low';
}

interface Props {
  series: ChartSeries[];
  span: number;
  ticks: number[];
  fmtX: (x: number) => string;
  equilibrium: number;
}

const N = 160;

function resample(points: { x: number; y: number }[], span: number) {
  const out = new Float64Array(N + 1);
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * span;
    while (j < points.length - 2 && points[j + 1].x < x) j++;
    const a = points[j];
    const b = points[Math.min(points.length - 1, j + 1)];
    const t = b.x === a.x ? 0 : Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
    out[i] = a.y + (b.y - a.y) * t;
  }
  return out;
}

interface Frame {
  ys: Float64Array[];
  lo: number;
  hi: number;
  eq: number;
}

function domain(ys: Float64Array[], eq: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const arr of ys) for (const v of arr) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  lo = Math.min(lo, eq);
  hi = Math.max(hi, eq);
  const minSpan = 0.06;
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.12;
  return { lo: Math.max(0, lo - pad), hi: Math.min(1, hi + pad) };
}

/** Smoothly tweened, hoverable line chart for the hypothetical trajectory. */
export default function TrajectoryChart({ series, span, ticks, fmtX, equilibrium }: Props) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const target = useMemo<Frame>(() => {
    const ys = series.map((s) => resample(s.points, span));
    const { lo, hi } = domain(ys, equilibrium);
    return { ys, lo, hi, eq: equilibrium };
  }, [series, span, equilibrium]);

  const [frame, setFrame] = useState<Frame>(target);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const from = frameRef.current;
    if (from.ys.length !== target.ys.length) {
      setFrame(target);
      return;
    }
    const start = performance.now();
    const dur = 750;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const lerp = (a: number, b: number) => a + (b - a) * e;
      setFrame({
        ys: target.ys.map((arr, si) => arr.map((v, i) => lerp(from.ys[si][i], v)) as Float64Array),
        lo: lerp(from.lo, target.lo),
        hi: lerp(from.hi, target.hi),
        eq: lerp(from.eq, target.eq),
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const [hover, setHover] = useState<number | null>(null);

  const w = Math.max(260, width);
  const h = Math.round(Math.min(300, Math.max(210, w * 0.48)));
  const pad = { l: 40, r: 16, t: 16, b: 30 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const sx = (i: number) => pad.l + (i / N) * iw;
  const sy = (v: number) => pad.t + (1 - (v - frame.lo) / (frame.hi - frame.lo || 1)) * ih;

  const pathOf = (arr: Float64Array) => {
    let d = '';
    for (let i = 0; i <= N; i++) d += `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(arr[i]).toFixed(1)}`;
    return d;
  };
  const mainIdx = series.findIndex((s) => s.variant === 'main');
  const area = mainIdx >= 0 ? `${pathOf(frame.ys[mainIdx])}L${sx(N)},${pad.t + ih}L${sx(0)},${pad.t + ih}Z` : '';

  const yTicks = useMemo(() => {
    const span = frame.hi - frame.lo;
    const step = span > 0.5 ? 0.2 : span > 0.25 ? 0.1 : span > 0.1 ? 0.05 : span > 0.04 ? 0.01 : 0.005;
    const out: number[] = [];
    for (let v = Math.ceil(frame.lo / step) * step; v <= frame.hi + 1e-9; v += step) out.push(v);
    return out;
  }, [frame.lo, frame.hi]);

  const magnified = frame.hi - frame.lo < 0.3;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * N);
    setHover(Math.max(0, Math.min(N, i)));
  };

  const hx = hover !== null ? sx(hover) : 0;

  return (
    <div ref={ref} className="traj-chart">
      <svg width={w} height={h} role="img" aria-label="Hypothetical persistence index over time">
        {yTicks.map((v) => (
          <g key={v.toFixed(4)}>
            <line x1={pad.l} x2={w - pad.r} y1={sy(v)} y2={sy(v)} className="grid" />
            <text x={pad.l - 8} y={sy(v) + 3} className="axis-t" textAnchor="end">
              {(v * 100).toFixed(yTicks.length > 1 && yTicks[1] - yTicks[0] < 0.01 ? 1 : 0)}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={pad.l + (t / span) * iw} y={h - 9} className="axis-t" textAnchor="middle">
            {fmtX(t)}
          </text>
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={sy(frame.eq)} y2={sy(frame.eq)} className="eq-line" />
        <text x={w - pad.r} y={sy(frame.eq) - 6} className="axis-t eq-t" textAnchor="end">
          model equilibrium
        </text>
        <path d={area} className="traj-area" />
        {series.map((s, i) => (
          <path key={s.id} d={pathOf(frame.ys[i] ?? new Float64Array(N + 1))} className={`traj-line ${s.variant}`} />
        ))}
        {mainIdx >= 0 && (
          <circle cx={sx(N)} cy={sy(frame.ys[mainIdx][N])} r={4} className="traj-end" />
        )}
        {hover !== null && (
          <g className="traj-hover">
            <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + ih} />
            {series.map((s, i) => (
              <circle key={s.id} cx={hx} cy={sy(frame.ys[i][hover])} r={s.variant === 'main' ? 4 : 3} className={`hv ${s.variant}`} />
            ))}
          </g>
        )}
        <rect
          x={pad.l}
          y={pad.t}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      <div className="traj-readout mono" aria-live="polite">
        {hover !== null ? (
          <>
            <span>{fmtX((hover / N) * span)}</span>
            {series.map((s, i) => (
              <span key={s.id} className={`ro ${s.variant}`}>
                <i />
                {(frame.ys[i][hover] * 100).toFixed(1)}
              </span>
            ))}
          </>
        ) : (
          <span className="muted">Hover or drag across the graph to inspect values{magnified ? ' · y-axis magnified' : ''}</span>
        )}
      </div>
    </div>
  );
}
