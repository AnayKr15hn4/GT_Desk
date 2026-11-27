import clsx from 'clsx';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useResolvedTheme } from '@/app/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { Sport } from '@/lib/types';

import { divider, flourish, heroPeony, heroRose, type Stroke } from './motifs';
import { usePaintedLines } from './usePaintedLines';

/**
 * Delft blue line work for the Porcelain theme: thin cobalt vines that grow, hold, fade the way
 * they grew, and grow again in another shape. Midnight's hero has its own pieces, the same way (a
 * blue jay and a hummingbird in pale blue, and Charles Leclerc in red and white). Held still for
 * reduced motion.
 */

/** What Anime.js's drawables measure a path in. Set ahead, it has nothing to write when it starts. */
const PATH_LENGTH = 1000;

// Memoised: hundreds of paths, so a re-render of the page around it never walks them again.
const Strokes = memo(function Strokes({ strokes, layer, live }: { strokes: Stroke[]; layer: string; live: boolean }) {
  return (
    <g data-layer={layer}>
      {strokes.map((s, i) =>
        live ? (
          // Hidden to begin with: the one dash sits past the end of the line.
          <path
            key={i}
            d={s.d}
            className={clsx(`delft-${s.tone}`, s.ink && `delft-ink-${s.ink}`)}
            data-delay={s.delay}
            data-duration={s.duration}
            pathLength={PATH_LENGTH}
            strokeDasharray={`0 ${PATH_LENGTH + 10}`}
            strokeDashoffset={-(PATH_LENGTH + 5)}
          />
        ) : (
          <path key={i} d={s.d} className={clsx(`delft-${s.tone}`, s.ink && `delft-ink-${s.ink}`)} />
        ),
      )}
    </g>
  );
});

interface LineWorkProps {
  faces: [Stroke[], Stroke[]];
  viewBox: string;
  holdMs: number;
  waitMs?: number;
  /** Line widths in the drawing's own units, for about 1 px on screen at its usual size. */
  weight: [line: number, fine: number];
  /** Paint once, hold, lift, then call this (instead of going round for ever). */
  onDone?: () => void;
  /** False holds the first stroke (set up and waiting) until it turns true. */
  armed?: boolean;
  /** Midnight's line work (shown only in Midnight, in its colours) instead of Porcelain's. */
  night?: boolean;
  className?: string;
}

function LineWork({ faces, viewBox, holdMs, waitMs, weight, onDone, armed, night = false, className }: LineWorkProps) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const shown = theme === (night ? 'midnight' : 'porcelain');
  const live = shown && !reduced;
  usePaintedLines(ref, live, { holdMs, waitMs, loop: !onDone, onDone, armed });
  if (!shown) return null;
  return (
    <svg
      key={String(live)}
      ref={ref}
      viewBox={viewBox}
      className={clsx('delft', night && 'delft-night', className)}
      style={{ '--delft-line': weight[0], '--delft-fine': weight[1] } as CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      <Strokes layer="face-0" strokes={faces[0]} live={live} />
      {live ? <Strokes layer="face-1" strokes={faces[1]} live /> : null}
    </svg>
  );
}

/** A vine sweeping in from the right, beside a page title. */
export function DelftFlourish({ className }: { className?: string }) {
  const faces = useMemo(() => flourish(), []);
  return <LineWork faces={faces} viewBox="0 0 600 200" holdMs={14_000} weight={[1.3, 0.9]} className={className} />;
}

/** A flower with a vine growing out to each side, between two sections. */
export function DelftDivider({ className }: { className?: string }) {
  const faces = useMemo(() => divider(), []);
  return <LineWork faces={faces} viewBox="0 0 760 60" holdMs={12_000} weight={[1.1, 0.75]} className={className} />;
}

/** How long the whole traced scene takes to paint, start to finish. */
const SCENE_PAINT_MS = 10_000;

/** A traced stroke: path data, length, 1 for a fine line, and in a coloured scene its ink (as the scene numbers them). */
type Traced = [string, number, 0 | 1, number?];

/** Traced strokes, in order, as brush strokes: an even flow of ink, long lines taking longer. */
function paintedInOrder(traced: Traced[], inks?: readonly string[]): Stroke[] {
  const total = traced.reduce((sum, [, length]) => sum + length, 0) || 1;
  let done = 0;
  return traced.map(([d, length, fine, ink]) => {
    const delay = Math.round((done / total) * SCENE_PAINT_MS);
    done += length;
    return { d, tone: fine ? 'fine' : 'line', ink: ink === undefined ? undefined : inks?.[ink], delay, duration: Math.round(Math.min(1400, Math.max(260, length * 5))) };
  });
}

interface Scene {
  width: number;
  height: number;
  strokes: Stroke[];
}

interface TracedModule {
  width: number;
  height: number;
  strokes: Traced[];
  /** A scene traced in its subject's own colours: the inks its strokes are numbered by. */
  inks?: readonly string[];
}

/**
 * A traced piece, each its own small file, loaded only when it's shown. `weight` is the line width
 * in the drawing's units for about 1 px on screen; `place` sets its height and where its right
 * side fades out; `pad` adds room on its left (drawing units), moving it right: out from behind
 * the headline.
 */
interface SceneEntry {
  load: () => Promise<TracedModule>;
  weight: [number, number];
  place: string;
  pad?: number;
}

/** Porcelain's scene for each sport. */
const SCENES: Partial<Record<Sport, SceneEntry>> = {
  // The winner standing on the car, fists up.
  f1: {
    load: () => import('./traced/celebration'),
    weight: [1.7, 1.15],
    place: 'top-[4%] h-[92%] [--fade-from:54%] [--fade-to:90%]',
  },
};

/** Midnight's: Charles Leclerc pulling on his gloves, each line red or white as his suit and helmet are. */
const NIGHT_SCENES: Partial<Record<Sport, SceneEntry>> = {
  // A little in from the left edge, his lines a little stronger than Porcelain's.
  f1: {
    load: () => import('./traced/leclerc'),
    weight: [1.7, 1.15],
    place: 'top-[5%] h-[92%] [--fade-from:76%] [--fade-to:100%] [--art-line:0.62] [--art-fine:0.42]',
    pad: 310,
  },
};

/** Midnight's own two pieces, in its pale blue: a blue jay taking off, and a hummingbird at ocotillo flowers. */
const NIGHT_PIECES: [SceneEntry, SceneEntry] = [
  // Its head a little in from the left edge, its wings spread across to the map, its tail fading over it.
  {
    load: () => import('./traced/jay'),
    weight: [1.7, 1.15],
    place: 'top-[7%] h-[76%] [--fade-from:70%] [--fade-to:100%] [--art-line:0.6] [--art-fine:0.38]',
    pad: 260,
  },
  // Mirrored: the flowers reach in from the left edge, the bird hovering over them.
  {
    load: () => import('./traced/hummingbird'),
    weight: [1.7, 1.15],
    place: 'top-[4%] h-[88%] [--fade-from:86%] [--fade-to:100%] [--art-line:0.6] [--art-fine:0.38]',
  },
];

/** A traced piece, loaded only when there is one. */
function useTracedScene(entry: SceneEntry | undefined): Scene | null {
  const [scene, setScene] = useState<{ entry: SceneEntry; scene: Scene } | null>(null);
  useEffect(() => {
    if (!entry) return;
    let alive = true;
    entry
      .load()
      .then((m) => {
        if (alive) setScene({ entry, scene: { width: m.width, height: m.height, strokes: paintedInOrder(m.strokes, m.inks) } });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [entry]);
  return scene && scene.entry === entry ? scene.scene : null;
}

type Piece = 'scene' | 'first' | 'second';
/** A weekend with a scene takes turns: a piece, the sport's scene, the other piece, the scene again. */
const THEMED: Piece[] = ['first', 'scene', 'second', 'scene'];
const PIECES: Piece[] = ['first', 'second'];
const HOLD_MS = 18_000;

/**
 * The hero's line work, painted at the left: one piece at a time, each painted, held and lifted
 * before the next. Porcelain's is Delft blue: the rose and the peony, taking turns with the
 * sport's traced scene (the winner on the car for Formula 1; lettering and logos left out).
 * Midnight's is pale blue: a blue jay taking off and a hummingbird at ocotillo flowers, taking
 * turns on a Formula 1 weekend with Charles Leclerc in the red and white of his suit and helmet.
 * Each piece sits against the left edge (or a little in from it) and fades out across its own
 * right side, so its edge never shows. The first piece is set up at once but starts only when
 * `ready` (the camera has landed), `waitMs` after that.
 */
export function DelftHeroArt({ sport, ready = true, waitMs = 0 }: { sport: Sport; ready?: boolean; waitMs?: number }) {
  const theme = useResolvedTheme();
  const night = theme === 'midnight';
  const entry = (night ? NIGHT_SCENES : SCENES)[sport];
  const scene = useTracedScene(entry);
  const jay = useTracedScene(night ? NIGHT_PIECES[0] : undefined);
  const hummingbird = useTracedScene(night ? NIGHT_PIECES[1] : undefined);
  const flowers = useMemo(() => (night ? null : [heroRose(), heroPeony()]), [night]);
  const [turn, setTurn] = useState(0);
  const next = useCallback(() => setTurn((n) => n + 1), []);
  const playlist = entry ? THEMED : PIECES;
  let piece = playlist[turn % playlist.length];
  if (piece === 'scene' && !scene) {
    // Not loaded yet: a piece takes its turn instead.
    piece = turn % 4 === 1 ? 'second' : 'first';
  }
  const wait = turn === 0 ? waitMs : 0;
  const armed = turn === 0 ? ready : true;
  const traced = (shown: Scene, from: SceneEntry) => (
    <LineWork
      key={turn}
      faces={[shown.strokes, []]}
      viewBox={`${-(from.pad ?? 0)} 0 ${shown.width + (from.pad ?? 0)} ${shown.height}`}
      holdMs={HOLD_MS}
      waitMs={wait}
      weight={from.weight}
      onDone={next}
      armed={armed}
      night={night}
      className={clsx('delft-art-fade absolute left-0 w-auto', from.place)}
    />
  );
  if (piece === 'scene' && scene && entry) return traced(scene, entry);
  if (night) {
    // Midnight's pieces are traced too; one still loading starts when it arrives.
    const own = piece === 'first' ? jay : hummingbird;
    return own ? traced(own, NIGHT_PIECES[piece === 'first' ? 0 : 1]) : null;
  }
  const flower = flowers?.[piece === 'first' ? 0 : 1];
  if (!flower) return null;
  return (
    <LineWork
      key={turn}
      faces={[flower, []]}
      viewBox="0 0 1400 1000"
      holdMs={HOLD_MS}
      waitMs={wait}
      weight={[1.3, 0.9]}
      onDone={next}
      armed={armed}
      className="delft-art-fade absolute top-0 left-[-7%] h-full w-auto [--fade-from:60%] [--fade-to:97%]"
    />
  );
}
