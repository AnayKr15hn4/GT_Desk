/**
 * Drawing helpers for the Delft line work: points in, smooth SVG paths out. Everything is drawn
 * in local coordinates (a motif points "up", toward -y) and then placed, turned and scaled.
 */

export type Pt = [number, number];

export interface Place {
  x?: number;
  y?: number;
  /** Degrees, clockwise (SVG's y points down). */
  rotate?: number;
  scale?: number;
  /** Mirror left to right before turning. */
  flip?: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function place(points: readonly Pt[], { x = 0, y = 0, rotate = 0, scale = 1, flip = false }: Place): Pt[] {
  const a = (rotate * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return points.map(([px, py]) => {
    const lx = (flip ? -px : px) * scale;
    const ly = py * scale;
    return [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
  });
}


/** A smooth curve through the points (Catmull-Rom, written as cubic Béziers). */
export function smooth(points: readonly Pt[], closed = false): string {
  const n = points.length;
  if (n < 2) return '';
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${r2(points[0][0])} ${r2(points[0][1])}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}


/** Evenly spaced samples of t in [0, 1]. */
export function steps(count: number): number[] {
  return Array.from({ length: count + 1 }, (_, i) => i / count);
}

/** A leaf along +x: pointed tip, fuller near the base, bending by `bend` (a fraction of its length). */
export function leafOutline(length: number, width: number, bend = 0): Pt[] {
  const spine = (t: number) => bend * length * t * t;
  const half = (t: number) => width * Math.sin(Math.PI * t) ** 0.85 * (1 - 0.3 * t);
  const top = steps(9).map((t): Pt => [length * t, spine(t) - half(t)]);
  const bottom = steps(9)
    .reverse()
    .slice(1, -1)
    .map((t): Pt => [length * t, spine(t) + half(t)]);
  return [...top, ...bottom];
}

export function leafSpine(length: number, bend = 0, from = 0.08, to = 0.8): Pt[] {
  return steps(6).map((s): Pt => {
    const t = from + (to - from) * s;
    return [length * t, bend * length * t * t];
  });
}

/** A petal along +x: narrow at the base, round and full at the end. */
export function petalOutline(length: number, width: number): Pt[] {
  const half = (t: number) => width * Math.sin(Math.PI * t ** 0.75) ** 0.7;
  const top = steps(10).map((t): Pt => [length * t, -half(t)]);
  const bottom = steps(10)
    .reverse()
    .slice(1, -1)
    .map((t): Pt => [length * t, half(t)]);
  return [...top, ...bottom];
}

/** A curl winding inward from radius r0 to r1, `turns` times, starting at angle a0 (degrees). */
export function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, a0 = 0, clockwise = true): Pt[] {
  const total = turns * Math.PI * 2;
  const count = Math.max(12, Math.round(turns * 22));
  return steps(count).map((t): Pt => {
    const a = (a0 * Math.PI) / 180 + (clockwise ? 1 : -1) * total * t;
    const r = r0 * (r1 / r0) ** t;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** A ring of rounded lobes (a flower's outline) between rInner (the notches) and rOuter (the tips). */
export function scallops(cx: number, cy: number, rInner: number, rOuter: number, lobes: number, phase = 0): Pt[] {
  const points: Pt[] = [];
  const per = 7;
  for (let i = 0; i < lobes; i++) {
    for (let j = 0; j < per; j++) {
      const u = j / per;
      const a = ((i + u + phase) / lobes) * Math.PI * 2 - Math.PI / 2;
      const r = rInner + (rOuter - rInner) * Math.sin(Math.PI * u) ** 0.55;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return points;
}

/** Points along the same curve `smooth()` draws through `points`, `per` to each stretch. */
export function sampleSmooth(points: readonly Pt[], per = 16): Pt[] {
  const n = points.length;
  if (n < 2) return [...points];
  const at = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  const out: Pt[] = [points[0]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 1; k <= per; k++) {
      const s = k / per;
      const u = 1 - s;
      out.push([
        u * u * u * p1[0] + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * p2[0],
        u * u * u * p1[1] + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * p2[1],
      ]);
    }
  }
  return out;
}

/** Walks a line by distance: where you are after `s` units, and which way you're heading (degrees). */
export function walker(points: readonly Pt[]) {
  const total = [0];
  for (let i = 1; i < points.length; i++) total.push(total[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const length = total[total.length - 1];
  return {
    length,
    at(s: number): { point: Pt; angle: number } {
      const target = Math.max(0, Math.min(length, s));
      let i = 1;
      while (i < total.length - 1 && total[i] < target) i++;
      const a = points[i - 1];
      const b = points[i];
      const k = (target - total[i - 1]) / (total[i] - total[i - 1] || 1);
      return { point: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
    },
  };
}

/** A small seeded random number generator (mulberry32), so each vine grows the same way every time. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
