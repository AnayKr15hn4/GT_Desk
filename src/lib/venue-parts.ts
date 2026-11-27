import type { LngLat } from './geo';

/**
 * Finding a venue's own building among the buildings the map draws, so it can be lit in gold at
 * its real shape and heights (a roof that steps up, a tower on a podium) rather than as a guess.
 * Pure geometry on [lon, lat]; flat-earth maths is plenty at the size of a building.
 */

/** One piece of a building from the map's tiles. */
export interface BuildingPart {
  /** Outer ring first, then any holes; closed. */
  polygon: LngLat[][];
  /** Metres: the top, and the bottom (a roof piece starts above the ground). */
  height: number;
  base: number;
}

export interface VenueHint {
  /** Where the venue is. */
  center: LngLat;
  /** OpenStreetMap's outline of it, when known: the building itself, or the grounds around it. */
  outline?: LngLat[][];
  outlineIsBuilding?: boolean;
}

export type Bounds = [west: number, south: number, east: number, north: number];

const M_PER_DEG = 111_320;
/** Smaller than any arena. */
const MIN_ARENA_M2 = 2_000;
/** How far the venue's point may sit from its building (map coordinates are often a little off). */
const NEAR_M = 60;
/** OpenFreeMap's tiles stop at zoom 14, so that's where buildings get cut in two. */
const TILE_ZOOM = 14;

/** Square metres. */
export function ringArea(ring: readonly LngLat[]): number {
  if (ring.length < 3) return 0;
  const [x0, y0] = ring[0];
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - x0) * (ring[i][1] - y0) - (ring[i][0] - x0) * (ring[j][1] - y0);
  }
  return (Math.abs(sum) / 2) * M_PER_DEG * M_PER_DEG * Math.cos((y0 * Math.PI) / 180);
}

/** The middle of a ring by area (inside it for any reasonable building shape). */
export function ringCentroid(ring: readonly LngLat[]): LngLat {
  const [x0, y0] = ring[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] - x0;
    const yi = ring[i][1] - y0;
    const xj = ring[j][0] - x0;
    const yj = ring[j][1] - y0;
    const f = xj * yi - xi * yj;
    a += f;
    cx += (xj + xi) * f;
    cy += (yj + yi) * f;
  }
  if (Math.abs(a) < 1e-18) {
    const n = ring.length;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [x0 + cx / (3 * a), y0 + cy / (3 * a)];
}

function pointInRing([x, y]: LngLat, ring: readonly LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function ringBounds(ring: readonly LngLat[]): Bounds {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [x, y] of ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
}

const tileX = (lon: number) => ((lon + 180) / 360) * 2 ** TILE_ZOOM;
const tileY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** TILE_ZOOM;
};
const spansEdge = (lo: number, hi: number) => Math.floor(lo - 1e-7) !== Math.floor(hi + 1e-7);

/** True when a tile edge runs through the overlap of two boxes. */
export function acrossTileEdge(a: Bounds, b: Bounds): boolean {
  const w = Math.max(a[0], b[0]);
  const s = Math.max(a[1], b[1]);
  const e = Math.min(a[2], b[2]);
  const n = Math.min(a[3], b[3]);
  if (w > e || s > n) return false;
  return spansEdge(tileX(w), tileX(e)) || spansEdge(tileY(n), tileY(s));
}

/** Two rings overlap or touch: a corner of one inside the other, or corners meeting. */
function meets(a: readonly LngLat[], b: readonly LngLat[]): boolean {
  if (b.some((p) => pointInRing(p, a)) || a.some((p) => pointInRing(p, b))) return true;
  const close = 0.5 / M_PER_DEG;
  return a.some(([ax, ay]) => b.some(([bx, by]) => Math.abs(ax - bx) < close && Math.abs(ay - by) < close));
}

function metresToBounds([x, y]: LngLat, [w, s, e, n]: Bounds): number {
  const dx = x < w ? w - x : x > e ? x - e : 0;
  const dy = y < s ? s - y : y > n ? y - n : 0;
  return Math.hypot(dx * M_PER_DEG * Math.cos((y * Math.PI) / 180), dy * M_PER_DEG);
}

const outer = (p: BuildingPart) => p.polygon[0];

function largest(parts: readonly BuildingPart[]): BuildingPart | undefined {
  let best: BuildingPart | undefined;
  let bestArea = 0;
  for (const p of parts) {
    const area = ringArea(outer(p));
    if (area > bestArea) {
      best = p;
      bestArea = area;
    }
  }
  return best;
}

/** The same piece comes back once per map tile drawn over it; keep one of each. */
function usable(parts: readonly BuildingPart[]): BuildingPart[] {
  const seen = new Set<string>();
  return parts.filter((p) => {
    const ring = outer(p);
    if (!ring || ring.length < 4 || !(p.height > p.base)) return false;
    const [cx, cy] = ringCentroid(ring);
    const key = `${p.height}|${p.base}|${cx.toFixed(6)}|${cy.toFixed(6)}|${ring.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A building and everything that belongs to it: pieces on top, the piece below, the rest of it on the next tile. */
function building(parts: readonly BuildingPart[], anchor: BuildingPart): BuildingPart[] {
  const chosen = new Set([anchor]);
  const queue = [anchor];
  while (queue.length) {
    const a = queue.shift()!;
    const ring = outer(a);
    const middle = ringCentroid(ring);
    const box = ringBounds(ring);
    for (const p of parts) {
      if (chosen.has(p)) continue;
      const other = outer(p);
      const belongs =
        pointInRing(ringCentroid(other), ring) ||
        pointInRing(middle, other) ||
        (Math.abs(p.height - a.height) < 0.6 && Math.abs(p.base - a.base) < 0.6 && acrossTileEdge(box, ringBounds(other)) && meets(ring, other));
      if (belongs) {
        chosen.add(p);
        queue.push(p);
      }
    }
  }
  return parts.filter((p) => chosen.has(p));
}

/**
 * The venue's own pieces among the buildings drawn near it. With OpenStreetMap's outline of the
 * building: every piece inside it. With an outline of the grounds: the biggest building on them.
 * With just a point: the building under it, or the biggest one right beside it. Empty when the
 * map has no building there (a new arena, or one not mapped yet).
 */
export function pickVenueParts(candidates: readonly BuildingPart[], hint: VenueHint): BuildingPart[] {
  const parts = usable(candidates);
  if (parts.length === 0) return [];
  if (hint.outline?.length) {
    const inside = parts.filter((p) => {
      const middle = ringCentroid(outer(p));
      return hint.outline!.some((ring) => pointInRing(middle, ring));
    });
    if (inside.length) return hint.outlineIsBuilding ? inside : building(parts, largest(inside)!);
  }
  const under = parts.filter((p) => pointInRing(hint.center, outer(p)));
  const beside = parts.filter((p) => ringArea(outer(p)) >= MIN_ARENA_M2 && metresToBounds(hint.center, ringBounds(outer(p))) <= NEAR_M);
  const anchor = largest(under) ?? largest(beside);
  return anchor ? building(parts, anchor) : [];
}

/** What OpenMapTiles draws for a building with no height in OpenStreetMap. */
const UNKNOWN_HEIGHT = 5;
/** Roughly an arena's roof, when nothing better is known. */
export const ARENA_HEIGHT_M = 30;

/**
 * The map draws a building with no height data 5 m tall; an arena isn't. Its main pieces (a
 * quarter of the biggest or more) rise to `fallback`; small ones (a canopy, a ticket booth) stay.
 */
export function withArenaHeight(parts: readonly BuildingPart[], fallback = ARENA_HEIGHT_M): BuildingPart[] {
  const biggest = parts.reduce((max, p) => Math.max(max, ringArea(outer(p))), 0);
  return parts.map((p) =>
    p.height === UNKNOWN_HEIGHT && p.base === 0 && fallback > UNKNOWN_HEIGHT && ringArea(outer(p)) >= biggest / 4 ? { ...p, height: fallback } : p,
  );
}
