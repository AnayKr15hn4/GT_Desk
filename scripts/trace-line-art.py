"""
Traces a coloring-page line drawing into centre-line strokes for the Porcelain theme's Delft line
work, and writes them as a TypeScript module.

  python scripts/trace-line-art.py <preset> <drawing.png|webp> src/components/delft/traced/<name>.ts [preview.png]

  python scripts/trace-line-art.py f1-celebration vegas.webp src/components/delft/traced/celebration.ts
  python scripts/trace-line-art.py ufc-champion belts.webp src/components/delft/traced/champion.ts

1. Crop off the frame and the watermark (crop).
2. Threshold to ink, then leave out lettering and logos (brands): "erase" clears a box, "inside"
   drops only shapes wholly within it, so outlines running through stay.
3. Thin every line to one pixel (Zhang-Suen), follow the skeleton into polylines, simplify them
   (Ramer-Douglas-Peucker), join lines that carry on, drop specks, fine texture (texture) and
   whole regions (drop), and order the strokes outward from focus (where painting starts).
   fine marks lighter strokes.

Each drawing has a preset below, in source-image pixels. For a new drawing, open it with a
coordinate grid and add one. Needs Python 3 with numpy and opencv-python.
"""
import json
import math
import sys

import cv2
import numpy as np

PRESETS = {
    # The winner standing on the car, fists up (traced/celebration.ts).
    'f1-celebration': {
        'subject': 'the driver on the car',
        'crop': (18, 18, 1338, 1330),
        'brands': [
            ('erase', (398, 892, 578, 982)),      # "Mobil" on the bodywork
            ('erase', (462, 1014, 580, 1132)),    # the winged horse below it
            ('inside', (1072, 960, 1354, 1094)),  # "ORACLE" on the sidepod
            ('erase', (648, 312, 768, 402)),      # chest logo and lettering
            ('erase', (688, 412, 722, 434)),      # belt badge
            ('erase', (766, 468, 800, 628)),      # lettering down the leg
            ('erase', (100, 885, 195, 925)),      # lettering on the car behind
        ],
        'focus': (735, 170),  # the helmet
        # The fence, photographers and poles on the left: behind the copy and the dial card.
        'drop': [(0, 560, 610, 860), (0, 860, 335, 962), (330, 820, 470, 872)],
        'fine': [(960, 590, 1200, 940), (1150, 860, 1354, 990)],  # poles and cars behind
        'texture': [],
        'edge_below': None,
    },
    # The champion with a belt on each shoulder (traced/champion.ts).
    'ufc-champion': {
        'subject': 'the champion with his belts',
        'crop': (16, 16, 1380, 998),  # the empty right side and the watermark go
        'brands': [
            ('erase', (692, 678, 764, 752)),      # logo on the left glove
            ('erase', (826, 732, 890, 808)),      # logo on the right glove
            ('inside', (465, 535, 610, 660)),     # the left belt's centre plate
            ('inside', (900, 510, 1070, 750)),    # the right belt's centre plate
        ],
        'focus': (790, 190),  # the face
        'drop': [(0, 740, 225, 1000)],  # the diagonal lines at the bottom left
        'fine': [(1040, 380, 1380, 1000)],  # the robe falling behind
        # The belts' dotted engraving: strokes shorter than this go, inside each box.
        'texture': [((350, 400, 725, 690), 14), ((810, 370, 1105, 800), 14), ((505, 765, 670, 865), 14)],
        # Lines running in from the left edge this far down (the bench or rail under him) go.
        'edge_below': 700,
    },
}

if len(sys.argv) < 4 or sys.argv[1] not in PRESETS:
    sys.exit('usage: python scripts/trace-line-art.py <' + '|'.join(PRESETS) + '> <drawing> <out.ts> [preview.png]')
NAME, SRC, OUT = sys.argv[1:4]
PREVIEW = sys.argv[4] if len(sys.argv) > 4 else None
PRESET = PRESETS[NAME]
CROP, BRANDS, FOCUS = PRESET['crop'], PRESET['brands'], PRESET['focus']
DROP, FINE, TEXTURE, EDGE_BELOW = PRESET['drop'], PRESET['fine'], PRESET['texture'], PRESET['edge_below']

img = cv2.imread(SRC, cv2.IMREAD_GRAYSCALE)
if img is None:
    sys.exit(f"can't read {SRC}")
x0, y0, x1, y1 = CROP
ink = (img < 170).astype(np.uint8)
ink[:y0, :] = 0
ink[y1:, :] = 0
ink[:, :x0] = 0
ink[:, x1:] = 0

# Remove lettering and logos.
for mode, (bx0, by0, bx1, by1) in BRANDS:
    if mode == 'erase':
        ink[by0:by1, bx0:bx1] = 0
count, labels, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
removed = 0
for i in range(1, count):
    x, y, w, h, area = stats[i]
    for mode, (bx0, by0, bx1, by1) in BRANDS:
        if mode == 'inside' and x >= bx0 and y >= by0 and x + w <= bx1 and y + h <= by1:
            ink[labels == i] = 0
            removed += 1
            break
# Specks.
count, labels, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
for i in range(1, count):
    if stats[i][4] < 12:
        ink[labels == i] = 0


def thin(b):
    """Zhang-Suen thinning, vectorised."""
    b = b.copy()
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(b, 1)
            p2, p3, p4 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:]
            p5, p6, p7 = P[2:, 2:], P[2:, 1:-1], P[2:, :-2]
            p8, p9 = P[1:-1, :-2], P[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            B = sum(n.astype(np.int16) for n in nb)
            seq = nb + [p2]
            A = sum(((seq[k] == 0) & (seq[k + 1] == 1)).astype(np.int16) for k in range(8))
            if step == 0:
                c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                c = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            m = (b == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if m.any():
                b[m] = 0
                changed = True
        if not changed:
            return b


sk = thin(ink)
ys, xs = np.nonzero(sk)
pixels = set(zip(xs.tolist(), ys.tolist()))
OFFS = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
RING = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]


def neighbours(p):
    x, y = p
    return [(x + dx, y + dy) for dx, dy in OFFS if (x + dx, y + dy) in pixels]


def crossings(p):
    """How many separate branches leave a pixel: 1 at an end, 2 along a line, 3+ at a junction."""
    x, y = p
    on = [(x + dx, y + dy) in pixels for dx, dy in RING]
    return sum(1 for k in range(8) if not on[k] and on[(k + 1) % 8])


branches = {p: crossings(p) for p in pixels}
ends_px = [p for p, c in branches.items() if c == 1]
junctions = {p for p, c in branches.items() if c >= 3}
visited = set()
lines = []


def walk(start):
    path = [start]
    if start not in junctions:
        visited.add(start)
    cur = start
    while True:
        options = [n for n in neighbours(cur) if n not in visited and n != start and n not in path[-3:]]
        if not options:
            break
        # Straight-on first: a 4-neighbour before a diagonal, so staircases don't zig-zag.
        options.sort(key=lambda n: (abs(n[0] - cur[0]) + abs(n[1] - cur[1]), n in junctions))
        nxt = options[0]
        path.append(nxt)
        if nxt in junctions:
            break
        visited.add(nxt)
        cur = nxt
    return path


for e in ends_px:
    if e not in visited:
        lines.append(walk(e))
for j in junctions:
    for n in neighbours(j):
        if n not in visited and n not in junctions:
            lines.append([j] + walk(n))
for p_ in list(pixels):
    if p_ not in visited and p_ not in junctions:
        lines.append(walk(p_))


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = np.array(points[0], float), np.array(points[-1], float)
    ab = b - a
    L = np.hypot(*ab)
    pts = np.array(points, float)
    if L == 0:
        d = np.hypot(*(pts - a).T)
    else:
        rel = pts - a
        d = np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / L
    i = int(np.argmax(d))
    if d[i] > eps:
        return rdp(points[: i + 1], eps)[:-1] + rdp(points[i:], eps)
    return [points[0], points[-1]]


def length(points):
    return sum(math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]) for i in range(len(points) - 1))


def middle(points):
    return (sum(x for x, _ in points) / len(points), sum(y for _, y in points) / len(points))


def inside(pt, boxes):
    return any(bx0 <= pt[0] <= bx1 and by0 <= pt[1] <= by1 for bx0, by0, bx1, by1 in boxes)


strokes = [rdp(line, 1.0) for line in lines if length(line) >= 4]


# Join strokes that meet end to end and carry on in the same direction, so lines draw in one go.
def direction(points, at_end):
    a, b = (points[-2], points[-1]) if at_end else (points[1], points[0])
    L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
    return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)


merged = True
while merged:
    merged = False
    ends = {}
    for i, s in enumerate(strokes):
        ends.setdefault(s[0], []).append((i, 0))
        ends.setdefault(s[-1], []).append((i, 1))
    used = set()
    out = []
    for i, s in enumerate(strokes):
        if i in used:
            continue
        used.add(i)
        cur = s
        grew = True
        while grew:
            grew = False
            d0 = direction(cur, True)
            best = None
            for j, which in ends.get(cur[-1], []):
                if j in used:
                    continue
                other = strokes[j] if which == 0 else strokes[j][::-1]
                d1 = direction(other[::-1], True)
                if d0[0] * -d1[0] + d0[1] * -d1[1] > 0.6:
                    best = (j, other)
                    break
            if best:
                used.add(best[0])
                cur = cur + best[1][1:]
                grew = True
                merged = True
        out.append(cur)
    strokes = out


def shortest_kept(s):
    """Specks go everywhere; in textured areas (engraving, stippling), longer marks go too."""
    m = middle(s)
    for box, shortest in TEXTURE:
        if inside(m, [box]):
            return shortest
    return 6


def from_left_edge(s):
    return EDGE_BELOW is not None and any(x < x0 + 8 and y > EDGE_BELOW for x, y in s)


strokes = [s for s in strokes if length(s) >= shortest_kept(s) and not inside(middle(s), DROP) and not from_left_edge(s)]
# Painting order: outward from the focus, by where each stroke comes nearest it.
strokes.sort(key=lambda s: min(math.hypot(x - FOCUS[0], y - FOCUS[1]) for x, y in s))
total_px = sum(length(s) for s in strokes)


def poly(points):
    pts = [(round(x - x0), round(y - y0)) for x, y in points]
    out = [pts[0]]
    for q in pts[1:]:
        if q != out[-1]:
            out.append(q)
    return 'M' + 'L'.join(f'{x} {y}' for x, y in out)


paths = [[poly(s), round(length(s)), 1 if (inside(middle(s), FINE) or length(s) < 24) else 0] for s in strokes]
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(f"// Generated by scripts/trace-line-art.py ({NAME}): centre lines of {PRESET['subject']}.\n")
    f.write('// Lettering and logos were left out. Do not edit by hand.\n')
    f.write(f'export const width = {x1 - x0};\n')
    f.write(f'export const height = {y1 - y0};\n')
    f.write('/** Strokes in painting order (outward from the focus): SVG path data, length in px, 1 for a fine line. */\n')
    f.write('export const strokes: [string, number, 0 | 1][] = ')
    json.dump(paths, f, separators=(',', ':'))
    f.write(';\n')

size = sum(len(p[0]) for p in paths)
print(f'{NAME}: removed {removed} lettering shapes; {len(pixels)} skeleton px; {len(strokes)} strokes; {total_px:.0f} px of line; {size / 1024:.0f} KB of path data')

if PREVIEW:
    canvas = np.full((y1 - y0, x1 - x0, 3), 255, np.uint8)
    for k, s in enumerate(strokes):
        t = k / max(1, len(strokes) - 1)
        colour = (int(160 * t + 60), int(70 + 60 * t), int(40 + 100 * (1 - t)))
        pts = np.array([(x - x0, y - y0) for x, y in s], np.int32)
        cv2.polylines(canvas, [pts], False, colour, 1, cv2.LINE_AA)
    cv2.imwrite(PREVIEW, canvas)
