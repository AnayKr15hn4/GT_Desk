import { describe, expect, it } from 'vitest';

import { formatLeadAmount, sessionNoun } from './alarms';
import { CHIME_GRACE_MS, CHIMED_MEMORY_MS, chimeBody, chimeTitle, dueForChime, MAX_WAIT_MS, msUntilNextChime, pruneChimed } from './chime';
import type { Alarm } from './types';

const alarm: Alarm = {
  id: 'a1',
  idempotencyKey: 'k1',
  eventId: 'e1',
  sessionId: 's1',
  sport: 'f1',
  eventName: 'Las Vegas Grand Prix',
  sessionLabel: 'Race',
  sessionStartUtc: '2026-11-22T04:00:00.000Z',
  venueCity: 'Las Vegas',
  leadMinutes: 10,
  alertTimeUtc: '2026-11-22T03:50:00.000Z',
  alertType: 'push',
  status: 'scheduled',
  createdAt: '2026-11-18T12:00:00.000Z',
};
const ringsAt = Date.parse(alarm.alertTimeUtc);
const none = new Set<string>();

describe('when the computer chimes', () => {
  it('chimes once the ring time arrives, and for a short while after', () => {
    expect(dueForChime([alarm], ringsAt - 1, none)).toEqual([]);
    expect(dueForChime([alarm], ringsAt, none)).toEqual([alarm]);
    expect(dueForChime([alarm], ringsAt + CHIME_GRACE_MS, none)).toEqual([alarm]);
  });

  it("doesn't chime a stale alarm after the computer wakes up hours later", () => {
    expect(dueForChime([alarm], ringsAt + CHIME_GRACE_MS + 1, none)).toEqual([]);
  });

  it('skips cancelled alarms and ones that already chimed', () => {
    expect(dueForChime([{ ...alarm, status: 'cancelled' }], ringsAt, none)).toEqual([]);
    expect(dueForChime([alarm], ringsAt, new Set(['a1']))).toEqual([]);
  });

  it('still chimes when the server already marked the alarm as rung', () => {
    expect(dueForChime([{ ...alarm, status: 'delivered' }], ringsAt + 5_000, none)).toHaveLength(1);
  });
});

describe('waiting for the next chime', () => {
  it('waits until the soonest scheduled ring time', () => {
    const later = { ...alarm, id: 'a2', alertTimeUtc: '2026-11-22T05:00:00.000Z' };
    expect(msUntilNextChime([later, alarm], ringsAt - 60_000)).toBe(60_000);
  });

  it('looks again within a few hours when the next alarm is days away', () => {
    expect(msUntilNextChime([alarm], ringsAt - 3 * 24 * 60 * 60_000)).toBe(MAX_WAIT_MS);
  });

  it('has nothing to wait for when every alarm has passed or was cancelled', () => {
    expect(msUntilNextChime([alarm], ringsAt + 1)).toBeNull();
    expect(msUntilNextChime([{ ...alarm, status: 'cancelled' }], ringsAt - 60_000)).toBeNull();
    expect(msUntilNextChime([], ringsAt)).toBeNull();
  });
});

describe('chime wording', () => {
  it('names the session the way you would say it', () => {
    expect(chimeTitle(alarm)).toBe('The race starts in 10 min');
    expect(chimeTitle({ leadMinutes: 60, sessionLabel: 'Qualifying' })).toBe('Qualifying starts in 1 hr');
    expect(chimeTitle({ leadMinutes: 0, sessionLabel: 'Main Card' })).toBe('The main card is starting');
  });

  it('says where the real alarm goes', () => {
    expect(chimeBody(alarm)).toBe('Las Vegas Grand Prix. The reminder goes to your phone as well.');
    expect(chimeBody({ ...alarm, alertType: 'call' })).toContain('wake-up call');
  });

  it('shares its pieces with the rest of the alarm wording', () => {
    expect(sessionNoun('Practice 2')).toBe('practice 2');
    expect(sessionNoun('Sprint')).toBe('the sprint');
    expect(formatLeadAmount(90)).toBe('1 hr 30 min');
  });
});

describe('remembering chimes', () => {
  it('forgets chimes after a day and ignores anything unreadable', () => {
    const now = ringsAt;
    expect(pruneChimed({ fresh: now - 1_000, old: now - CHIMED_MEMORY_MS, junk: 'x' }, now)).toEqual({ fresh: now - 1_000 });
    expect(pruneChimed(null, now)).toEqual({});
    expect(pruneChimed('[]', now)).toEqual({});
  });
});
