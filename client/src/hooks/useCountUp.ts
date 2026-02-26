/**
 * useCountUp hook
 * Animates a number from 0 to target value
 */

import { useEffect, useState } from "react";

export function useCountUp(target: number, duration = 1200, decimals = 2): string {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setCurrent(0);
      return;
    }

    const startTime = performance.now();
    const startValue = 0;

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    let animationId: number;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const value = startValue + (target - startValue) * eased;
      setCurrent(value);

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      }
    }

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [target, duration]);

  return current.toFixed(decimals);
}
