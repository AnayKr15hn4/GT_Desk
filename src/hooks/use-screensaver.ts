import { useEffect } from 'react';

/** Seconds of stillness before the hero goes into screensaver mode. */
const IDLE_MS = 7_000;

/**
 * Screensaver mode for Up next: after IDLE_MS without the mouse, keys, scroll or touch, while the
 * hero is in view, <html data-idle> is set and everything marked data-idle-hide fades away,
 * leaving the event name, the clock and the logo over the map. Any movement brings it all back.
 */
export function useScreensaver(enabled: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      delete root.dataset.idle;
      return;
    }
    let timer = 0;
    const sleep = () => {
      // Only at the top of the page, where the hero fills the screen, and not over an open dialog.
      if (window.scrollY < 40 && !document.querySelector('dialog[open]')) root.dataset.idle = '';
      else wake();
    };
    const wake = () => {
      delete root.dataset.idle;
      window.clearTimeout(timer);
      timer = window.setTimeout(sleep, IDLE_MS);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, wake, { passive: true });
    wake();
    return () => {
      for (const e of events) window.removeEventListener(e, wake);
      window.clearTimeout(timer);
      delete root.dataset.idle;
    };
  }, [enabled]);
}
