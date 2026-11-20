import { describe, expect, it } from 'vitest';

import { alarmForSession, canRemove, canRestore, displayStatus, gateForAlarm, leadPhrase, nextAlarm } from './alarms';
import type { Alarm } from './types';

const base: Alarm = {
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
const now = new Date('2026-11-18T15:00:00Z');

describe('what an alarm needs first', () => {
  const free = { signedIn: true, isPremium: false, phoneVerified: false, alertType: 'push' as const, activeCount: 0 };

  it('asks to sign in before anything else', () => {
    expect(gateForAlarm({ ...free, signedIn: false, alertType: 'call' })).toEqual({ kind: 'sign-in' });
  });

  it('keeps phone calls for Premium, then asks for a verified number', () => {
    expect(gateForAlarm({ ...free, alertType: 'call' })).toEqual({ kind: 'premium', reason: 'calls' });
    expect(gateForAlarm({ ...free, isPremium: true, alertType: 'call' })).toEqual({ kind: 'verify-phone' });
    expect(gateForAlarm({ ...free, isPremium: true, phoneVerified: true, alertType: 'call' })).toBeNull();
  });

  it('holds the free plan to two alarms', () => {
    expect(gateForAlarm({ ...free, activeCount: 1 })).toBeNull();
    expect(gateForAlarm({ ...free, activeCount: 2 })).toEqual({ kind: 'premium', reason: 'limit' });
    expect(gateForAlarm({ ...free, isPremium: true, activeCount: 40 })).toBeNull();
  });
});

describe('alarm wording', () => {
  it('reads naturally for each kind of session', () => {
    expect(leadPhrase(10, 'Race')).toBe('10 min before the race');
    expect(leadPhrase(60, 'Qualifying')).toBe('1 hr before qualifying');
    expect(leadPhrase(90, 'Practice 2')).toBe('1 hr 30 min before practice 2');
    expect(leadPhrase(0, 'Main Card')).toBe('as the main card starts');
  });
});

describe('alarm state', () => {
  it('shows a passed scheduled alarm as rung until the server says otherwise', () => {
    expect(displayStatus({ ...base, alertTimeUtc: '2026-11-18T14:00:00.000Z' }, now)).toBe('delivered');
    expect(displayStatus(base, now)).toBe('scheduled');
  });

  it('restores a cancelled alarm only while it would still ring in time', () => {
    expect(canRestore({ ...base, status: 'cancelled' }, now)).toBe(true);
    expect(canRestore({ ...base, status: 'cancelled', alertTimeUtc: '2026-11-18T14:00:00.000Z' }, now)).toBe(false);
  });

  it('removes only alarms that are finished or cancelled', () => {
    expect(canRemove(base)).toBe(false);
    expect(canRemove({ ...base, status: 'calling' })).toBe(false);
    expect(canRemove({ ...base, status: 'delivered' })).toBe(true);
  });

  it('finds the next alarm and the one for a session', () => {
    const later = { ...base, id: 'a2', sessionId: 's2', alertTimeUtc: '2026-11-23T03:50:00.000Z' };
    expect(nextAlarm([later, base], now)?.id).toBe('a1');
    expect(alarmForSession([later, base], 's2', now)?.id).toBe('a2');
    expect(alarmForSession([{ ...base, status: 'cancelled' }], 's1', now)).toBeUndefined();
  });
});
