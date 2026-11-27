import clsx from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet-danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  // One per screen: the action that matters.
  primary: 'bg-primary text-on-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-[1.08] disabled:opacity-45',
  secondary: 'bg-raised text-ink border border-edge hover:bg-pressed disabled:opacity-45',
  ghost: 'text-ink-2 hover:text-ink hover:bg-raised disabled:opacity-40',
  'quiet-danger': 'text-danger hover:bg-raised disabled:opacity-40',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] gap-1.5',
  md: 'h-10 px-5 text-[14px] gap-2',
  lg: 'h-13 px-7 text-[15.5px] gap-2.5',
};

/** Capsules for anything pressed. Labels say what happens. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-[560] whitespace-nowrap select-none',
        'transition-[transform,background-color,filter,color,opacity] duration-150 ease-[var(--ease-out-quint)] active:scale-[0.97] disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === 'lg' ? 20 : 18} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
});

export function IconButton({
  icon,
  label,
  className,
  size = 40,
  ...rest
}: { icon: IconName; label: string; size?: number } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-grid shrink-0 place-items-center rounded-full text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-raised hover:text-ink active:scale-[0.94]',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} />
    </button>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
