import type { Choice } from '../data/scenarios';
import { QUESTIONS } from '../data/scenarios';

interface Props {
  choices: Choice[];
  onNext: () => void;
}

export default function Reveal({ choices, onNext }: Props) {
  const acted = choices.filter((c) => c === 'act').length;
  return (
    <div className="panel-inner reveal-panel">
      <p className="label reveal-1">Inside</p>
      <h2 className="h2 reveal-2">Your decisions are part of a system that weighs effort against reward.</h2>
      <p className="body reveal-3">
        The <span className="accent">anterior midcingulate cortex (aMCC)</span> is one of the brain regions involved in
        networks supporting effort-based decisions, cognitive control and persistence.
      </p>
      <p className="body muted reveal-3">This simulation uses a simplified computational model inspired by these processes.</p>

      <div className="choice-strip reveal-4">
        <div className="strip-head">
          <span className="label">Your choices</span>
          <span className="mono small">
            {acted} of {choices.length} effortful
          </span>
        </div>
        <ol className="dots">
          {choices.map((c, i) => (
            <li key={i} className={c} title={`${QUESTIONS[i].short}: ${c === 'act' ? QUESTIONS[i].act : QUESTIONS[i].avoid}`}>
              <span className="dot" />
              <span className="dot-label">{QUESTIONS[i].short}</span>
            </li>
          ))}
        </ol>
        <p className="fine">
          Your choices did not activate or measure your aMCC. They will seed one parameter of the model.
        </p>
      </div>

      <button className="btn btn-primary reveal-5" onClick={onNext}>
        Open the model
      </button>
      <p className="fine reveal-5 drag-hint">Drag to rotate · scroll or pinch to zoom</p>
    </div>
  );
}
