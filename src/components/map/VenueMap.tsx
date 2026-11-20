import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre builds its worker's address at runtime, so the bundler can't see it. Shipping the
// (self-contained) worker as an asset and pointing MapLibre at it works in dev and production.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

import clsx from 'clsx';
import type { GeoJSONSource, Map as MapLibreMap, PaddingOptions } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Footprint } from '@/data/external';
import { prefersReducedMotion } from '@/hooks/use-reduced-motion';
import { bboxRing, bounds as boundsOf, circleRing, distanceKm, grow, type LngLat } from '@/lib/geo';
import { ARENA_HEIGHT_M, withArenaHeight, type BuildingPart } from '@/lib/venue-parts';

import { buildStyle, type MapTheme, type StyleInput } from './style';
import { useVenueBuilding } from './useVenueBuilding';

export interface VenueFocus {
  /** What the camera looks at (the venue). */
  center: LngLat;
  /** For a circuit: fit the whole lap instead of using `zoom`. */
  fit?: LngLat[];
  zoom?: number;
}

/** An arena to light in gold: where it is, and what OpenStreetMap knows of its outline. */
export interface ArenaHint {
  center: LngLat;
  /** Its building, or the grounds around it. */
  footprint?: Footprint;
  /** The box around it, [west, south, east, north]. */
  extent?: [number, number, number, number];
}

interface VenueMapProps {
  focus: VenueFocus | null;
  theme: MapTheme;
  track?: LngLat[];
  /** Light this arena's own building in gold (found among the map's buildings). */
  arena?: ArenaHint;
  seasonPoints?: StyleInput['seasonPoints'];
  /** Fly in from space the first time a venue is shown. */
  intro?: boolean;
  /** Orbit the venue slowly once the camera arrives. */
  orbit?: boolean;
  /** Turn the globe west to east instead of orbiting (for the season view). */
  spin?: boolean;
  /** Mark the focus point as the venue (a gold pulse from afar). Off when the focus is just a view. */
  markVenue?: boolean;
  /** A gold dot laps the circuit. */
  lap?: boolean;
  /** Drag to rotate and tilt, ctrl/cmd + scroll to zoom. */
  interactive?: boolean;
  /** Screen space kept free for content, so the venue sits beside it rather than under it. */
  padding?: Partial<PaddingOptions>;
  pitch?: number;
  className?: string;
  label: string;
  onArrive?: () => void;
  onFailure?: () => void;
}

const DEG_PER_SEC = 2.4;
/** The orbit and the lap move the camera at most this often; faster screens skip frames, not motion. */
const STEP_MS = 1000 / 60;
const RESUME_AFTER_MS = 4500;
const LAP_MS = 42_000;

/** What to draw in gold: pushed out a little so the gold doesn't flicker against the city's own walls. */
function goldParts(arena: ArenaHint | undefined, found: BuildingPart[] | undefined): StyleInput['venueParts'] {
  if (!arena || found === undefined) return undefined;
  if (found.length) {
    return withArenaHeight(found, arena.footprint?.heightM ?? ARENA_HEIGHT_M).map((part) => ({ ...part, polygon: [grow(part.polygon[0], 0.8), ...part.polygon.slice(1)] }));
  }
  const footprint = arena.footprint;
  if (footprint?.isBuilding) return footprint.rings.map((ring) => ({ polygon: [grow(ring, 0.8)], height: footprint.heightM, base: 0 }));
  return undefined;
}

/** Positions along a line by distance, for the lapping car. */
function makeLapper(line: LngLat[]) {
  const cumulative = [0];
  for (let i = 1; i < line.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceKm(line[i - 1][1], line[i - 1][0], line[i][1], line[i][0]));
  }
  const total = cumulative[cumulative.length - 1] || 1;
  return (t: number): LngLat => {
    const target = (t % 1) * total;
    let i = 1;
    while (i < cumulative.length && cumulative[i] < target) i++;
    const a = line[i - 1];
    const b = line[Math.min(i, line.length - 1)];
    const span = cumulative[i] - cumulative[i - 1] || 1;
    const k = (target - cumulative[i - 1]) / span;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
}

export function VenueMap({
  focus,
  theme,
  track,
  arena,
  seasonPoints,
  intro = false,
  orbit = true,
  spin = false,
  markVenue = true,
  lap = false,
  interactive = false,
  padding,
  pitch = 60,
  className,
  label,
  onArrive,
  onFailure,
}: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const arrivedRef = useRef(false);
  const introDoneRef = useRef(false);
  const lastUserMoveRef = useRef(0);
  const userHoldingRef = useRef(false);
  const orbitRef = useRef(orbit);
  // Off screen (scrolled past), the orbit and the lap wait: the map then has nothing to redraw.
  const onScreenRef = useRef(true);
  const spinRef = useRef(spin);
  const onArriveRef = useRef(onArrive);
  orbitRef.current = orbit;
  spinRef.current = spin;
  onArriveRef.current = onArrive;

  // The arena's own building from the map's tiles, at its real shape and heights; failing that,
  // OpenStreetMap's outline if it's the building; failing that, a ring on the ground around it.
  const hint = useMemo(
    () => (arena ? { center: arena.center, outline: arena.footprint?.rings, outlineIsBuilding: arena.footprint?.isBuilding } : undefined),
    [arena],
  );
  const found = useVenueBuilding(mapRef, ready, hint);
  const venueParts = useMemo(() => goldParts(arena, found), [arena, found]);
  const venueRing = useMemo(
    () => (arena && found !== undefined && !venueParts ? (arena.extent ? bboxRing(arena.extent, 6) : circleRing(arena.center, 90)) : undefined),
    [arena, found, venueParts],
  );

  const venueLon = markVenue ? focus?.center[0] : undefined;
  const venueLat = markVenue ? focus?.center[1] : undefined;
  const styleInput: StyleInput = useMemo(
    () => ({
      theme,
      track,
      venueParts,
      venueRing,
      seasonPoints,
      venue: venueLon != null && venueLat != null ? ([venueLon, venueLat] as LngLat) : undefined,
    }),
    [theme, track, venueParts, venueRing, seasonPoints, venueLon, venueLat],
  );
  const styleInputRef = useRef(styleInput);
  styleInputRef.current = styleInput;

  // Create the map once. MapLibre loads only when a map is first shown.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    void (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;
        if (maplibre.getWorkerUrl() !== workerUrl) maplibre.setWorkerUrl(workerUrl);
        map = new maplibre.Map({
          container: containerRef.current,
          style: buildStyle(styleInputRef.current),
          center: [0, 20],
          zoom: 1.4,
          pitch: 0,
          interactive,
          attributionControl: { compact: true },
          canvasContextAttributes: { antialias: true, powerPreference: 'high-performance' },
          maxPitch: 78,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          cooperativeGestures: interactive,
          dragRotate: interactive,
          pitchWithRotate: interactive,
          fadeDuration: 180,
        });
        mapRef.current = map;
        if (import.meta.env.DEV) (window as unknown as { __gtMap?: MapLibreMap }).__gtMap = map;
        const markUser = (e: { originalEvent?: unknown }) => {
          if (e.originalEvent) lastUserMoveRef.current = performance.now();
        };
        map.on('movestart', markUser);
        map.on('move', markUser);
        map.on('mousedown', () => (userHoldingRef.current = true));
        map.on('mouseup', () => {
          userHoldingRef.current = false;
          lastUserMoveRef.current = performance.now();
        });
        map.on('error', (e) => {
          // Tile hiccups are routine; only a lost WebGL context is fatal.
          if (String(e.error?.message ?? '').includes('WebGL')) {
            setFailed(true);
            onFailure?.();
          }
        });
        map.once('load', () => !cancelled && setReady(true));
      } catch {
        if (!cancelled) {
          setFailed(true);
          onFailure?.();
        }
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // Created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      onScreenRef.current = entry.isIntersecting;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Restyle in place when the theme or the venue's data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(buildStyle(styleInput), { diff: true });
  }, [ready, styleInput]);

  // Fly to the venue whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    const reduced = prefersReducedMotion();
    const pad = { top: padding?.top ?? 0, bottom: padding?.bottom ?? 0, left: padding?.left ?? 0, right: padding?.right ?? 0 } satisfies PaddingOptions;

    let target: { center: LngLat; zoom: number };
    if (focus.fit && focus.fit.length > 1) {
      const [w, s, e, n] = boundsOf(focus.fit);
      const camera = map.cameraForBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: { top: pad.top + 28, bottom: pad.bottom + 28, left: pad.left + 28, right: pad.right + 28 } },
      );
      // Only the zoom comes from the fit: its center already allows for the padding, and the camera
      // applies the padding again. The fit is computed flat; tilted, the lap needs a little more room.
      target = { center: focus.center, zoom: Math.min(16, (camera?.zoom ?? 14) - 0.3) };
    } else {
      target = { center: focus.center, zoom: focus.zoom ?? 16 };
    }

    arrivedRef.current = false;
    const arrive = () => {
      arrivedRef.current = true;
      lastUserMoveRef.current = 0;
      onArriveRef.current?.();
    };
    const bearing = -24;
    if (reduced) {
      map.jumpTo({ ...target, pitch, bearing, padding: pad });
      arrive();
      return;
    }
    if (intro && !introDoneRef.current) {
      introDoneRef.current = true;
      // Start out in space, a little west of the venue, and come down to it.
      map.jumpTo({ center: [target.center[0] - 58, Math.max(-25, Math.min(35, target.center[1] * 0.5))], zoom: 1.5, pitch: 0, bearing: 0, padding: pad });
      map.flyTo({ ...target, pitch, bearing, padding: pad, duration: 7200, curve: 1.5, speed: 0.6, essential: false });
    } else {
      map.flyTo({ ...target, pitch, bearing, padding: pad, duration: 2600, curve: 1.3, essential: false });
    }
    map.once('moveend', arrive);
    // padding is an object; compare by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focus?.center[0], focus?.center[1], focus?.fit, focus?.zoom, JSON.stringify(padding), pitch, intro]);

  // Orbit and lap on one frame loop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || prefersReducedMotion()) return;
    const lapper = lap && track && track.length > 2 ? makeLapper(track) : null;
    let frame = 0;
    let last = performance.now();
    let lastCar = 0;
    const started = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      // On a 120 Hz screen, every other frame: the map then redraws at 60 fps, half the work.
      if (now - last < STEP_MS - 1) return;
      if (!onScreenRef.current) {
        last = now;
        return;
      }
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      const idle = !userHoldingRef.current && now - lastUserMoveRef.current > RESUME_AFTER_MS;
      if (arrivedRef.current && idle && !map.isMoving()) {
        if (spinRef.current) {
          const c = map.getCenter();
          map.setCenter([c.lng + 3.2 * dt, c.lat]);
        } else if (orbitRef.current) {
          map.setBearing(map.getBearing() + DEG_PER_SEC * dt);
        }
      }
      // The car waits for the camera to land: during the flight it would only add work.
      if (lapper && arrivedRef.current && now - lastCar > 33) {
        lastCar = now;
        const source = map.getSource('car') as GeoJSONSource | undefined;
        source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lapper((now - started) / LAP_MS) } });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [ready, lap, track]);

  return (
    // Callers position it (usually `absolute inset-0`); it only clips.
    <div className={clsx('overflow-hidden', className ?? 'relative')}>
      {/* Inline position: MapLibre's own CSS sets .maplibregl-map { position: relative }, which would beat a class. */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} role="img" aria-label={label} />
      {failed ? (
        <div className="dial absolute inset-0 grid place-items-center rounded-none">
          <p className="text-ink-3 text-sm">The 3D map needs WebGL, which this browser has turned off.</p>
        </div>
      ) : null}
    </div>
  );
}
