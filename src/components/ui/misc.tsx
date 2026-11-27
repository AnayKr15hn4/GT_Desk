import clsx from 'clsx';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';

/** A key cap, for shortcut hints. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        'inline-grid h-5.5 min-w-5.5 place-items-center rounded-md border border-edge bg-raised px-1.5 font-sans text-[11px] font-[600] text-ink-2 shadow-[inset_0_-1px_0_var(--hairline)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Small state marks. Gold only for things that need attention (overnight, alarm set). */
export function Tag({ tone = 'neutral', icon, children }: { tone?: 'neutral' | 'gold' | 'live'; icon?: IconName; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-[580] whitespace-nowrap',
        tone === 'gold' && 'bg-gold-soft text-gold',
        tone === 'live' && 'bg-[color-mix(in_srgb,var(--live)_14%,transparent)] text-live',
        tone === 'neutral' && 'bg-raised text-ink-2',
      )}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {tone === 'live' && !icon ? <span className="live-dot size-1.5 rounded-full bg-live" /> : null}
      {children}
    </span>
  );
}

/** A placeholder bar while something loads. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={clsx('skeleton block rounded-md', className)} aria-hidden />;
}

/** Section heading on the canvas: wide, quiet, sentence case. */
export function SectionTitle({ title, detail, action }: { title: string; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="flex flex-col gap-2">
        <h2 className="wide text-[clamp(28px,2.6vw,40px)] font-[640] leading-[1.02] text-ink">{title}</h2>
        {detail ? <p className="max-w-[62ch] text-[15px] text-ink-2">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[20px] border border-dashed border-edge px-8 py-10">
      <Icon name={icon} size={26} className="text-ink-3" />
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[17px] font-[620]">{title}</h3>
        {children ? <div className="max-w-[56ch] text-[14.5px] leading-relaxed text-ink-2">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/** A link out of the app, in a new tab. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={clsx('underline decoration-[color-mix(in_srgb,currentColor_35%,transparent)] underline-offset-[3px] transition-colors hover:text-ink hover:decoration-current', className)}
    >
      {children}
    </a>
  );
}

/** Something that didn't load, said plainly, with a way to try again. */
export function LoadError({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-dashed border-edge px-6 py-5">
      <p className="text-[14.5px] text-ink-2">{children}</p>
      <Button size="sm" icon="rotate" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
