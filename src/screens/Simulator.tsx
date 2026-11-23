import { useState } from 'react';
import type { ModelInputs, ModelResult } from '../model/effortModel';
import { SIGMOID_K, band, interpret } from '../model/effortModel';
import AnimatedNumber from '../ui/AnimatedNumber';
import SigmoidPlot from '../ui/SigmoidPlot';
import Tag from '../ui/Tag';

interface Option {
  label: string;
  value: number;
}

/** Step 1: a concrete, recent moment the person can picture. */
const MOMENTS: { id: string; label: string; doing: string }[] = [
  { id: 'trash', label: 'Taking out the trash', doing: 'getting up to take out the trash' },
  { id: 'exercise', label: 'A workout', doing: 'starting the workout' },
  { id: 'phone', label: 'Studying, with my phone nearby', doing: 'getting back to studying' },
  { id: 'avoided', label: 'A task I kept putting off', doing: 'starting that task' },
  { id: 'route', label: 'Choosing the harder option', doing: 'taking on the harder option' },
  { id: 'commitment', label: 'A promise I made to myself', doing: 'following through on that promise' },
];

/** Step 2: how hard it felt → effort. */
const EFFORT: Option[] = [
  { label: 'No big deal — I just did it', value: 1 },
  { label: 'A bit annoying', value: 3 },
  { label: 'I had to push myself', value: 5 },
  { label: 'I really didn’t want to', value: 7 },
  { label: 'It felt like climbing a mountain', value: 9 },
];

/** Step 3: what it gave back → reward. */
const REWARD: Option[] = [
  { label: 'Nothing, really', value: 1 },
  { label: 'A small relief', value: 3 },
  { label: 'It was useful', value: 5 },
  { label: 'I felt good about myself', value: 7 },
  { label: 'It mattered a lot to me', value: 9 },
];

/** Step 4: what usually happens in moments like this → effort sensitivity. */
const HABIT: Option[] = [
  { label: 'I just do it', value: 2 },
  { label: 'I do it, after a little delay', value: 4 },
  { label: 'I often put it off', value: 6 },
  { label: 'I usually find a way out of it', value: 8 },
];

/** Option whose value is closest to v (seeded values may fall between options). */
const nearest = (options: Option[], v: number) =>
  options.reduce((best, o) => (Math.abs(o.value - v) < Math.abs(best - v) ? o.value : best), options[0].value);

interface Props {
  inputs: ModelInputs;
  setInputs: (i: ModelInputs) => void;
  result: ModelResult | null;
  history: ModelResult[];
  stale: boolean;
  acted: number;
  total: number;
  seededSensitivity: number;
  runCount: number;
  onRun: () => void;
  onNext: () => void;
}

const f2 = (n: number) => n.toFixed(2);

function Step({
  n,
  text,
  children,
  note,
}: {
  n: number;
  text: string;
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="question reveal-1" role="group" aria-label={text}>
      <span className="label">Step {n}</span>
      <p className="q-text">{text}</p>
      <div className="chips">{children}</div>
      {note && <p className="fine">{note}</p>}
    </div>
  );
}

export default function Simulator({
  inputs,
  setInputs,
  result,
  history,
  stale,
  acted,
  total,
  seededSensitivity,
  runCount,
  onRun,
  onNext,
}: Props) {
  const [moment, setMoment] = useState<string | null>(null);
  const [answeredEffort, setAnsweredEffort] = useState(false);
  const [answeredReward, setAnsweredReward] = useState(false);

  const maxBar = result ? Math.max(1, result.R, result.cost) : 1;
  const story = MOMENTS.find((m) => m.id === moment);
  const habitSelected = nearest(HABIT, inputs.sensitivity);
  const ready = !!story && answeredEffort && answeredReward;

  const option = (opt: Option, selected: boolean, onPick: () => void) => (
    <button key={opt.value} className={`chip ${selected ? 'on' : ''}`} aria-pressed={selected} onClick={onPick}>
      {opt.label}
    </button>
  );

  return (
    <div className="panel-inner sim">
      <header className="panel-head reveal-1">
        <Tag kind="model">Illustrative model</Tag>
        <h2 className="h2">Effort against reward.</h2>
        <p className="body muted">Think of one real moment. Answer a few questions about it. See what the model makes of it.</p>
      </header>

      <div className="questions reveal-2">
        <Step n={1} text="Think of the last time you had to do something you didn’t feel like doing. What was it?">
          {MOMENTS.map((m) => (
            <button
              key={m.id}
              className={`chip ${moment === m.id ? 'on' : ''}`}
              aria-pressed={moment === m.id}
              onClick={() => setMoment(m.id)}
            >
              {m.label}
            </button>
          ))}
        </Step>

        {story && (
          <Step n={2} text={`Right before ${story.doing}, how did it feel?`}>
            {EFFORT.map((o) =>
              option(o, answeredEffort && inputs.effort === o.value, () => {
                setAnsweredEffort(true);
                setInputs({ ...inputs, effort: o.value });
              }),
            )}
          </Step>
        )}

        {story && answeredEffort && (
          <Step n={3} text="And once it was done — what did you get out of it?">
            {REWARD.map((o) =>
              option(o, answeredReward && inputs.reward === o.value, () => {
                setAnsweredReward(true);
                setInputs({ ...inputs, reward: o.value });
              }),
            )}
          </Step>
        )}

        {ready && (
          <Step
            n={4}
            text="Be honest: when something feels like that, what usually happens?"
            note={
              <>
                Pre-selected from your earlier answers (you chose the effortful option {acted} of {total} times). Change
                it if it doesn’t sound like you.
                {inputs.sensitivity !== seededSensitivity && (
                  <>
                    {' '}
                    <button className="link" onClick={() => setInputs({ ...inputs, sensitivity: seededSensitivity })}>
                      Restore
                    </button>
                  </>
                )}
              </>
            }
          >
            {HABIT.map((o) =>
              option(o, habitSelected === o.value, () => setInputs({ ...inputs, sensitivity: o.value })),
            )}
          </Step>
        )}
      </div>

      {(ready || result) && (
        <>
          <p className="fine">Your answers become model parameters — they are not measured biological variables.</p>
          <button className={`btn btn-primary btn-run ${stale && result ? 'pulse' : ''}`} onClick={onRun}>
            {result ? 'Run simulation again' : 'Run simulation'}
          </button>
        </>
      )}

      {result && (
        <div className={`results ${stale ? 'stale' : ''}`} key={runCount}>
          <div className="result-main">
            <span className="label">Simulated action tendency</span>
            <div className={`big-number band-${band(result.tendency)}`}>
              <AnimatedNumber value={result.tendency * 100} />
              <span className="pct">%</span>
            </div>
            <p className="interp">{interpret(result)}</p>
            {stale && <p className="fine stale-note">Answers changed — run again to update.</p>}
          </div>

          <div className="bars">
            <div className="bar-row">
              <span className="label">Expected reward</span>
              <span className="mono small">R = {f2(result.R)}</span>
              <div className="bar">
                <span className="fill reward" style={{ width: `${(result.R / maxBar) * 100}%` }} />
              </div>
            </div>
            <div className="bar-row">
              <span className="label">Effort cost</span>
              <span className="mono small">E × C = {f2(result.cost)}</span>
              <div className="bar">
                <span className="fill cost" style={{ width: `${(result.cost / maxBar) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="equation mono">
            <div>
              <span className="muted">V</span> = R − (E × C) = {f2(result.R)} − ({f2(result.E)} × {f2(result.C)}) ={' '}
              <b>{result.value >= 0 ? '+' : ''}{f2(result.value)}</b>
            </div>
            <div>
              <span className="muted">P</span> = 1 / (1 + e<sup>−{SIGMOID_K}·V</sup>) = <b>{f2(result.tendency)}</b>
            </div>
          </div>

          <SigmoidPlot current={result} history={history.slice(0, -1)} k={SIGMOID_K} />
          <p className="fine">
            Each run is plotted on the sigmoid. The percentage is a model output — not a probability of what you will
            actually do, and not a reading of brain activity.
          </p>
        </div>
      )}

      {result && (
        <button className="btn btn-ghost" onClick={onNext}>
          What if this repeated for years? →
        </button>
      )}
    </div>
  );
}
