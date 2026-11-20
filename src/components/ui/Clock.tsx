import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { clockParts } from '@/lib/time';

type ClockSize = 'mega' | 'hero' | 'clock' | 'time' | 'row';

const sizes: Record<ClockSize, { time: string; period: string }> = {
  // Sized by width and height, so it stays inside short laptop screens.
  mega: { time: 'text-[clamp(72px,min(10vw,17vh),168px)] leading-[0.86]', period: 'text-[clamp(18px,min(1.9vw,3vh),30px)] font-[420] tracking-normal ml-3' },
  hero: { time: 'text-[clamp(64px,6.6vw,108px)] leading-[0.9]', period: 'text-[clamp(16px,1.4vw,22px)] font-[420] tracking-normal ml-2.5' },
  clock: { time: 'text-[44px] leading-none', period: 'text-[15px] font-[460] tracking-normal ml-1.5' },
  time: { time: 'text-[28px] leading-none font-[260]', period: 'text-[12.5px] font-[500] tracking-normal ml-1' },
  row: { time: 'text-[22px] leading-none font-[280]', period: 'text-[11.5px] font-[520] tracking-normal ml-1' },
};

/**
 * Dial numerals: your time large and ultralight, with a small AM/PM, like the hour on a watch.
 */
export function Clock({
  iso,
  timeZone,
  hour12,
  size = 'time',
  className,
}: {
  iso: string;
  timeZone: string;
  hour12: boolean;
  size?: ClockSize;
  className?: string;
}) {
  const { time, period } = clockParts(iso, timeZone, hour12);
  const s = sizes[size];
  return (
    <span className={clsx('inline-flex items-baseline whitespace-nowrap', className)}>
      <span className={clsx('numerals', s.time)}>{time}</span>
      {period ? <span className={clsx('text-ink-2', s.period)}>{period}</span> : null}
    </span>
  );
}

/**
 * Characters that roll in as they change, for a ticking countdown. Only a character that changed
 * moves; tabular figures keep every width steady, so nothing shifts.
 */
export function RollingText({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={clsx('tabular', className)}>{text}</span>;
  return (
    <span className={clsx('tabular inline-flex', className)} aria-label={text} role="text">
      {[...text].map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              className="inline-block"
              initial={{ y: '-70%', opacity: 0, filter: 'blur(2px)' }}
              animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: '70%', opacity: 0, filter: 'blur(2px)' }}
              transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
