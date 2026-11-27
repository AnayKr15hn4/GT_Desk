import type { Alarm, AlarmStatus, AlertType } from './types';

/** Free plan: push reminders only, two at a time. Premium unlocks calls and removes the cap. */
export const FREE_ACTIVE_ALARM_LIMIT = 2;

export const leadTimeOptions = [0, 5, 10, 15, 30, 60] as const;

export type AlarmGate =
  | { kind: 'sign-in' }
  | { kind: 'premium'; reason: 'calls' | 'limit' }
  | { kind: 'verify-phone' }
  | null;

/** What (if anything) must happen before this alarm can be saved. Order matters. The server re-checks. */
export function gateForAlarm(input: {
  signedIn: boolean;
  isPremium: boolean;
  phoneVerified: boolean;
  alertType: AlertType;
  activeCount: number;
}): AlarmGate {
  if (!input.signedIn) return { kind: 'sign-in' };
  if (input.alertType === 'call' && !input.isPremium) return { kind: 'premium', reason: 'calls' };
  if (input.alertType === 'call' && !input.phoneVerified) return { kind: 'verify-phone' };
  if (!input.isPremium && input.activeCount >= FREE_ACTIVE_ALARM_LIMIT) return { kind: 'premium', reason: 'limit' };
  return null;
}

/** A scheduled alarm whose ring time passed shows as delivered until the server reports otherwise. */
export function displayStatus(alarm: Alarm, now: Date): AlarmStatus {
  if (alarm.status === 'scheduled' && Date.parse(alarm.alertTimeUtc) <= now.getTime()) return 'delivered';
  return alarm.status;
}

export function isActive(alarm: Alarm, now: Date): boolean {
  return displayStatus(alarm, now) === 'scheduled';
}

/** A cancelled alarm can come back as long as it would still ring in time. */
export function canRestore(alarm: Alarm, now: Date): boolean {
  return alarm.status === 'cancelled' && Date.parse(alarm.alertTimeUtc) > now.getTime();
}

export function canRemove(alarm: Alarm): boolean {
  return alarm.status !== 'scheduled' && alarm.status !== 'calling';
}

/** The active alarm for a session, if any (one per session in practice). */
export function alarmForSession(alarms: readonly Alarm[], sessionId: string, now: Date): Alarm | undefined {
  return alarms.find((a) => a.sessionId === sessionId && isActive(a, now));
}

export function newIdempotencyKey(): string {
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The next alarm to ring, soonest first. */
export function nextAlarm(alarms: readonly Alarm[], now: Date): Alarm | undefined {
  return alarms
    .filter((a) => isActive(a, now))
    .sort((a, b) => Date.parse(a.alertTimeUtc) - Date.parse(b.alertTimeUtc))[0];
}

/** Sessions read without "the": "before qualifying", "before practice 2". */
const NO_ARTICLE = /^(qualifying|sprint qualifying|practice \d)$/i;

/** "the race", "the main card", but "qualifying" and "practice 2" on their own. */
export function sessionNoun(sessionLabel: string): string {
  const label = sessionLabel.toLowerCase();
  return NO_ARTICLE.test(label) ? label : `the ${label}`;
}

/** "10 min", "1 hr", "1 hr 30 min". */
export function formatLeadAmount(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h} hr ${m} min` : h ? `${h} hr` : `${m} min`;
}

/** "10 min before the race", "1 hr before qualifying", "as the main card starts". */
export function leadPhrase(leadMinutes: number, sessionLabel: string): string {
  const named = sessionNoun(sessionLabel);
  if (leadMinutes === 0) return `as ${named} starts`;
  return `${formatLeadAmount(leadMinutes)} before ${named}`;
}

export const statusLabels: Record<AlarmStatus, string> = {
  scheduled: 'Set',
  calling: 'Calling now',
  delivered: 'Rang',
  failed: "Didn't reach you",
  cancelled: 'Cancelled',
};
