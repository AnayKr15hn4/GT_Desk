import clsx from 'clsx';
import { LayoutGroup, motion } from 'motion/react';
import { useId, type KeyboardEvent } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Pill toggles. The selected one inverts (text-colour fill), as on the phone, and the fill slides
 * between options. Arrow keys move the selection.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  tone = 'solid',
  className,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  tone?: 'solid' | 'glass';
  className?: string;
}) {
  const id = useId();
  const index = options.findIndex((o) => o.value === value);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
  };
  return (
    <LayoutGroup id={id}>
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={clsx(
          'inline-flex items-center gap-1 rounded-full p-1',
          // Its glass tone sits over the spinning globe: still glass, no blur to redo every frame.
          tone === 'glass' ? 'glass-still !shadow-none' : 'bg-raised border border-hairline',
          className,
        )}
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={clsx(
                'relative rounded-full font-[560] whitespace-nowrap transition-colors duration-200',
                size === 'sm' ? 'h-7 px-3 text-[12.5px]' : 'h-9 px-4.5 text-[13.5px]',
                selected ? 'text-canvas' : 'text-ink-2 hover:text-ink',
              )}
            >
              {selected ? (
                <motion.span
                  layoutId="segment-fill"
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.8 }}
                />
              ) : null}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** A single on/off pill, for multi-select rows of options (sports, session kinds). */
export function TogglePill({
  pressed,
  onClick,
  children,
  disabled,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13.5px] font-[560] transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.97]',
        pressed ? 'border-ink bg-ink text-canvas' : 'border-edge text-ink-2 hover:border-ink-3 hover:text-ink',
        disabled && 'opacity-45',
      )}
    >
      {children}
    </button>
  );
}
