import { sessionDurationMinutes, type SessionFilters } from './sessions';
import { addMinutesIso, localDateKey } from './time';
import type { EventStatus, Session, Sport, SportEvent } from './types';

export type SessionState = 'upcoming' | 'live' | 'finished';

function sessionEndUtc(session: Pick<Session, 'kind' | 'startUtc'>): string {
  return addMinutesIso(session.startUtc, sessionDurationMinutes[session.kind]);
}

export function sessionState(session: Pick<Session, 'kind' | 'startUtc'>, now: Date): SessionState {
  const t = now.getTime();
  if (t < Date.parse(session.startUtc)) return 'upcoming';
  if (t < Date.parse(sessionEndUtc(session))) return 'live';
  return 'finished';
}

export function eventStatus(sessions: Session[], now: Date): EventStatus {
  const active = sessions.filter((s) => !s.isCancelled);
  if (active.length === 0) return sessions.length > 0 ? 'cancelled' : 'scheduled';
  if (active.some((s) => sessionState(s, now) === 'live')) return 'live';
  return active.every((s) => sessionState(s, now) === 'finished') ? 'completed' : 'scheduled';
}

export interface ScheduleItem {
  event: SportEvent;
  session: Session;
}

export interface ScheduleQuery {
  sports: readonly Sport[];
  filters: SessionFilters;
  now: Date;
}

/** One row per session you want to see: followed sport, kept by the filter, not cancelled, not over. */
export function buildSchedule(events: readonly SportEvent[], { sports, filters, now }: ScheduleQuery): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  for (const event of events) {
    if (!sports.includes(event.sport)) continue;
    const kinds = filters[event.sport];
    for (const session of event.sessions) {
      if (session.isCancelled) continue;
      if (!kinds.includes(session.kind)) continue;
      if (sessionState(session, now) === 'finished') continue;
      items.push({ event, session });
    }
  }
  return items.sort(
    (a, b) => Date.parse(a.session.startUtc) - Date.parse(b.session.startUtc) || a.event.id.localeCompare(b.event.id),
  );
}

export interface ScheduleDay {
  key: string;
  firstStartUtc: string;
  items: ScheduleItem[];
}

/** Groups already-sorted items by calendar day in your zone. */
export function groupByLocalDay(items: readonly ScheduleItem[], timeZone: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  for (const item of items) {
    const key = localDateKey(item.session.startUtc, timeZone);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(item);
    else days.push({ key, firstStartUtc: item.session.startUtc, items: [item] });
  }
  return days;
}

/** Upcoming, not-cancelled sessions of one event. */
export function upcomingSessions(event: SportEvent, now: Date): Session[] {
  return event.sessions.filter((s) => !s.isCancelled && sessionState(s, now) === 'upcoming');
}

/** The event's first and last session starts, cancelled ones left out (null when every one is). */
export function eventSpan(event: SportEvent): { firstUtc: string; lastUtc: string } | null {
  const starts = event.sessions.filter((s) => !s.isCancelled).map((s) => Date.parse(s.startUtc));
  if (starts.length === 0) return null;
  return { firstUtc: new Date(Math.min(...starts)).toISOString(), lastUtc: new Date(Math.max(...starts)).toISOString() };
}

/** Events that still have something ahead, soonest first. */
export function upcomingEvents(events: readonly SportEvent[], now: Date): SportEvent[] {
  return events
    .filter((e) => e.sessions.some((s) => !s.isCancelled && sessionState(s, now) !== 'finished'))
    .sort((a, b) => (eventSpan(a)?.firstUtc ?? '').localeCompare(eventSpan(b)?.firstUtc ?? ''));
}

/** The headline session of an event: the race, or the main event, else its last session. */
export function headlineSession(event: SportEvent): Session | undefined {
  const active = event.sessions.filter((s) => !s.isCancelled);
  return (
    active.find((s) => s.kind === 'race') ??
    active.find((s) => s.kind === 'main_event') ??
    active.find((s) => s.kind === 'main_card') ??
    active[active.length - 1]
  );
}
