import { motion } from 'motion/react';
import { useCallback } from 'react';
import { Outlet, useLocation } from 'react-router';

import { CommandPalette } from '@/components/dialogs/CommandPalette';
import { PhoneDialog } from '@/components/dialogs/PhoneDialog';
import { PremiumDialog } from '@/components/dialogs/PremiumDialog';
import { SetAlarmDialog } from '@/components/dialogs/SetAlarmDialog';
import { ShortcutsDialog } from '@/components/dialogs/ShortcutsDialog';
import { SignInDialog } from '@/components/dialogs/SignInDialog';
import { Footer } from '@/components/shell/Footer';
import { TopBar } from '@/components/shell/TopBar';
import { Toaster } from '@/components/ui/Toast';
import { useSchedule } from '@/hooks/use-schedule';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { openSetAlarm } from '@/stores/ui';

import { useDesktopChime } from './chime';
import { useShortcuts } from './shortcuts';
import { SmoothScroll } from './SmoothScroll';
import { useApplyTheme } from './theme';

export function Shell() {
  useApplyTheme();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const { next } = useSchedule();
  const setNext = useCallback(() => {
    if (next) openSetAlarm(next.event.id, [next.session.id]);
  }, [next]);
  useShortcuts(setNext);
  useDesktopChime();

  return (
    <SmoothScroll>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <TopBar />
      <motion.main
        id="main"
        key={pathname.split('/')[1] || 'home'}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      >
        <Outlet />
      </motion.main>
      <Footer onSetNext={next ? setNext : undefined} />
      <Toaster />
      <SignInDialog />
      <SetAlarmDialog />
      <PhoneDialog />
      <PremiumDialog />
      <CommandPalette />
      <ShortcutsDialog />
    </SmoothScroll>
  );
}
