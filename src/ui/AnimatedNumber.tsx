import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
}

/** Tweens from the previously displayed value to the new one. */
export default function AnimatedNumber({ value, decimals = 0, duration = 1100, suffix = '' }: Props) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const shownRef = useRef(0);

  useEffect(() => {
    from.current = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const v = from.current + (value - from.current) * e;
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  );
}
