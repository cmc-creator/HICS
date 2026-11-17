import { useEffect, useState } from 'react';

// Animated count-up for dashboard stat tiles: numbers ease from
// 0 to their value on mount (and whenever the value changes, e.g.
// when async training data lands). Honors prefers-reduced-motion
// by jumping straight to the value.
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const safeTarget = Number.isFinite(target) ? target : 0;
    if (
      safeTarget === 0
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(safeTarget);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(safeTarget * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
