import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';

import { IconButton } from './Button';

/**
 * A modal on the browser's own <dialog>: it traps focus, closes on Escape and makes the page
 * behind it inert. Entry and exit are CSS transitions (see .gt-dialog in index.css).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  width = 520,
  className,
  bare = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  width?: number;
  className?: string;
  /** No header: the content draws its own (the command palette). */
  bare?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs before the dialog opens, so focus the first field once it has.
      requestAnimationFrame(() => dialog.querySelector<HTMLElement>('input, textarea, select')?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === ref.current) onClose();
      }}
      className={clsx('gt-dialog m-auto max-h-[min(860px,calc(100dvh-48px))] bg-transparent p-0 text-ink', className)}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
    >
      {open ? (
        <div className="dial flex max-h-[calc(100dvh-48px)] flex-col overflow-hidden rounded-[28px]">
          {bare ? (
            children
          ) : (
            <>
              <header className="flex shrink-0 items-start justify-between gap-4 px-7 pt-6">
                <div className="flex flex-col gap-1.5 pt-1">
                  <h2 className="semiwide text-[22px] font-[640] leading-tight">{title}</h2>
                  {description ? <div className="text-[14px] leading-relaxed text-ink-2">{description}</div> : null}
                </div>
                <IconButton icon="close" label="Close" onClick={onClose} className="-mr-2" />
              </header>
              {/* The body scrolls on short screens; Lenis leaves it to the browser. */}
              <div className="min-h-0 overflow-y-auto overscroll-contain px-7 pt-5 pb-7" data-lenis-prevent>
                {children}
              </div>
            </>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
