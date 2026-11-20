import { describe, expect, it } from 'vitest';

import type { LngLat } from './geo';
import { acrossTileEdge, pickVenueParts, ringArea, ringBounds, ringCentroid, withArenaHeight, type BuildingPart } from './venue-parts';

// Midtown Manhattan, near a zoom-14 tile edge (x = 4825).
const LAT = 40.7505;
const EDGE_LON = (4825 / 2 ** 14) * 360 - 180;
const mPerLon = 111_320 * Math.cos((LAT * Math.PI) / 180);

/** A closed rectangle, `w` by `h` metres, centred `east` and `north` metres from the tile edge. */
function rect(east: number, north: number, w: number, h: number): LngLat[] {
  const cx = EDGE_LON + east / mPerLon;
  const cy = LAT + north / 111_320;
  const dx = w / 2 / mPerLon;
  const dy = h / 2 / 111_320;
  return [
    [cx - dx, cy - dy],
    [cx + dx, cy - dy],
    [cx + dx, cy + dy],
    [cx - dx, cy + dy],
    [cx - dx, cy - dy],
  ];
}

const part = (ring: LngLat[], height: number, base = 0): BuildingPart => ({ polygon: [ring], height, base });
const at = (east: number, north: number): LngLat => [EDGE_LON + east / mPerLon, LAT + north / 111_320];

describe('building geometry', () => {
  it('measures areas and middles in metres', () => {
    const square = rect(-500, 0, 100, 100);
    expect(ringArea(square)).toBeGreaterThan(9_900);
    expect(ringArea(square)).toBeLessThan(10_100);
    const [x, y] = ringCentroid(square);
    expect(x).toBeCloseTo(at(-500, 0)[0], 9);
    expect(y).toBeCloseTo(LAT, 9);
  });

  it('notices a tile edge running between two boxes', () => {
    expect(acrossTileEdge(ringBounds(rect(-30, 0, 80, 60)), ringBounds(rect(30, 0, 80, 60)))).toBe(true);
    expect(acrossTileEdge(ringBounds(rect(-300, 0, 80, 60)), ringBounds(rect(-250, 0, 80, 60)))).toBe(false);
    expect(acrossTileEdge(ringBounds(rect(-300, 0, 20, 20)), ringBounds(rect(300, 0, 20, 20)))).toBe(false);
  });
});

describe("finding the venue's building", () => {
  const arena = part(rect(-500, 0, 120, 120), 30);
  const neighbour = part(rect(-350, 0, 40, 40), 30);

  it("lights the building under the venue's point, and not its neighbours", () => {
    expect(pickVenueParts([arena, neighbour], { center: at(-500, 10) })).toEqual([arena]);
  });

  it('keeps the pieces stacked on it, like a roof that steps up', () => {
    const roof = part(rect(-500, 0, 70, 70), 46, 30);
    expect(pickVenueParts([arena, roof, neighbour], { center: at(-500, 0) })).toEqual([arena, roof]);
  });

  it("finds an arena beside a point that's a little off, past a small kiosk", () => {
    const kiosk = part(rect(-500, -95, 8, 8), 4);
    expect(pickVenueParts([arena, kiosk], { center: at(-500, -90) })).toEqual([arena]);
  });

  it('puts a building back together where the map tiles cut it in two', () => {
    // Each tile keeps a little past its edge, so the two halves overlap there.
    const west = part(rect(-40, 0, 100, 90), 28);
    const east = part(rect(40, 0, 100, 90), 28);
    const sameHeightNextDoor = part(rect(160, 0, 60, 90), 28);
    expect(pickVenueParts([west, east, sameHeightNextDoor], { center: at(-60, 0) })).toEqual([west, east]);
  });

  it("with an outline of the grounds, picks the biggest building on them", () => {
    const kiosk = part(rect(-500, 90, 15, 15), 4);
    const grounds = rect(-500, 0, 300, 300);
    expect(pickVenueParts([arena, kiosk, neighbour], { center: at(-500, 0), outline: [grounds] })).toEqual([arena]);
  });

  it("with OpenStreetMap's outline of the building, takes every piece inside it", () => {
    const roof = part(rect(-500, 0, 70, 70), 46, 30);
    const outline = rect(-500, 0, 122, 122);
    expect(pickVenueParts([neighbour, arena, roof], { center: at(-520, 50), outline: [outline], outlineIsBuilding: true })).toEqual([arena, roof]);
  });

  it('keeps one of each piece drawn twice by neighbouring tiles', () => {
    expect(pickVenueParts([arena, { ...arena, polygon: [[...arena.polygon[0]]] }], { center: at(-500, 0) })).toHaveLength(1);
  });

  it("comes back empty when the map has no building there", () => {
    expect(pickVenueParts([neighbour], { center: at(-900, 0) })).toEqual([]);
    expect(pickVenueParts([], { center: at(-500, 0) })).toEqual([]);
  });
});

describe('arena heights', () => {
  it("raises an arena the map only knows as 5 m tall, but not its small pieces", () => {
    const body = part(rect(-500, 0, 120, 120), 5);
    const canopy = part(rect(-500, -70, 20, 8), 5);
    const known = part(rect(-500, 0, 60, 60), 41, 5);
    expect(withArenaHeight([body, canopy, known], 34).map((p) => p.height)).toEqual([34, 5, 41]);
  });

  it('leaves real heights alone', () => {
    const body = part(rect(-500, 0, 120, 120), 38);
    expect(withArenaHeight([body])[0].height).toBe(38);
  });
});
