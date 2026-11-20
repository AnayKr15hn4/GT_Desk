import { createTimeline, svg } from 'animejs';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** The pause between one shape fading and the next one growing. */
const BREATH_MS = 1400;

export interface PaintOptions {
  /** How long a finished drawing stays before it lifts. */
  holdMs: number;
  /** Before the first stroke, ms. */
  waitMs?: number;
  /** Paint, hold and lift for as long as it's shown; otherwise once, then `onDone`. */
  loop?: boolean;
  onDone?: () => void;
  /**
   * False holds the first stroke: everything is set up and waiting, so when it turns true the
   * drawing starts without any work at that moment (it's timed to the camera landing).
   */
  armed?: boolean;
}

/**
 * Paints an SVG's strokes the way a hand would, holds them, then lifts them in the direction they
 * were painted, and paints the next shape: each `[data-layer="face-N"]` in turn. A path's
 * `data-delay` (ms) sets when its stroke starts and `data-duration` how long it takes (by its
 * length when missing). Off screen, or in a hidden tab, it simply waits.
 */
export function usePaintedLines(ref: RefObject<SVGSVGElement | null>, live: boolean, { holdMs, waitMs = 0, loop = true, onDone, armed = true }: PaintOptions) {
  // The latest callback and arming, without restarting the drawing when they change.
  const done = useRef(onDone);
  const isArmed = useRef(armed);
  const arm = useRef<(() => void) | null>(null);
  useEffect(() => {
    done.current = onDone;
  });

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !live) return;
    const faces = [0, 1].map((n) => [...root.querySelectorAll<SVGPathElement>(`[data-layer="face-${n}"] path`)]).filter((paths) => paths.length > 0);
    if (faces.length === 0) return;

    // Set up before the first paint, so a finished drawing never flashes on screen.
    // At most 60 updates a second: a slow drawing looks the same, and on a 120 Hz screen it's half the work.
    const cycle = createTimeline({ loop, autoplay: false, frameRate: 60, onComplete: loop ? undefined : () => done.current?.() });
    faces.forEach((paths, k) => {
      const delay = paths.map((p) => Number(p.dataset.delay ?? 0));
      const duration = paths.map((p) => (p.dataset.duration ? Number(p.dataset.duration) : Math.min(2200, Math.max(420, p.getTotalLength() * 7))));
      const strokes = svg.createDrawable(paths, 0, 0);
      cycle
        .add(strokes, { draw: ['0 0', '0 1'], ease: 'inOutSine', delay: (_: unknown, i?: number) => delay[i ?? 0], duration: (_: unknown, i?: number) => duration[i ?? 0] }, k === 0 ? 0 : `+=${BREATH_MS}`)
        // Lifted the way it went on, root to tip, a little quicker.
        .add(strokes, { draw: ['0 1', '1 1'], ease: 'inSine', delay: (_: unknown, i?: number) => delay[i ?? 0] * 0.6, duration: (_: unknown, i?: number) => duration[i ?? 0] * 0.75 }, `+=${holdMs}`);
    });
    cycle.add({ duration: BREATH_MS });

    let played = false;
    let visible = false;
    let wake = 0;
    const go = () => {
      window.clearTimeout(wake);
      if (!visible || !isArmed.current) return;
      if (played) cycle.resume();
      else
        wake = window.setTimeout(() => {
          played = true;
          cycle.play();
        }, waitMs);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) go();
        else {
          window.clearTimeout(wake);
          if (played) cycle.pause();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(root);
    arm.current = go;
    return () => {
      arm.current = null;
      observer.disconnect();
      window.clearTimeout(wake);
      cycle.pause();
    };
  }, [ref, live, holdMs, waitMs, loop]);

  useEffect(() => {
    isArmed.current = armed;
    if (armed) arm.current?.();
  }, [armed]);
}
