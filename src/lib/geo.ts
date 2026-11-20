/** Small geographic helpers for the venue maps. */

export type LngLat = [number, number];

/** Distance in km between two coordinates (haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** [west, south, east, north] of a list of points. */
export function bounds(points: readonly LngLat[]): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [x, y] of points) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
}

/** A closed polygon ring around a point, `radiusM` metres out (for "buildings within" filters). */
export function circleRing(center: LngLat, radiusM: number, steps = 32): LngLat[] {
  const [lon, lat] = center;
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]);
  }
  return ring;
}

/** A rectangle ring from [west, south, east, north], grown by `padM` metres on each side. */
export function bboxRing([w, s, e, n]: [number, number, number, number], padM = 0): LngLat[] {
  const lat = (s + n) / 2;
  const dLat = padM / 111_320;
  const dLon = padM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const W = w - dLon;
  const E = e + dLon;
  const S = s - dLat;
  const N = n + dLat;
  return [
    [W, S],
    [E, S],
    [E, N],
    [W, N],
    [W, S],
  ];
}

/** Total length of a line in km. */
export function lineLengthKm(line: readonly LngLat[]): number {
  let km = 0;
  for (let i = 1; i < line.length; i++) km += distanceKm(line[i - 1][1], line[i - 1][0], line[i][1], line[i][0]);
  return km;
}

/** Longitude/latitude of the centre of a box. */
export function boxCenter([w, s, e, n]: [number, number, number, number]): LngLat {
  return [(w + e) / 2, (s + n) / 2];
}

/**
 * Projects a [lon, lat] line north-up into a box whose longer side is 100, as an SVG path.
 * Longitude is scaled by cos(latitude) so the shape is not stretched away from the equator.
 */
export function projectToSvg(coords: readonly LngLat[]): { d: string; width: number; height: number } {
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const k = Math.cos((lat * Math.PI) / 180);
  const pts = coords.map(([x, y]) => [x * k, -y]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = 100 / Math.max(spanX, spanY);
  const d =
    pts.map(([x, y], i) => `${i ? 'L' : 'M'}${((x - minX) * scale).toFixed(2)} ${((y - minY) * scale).toFixed(2)}`).join('') + 'Z';
  return { d, width: +(spanX * scale).toFixed(2), height: +(spanY * scale).toFixed(2) };
}

/**
 * Pushes a ring out by `metres` from its centre, so a gold copy drawn over a building doesn't
 * flicker against the walls it shares with OpenStreetMap's own extrusion.
 */
export function grow(ring: LngLat[], metres: number): LngLat[] {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const k = Math.cos((cy * Math.PI) / 180);
  return ring.map(([x, y]) => {
    const dx = (x - cx) * 111_320 * k;
    const dy = (y - cy) * 111_320;
    const d = Math.hypot(dx, dy) || 1;
    const s = (d + metres) / d;
    return [cx + (x - cx) * s, cy + (y - cy) * s];
  });
}
