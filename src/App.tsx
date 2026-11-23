import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Choice } from './data/scenarios';
import { QUESTIONS } from './data/scenarios';
import type { ModelInputs, ModelResult } from './model/effortModel';
import { runModel, sensitivityFromChoices } from './model/effortModel';
import type { Horizon } from './model/trajectory';
import { simulateTrajectory } from './model/trajectory';
import { brainShift } from './model/brainShift';
import Intro from './screens/Intro';
import Question from './screens/Question';
import Reveal from './screens/Reveal';
import Science from './screens/Science';
import Simulator from './screens/Simulator';
import Trajectory from './screens/Trajectory';
import type { Assumptions } from './screens/Trajectory';

const loadScene = () => import('./three/BrainScene');
const BrainScene = lazy(loadScene);

type Stage = 'intro' | 'q' | 'reveal' | 'sim' | 'traj' | 'science';
const LAB_STAGES: Stage[] = ['reveal', 'sim', 'traj', 'science'];
const NAV: { id: Stage; label: string }[] = [
  { id: 'reveal', label: 'Brain' },
  { id: 'sim', label: 'Model' },
  { id: 'traj', label: 'Trajectory' },
  { id: 'science', label: 'Science' },
];

const DEFAULT_ASSUMPTIONS: Assumptions = { perDay: 3, adaptation: 5, decay: 5 };
const TRANSITION_MS = 420;

function readDemo(): Stage | null {
  const d = new URLSearchParams(window.location.search).get('demo');
  return d && (['q', 'reveal', 'sim', 'traj', 'science'] as string[]).includes(d) ? (d as Stage) : null;
}

export default function App() {
  const demo = useMemo(readDemo, []);
  const demoChoices: Choice[] = ['act', 'avoid', 'act'];
  const seeded0 = sensitivityFromChoices(2 / 3);

  const [stage, setStage] = useState<Stage>(demo ?? 'intro');
  const [leaving, setLeaving] = useState<'all' | 'panel' | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [choices, setChoices] = useState<Choice[]>(demo && demo !== 'q' ? demoChoices : []);
  const [inputs, setInputs] = useState<ModelInputs>({ effort: 6, reward: 6, sensitivity: demo ? seeded0 : 5 });
  const [result, setResult] = useState<ModelResult | null>(
    demo === 'sim' || demo === 'traj' || demo === 'science' ? runModel({ effort: 6, reward: 6, sensitivity: seeded0 }) : null,
  );
  const [history, setHistory] = useState<ModelResult[]>([]);
  const [runCount, setRunCount] = useState(0);
  const [horizon, setHorizon] = useState<Horizon>('10mo');
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [replaying, setReplaying] = useState(false);
  const [highlight, setHighlight] = useState(!!demo && demo !== 'q');
  const panelRef = useRef<HTMLDivElement>(null);

  const inLab = LAB_STAGES.includes(stage);
  const acted = choices.filter((c) => c === 'act').length;
  const seeded = sensitivityFromChoices(choices.length ? acted / choices.length : 0.5);
  const shift = useMemo(() => {
    if (!result) return null;
    const pChoices = choices.length ? acted / choices.length : 0.5;
    const main = simulateTrajectory({ R: result.R, E: result.E, C0: result.C, pChoices, ...assumptions }, horizon);
    return brainShift(main.final, horizon);
  }, [result, choices.length, acted, assumptions, horizon]);
  const brainStatus = stage === 'traj' && shift ? shift : null;
  const stale = !!result && (result.inputs.effort !== inputs.effort || result.inputs.reward !== inputs.reward || result.inputs.sensitivity !== inputs.sensitivity);

  // Turn the aMCC highlight on shortly after the brain is revealed
  useEffect(() => {
    if (!inLab || highlight) return;
    const t = window.setTimeout(() => setHighlight(true), 1700);
    return () => window.clearTimeout(t);
  }, [inLab, highlight]);

  const go = useCallback(
    (next: Stage, mutate?: () => void) => {
      const both = LAB_STAGES.includes(next) && LAB_STAGES.includes(stage);
      setLeaving(both ? 'panel' : 'all');
      window.setTimeout(() => {
        mutate?.();
        setStage(next);
        setLeaving(null);
        window.scrollTo({ top: 0 });
        panelRef.current?.scrollTo({ top: 0 });
      }, TRANSITION_MS);
    },
    [stage],
  );

  const begin = () => {
    // fetch the 3D chunk and build the anatomy in idle time while the user answers
    void loadScene().then(() => import('./three/anatomy')).then((m) => m.prewarmAnatomy());
    go('q', () => {
      setQIndex(0);
      setChoices([]);
    });
  };

  const choose = (c: Choice) => {
    const nextChoices = [...choices, c];
    if (qIndex < QUESTIONS.length - 1) {
      go('q', () => {
        setChoices(nextChoices);
        setQIndex(qIndex + 1);
      });
      return;
    }
    const nActed = nextChoices.filter((x) => x === 'act').length;
    const sens = sensitivityFromChoices(nActed / nextChoices.length);
    if (replaying) {
      const nextInputs = { ...inputs, sensitivity: sens };
      go('traj', () => {
        setChoices(nextChoices);
        setInputs(nextInputs);
        const r = runModel(nextInputs);
        setResult(r);
        setHistory((h) => [...h, r].slice(-8));
        setRunCount((n) => n + 1);
        setReplaying(false);
      });
    } else {
      go('reveal', () => {
        setChoices(nextChoices);
        setInputs({ effort: 6, reward: 6, sensitivity: sens });
        setResult(null);
        setHistory([]);
      });
    }
  };

  const run = () => {
    const r = runModel(inputs);
    setResult(r);
    setHistory((h) => [...h, r].slice(-8));
    setRunCount((n) => n + 1);
  };

  const replay = () => {
    go('q', () => {
      setReplaying(true);
      setQIndex(0);
      setChoices([]);
    });
  };

  const restart = () => {
    go('intro', () => {
      setQIndex(0);
      setChoices([]);
      setInputs({ effort: 6, reward: 6, sensitivity: 5 });
      setResult(null);
      setHistory([]);
      setHorizon('10mo');
      setAssumptions(DEFAULT_ASSUMPTIONS);
      setReplaying(false);
      setHighlight(false);
      if (demo) window.history.replaceState(null, '', window.location.pathname);
    });
  };

  const navEnabled = (s: Stage) => (s === 'traj' || s === 'science' ? !!result : true);

  let panel: ReactNode = null;
  if (stage === 'reveal') panel = <Reveal choices={choices} onNext={() => go('sim')} />;
  if (stage === 'sim')
    panel = (
      <Simulator
        inputs={inputs}
        setInputs={setInputs}
        result={result}
        history={history}
        stale={stale}
        acted={acted}
        total={choices.length}
        seededSensitivity={seeded}
        runCount={runCount}
        onRun={run}
        onNext={() => go('traj')}
      />
    );
  if (stage === 'traj' && result)
    panel = (
      <Trajectory
        choices={choices}
        result={result}
        shift={shift}
        horizon={horizon}
        setHorizon={setHorizon}
        assumptions={assumptions}
        setAssumptions={setAssumptions}
        onReplay={replay}
        onBackToModel={() => go('sim')}
        onNext={() => go('science')}
      />
    );
  if (stage === 'science') panel = <Science onRestart={restart} onBack={() => go('traj')} />;

  return (
    <div className={`app ${inLab ? 'is-lab' : ''}`}>
      <header className={`topbar ${stage === 'intro' ? 'hidden' : ''}`}>
        <button className="wordmark" onClick={restart} title="Restart">
          The Resistance
        </button>
        {inLab && (
          <nav className="steps" aria-label="Sections">
            {NAV.map((n, i) => (
              <button
                key={n.id}
                className={`${stage === n.id ? 'on' : ''}`}
                disabled={!navEnabled(n.id)}
                onClick={() => stage !== n.id && go(n.id)}
              >
                <span className="mono">{String(i + 1).padStart(2, '0')}</span> {n.label}
              </button>
            ))}
          </nav>
        )}
        {stage !== 'intro' && (
          <button className="link restart" onClick={restart}>
            Restart
          </button>
        )}
      </header>

      {!inLab && (
        <main className={`stage-plain ${leaving ? 'leaving' : ''}`} key={stage === 'q' ? `q-${qIndex}` : stage}>
          {stage === 'intro' && <Intro onBegin={begin} />}
          {stage === 'q' && (
            <Question scenario={QUESTIONS[qIndex]} index={qIndex} total={QUESTIONS.length} onChoose={choose} />
          )}
        </main>
      )}

      {inLab && (
        <main className={`lab ${leaving === 'all' ? 'leaving' : ''}`}>
          <div className="lab-stage">
            <div className="iris">
              <Suspense fallback={<div className="scene-loading label">Preparing anatomy…</div>}>
                <BrainScene highlight={highlight} showLabel={highlight} status={brainStatus} />
              </Suspense>
            </div>
            <p className="stage-caption fine">
              Head: 3D scan by Lee Perry-Smith, Infinite Realities (CC BY 3.0). Brain illustrative, generated
              procedurally; not a depiction of neural activity.
            </p>
          </div>
          <div className="lab-panel" ref={panelRef}>
            <div className={`panel-anim ${leaving === 'panel' ? 'leaving' : ''}`} key={stage}>
              {panel}
            </div>
            <footer className="disclaimer fine">
              Illustrative educational model. Not a measurement of brain activity, a digital twin, a diagnostic tool, or
              a predictor of brain development, dementia or Alzheimer’s disease.
            </footer>
          </div>
        </main>
      )}
    </div>
  );
}
