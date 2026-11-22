"""
Traces a coloring-page line drawing into centre-line strokes for the hero's painted line work
(Delft blue in Porcelain, a night piece in Midnight), and writes them as a TypeScript module.

  python scripts/trace-line-art.py <preset> <drawing.png|webp> src/components/delft/traced/<name>.ts [preview.png] [--colours=<photo>]

  python scripts/trace-line-art.py f1-celebration vegas.webp src/components/delft/traced/celebration.ts
  python scripts/trace-line-art.py ufc-champion belts.webp src/components/delft/traced/champion.ts
  python scripts/trace-line-art.py f1-leclerc leclerc.webp src/components/delft/traced/leclerc.ts --colours=leclerc-photo.jpg
  python scripts/trace-line-art.py night-jay jay.webp src/components/delft/traced/jay.ts
  python scripts/trace-line-art.py night-hummingbird hummingbird.webp src/components/delft/traced/hummingbird.ts

A preset with colours gives each stroke an ink for the colour it runs over in the photo the
drawing was made from, laid over the drawing (frame): the photo's colours are sorted by hue
(red, orange, yellow, green, blue, violet) or as light, grey or dark, and the preset maps those to
its inks (map). Colours it leaves out, a background's, don't count. One with flip is mirrored;
one with trim has the empty margin at its left cut off, so it starts at the left edge.

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
    # Midnight's Formula 1 scene: Charles Leclerc pulling on his gloves (traced/leclerc.ts), each
    # line red or white as his suit and helmet are in the photo.
    'f1-leclerc': {
        'subject': 'Charles Leclerc pulling on his gloves',
        'crop': (16, 300, 1106, 1608),
        'trim': True,
        'colours': {
            'frame': (12, 12, 1110, 1612),  # the photo, stretched over the drawing's frame
            'inks': ['white', 'red'],
            # Black parts (the neck support, shadows) take white lines, as a lesser vote.
            'map': {'red': 'red', 'orange': 'red', 'yellow': 'red', 'light': 'white', 'dark': ('white', 0.5)},
            'min_s': 90,
            'light': (70, 150),
        },
        'brands': [
            ('erase', (40, 742, 205, 838)),       # lettering on the garage wall
            ('erase', (442, 474, 519, 549)),      # the badge on the helmet
            ('erase', (466, 547, 501, 580)),      # and the emblem under it
            ('inside', (300, 552, 382, 579)),     # lettering on the visor's band
            ('inside', (570, 557, 647, 590)),
            ('inside', (320, 716, 548, 758)),     # vents and lettering on the chin
            ('inside', (452, 754, 508, 776)),
            ('inside', (355, 784, 530, 836)),     # logos under them
            ('erase', (240, 990, 425, 1110)),     # the logo on the chest
            ('inside', (92, 1312, 302, 1466)),    # lettering down the sleeve
            ('erase', (722, 1436, 862, 1500)),    # the name on the belt (the drawing spelt it wrong)
            ('inside', (465, 1150, 565, 1260)),   # the logo behind the gloves
            ('erase', (528, 1196, 584, 1302)),
            ('erase', (596, 1186, 636, 1312)),
            ('erase', (536, 296, 770, 352)),      # the garage beams where they meet his outline
            ('erase', (604, 396, 640, 412)),
            ('erase', (16, 1445, 96, 1490)),
        ],
        'focus': (460, 560),  # the helmet
        # The garage behind him: beams, a strut, a board, signs and lettering, the car's edges.
        'drop': [
            (16, 380, 248, 720), (655, 200, 1106, 640), (560, 280, 700, 345), (850, 330, 1106, 860),
            (1000, 780, 1106, 960), (990, 930, 1106, 1135), (16, 860, 98, 1080), (16, 1090, 88, 1480),
            (16, 1440, 160, 1500), (16, 1500, 300, 1608), (870, 1230, 1106, 1608),
        ],
        'fine': [],
        'texture': [],
        'edge_below': None,
    },
    # Midnight: a blue jay taking off, wings spread (traced/jay.ts).
    'night-jay': {
        'subject': 'a blue jay taking off, wings spread',
        'crop': (14, 14, 1484, 1196),
        'trim': True,
        'brands': [],
        'focus': (240, 500),  # the head
        'drop': [(14, 1040, 360, 1196), (215, 895, 325, 1008)],  # the post it's leaving
        'fine': [],
        'texture': [],
        'edge_below': None,
    },
    # Midnight: a hummingbird at ocotillo flowers (traced/hummingbird.ts), mirrored: it faces left,
    # the flowers reaching in from the left.
    'night-hummingbird': {
        'subject': 'a hummingbird at ocotillo flowers',
        'crop': (14, 14, 1316, 1340),
        'flip': True,
        'trim': True,
        'brands': [],
        'focus': (720, 460),  # the head
        'drop': [],
        'fine': [],
        'texture': [],
        'edge_below': None,
    },
}

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FLAGS = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
if len(ARGS) < 3 or ARGS[0] not in PRESETS:
    sys.exit('usage: python scripts/trace-line-art.py <' + '|'.join(PRESETS) + '> <drawing> <out.ts> [preview.png] [--colours=<photo>]')
NAME, SRC, OUT = ARGS[:3]
PREVIEW = ARGS[3] if len(ARGS) > 3 else None
PRESET = PRESETS[NAME]
PHOTO = FLAGS.get('colours')
if 'colours' in PRESET and not PHOTO:
    sys.exit(f'{NAME} takes its colours from a photo: add --colours=<photo>')
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


FLIP = PRESET.get('flip', False)


def local(x, y):
    """A point in the cropped drawing, mirrored left to right for a preset with flip."""
    return (x1 - x if FLIP else x - x0, y - y0)


# Trimmed: everything moves left by the empty margin (less a little room for the line's width).
TRIM = max(0, math.floor(min(local(x, y)[0] for s in strokes for x, y in s)) - 4) if PRESET.get('trim') else 0


def poly(points):
    pts = [(round(local(x, y)[0] - TRIM), round(local(x, y)[1])) for x, y in points]
    out = [pts[0]]
    for q in pts[1:]:
        if q != out[-1]:
            out.append(q)
    return 'M' + 'L'.join(f'{x} {y}' for x, y in out)




def colour_class(h, s, v):
    """A photo pixel's colour: by hue (OpenCV's 0-179) if it has enough of one, else light, dark or grey."""
    if s >= COL['min_s'] and v >= 60:
        if h <= 9 or h >= 165:
            return 'red'
        if h <= 18:
            return 'orange'
        if h <= 34:
            return 'yellow'
        if h <= 88:
            return 'green'
        if h <= 135:
            return 'blue'
        return 'violet'
    if s <= COL['light'][0] and v >= COL['light'][1]:
        return 'light'
    if v < 70:
        return 'dark'
    return 'grey'


def colour_of(points):
    """The stroke's ink, by the colours it runs over in the photo; the first ink if none count."""
    votes = {}
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        steps = max(1, int(math.hypot(bx - ax, by - ay) / 2))
        for k in range(steps):
            x = ax + (bx - ax) * k / steps
            y = ay + (by - ay) * k / steps
            px = int((x - PX0) / (PX1 - PX0) * PW)
            py = int((y - PY0) / (PY1 - PY0) * PH)
            for qy in range(py - 1, py + 2):
                for qx in range(px - 1, px + 2):
                    if not (0 <= qx < PW and 0 <= qy < PH):
                        continue
                    to = COL['map'].get(colour_class(*(int(c) for c in HSV[qy, qx])))
                    if to is None:
                        continue
                    ink, weight = to if isinstance(to, tuple) else (to, 1)
                    votes[ink] = votes.get(ink, 0) + weight
    best = max(COL['inks'], key=lambda ink: votes.get(ink, 0))
    return COL['inks'].index(best)


COLOURS = None
if PHOTO:
    photo = cv2.imread(PHOTO)
    if photo is None:
        sys.exit(f"can't read {PHOTO}")
    HSV = cv2.cvtColor(photo, cv2.COLOR_BGR2HSV)
    PH, PW = HSV.shape[:2]
    COL = PRESET['colours']
    PX0, PY0, PX1, PY1 = COL['frame']
    COLOURS = [colour_of(s) for s in strokes]

paths = [[poly(s), round(length(s)), 1 if (inside(middle(s), FINE) or length(s) < 24) else 0] for s in strokes]
if COLOURS:
    paths = [p + [c] for p, c in zip(paths, COLOURS)]
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(f"// Generated by scripts/trace-line-art.py ({NAME}): centre lines of {PRESET['subject']}.\n")
    f.write('// Lettering and logos were left out. Do not edit by hand.\n')
    f.write(f'export const width = {x1 - x0 - TRIM};\n')
    f.write(f'export const height = {y1 - y0};\n')
    if COLOURS:
        f.write('/** The colours its lines are drawn in, by the photo it was made from. */\n')
        f.write('export const inks = ' + json.dumps(COL['inks']) + ';\n')
        f.write('/** Strokes in painting order (outward from the focus): SVG path data, length in px, 1 for a fine line, its ink. */\n')
        f.write('export const strokes: [string, number, 0 | 1, number][] = ')
    else:
        f.write('/** Strokes in painting order (outward from the focus): SVG path data, length in px, 1 for a fine line. */\n')
        f.write('export const strokes: [string, number, 0 | 1][] = ')
    json.dump(paths, f, separators=(',', ':'))
    f.write(';\n')

size = sum(len(p[0]) for p in paths)
print(f'{NAME}: removed {removed} lettering shapes; {len(pixels)} skeleton px; {len(strokes)} strokes; {total_px:.0f} px of line; {size / 1024:.0f} KB of path data')

# How each ink looks in a preview (BGR), near the app's own.
PREVIEW_INKS = {'red': (62, 75, 255), 'white': (248, 241, 238)}

if PREVIEW:
    # Coloured strokes on the night sky; plain ones by painting order (early blue, late orange).
    canvas = np.full((y1 - y0, x1 - x0 - TRIM, 3), (40, 22, 13) if COLOURS else (255, 255, 255), np.uint8)
    for k, s in enumerate(strokes):
        t = k / max(1, len(strokes) - 1)
        colour = PREVIEW_INKS[COL['inks'][COLOURS[k]]] if COLOURS else (int(160 * t + 60), int(70 + 60 * t), int(40 + 100 * (1 - t)))
        pts = np.array([(local(x, y)[0] - TRIM, local(x, y)[1]) for x, y in s], np.int32)
        cv2.polylines(canvas, [pts], False, colour, 1, cv2.LINE_AA)
    cv2.imwrite(PREVIEW, canvas)
