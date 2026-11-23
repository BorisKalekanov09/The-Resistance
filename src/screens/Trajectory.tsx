import { useMemo } from 'react';
import type { Choice } from '../data/scenarios';
import { QUESTIONS } from '../data/scenarios';
import type { ModelResult } from '../model/effortModel';
import type { BrainShift } from '../model/brainShift';
import type { Horizon, TrajectoryParams } from '../model/trajectory';
import { HORIZONS, equilibrium, simulateTrajectory } from '../model/trajectory';
import Slider from '../ui/Slider';
import Tag from '../ui/Tag';
import TrajectoryChart from '../ui/TrajectoryChart';
import type { ChartSeries } from '../ui/TrajectoryChart';

export interface Assumptions {
  perDay: number;
  adaptation: number;
  decay: number;
}

interface Props {
  choices: Choice[];
  result: ModelResult;
  shift: BrainShift | null;
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  assumptions: Assumptions;
  setAssumptions: (a: Assumptions) => void;
  onReplay: () => void;
  onBackToModel: () => void;
  onNext: () => void;
}

export default function Trajectory({
  choices,
  result,
  shift,
  horizon,
  setHorizon,
  assumptions,
  setAssumptions,
  onReplay,
  onBackToModel,
  onNext,
}: Props) {
  const acted = choices.filter((c) => c === 'act').length;
  const pChoices = choices.length ? acted / choices.length : 0.5;
  const spec = HORIZONS[horizon];

  const params: TrajectoryParams = useMemo(
    () => ({ R: result.R, E: result.E, C0: result.C, pChoices, ...assumptions }),
    [result, pChoices, assumptions],
  );

  const { series, eq, main } = useMemo(() => {
    const main = simulateTrajectory(params, horizon);
    const hi = simulateTrajectory(params, horizon, 1);
    const lo = simulateTrajectory(params, horizon, 0);
    const series: ChartSeries[] = [
      { id: 'hi', label: 'If every choice were effortful', points: hi.points, variant: 'ref-high' },
      { id: 'lo', label: 'If every choice were avoided', points: lo.points, variant: 'ref-low' },
      { id: 'main', label: 'Your repeated pattern', points: main.points, variant: 'main' },
    ];
    return { series, eq: equilibrium(params), main };
  }, [params, horizon]);

  const set = (k: keyof Assumptions) => (v: number) => setAssumptions({ ...assumptions, [k]: v });
  const delta = (main.final - 0.5) * 100;

  return (
    <div className="panel-inner traj">
      <header className="panel-head reveal-1">
        <span className="label">Your long-term trajectory</span>
        <h2 className="h2">What if this pattern were repeated over time?</h2>
        <p className="body muted">
          Repeated engagement in challenging activities is an interesting area of research involving learning, cognitive
          control and adaptation. The graph below is a hypothetical model illustrating how repeated behavioral patterns
          could be represented mathematically — not a prediction of brain changes.
        </p>
      </header>

      <div className="layer reveal-2">
        <Tag kind="actual" />
        <div className="layer-body">
          <ol className="dots compact">
            {choices.map((c, i) => (
              <li key={i} className={c} title={QUESTIONS[i].short}>
                <span className="dot" />
              </li>
            ))}
          </ol>
          <span className="small">
            {acted} of {choices.length} effortful in this session
          </span>
        </div>
      </div>

      <div className="layer reveal-2">
        <Tag kind="model" />
        <p className="small layer-body">
          Each modeled decision uses your last run (R {result.R.toFixed(2)}, E {result.E.toFixed(2)}, C{' '}
          {result.C.toFixed(2)}), blended 50/50 with your actual choice rate. Each effortful outcome nudges a
          dimensionless <i>persistence index</i> up; each avoided one lets it drift down.
        </p>
      </div>

      <div className="horizon reveal-3" role="tablist" aria-label="Time horizon">
        {(Object.keys(HORIZONS) as Horizon[]).map((h) => (
          <button key={h} role="tab" aria-selected={h === horizon} className={h === horizon ? 'on' : ''} onClick={() => setHorizon(h)}>
            {HORIZONS[h].label}
          </button>
        ))}
      </div>

      <div className="chart-wrap reveal-3">
        <div className="chart-head">
          <Tag kind="hypothetical" />
          <span className="mono small muted">{main.events.toLocaleString()} modeled decisions</span>
        </div>
        <TrajectoryChart series={series} span={spec.span} ticks={spec.ticks} fmtX={spec.fmt} equilibrium={eq} />
        <div className="legend">
          {series
            .slice()
            .reverse()
            .map((s) => (
              <span key={s.id} className={`lg ${s.variant}`}>
                <i />
                {s.label}
              </span>
            ))}
        </div>
        <div className="traj-stats">
          <div>
            <span className="label">Index after {spec.label}</span>
            <span className="stat mono">
              {(main.final * 100).toFixed(1)}
              <small>
                {' '}
                ({delta >= 0 ? '+' : ''}
                {delta.toFixed(1)})
              </small>
            </span>
          </div>
          <div>
            <span className="label">Model equilibrium</span>
            <span className="stat mono">{(eq * 100).toFixed(1)}</span>
          </div>
        </div>
        <p className="fine">
          Arbitrary units, starting at 50. In ten minutes, a pattern barely registers; only repetition moves the curve.
        </p>
      </div>

      {shift && (
        <div className={`brain-check trend-${shift.trend}`} key={`${horizon}-${shift.trend}`} role="status">
          <div className="brain-check-head">
            <span className="label">Brain check · {spec.label}</span>
            <Tag kind="hypothetical" />
          </div>
          <p className="brain-check-title">
            <span className="brain-check-icon" aria-hidden>
              {shift.trend === 'weaker' ? '↓' : shift.trend === 'stronger' ? '↑' : '–'}
            </span>
            {shift.title}
          </p>
          <p className="small">{shift.body}</p>
          {(shift.trend === 'weaker' || shift.trend === 'stronger') && (
            <p className="fine">Look at the brain on the left — the aMCC highlight now shows this change. Illustration, not a measurement.</p>
          )}
        </div>
      )}

      <details className="assumptions reveal-4" open>
        <summary>
          <span className="label">Change the assumptions</span>
        </summary>
        <div className="sliders">
          <Slider
            label="Effortful decisions per day"
            value={assumptions.perDay}
            min={1}
            max={10}
            step={1}
            format={(v) => v.toFixed(0)}
            onChange={set('perDay')}
            hint="months & years only"
          />
          <Slider label="Adaptation rate" value={assumptions.adaptation} min={1} max={10} step={0.5} onChange={set('adaptation')} minLabel="slow" maxLabel="fast" />
          <Slider label="Decay rate" value={assumptions.decay} min={1} max={10} step={0.5} onChange={set('decay')} minLabel="slow" maxLabel="fast" />
        </div>
        <div className="row-actions">
          <button className="link" onClick={onBackToModel}>
            ← Change R, E, C in the model
          </button>
          <button className="link" onClick={onReplay}>
            Replay the scenarios ↺
          </button>
        </div>
      </details>

      <div className="not-box reveal-4">
        <span className="label">This model does not predict</span>
        <p className="small">
          aMCC growth, brain volume, willpower, cognitive aging, dementia, Alzheimer’s disease or any future health
          outcome. The index is a mathematical abstraction of a repeated pattern.
        </p>
      </div>

      <button className="btn btn-primary" onClick={onNext}>
        What does science know? →
      </button>
    </div>
  );
}
