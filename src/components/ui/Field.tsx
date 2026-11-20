import clsx from 'clsx';
import { useId, type InputHTMLAttributes } from 'react';

/** A labelled text field. Errors say what happened and what to do. */
export function Field({
  label,
  value,
  onChange,
  error,
  hint,
  large,
  className,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  large?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-[13px] font-[620] text-ink-2">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={clsx(
          'w-full rounded-[12px] border bg-surface px-4 text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-3',
          'focus:border-gold focus:shadow-[0_0_0_3px_var(--gold-soft)]',
          large ? 'tabular h-14 text-[24px] tracking-[0.14em]' : 'h-12 text-[16px]',
          error ? 'border-danger' : 'border-edge',
        )}
        {...rest}
      />
      {error ? (
        <p id={messageId} className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
