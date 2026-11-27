import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';

import type { LngLat } from '@/lib/geo';

/**
 * The venue map's look: one neutral (the city, in the theme's steel or porcelain) and one vibrant
 * (champagne gold, only for the venue: its track or its building). Built from OpenFreeMap's
 * OpenMapTiles vector tiles, which need no key. Labels are kept to a minimum so the place reads
 * like a model, not a road atlas.
 */

export type MapTheme = 'midnight' | 'porcelain';

interface Palette {
  land: string;
  landcover: string;
  park: string;
  water: string;
  waterLine: string;
  roadMajor: string;
  roadMinor: string;
  roadPath: string;
  rail: string;
  buildingLow: string;
  buildingMid: string;
  buildingHigh: string;
  buildingOpacity: number;
  label: string;
  labelHalo: string;
  gold: string;
  goldCore: string;
  goldHalo: string;
  sky: string;
  horizon: string;
  light: { color: string; intensity: number };
  seasonDot: string;
  /** The car lapping the circuit: the one point brighter than the track. */
  car: string;
}

const palettes: Record<MapTheme, Palette> = {
  midnight: {
    land: '#0d1628',
    landcover: '#0f1a2e',
    park: '#0f1b2e',
    water: '#060b16',
    waterLine: '#0a1322',
    roadMajor: '#2a3a5a',
    roadMinor: '#1c2840',
    roadPath: '#172136',
    rail: '#1f2b44',
    buildingLow: '#1b2842',
    buildingMid: '#24345a',
    buildingHigh: '#33497a',
    buildingOpacity: 0.94,
    label: '#8590a5',
    labelHalo: '#0b1220',
    gold: '#d4b67a',
    goldCore: '#f3dfb2',
    goldHalo: 'rgba(212, 182, 122, 0.32)',
    sky: '#0b1220',
    horizon: '#223659',
    light: { color: '#d8e1f2', intensity: 0.42 },
    seasonDot: '#d4b67a',
    car: '#ffffff',
  },
  porcelain: {
    // A white clay model on a slightly deeper ground, so the blocks read in 3D.
    land: '#dde2e9',
    landcover: '#d8dee6',
    park: '#d9e0e0',
    water: '#c3cede',
    waterLine: '#bac6d6',
    roadMajor: '#f7f8fa',
    roadMinor: '#eef1f4',
    roadPath: '#e7ebf0',
    rail: '#c9d0da',
    buildingLow: '#ffffff',
    buildingMid: '#fbfcfd',
    buildingHigh: '#f1f4f8',
    buildingOpacity: 1,
    label: '#5d6679',
    labelHalo: '#f3f4f6',
    // Brighter than the UI's text gold: on the map it's a material, not type, so it can be vivid.
    gold: '#b8913f',
    goldCore: '#d4b67a',
    goldHalo: 'rgba(184, 145, 63, 0.26)',
    sky: '#f3f4f6',
    horizon: '#ffffff',
    light: { color: '#ffffff', intensity: 0.72 },
    seasonDot: '#7f6127',
    car: '#0f1726',
  },
};

const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export interface StyleInput {
  theme: MapTheme;
  /** The racing line, drawn in gold. */
  track?: LngLat[];
  /** The venue's building (an arena), piece by piece, drawn as its own gold extrusion. */
  venueParts?: { polygon: LngLat[][]; height: number; base: number }[];
  /** Without an outline: a gold ring on the ground around the venue. */
  venueRing?: LngLat[];
  /** Gold points for the season's venues, visible from space. */
  seasonPoints?: { lngLat: LngLat; id: string }[];
  /** The venue itself, as a soft gold pulse at low zoom. */
  venue?: LngLat;
}

const lineWidth = (stops: [number, number][]): ExpressionSpecification =>
  ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flat()] as unknown as ExpressionSpecification;

/**
 * Buildings rise out of the ground as the camera arrives, then hold their real height. A zoom
 * expression must be the outermost one, so a minimum height goes inside the output value.
 */
const risingHeight = (property: 'render_height' | 'render_min_height', min = 0): ExpressionSpecification => {
  const height: ExpressionSpecification = ['coalesce', ['get', property], 0];
  return ['interpolate', ['linear'], ['zoom'], 12.2, 0, 13.3, min ? ['max', height, min] : height];
};

export function buildStyle(input: StyleInput): StyleSpecification {
  const p = palettes[input.theme];
  const sources: StyleSpecification['sources'] = {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: OPENFREEMAP_ATTRIBUTION },
    track: {
      type: 'geojson',
      lineMetrics: true,
      data: input.track
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: input.track } }
        : { type: 'FeatureCollection', features: [] },
    },
    season: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: (input.seasonPoints ?? []).map((s) => ({
          type: 'Feature',
          properties: { id: s.id },
          geometry: { type: 'Point', coordinates: s.lngLat },
        })),
      },
    },
    // Starts empty: VenueMap moves the car along its lap with setData.
    car: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    venue: {
      type: 'geojson',
      data: input.venue
        ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: input.venue } }
        : { type: 'FeatureCollection', features: [] },
    },
    'venue-footprint': {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: (input.venueParts ?? []).map((part) => ({
          type: 'Feature',
          properties: { height: part.height, base: part.base },
          geometry: { type: 'Polygon', coordinates: part.polygon },
        })),
      },
    },
    'venue-ring': {
      type: 'geojson',
      data: input.venueRing
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: input.venueRing } }
        : { type: 'FeatureCollection', features: [] },
    },
    'venue-spot': {
      type: 'geojson',
      data: input.venueRing
        ? {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [
                input.venueRing.reduce((s, c) => s + c[0], 0) / input.venueRing.length,
                input.venueRing.reduce((s, c) => s + c[1], 0) / input.venueRing.length,
              ],
            },
          }
        : { type: 'FeatureCollection', features: [] },
    },
  };
  const lit = input.venueParts?.length ? 1 : 0;

  const layers: LayerSpecification[] = [
    { id: 'land', type: 'background', paint: { 'background-color': p.land } },
    {
      id: 'landcover',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      paint: { 'fill-color': p.landcover, 'fill-opacity': 0.7 },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': p.park, 'fill-opacity': 0.8 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': p.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': p.waterLine, 'line-width': lineWidth([[10, 0.5], [16, 3]]) },
    },
    {
      id: 'road-path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 14,
      filter: ['match', ['get', 'class'], ['path', 'track', 'service'], true, false],
      paint: { 'line-color': p.roadPath, 'line-width': lineWidth([[14, 0.4], [18, 3]]) },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['match', ['get', 'class'], ['minor', 'tertiary'], true, false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.roadMinor, 'line-width': lineWidth([[12, 0.4], [18, 10]]) },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.roadMajor, 'line-width': lineWidth([[6, 0.4], [12, 1.6], [18, 18]]) },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 12,
      // Not the ones underground: Penn Station's tracks would fan out across Midtown.
      filter: ['all', ['match', ['get', 'class'], ['rail', 'transit'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': p.rail, 'line-width': lineWidth([[12, 0.5], [18, 2]]), 'line-dasharray': ['literal', [3, 3]] },
    },
    // Racing lines OpenStreetMap knows about, faintly, in case the dataset misses a circuit.
    {
      id: 'raceway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['==', ['get', 'class'], 'raceway'],
      paint: { 'line-color': p.gold, 'line-opacity': 0.28, 'line-width': lineWidth([[11, 0.6], [17, 6]]) },
    },
    // On the ground around the venue, under the buildings, so the ones in front hide it as they would.
    {
      // Light spilling from the gold building.
      id: 'venue-glow',
      type: 'line',
      source: 'venue-footprint',
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': p.goldHalo,
        'line-width': lineWidth([[13, 6], [17, 34]]),
        'line-blur': lineWidth([[13, 4], [17, 22]]),
        'line-opacity': lit,
        'line-opacity-transition': { duration: 900, delay: 0 },
      },
    },
    {
      // Without the building: a pool of gold light inside the ring, lying flat with the map.
      id: 'venue-spot',
      type: 'circle',
      source: 'venue-spot',
      paint: {
        'circle-color': p.gold,
        'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 13, 14, 16, 80, 18, 320],
        'circle-blur': 0.9,
        'circle-opacity': 0.42,
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: 'venue-ring',
      type: 'line',
      source: 'venue-ring',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': p.gold, 'line-width': lineWidth([[13, 1.2], [17, 4]]), 'line-dasharray': ['literal', [2, 1.5]] },
    },
    {
      id: 'buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 12.2,
      filter: ['!', ['has', 'hide_3d']],
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'render_height'], 0],
          0,
          p.buildingLow,
          40,
          p.buildingMid,
          160,
          p.buildingHigh,
        ],
        'fill-extrusion-height': risingHeight('render_height'),
        'fill-extrusion-base': risingHeight('render_min_height'),
        'fill-extrusion-opacity': p.buildingOpacity,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // The venue's own building, in gold, piece by piece: a touch taller and wider than the city's
    // copy of it, so the roof and walls show gold. It fades in once it's been found.
    {
      id: 'venue-building',
      type: 'fill-extrusion',
      source: 'venue-footprint',
      paint: {
        'fill-extrusion-color': p.gold,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.2, 0, 13.3, ['+', ['get', 'height'], 1.5]],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 12.2, 0, 13.3, ['get', 'base']],
        'fill-extrusion-opacity': lit,
        'fill-extrusion-opacity-transition': { duration: 900, delay: 0 },
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // The track: a wide soft halo, a body, and a bright core, so it reads like light on tarmac.
    {
      id: 'track-halo',
      type: 'line',
      source: 'track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.goldHalo, 'line-width': lineWidth([[10, 6], [14, 20], [17, 60]]), 'line-blur': lineWidth([[10, 4], [14, 12], [17, 30]]) },
    },
    {
      id: 'track-body',
      type: 'line',
      source: 'track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.gold, 'line-width': lineWidth([[10, 1.6], [14, 4.5], [17, 14]]) },
    },
    {
      id: 'track-core',
      type: 'line',
      source: 'track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.goldCore, 'line-width': lineWidth([[10, 0.5], [14, 1.4], [17, 4]]), 'line-opacity': 0.9 },
    },
    {
      id: 'car-glow',
      type: 'circle',
      source: 'car',
      paint: { 'circle-color': p.goldCore, 'circle-radius': lineWidth([[10, 9], [16, 24]]), 'circle-blur': 1, 'circle-opacity': 0.7 },
    },
    {
      id: 'car',
      type: 'circle',
      source: 'car',
      paint: {
        'circle-color': p.car,
        'circle-radius': lineWidth([[10, 3], [16, 6.5]]),
        'circle-stroke-color': p.gold,
        'circle-stroke-width': 1.5,
      },
    },
    {
      id: 'season-glow',
      type: 'circle',
      source: 'season',
      maxzoom: 9,
      paint: {
        'circle-color': p.seasonDot,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 7, 6, 14],
        'circle-blur': 1,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 7, 0.45, 9, 0],
      },
    },
    {
      id: 'season',
      type: 'circle',
      source: 'season',
      maxzoom: 9,
      paint: {
        'circle-color': p.seasonDot,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.2, 6, 4],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 7, 1, 9, 0],
      },
    },
    {
      id: 'venue-pulse',
      type: 'circle',
      source: 'venue',
      maxzoom: 12,
      paint: {
        'circle-color': p.gold,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 5, 10, 12],
        'circle-stroke-color': p.gold,
        'circle-stroke-width': 1,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0],
      },
    },
    {
      id: 'place-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      // Only near the venue; from space the globe carries just the gold points.
      minzoom: 8.5,
      maxzoom: 13,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: {
        'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 13],
        'text-letter-spacing': 0.02,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2, 'text-opacity': 0.85 },
    },
  ];

  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources,
    layers,
    sky: {
      'sky-color': p.sky,
      'horizon-color': p.horizon,
      'sky-horizon-blend': 0.55,
      'horizon-fog-blend': 0.6,
      // A faint rim of atmosphere from space, not daylight: the globe stays a night globe.
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, input.theme === 'midnight' ? 0.32 : 0.5, 4, input.theme === 'midnight' ? 0.26 : 0.4, 7, 0],
    },
    light: { anchor: 'map', position: [1.4, 205, 38], color: p.light.color, intensity: p.light.intensity },
  };
}
