import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The element's size, measured right away on mount and kept current as it resizes. Measuring
 * synchronously matters: ResizeObserver doesn't report while a page renders in the background.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (width: number, height: number) =>
      setSize((s) => (Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height }));
    const measure = () => {
      const r = el.getBoundingClientRect();
      update(r.width, r.height);
    };
    measure();
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return [ref, size] as const;
}
