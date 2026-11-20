import { useEffect, useState } from 'react';

/**
 * The current time, re-rendering every `intervalMs`. Aligned to the wall clock, so a 1-second
 * clock ticks on the second rather than drifting.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => clearTimeout(timer);
  }, [intervalMs]);
  return now;
}
