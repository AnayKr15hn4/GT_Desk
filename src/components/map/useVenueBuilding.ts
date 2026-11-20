import type { GeoJSONFeature, Map as MapLibreMap, PointLike } from 'maplibre-gl';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { circleRing, type LngLat } from '@/lib/geo';
import { pickVenueParts, type BuildingPart, type VenueHint } from '@/lib/venue-parts';

/** Building pieces from the map's tiles, (multi)polygons flattened. */
function partsOf(features: GeoJSONFeature[]): BuildingPart[] {
  const parts: BuildingPart[] = [];
  for (const feature of features) {
    const height = Number(feature.properties?.render_height ?? 0);
    const base = Number(feature.properties?.render_min_height ?? 0);
    const g = feature.geometry;
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const polygon of polygons) parts.push({ polygon: polygon as LngLat[][], height, base });
  }
  return parts;
}

/** The part of the screen around the venue: its outline, or 140 m around its point. Null when it's off screen. */
function screenBox(map: MapLibreMap, hint: VenueHint): [PointLike, PointLike] | null {
  const points = hint.outline?.flat() ?? circleRing(hint.center, 140, 16);
  const canvas = map.getCanvas();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const point of points) {
    const { x, y } = map.project(point);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  // Room for walls rising above the outline in a tilted view.
  x0 = Math.max(0, x0 - 40);
  y0 = Math.max(0, y0 - 120);
  x1 = Math.min(canvas.clientWidth, x1 + 40);
  y1 = Math.min(canvas.clientHeight, y1 + 40);
  return x1 > x0 && y1 > y0 ? [[x0, y0], [x1, y1]] : null;
}

const keyOf = (hint: VenueHint | undefined) =>
  hint ? `${hint.center.join(',')}|${hint.outline ? `${hint.outline.length}:${hint.outline[0]?.[0]?.join(',')}` : '-'}` : '';

const LOOK_EVERY_MS = 350;
const GIVE_UP_MS = 15_000;

/**
 * Finds the venue's own building among the ones the map draws, once the tiles around it are in:
 * the pieces to light in gold, at their real heights. Undefined while it looks; empty when the
 * map has no building there (or never got close enough), so the caller can fall back.
 */
export function useVenueBuilding(mapRef: RefObject<MapLibreMap | null>, ready: boolean, hint: VenueHint | undefined): BuildingPart[] | undefined {
  const key = keyOf(hint);
  const [found, setFound] = useState<{ key: string; parts: BuildingPart[] } | null>(null);
  // The same venue again (a new object for the same place) keeps what was found.
  const doneKey = useRef('');

  useEffect(() => {
    const map = mapRef.current;
    const venue = hint;
    if (!map || !ready || !venue || doneKey.current === key) return;
    const started = performance.now();
    const look = () => {
      let parts: BuildingPart[] | null = null;
      if (performance.now() - started > GIVE_UP_MS) parts = [];
      else if (map.getZoom() >= 15 && map.getLayer('buildings') && map.getSource('openmaptiles') && map.isSourceLoaded('openmaptiles')) {
        const box = screenBox(map, venue);
        if (box) parts = pickVenueParts(partsOf(map.queryRenderedFeatures(box, { layers: ['buildings'] })), venue);
      }
      if (parts) {
        window.clearInterval(timer);
        doneKey.current = key;
        setFound({ key, parts });
      }
    };
    // A light check a few times a second, until the camera is close and the tiles are in.
    const timer = window.setInterval(look, LOOK_EVERY_MS);
    look();
    return () => window.clearInterval(timer);
  }, [mapRef, ready, key, hint]);

  return found && found.key === key ? found.parts : undefined;
}
