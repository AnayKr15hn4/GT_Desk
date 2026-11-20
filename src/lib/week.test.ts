import { describe, expect, it } from 'vitest';

import type { ScheduleItem } from './schedule';
import type { Session, SportEvent } from './types';
import { addDaysToKey, assignLanes, buildWeek, nightBands } from './week';

const event = { id: 'e1', name: 'Test GP', sport: 'f1' } as SportEvent;
const item = (id: string, kind: Session['kind'], startUtc: string): ScheduleItem => ({
  event,
  session: { id, eventId: 'e1', kind, label: kind, startUtc, isEstimated: false, isCancelled: false },
});

describe('week chronograph', () => {
  const now = new Date('2026-11-18T15:00:00Z');

  it('lays seven local days from today', () => {
    const rows = buildWeek([], 'America/New_York', now);
    expect(rows.map((r) => r.key)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24']);
  });

  it('places a session where it starts on your clock', () => {
    // 2026-11-21 04:00 UTC = Friday 11:00 PM in New York; a 60 minute qualifying session.
    const rows = buildWeek([item('q', 'qualifying', '2026-11-21T04:00:00Z')], 'America/New_York', now);
    const friday = rows.find((r) => r.key === '2026-11-20')!;
    expect(friday.blocks).toHaveLength(1);
    expect(friday.blocks[0]).toMatchObject({ fromMin: 1380, toMin: 1440, isStart: true });
  });

  it('continues a session past midnight on the next row', () => {
    // A 2 hour race from 11:00 PM: one hour tonight, one hour after midnight.
    const rows = buildWeek([item('r', 'race', '2026-11-22T04:00:00Z')], 'America/New_York', now);
    const saturday = rows.find((r) => r.key === '2026-11-21')!;
    const sunday = rows.find((r) => r.key === '2026-11-22')!;
    expect(saturday.blocks[0]).toMatchObject({ fromMin: 1380, toMin: 1440, isStart: true });
    expect(sunday.blocks[0]).toMatchObject({ fromMin: 0, toMin: 60, isStart: false });
  });

  it('ignores sessions outside the seven days', () => {
    const rows = buildWeek([item('x', 'race', '2026-12-05T04:00:00Z')], 'America/New_York', now);
    expect(rows.every((r) => r.blocks.length === 0)).toBe(true);
  });

  it('stacks overlapping sessions in lanes, counting a label width', () => {
    const rows = buildWeek(
      [item('a', 'main_card', '2026-11-21T18:00:00Z'), item('b', 'main_event', '2026-11-21T19:40:00Z'), item('c', 'prelims', '2026-11-21T23:30:00Z')],
      'UTC',
      now,
    );
    const day = rows.find((r) => r.key === '2026-11-21')!;
    const { lanes, count } = assignLanes(day.blocks, 12, 45);
    expect(lanes).toEqual([0, 1, 0]);
    expect(count).toBe(2);
  });

  it('shades the night as percentages of the day', () => {
    expect(nightBands({ startMin: 22 * 60, endMin: 6 * 60 })).toEqual([
      { left: 0, width: 25 },
      { left: (1320 / 1440) * 100, width: (120 / 1440) * 100 },
    ]);
  });

  it('adds calendar days to a key', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});
