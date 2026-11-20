import { AnimatePresence, motion } from 'motion/react';

import { Icon } from './Icon';
import { useToasts } from './toast-store';

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="glass pointer-events-auto flex items-center gap-3 rounded-full py-2.5 pr-2.5 pl-4.5 text-[14px] text-ink"
          >
            {t.icon ? <Icon name={t.icon} size={18} className="text-gold" /> : null}
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="rounded-full px-3 py-1 text-[13px] font-[600] text-gold hover:bg-raised"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : (
              <span className="w-1.5" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
