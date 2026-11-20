import { useEffect, useSyncExternalStore } from 'react';

import { useSchedule } from '@/hooks/use-schedule';
import { isOvernight } from '@/lib/time';
import { useClock, usePreferences } from '@/stores/preferences';

const lightQuery = '(prefers-color-scheme: light)';

function subscribe(onChange: () => void) {
  const list = matchMedia(lightQuery);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/** The theme in use right now: the saved choice, or the computer's when set to Automatic. */
export function useResolvedTheme(): 'midnight' | 'porcelain' {
  const mode = usePreferences((s) => s.theme);
  const night = usePreferences((s) => s.night);
  const { timeZone } = useClock();
  const { next } = useSchedule();
  const systemLight = useSyncExternalStore(subscribe, () => matchMedia(lightQuery).matches, () => false);
  if (mode === 'system') return systemLight ? 'porcelain' : 'midnight';
  // Follows the next session: dark if it starts during your night, light if it's a daytime start.
  if (mode === 'event') return next && isOvernight(next.session.startUtc, timeZone, night) ? 'midnight' : 'porcelain';
  return mode;
}

/** Keeps <html data-theme> and the browser's theme colour in step with the resolved theme. */
export function useApplyTheme() {
  const theme = useResolvedTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'porcelain' ? '#F3F4F6' : '#0B1220');
  }, [theme]);
  return theme;
}
