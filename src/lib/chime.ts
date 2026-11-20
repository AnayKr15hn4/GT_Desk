import { formatLeadAmount, sessionNoun } from './alarms';
import type { Alarm } from './types';

/**
 * The chime on this computer is a courtesy: the server still calls or notifies your phone. These
 * are the rules for when it rings; the sound and the notification live in app/chime.ts.
 */

/** How late a chime may still ring, for a computer waking from sleep or a slowed background tab. */
export const CHIME_GRACE_MS = 2 * 60_000;

/** Long timers drift, so look again at least this often. */
export const MAX_WAIT_MS = 6 * 60 * 60_000;

/** Remember a chimed alarm this long, so a reload or a second tab doesn't ring it again. */
export const CHIMED_MEMORY_MS = 24 * 60 * 60_000;

/** Alarms whose ring time has just passed and that haven't chimed here yet. */
export function dueForChime(alarms: readonly Alarm[], now: number, chimed: ReadonlySet<string>): Alarm[] {
  return alarms.filter((alarm) => {
    // The server may already have marked it delivered (or failed) by the time the tab looks.
    if (alarm.status === 'cancelled' || chimed.has(alarm.id)) return false;
    const at = Date.parse(alarm.alertTimeUtc);
    return at <= now && now - at <= CHIME_GRACE_MS;
  });
}

/** How long to wait before looking again: until the next ring time, capped. Null when nothing is set. */
export function msUntilNextChime(alarms: readonly Alarm[], now: number): number | null {
  let soonest = Infinity;
  for (const alarm of alarms) {
    if (alarm.status !== 'scheduled') continue;
    const at = Date.parse(alarm.alertTimeUtc);
    if (at > now && at < soonest) soonest = at;
  }
  return soonest === Infinity ? null : Math.min(soonest - now, MAX_WAIT_MS);
}

/** "The race starts in 10 min", "Qualifying is starting". */
export function chimeTitle(alarm: Pick<Alarm, 'leadMinutes' | 'sessionLabel'>): string {
  const noun = sessionNoun(alarm.sessionLabel);
  const subject = noun.charAt(0).toUpperCase() + noun.slice(1);
  return alarm.leadMinutes === 0 ? `${subject} is starting` : `${subject} starts in ${formatLeadAmount(alarm.leadMinutes)}`;
}

export function chimeBody(alarm: Pick<Alarm, 'eventName' | 'alertType'>): string {
  const phone = alarm.alertType === 'call' ? 'Your wake-up call goes to your phone as well.' : 'The reminder goes to your phone as well.';
  return `${alarm.eventName}. ${phone}`;
}

/** Drops chimed alarms older than CHIMED_MEMORY_MS (and anything unreadable). */
export function pruneChimed(entries: unknown, now: number): Record<string, number> {
  const kept: Record<string, number> = {};
  if (!entries || typeof entries !== 'object') return kept;
  for (const [id, at] of Object.entries(entries)) {
    if (typeof at === 'number' && now - at < CHIMED_MEMORY_MS) kept[id] = at;
  }
  return kept;
}
