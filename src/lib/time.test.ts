import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NIGHT,
  formatCountdown,
  formatDayLabel,
  formatMinuteOfDay,
  formatUtcOffset,
  inNight,
  isOvernight,
  nightLength,
  nightSegments,
  venueOffsetLine,
  venueTimeLine,
  zoneOffsetMinutes,
  countdown,
} from './time';

describe('your night', () => {
  it('defaults to 10:00 PM to 5:30 AM and wraps past midnight', () => {
    expect(DEFAULT_NIGHT).toEqual({ startMin: 1320, endMin: 330 });
    expect(inNight(23 * 60, DEFAULT_NIGHT)).toBe(true);
    expect(inNight(5 * 60 + 29, DEFAULT_NIGHT)).toBe(true);
    expect(inNight(5 * 60 + 30, DEFAULT_NIGHT)).toBe(false);
    expect(inNight(12 * 60, DEFAULT_NIGHT)).toBe(false);
  });

  it('handles a night that starts after midnight', () => {
    const owl = { startMin: 0, endMin: 8 * 60 };
    expect(inNight(7 * 60, owl)).toBe(true);
    expect(inNight(23 * 60, owl)).toBe(false);
    expect(nightSegments(owl)).toEqual([[0, 480]]);
  });

  it('splits a wrapping night into two ranges and measures it', () => {
    expect(nightSegments(DEFAULT_NIGHT)).toEqual([
      [0, 330],
      [1320, 1440],
    ]);
    expect(nightLength(DEFAULT_NIGHT)).toBe(450);
  });

  it('marks sessions that start during your night', () => {
    // 04:00 UTC is 11:00 PM in New York (winter), 8:00 PM in Las Vegas.
    expect(isOvernight('2026-11-22T04:00:00Z', 'America/New_York')).toBe(true);
    expect(isOvernight('2026-11-22T04:00:00Z', 'America/Los_Angeles')).toBe(false);
  });
});

describe('clock text', () => {
  it('writes a minute of the day in both clocks', () => {
    expect(formatMinuteOfDay(330, true)).toBe('5:30 AM');
    expect(formatMinuteOfDay(0, true)).toBe('12:00 AM');
    expect(formatMinuteOfDay(12 * 60, true)).toBe('12:00 PM');
    expect(formatMinuteOfDay(1320, false)).toBe('22:00');
  });

  it('reads UTC offsets, half hours included', () => {
    expect(zoneOffsetMinutes('2026-11-22T04:00:00Z', 'America/New_York')).toBe(-300);
    expect(zoneOffsetMinutes('2026-11-22T04:00:00Z', 'Asia/Kolkata')).toBe(330);
    expect(formatUtcOffset(-300)).toBe('UTC−5');
    expect(formatUtcOffset(330)).toBe('UTC+5:30');
    expect(formatUtcOffset(0)).toBe('UTC');
  });

  it("says how the venue's clock compares to yours", () => {
    expect(venueOffsetLine('2026-11-22T04:00:00Z', 'America/New_York', 'America/Los_Angeles')).toBe('3 hr behind you');
    expect(venueOffsetLine('2026-11-22T04:00:00Z', 'America/New_York', 'Asia/Kolkata')).toBe('10 hr 30 min ahead of you');
    expect(venueOffsetLine('2026-11-22T04:00:00Z', 'Europe/London', 'Europe/London')).toBe('Same time as you');
  });

  it("gives the venue's own time quietly", () => {
    expect(venueTimeLine('2026-11-22T04:00:00Z', { city: 'Las Vegas', timeZone: 'America/Los_Angeles' }, true)).toBe('8:00 PM in Las Vegas');
    expect(venueTimeLine('2026-11-22T04:00:00Z', { city: 'TBA' }, true)).toBeNull();
  });

  it('labels days relative to now', () => {
    const now = new Date('2026-11-18T15:00:00Z');
    expect(formatDayLabel('2026-11-18T20:00:00Z', 'America/New_York', now)).toBe('Today');
    expect(formatDayLabel('2026-11-19T20:00:00Z', 'America/New_York', now)).toBe('Tomorrow');
    expect(formatDayLabel('2026-11-22T04:00:00Z', 'America/New_York', now)).toBe('Sat, Nov 21');
  });

  it('counts down to the second', () => {
    const c = countdown('2026-11-20T04:00:05Z', new Date('2026-11-18T01:59:00Z'));
    expect(formatCountdown(c)).toBe('2d 02h 01m 05s');
  });
});
