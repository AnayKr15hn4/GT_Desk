import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const list = matchMedia(query);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/** True when the person asked their computer for less motion. Everything holds still then. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false);
}

export const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia(query).matches;
