import { useId } from 'react';

interface Props {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  minLabel?: string;
  maxLabel?: string;
}

export default function Slider({
  label,
  hint,
  value,
  min = 0,
  max = 10,
  step = 0.5,
  onChange,
  format = (v) => v.toFixed(1),
  minLabel,
  maxLabel,
}: Props) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id} className="label">
          {label}
        </label>
        <span className="mono slider-value">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      {(minLabel || maxLabel || hint) && (
        <div className="slider-foot">
          <span>{minLabel}</span>
          {hint && <span className="slider-hint">{hint}</span>}
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
