/**
 * Domain types, shared with the GameTime phone app (apps/mobile/src/services/types.ts in the team
 * repo). The backend's list_events, list_alarms and get_account return exactly these shapes.
 *
 * All instants are UTC ISO-8601 strings. Convert to a time zone only for display.
 */

export type Sport = 'f1' | 'ufc';

export type F1SessionKind = 'fp1' | 'fp2' | 'fp3' | 'sprint_quali' | 'sprint' | 'qualifying' | 'race';
export type UfcSessionKind = 'early_prelims' | 'prelims' | 'main_card' | 'main_event';
export type SessionKind = F1SessionKind | UfcSessionKind;

export type DataSource = 'jolpica' | 'espn' | 'fixture';

export interface Venue {
  name: string;
  city: string;
  region?: string;
  country: string;
  lat?: number;
  lon?: number;
  /** IANA zone of the venue, e.g. "America/Chicago". */
  timeZone?: string;
  indoor: boolean;
  infoUrl?: string;
}

export interface Session {
  id: string;
  eventId: string;
  kind: SessionKind;
  label: string;
  startUtc: string;
  /** True when the start is an estimate (e.g. a UFC main event), not a published time. */
  isEstimated: boolean;
  isCancelled: boolean;
}

export interface Fighter {
  name: string;
  record?: string;
  country?: string;
  flagUrl?: string;
}

export interface Bout {
  id: string;
  weightClass?: string;
  fighters: [Fighter, Fighter];
  segment: UfcSessionKind;
  isMainEvent: boolean;
  rounds?: number;
  isTitleFight?: boolean;
}

export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface SportEvent {
  id: string;
  externalId: string;
  source: DataSource;
  sport: Sport;
  league: string;
  name: string;
  shortName: string;
  subtitle?: string;
  round?: number;
  venue: Venue;
  status: EventStatus;
  sessions: Session[];
  bouts?: Bout[];
  broadcasters?: string[];
}

export interface HourlyForecast {
  timeUtc: string;
  temperatureC: number;
  precipitationProbability: number | null;
  weatherCode: number;
  windKph: number;
  isDay: boolean;
}

export interface Forecast {
  lat: number;
  lon: number;
  hours: HourlyForecast[];
  fetchedAt: string;
}

export type AlertType = 'call' | 'push';
export type AlarmStatus = 'scheduled' | 'calling' | 'delivered' | 'failed' | 'cancelled';

export interface Alarm {
  id: string;
  idempotencyKey: string;
  eventId: string;
  sessionId: string;
  sport: Sport;
  eventName: string;
  sessionLabel: string;
  sessionStartUtc: string;
  venueCity: string;
  leadMinutes: number;
  alertTimeUtc: string;
  alertType: AlertType;
  status: AlarmStatus;
  createdAt: string;
}

/** What get_account() returns. */
export interface ServerAccount {
  plan: 'free' | 'premium';
  planExpiresAt: string | null;
  phone: { e164: string; verified: boolean } | null;
  timezone: string | null;
}
