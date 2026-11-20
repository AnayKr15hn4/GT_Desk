import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { formatMinuteOfDay, nightLength, type NightWindow } from '@/lib/time';

const SIZE = 300;
const R = 116;
const C = SIZE / 2;
const STEP = 15;
const DAY = 24 * 60;

const angleOf = (minute: number) => (minute / DAY) * Math.PI * 2 - Math.PI / 2;
const point = (minute: number, r = R) => [C + Math.cos(angleOf(minute)) * r, C + Math.sin(angleOf(minute)) * r] as const;

function arcPath(from: number, to: number, r = R) {
  const length = (to - from + DAY) % DAY;
  const [x1, y1] = point(from, r);
  const [x2, y2] = point(to, r);
  const large = length > DAY / 2 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * Your night as an arc on a 24-hour dial: midnight at the top, noon at the bottom. Drag either
 * handle (or focus it and use the arrow keys) to change when your night starts and ends.
 */
export function NightDial({ night, onChange, hour12 }: { night: NightWindow; onChange: (n: NightWindow) => void; hour12: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);

  const minuteAt = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE - C;
    const y = ((clientY - rect.top) / rect.height) * SIZE - C;
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    return (Math.round(((a / (Math.PI * 2)) * DAY) / STEP) * STEP) % DAY;
  }, []);

  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const m = minuteAt(e.clientX, e.clientY);
    const next = dragging.current === 'start' ? { ...night, startMin: m } : { ...night, endMin: m };
    if (next.startMin !== next.endMin) onChange(next);
  };

  const key = (which: 'start' | 'end') => (e: KeyboardEvent<SVGGElement>) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? STEP : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -STEP : 0;
    if (!delta) return;
    e.preventDefault();
    const field = which === 'start' ? 'startMin' : 'endMin';
    const value = (night[field] + delta * (e.shiftKey ? 4 : 1) + DAY) % DAY;
    const next = { ...night, [field]: value };
    if (next.startMin !== next.endMin) onChange(next);
  };

  const length = nightLength(night);
  const hours = Math.floor(length / 60);
  const minutes = length % 60;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-[300px] w-[300px] touch-none select-none"
      onPointerMove={move}
      onPointerUp={() => (dragging.current = null)}
      onPointerLeave={() => (dragging.current = null)}
      role="group"
      aria-label={`Your night, ${formatMinuteOfDay(night.startMin, hour12)} to ${formatMinuteOfDay(night.endMin, hour12)}`}
    >
      <defs>
        <radialGradient id="night-dial" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="var(--dial-1)" />
          <stop offset="55%" stopColor="var(--dial-2)" />
          <stop offset="100%" stopColor="var(--dial-3)" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={C - 4} fill="url(#night-dial)" stroke="var(--dial-rim)" />
      {/* Hour ticks: long at the quarters. */}
      {Array.from({ length: 24 }, (_, h) => {
        const [x1, y1] = point(h * 60, R + 18);
        const [x2, y2] = point(h * 60, R + (h % 6 === 0 ? 8 : 13));
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-3)" strokeOpacity={h % 6 === 0 ? 0.9 : 0.4} strokeWidth={h % 6 === 0 ? 1.6 : 1} strokeLinecap="round" />;
      })}
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = point(h * 60, R - 26);
        return (
          <text key={h} x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-3)" className="tabular">
            {h === 0 ? (hour12 ? '12 AM' : '00') : h === 12 ? (hour12 ? 'Noon' : '12') : hour12 ? `${h % 12} ${h < 12 ? 'AM' : 'PM'}` : String(h).padStart(2, '0')}
          </text>
        );
      })}
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--hairline)" strokeWidth={14} />
      <path d={arcPath(night.startMin, night.endMin)} fill="none" stroke="var(--gold)" strokeOpacity={0.9} strokeWidth={14} strokeLinecap="round" />
      <text x={C} y={C - 4} textAnchor="middle" fontSize={34} fontWeight={220} fill="var(--ink)" className="tabular" letterSpacing={-1}>
        {hours}h{minutes ? ` ${minutes}m` : ''}
      </text>
      <text x={C} y={C + 20} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)">
        of night
      </text>
      {(['start', 'end'] as const).map((which) => {
        const m = which === 'start' ? night.startMin : night.endMin;
        const [x, y] = point(m);
        return (
          <g
            key={which}
            tabIndex={0}
            role="slider"
            aria-label={which === 'start' ? 'Night starts' : 'Night ends'}
            aria-valuemin={0}
            aria-valuemax={DAY - STEP}
            aria-valuenow={m}
            aria-valuetext={formatMinuteOfDay(m, hour12)}
            onKeyDown={key(which)}
            onPointerDown={(e) => {
              e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
              dragging.current = which;
            }}
            className="cursor-grab outline-none focus-visible:[&>circle:first-child]:stroke-[var(--ink)]"
          >
            <circle cx={x} cy={y} r={13} fill="var(--canvas)" stroke="var(--gold)" strokeWidth={2} />
            <circle cx={x} cy={y} r={4} fill={which === 'start' ? 'var(--gold)' : 'var(--ink)'} />
          </g>
        );
      })}
    </svg>
  );
}
