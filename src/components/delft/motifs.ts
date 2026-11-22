import { leafOutline, leafSpine, petalOutline, place, random, sampleSmooth, scallops, smooth, spiral, steps, walker, type Pt } from './geometry';

/**
 * Delft blue line work, after the painted vines and flowers of Delftware: a stem that grows,
 * leaves that open off it, tendrils that curl, a small flower at the tip. Just thin lines, no
 * objects. Each stroke knows when it starts, so a vine paints itself from root to tip.
 */

export interface Stroke {
  d: string;
  /** line: stems and outlines. fine: veins and dots. */
  tone: 'line' | 'fine';
  /** In a scene traced in its subject's own colours, the colour of what the line runs over. */
  ink?: string;
  /** When the stroke starts, ms. */
  delay: number;
  /** How long it takes, ms; by its length when left out. */
  duration?: number;
}

type Map = (points: Pt[]) => Pt[];

const same: Map = (points) => points;
/** Milliseconds for the growing tip to travel one unit of stem. */
const GROW_MS = 7;

const ring = (cx: number, cy: number, r: number, count = 24): Pt[] =>
  steps(count)
    .slice(0, -1)
    .map((t): Pt => [cx + r * Math.sin(t * Math.PI * 2), cy - r * Math.cos(t * Math.PI * 2)]);

const stroke = (map: Map, points: Pt[], tone: Stroke['tone'], delay: number, duration?: number, closed = false): Stroke => ({
  d: smooth(map(points), closed),
  tone,
  delay: Math.round(delay),
  duration,
});

/** A flower from the front: rounded petals, a ring, a heart, a vein in each petal. */
export function rosette(map: Map, cx: number, cy: number, r: number, petals: number, t: number): Stroke[] {
  const strokes: Stroke[] = [
    stroke(map, scallops(cx, cy, r * 0.56, r, petals), 'line', t, 900, true),
    stroke(map, ring(cx, cy, r * 0.36), 'line', t + 380, 500, true),
    stroke(map, ring(cx, cy, r * 0.11, 10), 'fine', t + 620, 300, true),
  ];
  for (let i = 0; i < petals; i++) {
    const a = ((i + 0.5) / petals) * Math.PI * 2 - Math.PI / 2;
    const p = (k: number): Pt => [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)];
    strokes.push(stroke(map, [p(0.62), p(0.84)], 'fine', t + 700 + i * 45, 260));
  }
  return strokes;
}

function leaf(map: Map, base: Pt, angle: number, length: number, side: number, t: number): Stroke[] {
  const local = (points: Pt[]) => map(place(points, { x: base[0], y: base[1], rotate: angle }));
  const bend = side * 0.11;
  return [stroke(local, leafOutline(length, length * 0.27, bend), 'line', t, 640, true), stroke(local, leafSpine(length, bend, 0.1, 0.78), 'fine', t + 300, 380)];
}

/** A tendril off the stem that ends in a curl, the Delft painter's flourish. */
function curl(map: Map, base: Pt, angle: number, length: number, side: number, t: number): Stroke {
  const L = length;
  const local = [
    [0, 0],
    [L * 0.42, -0.05 * L],
    [L * 0.78, -0.2 * L],
    ...spiral(L * 0.76, -0.43 * L, 0.23 * L, 0.04 * L, 1.35, 85, false).slice(1),
  ].map(([x, y]): Pt => [x, y * side]);
  return stroke((points) => map(place(points, { x: base[0], y: base[1], rotate: angle })), local, 'line', t, 900);
}

function bud(map: Map, base: Pt, angle: number, length: number, t: number): Stroke[] {
  const local = (points: Pt[]) => map(place(points, { x: base[0], y: base[1], rotate: angle }));
  return [stroke(local, petalOutline(length, length * 0.34), 'line', t, 520, true), stroke(local, [[length * 0.24, 0], [length * 0.64, 0]], 'fine', t + 260, 260)];
}

/** Three dots, the way Delft painters scatter them beside a leaf. */
function dots(map: Map, near: Pt, angle: number, distance: number, t: number): Stroke[] {
  const a = (angle * Math.PI) / 180;
  const c: Pt = [near[0] + distance * Math.cos(a), near[1] + distance * Math.sin(a)];
  const across: Pt = [-Math.sin(a) * 2.6, Math.cos(a) * 2.6];
  const along: Pt = [Math.cos(a) * 2.4, Math.sin(a) * 2.4];
  return [
    [c[0] + along[0], c[1] + along[1]],
    [c[0] + across[0], c[1] + across[1]],
    [c[0] - across[0], c[1] - across[1]],
  ].map((p, i) => stroke(map, ring(p[0], p[1], 0.85, 8), 'fine', t + i * 110, 220, true));
}

export interface VineSpec {
  /** The stem's shape, root first. */
  stem: Pt[];
  seed: number;
  /** When the root starts growing, ms. */
  start?: number;
  /** The flower at the tip (its radius); 0 for a bud. */
  bloom?: number;
  /** Scales leaves and curls. */
  size?: number;
  /** One side branch partway along. */
  branch?: boolean;
  /** Room between leaves, as a multiple of the usual. */
  spacing?: number;
  /** What the tip ends in when there's no flower. */
  end?: 'bud' | 'curl';
  /** Where the drawing lands (mirroring, for a pair). */
  map?: Map;
}

/**
 * A vine: the stem grows from its root, and as the tip passes, leaves open on alternate sides,
 * tendrils curl, now and then three dots; a side branch with its own flower; a flower at the tip.
 */
export function vine({ stem, seed, start = 0, bloom = 7, size = 1, branch = true, spacing = 1, end = 'bud', map = same }: VineSpec): Stroke[] {
  const rand = random(seed);
  const walk = walker(sampleSmooth(stem, 18));
  const growMs = walk.length * GROW_MS;
  const when = (s: number) => start + (s / walk.length) * growMs;
  const strokes: Stroke[] = [stroke(map, stem, 'line', start, growMs)];
  const branchAt = branch ? walk.length * (0.36 + rand() * 0.16) : Infinity;
  let branched = false;
  let side = rand() < 0.5 ? 1 : -1;
  let s = (11 + rand() * 7) * size;
  for (let n = 0; s < walk.length - 14 * size; n++) {
    const { point, angle } = walk.at(s);
    const t = when(s);
    if (!branched && s >= branchAt) {
      branched = true;
      const L = walk.length * 0.4;
      const frame = (points: Pt[]) => place(points, { x: point[0], y: point[1], rotate: angle });
      const shoot = frame([
        [0, 0],
        [L * 0.34, side * L * 0.1],
        [L * 0.68, side * L * 0.27],
        [L * 0.94, side * L * 0.31],
      ]);
      // The branch ends in a bud, so the vine has one flower.
      strokes.push(...vine({ stem: shoot, seed: seed * 7 + 3, start: t, bloom: 0, size: size * 0.84, branch: false, map }));
    } else if (n % 3 === 2) {
      strokes.push(curl(map, point, angle + side * 56, (14 + rand() * 5) * size, side, t));
    } else {
      const length = (13 + rand() * 7) * size;
      strokes.push(...leaf(map, point, angle + side * (34 + rand() * 18), length, side, t));
      if (rand() < 0.25) strokes.push(...dots(map, point, angle + side * 100, 8 * size, t + 420));
    }
    side = -side;
    s += (18 + rand() * 9) * size * spacing;
  }
  const tip = walk.at(walk.length);
  const t = when(walk.length);
  if (bloom > 0) {
    const a = (tip.angle * Math.PI) / 180;
    strokes.push(...rosette(map, tip.point[0] + bloom * Math.cos(a), tip.point[1] + bloom * Math.sin(a), bloom, 8, t));
    // Two small leaves cupping the flower.
    for (const cup of [1, -1]) strokes.push(...leaf(map, tip.point, tip.angle + cup * 140, bloom * 0.78, -cup, t + 220));
  } else if (end === 'curl') {
    strokes.push(curl(map, tip.point, tip.angle - side * 20, 15 * size, -side, t));
  } else {
    strokes.push(...bud(map, tip.point, tip.angle, 9 * size, t));
  }
  return strokes;
}

/**
 * The flourish beside a page title, in a 600 by 200 box: a vine sweeping in from the right edge
 * and coming to a flower. Two shapes, painted in turn.
 */
export function flourish(): [Stroke[], Stroke[]] {
  return [
    vine({ stem: [[604, 22], [548, 58], [480, 44], [418, 92], [350, 88], [296, 130], [236, 128]], seed: 5, bloom: 15, size: 1.75 }),
    vine({ stem: [[604, 120], [552, 86], [486, 104], [424, 56], [356, 70], [300, 30], [244, 40]], seed: 11, bloom: 15, size: 1.75 }),
  ];
}

/**
 * A divider for between sections, 760 by 60: a flower in the middle and a vine growing out from
 * it to each side, one the mirror of the other. Two arrangements, painted in turn.
 */
export function divider(): [Stroke[], Stroke[]] {
  const mid = 380;
  const y = 30;
  const pair = (seed: number, wave: number[]): Stroke[] => {
    const right: Pt[] = wave.map((dy, i): Pt => [mid + 11 + i * 78, y + dy]);
    const mirror: Map = (points) => points.map(([x, py]): Pt => [2 * mid - x, py]);
    return [
      ...rosette(same, mid, y, 8.5, 8, 0),
      ...vine({ stem: right, seed, start: 650, bloom: 0, size: 0.9, spacing: 1.5, branch: false, end: 'curl' }),
      ...vine({ stem: right, seed, start: 650, bloom: 0, size: 0.9, spacing: 1.5, branch: false, end: 'curl', map: mirror }),
    ];
  };
  return [pair(3, [0, -7, 5, -5, 3]), pair(8, [0, 6, -6, 4, -2])];
}

/* ── The hero's big flower ───────────────────────────────────────────────────────────────── */

const polar = (cx: number, cy: number, r: number, deg: number): Pt => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

/** Points along an arc of radius r(u) from angle a0 to a1 (degrees). */
const arc = (cx: number, cy: number, a0: number, a1: number, radius: (u: number) => number, count = 14): Pt[] =>
  steps(count).map((u) => polar(cx, cy, radius(u), a0 + (a1 - a0) * u));

/** A leaf with a midrib and side veins, for the big compositions. */
function veinedLeaf(map: Map, base: Pt, angle: number, length: number, side: number, t: number): Stroke[] {
  const local = (points: Pt[]) => map(place(points, { x: base[0], y: base[1], rotate: angle }));
  const bend = side * 0.08;
  const width = length * 0.3;
  const half = (u: number) => width * Math.sin(Math.PI * u) ** 0.85 * (1 - 0.3 * u);
  const strokes = [stroke(local, leafOutline(length, width, bend), 'line', t, 760, true), stroke(local, leafSpine(length, bend, 0.04, 0.86), 'fine', t + 320, 520)];
  [0.3, 0.48, 0.66].forEach((u, i) => {
    const y = bend * length * u * u;
    for (const dir of [-1, 1]) {
      strokes.push(stroke(local, [[length * u, y], [length * (u + 0.1), y + dir * half(u) * 0.72]], 'fine', t + 520 + i * 90, 260));
    }
  });
  return strokes;
}

/** A rose leaf: a short stalk with a leaflet at its end and a pair either side. */
function roseLeaf(map: Map, base: Pt, angle: number, size: number, side: number, t: number): Stroke[] {
  const stalk = size * 0.34;
  const a = (angle * Math.PI) / 180;
  const end: Pt = [base[0] + stalk * Math.cos(a), base[1] + stalk * Math.sin(a)];
  const middle: Pt = [base[0] + stalk * 0.55 * Math.cos(a), base[1] + stalk * 0.55 * Math.sin(a)];
  return [
    stroke(map, [base, middle, end], 'line', t, 420),
    ...veinedLeaf(map, end, angle + side * 6, size * 0.62, side, t + 300),
    ...veinedLeaf(map, middle, angle - 52, size * 0.46, -1, t + 520),
    ...veinedLeaf(map, middle, angle + 52, size * 0.46, 1, t + 620),
  ];
}

/** A small hooked thorn on a stem. */
function thorn(map: Map, at: Pt, angle: number, side: number, size: number, t: number): Stroke {
  const local = (points: Pt[]) => map(place(points, { x: at[0], y: at[1], rotate: angle }));
  return stroke(local, [[-size * 0.5, 0], [-size * 0.1, -side * size * 0.45], [size * 0.25, -side * size * 0.9], [size * 0.2, 0]], 'fine', t, 300);
}

/**
 * A rose from above in Delft line work: a curled heart, rings of cupped petals that overlap like
 * shingles (each drawn where it shows), sepals between the outer petals.
 */
function roseHead(map: Map, cx: number, cy: number, R: number, t: number): Stroke[] {
  const strokes: Stroke[] = [stroke(map, spiral(cx, cy, R * 0.14, R * 0.025, 2.2, 210, true), 'line', t, 1100)];
  // Rings from the heart out: radius, petals, spread (degrees), offset.
  const rings: [number, number, number, number][] = [
    [0.24, 3, 150, 20],
    [0.38, 4, 122, 62],
    [0.53, 5, 104, 14],
  ];
  let k = t + 500;
  for (const [r, count, spread, offset] of rings) {
    for (let i = 0; i < count; i++) {
      const a0 = offset + (i * 360) / count;
      // A cupped petal: rising from inside, round across the top, tucking in at the end.
      const points = arc(cx, cy, a0, a0 + spread, (u) => R * r * (0.82 + 0.2 * Math.sin(Math.PI * u ** 0.8)) * (u > 0.85 ? 1 - (u - 0.85) * 0.9 : 1));
      strokes.push(stroke(map, points, 'line', k, 620));
      k += 110;
    }
  }
  // The open petals, drawn as shingles: across the top edge and down the side that shows.
  const outer: [number, number, number, number][] = [
    [0.6, 0.84, 6, 0],
    [0.86, 1, 7, 26],
  ];
  for (const [r0, r1, count, offset] of outer) {
    const half = 360 / count / 2 + 6;
    for (let i = 0; i < count; i++) {
      const c = offset + (i * 360) / count;
      const top = arc(cx, cy, c - half, c + half, (u) => R * r1 * (1 + 0.035 * Math.sin(Math.PI * 2 * u) - 0.02 * Math.sin(Math.PI * u * 4)), 18);
      const side = arc(cx, cy, c + half, c + half * 0.72, (u) => R * (r1 - (r1 - r0) * u), 6).slice(1);
      strokes.push(stroke(map, [...top, ...side], 'line', k, 760));
      strokes.push(stroke(map, [polar(cx, cy, R * (r0 + 0.04), c), polar(cx, cy, R * (r1 - 0.08), c + 2)], 'fine', k + 320, 320));
      k += 120;
    }
  }
  // Sepals peeking out between the outer petals.
  for (let i = 0; i < 5; i++) {
    const c = 26 + 360 / 14 + (i * 360) / 5;
    strokes.push(...leaf(map, polar(cx, cy, R * 0.93, c), c, R * 0.26, i % 2 ? 1 : -1, k));
    k += 140;
  }
  return strokes;
}

/** A rosebud: closed petals with a turn of the curl showing, cupped by two sepals. */
function roseBud(map: Map, base: Pt, angle: number, size: number, t: number): Stroke[] {
  const local = (points: Pt[]) => map(place(points, { x: base[0], y: base[1], rotate: angle }));
  return [
    stroke(local, petalOutline(size, size * 0.42), 'line', t, 700, true),
    stroke(local, [[size * 0.92, -size * 0.06], [size * 0.7, -size * 0.2], [size * 0.5, -size * 0.08], [size * 0.42, size * 0.12], [size * 0.6, size * 0.22]], 'fine', t + 400, 420),
    ...leaf(local, [size * 0.12, 0], -38, size * 0.55, -1, t + 560),
    ...leaf(local, [size * 0.12, 0], 38, size * 0.55, 1, t + 640),
  ];
}

/** A stem that grows from its root, with what grows off it timed to the passing tip. */
function grownStem(map: Map, stem: Pt[], start: number) {
  const walk = walker(sampleSmooth(stem, 18));
  const growMs = walk.length * GROW_MS;
  return {
    walk,
    end: start + growMs,
    stroke: stroke(map, stem, 'line', start, growMs),
    when: (s: number) => start + (s / walk.length) * growMs,
  };
}

/** A long tendril reaching right with small leaves along it, ending in a curl: it runs out into the fade. */
function reach(map: Map, stem: Pt[], start: number, seed: number): Stroke[] {
  const rand = random(seed);
  const s = grownStem(map, stem, start);
  const strokes: Stroke[] = [s.stroke];
  let side = 1;
  for (let at = 40; at < s.walk.length - 40; at += 46 + rand() * 16) {
    const { point, angle } = s.walk.at(at);
    strokes.push(...veinedLeaf(map, point, angle + side * (38 + rand() * 12), 38 + rand() * 10, side, s.when(at)));
    side = -side;
  }
  const tip = s.walk.at(s.walk.length);
  strokes.push(curl(map, tip.point, tip.angle - 24, 44, -1, s.end));
  return strokes;
}

/**
 * The hero rose, in a 1400 by 1000 box made for the left of the hero: the flower up by the
 * headline, its stem down the margin beside the dial card, a bud reaching up and a tendril
 * reaching right into the fade.
 */
export function heroRose(): Stroke[] {
  const c: Pt = [300, 330];
  const R = 200;
  const strokes = roseHead(same, c[0], c[1], R, 0);
  const stem = grownStem(same, [polar(c[0], c[1], R * 0.97, 112), [196, 610], [160, 700], [146, 800], [126, 900], [104, 1000]], 3400);
  strokes.push(stem.stroke);
  for (const [f, side] of [[0.22, -1], [0.5, 1], [0.78, -1]] as const) {
    const { point, angle } = stem.walk.at(stem.walk.length * f);
    strokes.push(...roseLeaf(same, point, angle + side * 60, 170, side, stem.when(stem.walk.length * f)));
  }
  for (const [f, side] of [[0.36, -1], [0.64, 1]] as const) {
    const { point, angle } = stem.walk.at(stem.walk.length * f);
    strokes.push(thorn(same, point, angle, side, 12, stem.when(stem.walk.length * f)));
  }
  // The bud on its own stalk, reaching up and right above the headline.
  const stalk = grownStem(same, [polar(c[0], c[1], R * 0.98, -40), [556, 126], [670, 94], [770, 86], [850, 96]], 3800);
  strokes.push(stalk.stroke);
  const tip = stalk.walk.at(stalk.walk.length);
  strokes.push(...roseBud(same, tip.point, tip.angle, 84, stalk.end));
  const mid = stalk.walk.at(stalk.walk.length * 0.45);
  strokes.push(...veinedLeaf(same, mid.point, mid.angle + 50, 64, 1, stalk.when(stalk.walk.length * 0.45)));
  // A tendril running right into the fade, and the painter's dots.
  strokes.push(...reach(same, [polar(c[0], c[1], R * 1.02, 40), [600, 492], [780, 472], [960, 502], [1150, 480], [1340, 500]], 4200, 21));
  strokes.push(...dots(same, polar(c[0], c[1], R * 1.12, -78), -78, 16, 2800));
  strokes.push(...dots(same, polar(c[0], c[1], R * 1.1, 52), 52, 18, 3200));
  return strokes;
}

/** The hero's other flower, in the same box: a peony in layers of round petals, leaves, a bud. */
export function heroPeony(): Stroke[] {
  const c: Pt = [300, 340];
  const R = 192;
  const strokes: Stroke[] = [];
  // From the heart out, each ring of petals a little wider and turned.
  const rings: [number, number, number, number][] = [
    [0.1, 0.22, 6, 0.2],
    [0.24, 0.42, 8, 0.5],
    [0.44, 0.64, 10, 0.15],
    [0.66, 0.84, 12, 0.45],
    [0.84, 1, 14, 0],
  ];
  rings.forEach(([r0, r1, lobes, phase], i) => {
    const cy = c[1] + R * 0.02 * i;
    strokes.push(stroke(same, scallops(c[0], cy, R * r0, R * r1, lobes, phase), 'line', i * 650, 1300, true));
    for (let j = 0; j < lobes; j++) {
      const a = ((j + 0.5 + phase) / lobes) * 360 - 90;
      strokes.push(stroke(same, [polar(c[0], cy, R * (r0 + (r1 - r0) * 0.25), a), polar(c[0], cy, R * (r0 + (r1 - r0) * 0.7), a)], 'fine', i * 650 + 700 + j * 40, 260));
    }
  });
  strokes.push(stroke(same, ring(c[0], c[1], R * 0.05, 10), 'fine', 300, 400, true));
  const stem = grownStem(same, [polar(c[0], c[1], R, 108), [206, 620], [176, 716], [160, 814], [136, 910], [112, 1000]], 3400);
  strokes.push(stem.stroke);
  for (const [f, side, size] of [[0.24, -1, 170], [0.52, 1, 190], [0.8, -1, 160]] as const) {
    const { point, angle } = stem.walk.at(stem.walk.length * f);
    strokes.push(...veinedLeaf(same, point, angle + side * 52, size, side, stem.when(stem.walk.length * f)));
  }
  const stalk = grownStem(same, [polar(c[0], c[1], R * 1.01, -42), [552, 128], [664, 98], [764, 90], [846, 100]], 3600);
  strokes.push(stalk.stroke);
  const tip = stalk.walk.at(stalk.walk.length);
  const flower = polar(tip.point[0], tip.point[1], 32, tip.angle);
  strokes.push(...rosette(same, flower[0], flower[1], 32, 9, stalk.end));
  strokes.push(...reach(same, [polar(c[0], c[1], R * 1.02, 42), [600, 496], [786, 474], [970, 504], [1160, 482], [1340, 502]], 4000, 34));
  strokes.push(...dots(same, polar(c[0], c[1], R * 1.12, -80), -80, 16, 3000));
  return strokes;
}
