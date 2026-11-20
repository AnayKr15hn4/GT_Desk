import { sportMeta } from './sessions';
import type { SportEvent } from './types';

/** The big name: the headline bout for a Fight Night, the event's name otherwise. */
export function displayName(event: SportEvent): { title: string; kicker: string } {
  if (event.sport === 'ufc' && /fight night/i.test(event.name) && event.subtitle) {
    return { title: event.subtitle, kicker: event.name };
  }
  if (event.sport === 'f1') {
    return { title: event.name, kicker: event.round ? `Formula 1, round ${event.round}` : 'Formula 1' };
  }
  return { title: event.name, kicker: event.subtitle ?? sportMeta[event.sport].name };
}
