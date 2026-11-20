import clsx from 'clsx';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useResolvedTheme } from '@/app/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { Sport } from '@/lib/types';

import { divider, flourish, heroPeony, heroRose, type Stroke } from './motifs';
import { usePaintedLines } from './usePaintedLines';

/**
 * Delft blue line work for the Porcelain theme: thin cobalt vines that grow, hold, fade the way
 * they grew, and grow again in another shape. Nothing in Midnight; held still for reduced motion.
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
            className={`delft-${s.tone}`}
            data-delay={s.delay}
            data-duration={s.duration}
            pathLength={PATH_LENGTH}
            strokeDasharray={`0 ${PATH_LENGTH + 10}`}
            strokeDashoffset={-(PATH_LENGTH + 5)}
          />
        ) : (
          <path key={i} d={s.d} className={`delft-${s.tone}`} />
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
  className?: string;
}

function LineWork({ faces, viewBox, holdMs, waitMs, weight, onDone, armed, className }: LineWorkProps) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const shown = theme === 'porcelain';
  const live = shown && !reduced;
  usePaintedLines(ref, live, { holdMs, waitMs, loop: !onDone, onDone, armed });
  if (!shown) return null;
  return (
    <svg
      key={String(live)}
      ref={ref}
      viewBox={viewBox}
      className={clsx('delft', className)}
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

/** Traced strokes, in order, as brush strokes: an even flow of ink, long lines taking longer. */
function paintedInOrder(traced: [string, number, 0 | 1][]): Stroke[] {
  const total = traced.reduce((sum, [, length]) => sum + length, 0) || 1;
  let done = 0;
  return traced.map(([d, length, fine]) => {
    const delay = Math.round((done / total) * SCENE_PAINT_MS);
    done += length;
    return { d, tone: fine ? 'fine' : 'line', delay, duration: Math.round(Math.min(1400, Math.max(260, length * 5))) };
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
  strokes: [string, number, 0 | 1][];
}

/**
 * One traced scene per sport, each its own small file, loaded only on that sport's weekend.
 * `weight` is the line width in the drawing's units for about 1 px on screen; `place` sets its
 * height and where its right side fades out; `pad` adds room on its left (drawing units), to move
 * a figure whose left side ends in a closed outline out from behind the headline.
 */
const SCENES: Partial<Record<Sport, { load: () => Promise<TracedModule>; weight: [number, number]; place: string; pad?: number }>> = {
  // The winner standing on the car, fists up.
  f1: {
    load: () => import('./traced/celebration'),
    weight: [1.7, 1.15],
    place: 'top-[4%] h-[92%] [--fade-from:54%] [--fade-to:90%]',
  },
};

/** The sport's traced scene, loaded only when it has one. */
function useTracedScene(sport: Sport): Scene | null {
  const [scene, setScene] = useState<{ sport: Sport; scene: Scene } | null>(null);
  useEffect(() => {
    const entry = SCENES[sport];
    if (!entry) return;
    let alive = true;
    entry
      .load()
      .then((m) => {
        if (alive) setScene({ sport, scene: { width: m.width, height: m.height, strokes: paintedInOrder(m.strokes) } });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sport]);
  return scene && scene.sport === sport ? scene.scene : null;
}

type Piece = 'scene' | 'rose' | 'peony';
/** A weekend with a scene takes turns: the sport, a flower, the sport, the other flower. */
const THEMED: Piece[] = ['rose', 'scene', 'peony', 'scene'];
const FLOWERS: Piece[] = ['rose', 'peony'];
const HOLD_MS = 18_000;

/**
 * The hero's Delft line work, painted on the light at the left: one piece at a time, each painted,
 * held and lifted before the next. A sport with a traced scene (the winner on the car for
 * Formula 1, the champion with his belts for the UFC; lettering and logos left out) takes turns
 * with the rose and the peony. Each piece sits against the left edge and fades out across its own
 * right side, so its edge never shows. The first piece is set up at once but starts only when
 * `ready` (the camera has landed), `waitMs` after that.
 */
export function DelftHeroArt({ sport, ready = true, waitMs = 0 }: { sport: Sport; ready?: boolean; waitMs?: number }) {
  const theme = useResolvedTheme();
  const scene = useTracedScene(sport);
  const rose = useMemo(() => heroRose(), []);
  const peony = useMemo(() => heroPeony(), []);
  const [turn, setTurn] = useState(0);
  const next = useCallback(() => setTurn((n) => n + 1), []);
  if (theme !== 'porcelain') return null;
  const entry = SCENES[sport];
  const playlist = entry ? THEMED : FLOWERS;
  let piece = playlist[turn % playlist.length];
  if (piece === 'scene' && !scene) {
    // Not loaded yet: the first turn waits for it; a later one shows a flower instead.
    if (turn === 0) return null;
    piece = turn % 4 === 1 ? 'peony' : 'rose';
  }
  const wait = turn === 0 ? waitMs : 0;
  const armed = turn === 0 ? ready : true;
  if (piece === 'scene' && scene && entry) {
    return (
      <LineWork
        key={turn}
        faces={[scene.strokes, []]}
        viewBox={`${-(entry.pad ?? 0)} 0 ${scene.width + (entry.pad ?? 0)} ${scene.height}`}
        holdMs={HOLD_MS}
        waitMs={wait}
        weight={entry.weight}
        onDone={next}
        armed={armed}
        className={clsx('delft-art-fade absolute left-0 w-auto', entry.place)}
      />
    );
  }
  return (
    <LineWork
      key={turn}
      faces={[piece === 'rose' ? rose : peony, []]}
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
