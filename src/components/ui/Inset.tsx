import clsx from 'clsx';
import type { ReactNode } from 'react';

/** Rows of the same kind sit in one inset group with hairlines, not in separate cards. */
export function InsetGroup({ title, footer, children, className, action }: { title?: string; footer?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={clsx('flex flex-col gap-2.5', className)}>
      {title || action ? (
        <div className="flex items-end justify-between gap-4 px-1">
          {title ? <h3 className="text-[13px] font-[620] text-ink-2">{title}</h3> : <span />}
          {action}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-1 divide-y divide-hairline">{children}</div>
      {footer ? <p className="px-1 text-[12.5px] leading-relaxed text-ink-3">{footer}</p> : null}
    </section>
  );
}

export function Row({
  children,
  onClick,
  className,
  as = 'div',
  selected,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  as?: 'div' | 'li';
  selected?: boolean;
}) {
  const Tag = as;
  const clickable = !!onClick;
  return (
    <Tag
      onClick={onClick}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? 'button' : undefined}
      aria-pressed={clickable && selected !== undefined ? selected : undefined}
      className={clsx(
        // Wraps in a narrow window: a control that doesn't fit beside its label drops below it instead of being cut off.
        'flex min-h-14 flex-wrap items-center gap-4 px-5 py-3.5 transition-colors duration-150',
        clickable && 'cursor-pointer hover:bg-raised focus-visible:bg-raised focus-visible:outline-none',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
