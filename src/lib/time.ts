import { formatInTimeZone } from 'date-fns-tz';

/**
 * Pure time helpers, shared in spirit with the phone app. Every function takes the IANA zone
 * explicitly so the same code renders your time and the venue's time, and stays testable.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface ClockParts {
  /** "1:50" or "01:50" in 24h mode. */
  time: string;
  /** "AM" / "PM", or "" in 24h mode. */
  period: string;
}

export function clockParts(iso: string, timeZone: string, hour12: boolean): ClockParts {
  if (hour12) {
    return { time: formatInTimeZone(iso, timeZone, 'h:mm'), period: formatInTimeZone(iso, timeZone, 'a') };
  }
  return { time: formatInTimeZone(iso, timeZone, 'HH:mm'), period: '' };
}

/** "1:50 AM" (12h) or "01:50" (24h). */
export function formatClock(iso: string, timeZone: string, hour12: boolean): string {
  const { time, period } = clockParts(iso, timeZone, hour12);
  return period ? `${time} ${period}` : time;
}

/** Calendar date in the zone, e.g. "2026-10-25". */
export function localDateKey(iso: string, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, 'yyyy-MM-dd');
}

function dayDiff(aKey: string, bKey: string): number {
  return Math.round((Date.parse(`${bKey}T00:00:00Z`) - Date.parse(`${aKey}T00:00:00Z`)) / DAY);
}

/** "Today", "Tomorrow", "Yesterday", or "Sat, Oct 24" (adds the year when it differs). */
export function formatDayLabel(iso: string, timeZone: string, now: Date = new Date()): string {
  const target = localDateKey(iso, timeZone);
  const today = localDateKey(now.toISOString(), timeZone);
  const diff = dayDiff(today, target);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const sameYear = target.slice(0, 4) === today.slice(0, 4);
  return formatInTimeZone(iso, timeZone, sameYear ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
}

/** "Sunday, November 22". */
export function formatLongDate(iso: string, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, 'EEEE, MMMM d');
}

export function formatShortDate(iso: string, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, 'EEE, MMM d');
}

/** Local wall-clock hour as a fraction, e.g. 1.5 for 1:30. */
export function localHour(iso: string, timeZone: string): number {
  const [h, m] = formatInTimeZone(iso, timeZone, 'H:m').split(':').map(Number);
  return h + m / 60;
}

/** Minutes after local midnight, e.g. 90 for 1:30 AM. */
export function localMinuteOfDay(iso: string, timeZone: string): number {
  const [h, m] = formatInTimeZone(iso, timeZone, 'H:m').split(':').map(Number);
  return h * 60 + m;
}

/**
 * The hours you'd rather be asleep, as minutes after midnight. Wraps past midnight when start is
 * after end (22:00 to 05:30 is the default). Adjustable in Settings.
 */
export interface NightWindow {
  startMin: number;
  endMin: number;
}

export const DEFAULT_NIGHT: NightWindow = { startMin: 22 * 60, endMin: 5 * 60 + 30 };

export function inNight(minute: number, night: NightWindow): boolean {
  return night.startMin > night.endMin
    ? minute >= night.startMin || minute < night.endMin
    : minute >= night.startMin && minute < night.endMin;
}

/** True when the session starts during your night. */
export function isOvernight(iso: string, timeZone: string, night: NightWindow = DEFAULT_NIGHT): boolean {
  return inNight(localMinuteOfDay(iso, timeZone), night);
}

/** The night window as one or two [from, to) minute ranges inside a single day. */
export function nightSegments(night: NightWindow): [number, number][] {
  if (night.startMin === night.endMin) return [];
  return night.startMin > night.endMin
    ? [
        [0, night.endMin],
        [night.startMin, 24 * 60],
      ]
    : [[night.startMin, night.endMin]];
}

/** "5:30 AM" or "05:30" for a minute of the day. */
export function formatMinuteOfDay(minute: number, hour12: boolean): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const mm = String(m).padStart(2, '0');
  if (!hour12) return `${String(h).padStart(2, '0')}:${mm}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Length of the night window in minutes. */
export function nightLength(night: NightWindow): number {
  return (night.endMin - night.startMin + 24 * 60) % (24 * 60);
}

/** When the alarm should fire. Pure UTC arithmetic, so DST changes cannot shift it. */
export function alertTimeUtc(sessionStartUtc: string, leadMinutes: number): string {
  return new Date(Date.parse(sessionStartUtc) - leadMinutes * MINUTE).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * MINUTE).toISOString();
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function countdown(targetIso: string, now: Date = new Date()): Countdown {
  const totalMs = Math.max(0, Date.parse(targetIso) - now.getTime());
  return {
    days: Math.floor(totalMs / DAY),
    hours: Math.floor((totalMs % DAY) / HOUR),
    minutes: Math.floor((totalMs % HOUR) / MINUTE),
    seconds: Math.floor((totalMs % MINUTE) / 1000),
    totalMs,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2d 04h 13m 05s", "4h 13m 05s", "0m 42s": always to the second. */
export function formatCountdown(c: Countdown): string {
  if (c.days > 0) return `${c.days}d ${pad(c.hours)}h ${pad(c.minutes)}m ${pad(c.seconds)}s`;
  if (c.hours > 0) return `${c.hours}h ${pad(c.minutes)}m ${pad(c.seconds)}s`;
  return `${c.minutes}m ${pad(c.seconds)}s`;
}

/** "In 2 days", "In 5 hours", "In 12 minutes", "Now". A calm, rounded reading. */
export function formatRelative(targetIso: string, now: Date = new Date()): string {
  const ms = Date.parse(targetIso) - now.getTime();
  if (ms <= 0) return 'Now';
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.round(ms / HOUR);
  if (hours < 36) return `In ${hours} hr`;
  return `In ${Math.round(ms / DAY)} days`;
}

/** "10 min before", "1 hr before", "At start". */
export function formatLead(leadMinutes: number): string {
  if (leadMinutes === 0) return 'At start';
  if (leadMinutes % 60 === 0) return `${leadMinutes / 60} hr before`;
  if (leadMinutes > 60) return `${Math.floor(leadMinutes / 60)} hr ${leadMinutes % 60} min before`;
  return `${leadMinutes} min before`;
}

/** Short zone label for the given instant, e.g. "CDT" or "GMT+1". */
export function zoneAbbreviation(iso: string, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, 'zzz');
}

/** Offset from UTC in minutes for the zone at that instant (e.g. -300 for New York in winter). */
export function zoneOffsetMinutes(iso: string, timeZone: string): number {
  const raw = formatInTimeZone(iso, timeZone, 'xxx'); // "+05:30" or "-08:00"
  const sign = raw.startsWith('-') ? -1 : 1;
  const [h, m] = raw.slice(1).split(':').map(Number);
  return sign * (h * 60 + m);
}

/** "UTC+5:30", "UTC−8", "UTC". */
export function formatUtcOffset(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** "America/New_York" becomes "New York". */
export function zoneCity(timeZone: string): string {
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replace(/_/g, ' ');
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatInTimeZone(new Date(0), timeZone, 'H');
    return true;
  } catch {
    return false;
  }
}

const COUNTRY_SHORT: Record<string, string> = {
  'united arab emirates': 'UAE',
  'united kingdom': 'UK',
  'great britain': 'UK',
  'united states': 'USA',
  'united states of america': 'USA',
};

export function shortCountry(country: string): string {
  const name = country.trim();
  return COUNTRY_SHORT[name.toLowerCase()] ?? name;
}

/** "9:00 PM in Las Vegas": the venue's own clock, quietly. Just the city when its zone is unknown. */
export function venueTimeLine(
  startUtc: string,
  venue: { city: string; country?: string; timeZone?: string },
  hour12: boolean,
): string | null {
  const city = venue.city && venue.city !== 'TBA' ? venue.city : null;
  if (!city) return null;
  return venue.timeZone ? `${formatClock(startUtc, venue.timeZone, hour12)} in ${city}` : city;
}

/** Hours between your clock and the venue's at that instant, e.g. "3 hr behind you". */
export function venueOffsetLine(iso: string, yourZone: string, venueZone: string | undefined): string | null {
  if (!venueZone) return null;
  const diff = zoneOffsetMinutes(iso, venueZone) - zoneOffsetMinutes(iso, yourZone);
  if (diff === 0) return 'Same time as you';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const amount = m ? `${h} hr ${m} min` : `${h} hr`;
  return `${amount} ${diff > 0 ? 'ahead of' : 'behind'} you`;
}

/** The browser's own zone. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** True when the browser's locale writes times with AM/PM. */
export function deviceUses12h(): boolean {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).formatToParts(new Date(2020, 0, 1, 13));
    return parts.some((p) => p.type === 'dayPeriod');
  } catch {
    return true;
  }
}
