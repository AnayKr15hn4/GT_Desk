import type { ScheduleItem } from './schedule';
import { sessionDurationMinutes } from './sessions';
import { DAY, localDateKey, localMinuteOfDay, nightSegments, type NightWindow } from './time';

/**
 * The week chronograph: seven rows (today and the next six days, in your zone), each a 24-hour
 * track. Sessions sit where they start on your clock and are as long as they usually run. A
 * session that runs past midnight continues at the start of the next row.
 */

export interface WeekBlock {
  item: ScheduleItem;
  /** Minutes after local midnight where this piece starts and ends. */
  fromMin: number;
  toMin: number;
  /** True for the piece that holds the real start (the second piece of a split session is not). */
  isStart: boolean;
}

export interface WeekRow {
  key: string;
  /** Any instant on that local day, for formatting its label. */
  sampleUtc: string;
  blocks: WeekBlock[];
}

const MINUTES = 24 * 60;

/** "2026-11-18" plus n calendar days. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function buildWeek(items: readonly ScheduleItem[], timeZone: string, now: Date, days = 7): WeekRow[] {
  const todayKey = localDateKey(now.toISOString(), timeZone);
  const rows: WeekRow[] = Array.from({ length: days }, (_, i) => ({
    key: addDaysToKey(todayKey, i),
    // Noon UTC on the date is the same local date for every zone except the ±12–14 h extremes;
    // labels only need the date, so pick the instant inside the row by walking from now.
    sampleUtc: new Date(now.getTime() + i * DAY).toISOString(),
    blocks: [],
  }));
  const index = new Map(rows.map((r, i) => [r.key, i]));

  for (const item of items) {
    const key = localDateKey(item.session.startUtc, timeZone);
    const row = index.get(key);
    if (row === undefined) continue;
    const from = localMinuteOfDay(item.session.startUtc, timeZone);
    const length = sessionDurationMinutes[item.session.kind];
    const to = from + length;
    rows[row].blocks.push({ item, fromMin: from, toMin: Math.min(to, MINUTES), isStart: true });
    if (to > MINUTES && row + 1 < rows.length) {
      rows[row + 1].blocks.push({ item, fromMin: 0, toMin: to - MINUTES, isStart: false });
    }
  }
  for (const r of rows) r.blocks.sort((a, b) => a.fromMin - b.fromMin);
  return rows;
}

/**
 * Lanes, so overlapping blocks in one row stack instead of hiding each other. Returns the lane of
 * each block (same order as `blocks`) and how many lanes the row needs.
 */
export function assignLanes(blocks: readonly WeekBlock[], minGapMin = 18, minWidthMin = 45): { lanes: number[]; count: number } {
  const laneEnds: number[] = [];
  const lanes = blocks.map((b) => {
    // Short sessions still take room on screen (their label); treat each as at least that wide.
    const end = Math.max(b.toMin, b.fromMin + minWidthMin);
    let lane = laneEnds.findIndex((e) => e + minGapMin <= b.fromMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return lane;
  });
  return { lanes, count: Math.max(1, laneEnds.length) };
}

/** The night window as percentages of a 24-hour track, for shading. */
export function nightBands(night: NightWindow): { left: number; width: number }[] {
  return nightSegments(night).map(([a, b]) => ({ left: (a / MINUTES) * 100, width: ((b - a) / MINUTES) * 100 }));
}

export const toPercent = (minute: number) => (minute / MINUTES) * 100;
