import { animate, svg } from 'animejs';
import { useEffect, useMemo, useRef } from 'react';

import { prefersReducedMotion } from '@/hooks/use-reduced-motion';
import { projectToSvg, type LngLat } from '@/lib/geo';

/** The racing line, north up, drawn in gold the first time it scrolls into view. */
export function CircuitOutline({ line, className }: { line: LngLat[]; className?: string }) {
  const { d, width, height } = useMemo(() => projectToSvg(line), [line]);
  const pathRef = useRef<SVGPathElement>(null);
  const startRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || prefersReducedMotion()) return;
    // Starts fully undrawn (start 0, end 0) until it scrolls into view.
    const [drawable] = svg.createDrawable(path, 0, 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        animate(drawable, { draw: ['0 0', '0 1'], duration: 2600, ease: 'inOutQuart' });
        if (startRef.current) animate(startRef.current, { opacity: { from: 0, to: 1 }, scale: { from: 0.4, to: 1 }, delay: 2300, duration: 600, ease: 'outBack' });
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(path);
    return () => observer.disconnect();
  }, [d]);

  const pad = 6;
  const start = d.match(/^M([\d.]+) ([\d.]+)/);
  return (
    <svg viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`} className={className} role="img" aria-label="Circuit layout">
      <path d={d} fill="none" stroke="var(--hairline)" strokeWidth={3.4} strokeLinejoin="round" />
      <path ref={pathRef} d={d} fill="none" stroke="var(--gold)" strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
      {start ? <circle ref={startRef} cx={start[1]} cy={start[2]} r={2.4} fill="var(--gold)" style={{ transformOrigin: `${start[1]}px ${start[2]}px` }} /> : null}
    </svg>
  );
}
