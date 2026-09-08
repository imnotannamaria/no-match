"use client";

// The two counts are the only claim this page makes at a glance, so a
// change in one has to be noticed. Counting up from the previous value
// makes the change legible without a caption saying "this changed".
//
// Every state write happens inside the animation frame, never in the
// effect body: React's compiler lint rejects the latter, and it would
// also cost an extra render on every search.

import { useEffect, useRef, useState } from "react";

const DURATION = 620;

export function useCountUp(target: number | null): number | null {
  const [display, setDisplay] = useState<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    let frame = 0;

    if (target === null) {
      frame = requestAnimationFrame(() => {
        from.current = 0;
        setDisplay(null);
      });
      return () => cancelAnimationFrame(frame);
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;

    if (reduced || start === target) {
      frame = requestAnimationFrame(() => {
        from.current = target;
        setDisplay(target);
      });
      return () => cancelAnimationFrame(frame);
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DURATION);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        from.current = target;
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return display;
}
