import { useEffect, useState } from 'react';
import type { Choice, Scenario } from '../data/scenarios';

interface Props {
  scenario: Scenario;
  /** 0-based position in the onboarding (0 = opening dilemma) */
  index: number;
  total: number;
  onChoose: (c: Choice) => void;
}

export default function Question({ scenario, index, total, onChoose }: Props) {
  const [picked, setPicked] = useState<Choice | null>(null);

  useEffect(() => setPicked(null), [scenario.id]);

  const choose = (c: Choice) => {
    if (picked) return;
    setPicked(c);
    window.setTimeout(() => onChoose(c), 620);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === 'ArrowLeft') choose('act');
      if (e.key === '2' || e.key === 'ArrowRight') choose('avoid');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isOpening = index === 0;

  return (
    <section className="screen question" key={scenario.id}>
      <div className="q-meta">
        <span className="label mono">
          {String(index + 1).padStart(2, '0')} <span className="muted">/ {String(total).padStart(2, '0')}</span>
        </span>
        <div className="q-progress" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={i <= index ? 'on' : ''} />
          ))}
        </div>
      </div>

      <div className="q-body">
        <h2 className="q-lead reveal-1">{scenario.lead}</h2>
        <p className="q-text reveal-2">{scenario.body}</p>
        <p className="q-ask reveal-3">{isOpening ? 'What do you do?' : 'Do you…'}</p>
      </div>

      <div className={`choices reveal-4 ${picked ? 'has-pick' : ''}`}>
        {(['act', 'avoid'] as const).map((c, i) => (
          <button
            key={c}
            className={`choice ${picked === c ? 'picked' : ''} ${picked && picked !== c ? 'dimmed' : ''}`}
            onClick={() => choose(c)}
            aria-pressed={picked === c}
          >
            <span className="choice-key mono">{i + 1}</span>
            <span className="choice-text">{c === 'act' ? scenario.act : scenario.avoid}</span>
            <span className="choice-arrow" aria-hidden>
              →
            </span>
          </button>
        ))}
      </div>

      <p className="fine q-foot">There are no right answers. These are illustrative situations, not a test.</p>
    </section>
  );
}
