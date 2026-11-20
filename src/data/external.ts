import { bounds, distanceKm, type LngLat } from '@/lib/geo';
import { fold } from '@/lib/text';
import type { Forecast, SportEvent } from '@/lib/types';
import { FORECAST_DAYS } from '@/lib/weather';

/**
 * Keyless public services the desktop app reads directly (all CORS-open):
 * - Open-Meteo for venue weather (CC BY 4.0, free for non-commercial use).
 * - bacinger/f1-circuits for racing lines (MIT), via jsDelivr.
 * - Photon (komoot, OpenStreetMap data) to place arenas precisely; the backend only knows the city.
 */

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

// ── Weather ────────────────────────────────────────────────────

interface OpenMeteoForecast {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation_probability?: (number | null)[];
    weather_code: (number | null)[];
    wind_speed_10m: (number | null)[];
    is_day?: (number | null)[];
  };
}

export async function fetchForecast(lat: number, lon: number, signal?: AbortSignal): Promise<Forecast> {
  const params = [
    `latitude=${lat.toFixed(4)}`,
    `longitude=${lon.toFixed(4)}`,
    'hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,is_day',
    'timezone=UTC',
    `forecast_days=${FORECAST_DAYS}`,
  ];
  const json = await getJson<OpenMeteoForecast>(`https://api.open-meteo.com/v1/forecast?${params.join('&')}`, signal);
  const h = json.hourly;
  const hours = h.time
    .map((t, i) => ({
      timeUtc: new Date(`${t}:00Z`).toISOString(),
      temperatureC: h.temperature_2m[i],
      precipitationProbability: h.precipitation_probability?.[i] ?? null,
      weatherCode: h.weather_code[i],
      windKph: h.wind_speed_10m[i],
      isDay: (h.is_day?.[i] ?? 1) === 1,
    }))
    .filter(
      (x): x is typeof x & { temperatureC: number; weatherCode: number; windKph: number } =>
        x.temperatureC != null && x.weatherCode != null && x.windKph != null,
    );
  return { lat: json.latitude, lon: json.longitude, hours, fetchedAt: new Date().toISOString() };
}

// ── Circuits ───────────────────────────────────────────────────

export interface Circuit {
  id: string;
  name: string;
  /** Lap length in metres, when the dataset has it. */
  lengthM?: number;
  opened?: number;
  firstGp?: number;
  line: LngLat[];
  center: LngLat;
}

interface CircuitCollection {
  features: {
    properties: { id: string; Name: string; length?: number; opened?: number; firstgp?: number };
    geometry: { type: string; coordinates: LngLat[] };
  }[];
}

const CIRCUITS_URL = 'https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@master/f1-circuits.geojson';

export async function fetchCircuits(signal?: AbortSignal): Promise<Circuit[]> {
  const json = await getJson<CircuitCollection>(CIRCUITS_URL, signal);
  return json.features
    .filter((f) => f.geometry.type === 'LineString' && f.geometry.coordinates.length > 2)
    .map((f) => {
      const [w, s, e, n] = bounds(f.geometry.coordinates);
      return {
        id: f.properties.id,
        name: f.properties.Name,
        lengthM: f.properties.length,
        opened: f.properties.opened,
        firstGp: f.properties.firstgp,
        line: f.geometry.coordinates,
        center: [(w + e) / 2, (s + n) / 2] as LngLat,
      };
    });
}

/** The circuit of an F1 event, matched by venue coordinates (within 5 km). */
export function circuitForEvent(event: Pick<SportEvent, 'sport' | 'venue'>, circuits: Circuit[] | undefined): Circuit | null {
  const { lat, lon } = event.venue;
  if (event.sport !== 'f1' || !circuits || lat == null || lon == null) return null;
  let best: Circuit | null = null;
  let bestKm = 5;
  for (const c of circuits) {
    const km = distanceKm(lat, lon, c.center[1], c.center[0]);
    if (km <= bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return best;
}

// ── Arenas ─────────────────────────────────────────────────────

export interface ArenaPlace {
  center: LngLat;
  /** The building's footprint box, when OpenStreetMap has one: [west, south, east, north]. */
  extent?: [number, number, number, number];
  /** False when only the city is known. */
  precise: boolean;
  /** The OpenStreetMap object Photon matched, for fetching its exact outline. */
  osm?: { type: 'N' | 'W' | 'R'; id: number };
}

/** Venues OpenStreetMap and Wikidata know by another name (older, or spelled out). */
const ALIASES: Record<string, string[]> = {
  'meta apex': ['UFC Apex'],
  'ufc apex': ['UFC Apex'],
  'abha arena': ['Ali Bin Hamad Al Attiya Arena', 'Ali Bin Hamad Al-Attiyah Arena'],
};

const GENERIC = new Set(['arena', 'stadium', 'center', 'centre', 'the', 'hall', 'dome', 'park', 'garden', 'gardens', 'at']);

const tokens = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !GENERIC.has(t));

/** True when a result's name shares a distinctive word with the venue's ("Scotiabank Arena"). */
export function namesMatch(venueName: string, candidate: string): boolean {
  const want = new Set(tokens(venueName));
  return tokens(candidate).some((t) => want.has(t));
}

interface PhotonResult {
  features: {
    properties: {
      name?: string;
      osm_key?: string;
      osm_value?: string;
      osm_type?: 'N' | 'W' | 'R';
      osm_id?: number;
      extent?: [number, number, number, number];
    };
    geometry: { coordinates: LngLat };
  }[];
}

// v4: no longer keeps a fallback found while Photon was failing, so those are looked up again.
const CACHE_KEY = 'gametime-desktop.arenas.v4';

/** Best first: the building itself, then its grounds, then anything else with the name. Points last. */
function placeRank(p: PhotonResult['features'][number]['properties']): number {
  const kind = p.osm_key === 'building' ? 0 : p.osm_key === 'leisure' || p.osm_key === 'amenity' ? 1 : 2;
  return kind + (p.osm_type === 'N' ? 3 : 0);
}

/** One retry, a moment later: Photon turns away bursts of searches now and then. */
async function photon(url: string, signal?: AbortSignal): Promise<PhotonResult> {
  try {
    return await getJson<PhotonResult>(url, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    await new Promise((done) => setTimeout(done, 900));
    return getJson<PhotonResult>(url, signal);
  }
}

interface WikidataSearch {
  search?: { id: string; label?: string }[];
}

interface WikidataEntities {
  entities?: Record<
    string,
    {
      claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
    }
  >;
}

const claim = <T,>(entity: NonNullable<WikidataEntities['entities']>[string], property: string): T | undefined =>
  entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value as T | undefined;

/**
 * Wikidata knows many venues OpenStreetMap search doesn't find by name: their coordinates (P625)
 * and, often, their OpenStreetMap way (P10689) or relation (P402). Only a place within 60 km of
 * the city counts.
 */
async function findOnWikidata(name: string, city: LngLat, signal?: AbortSignal): Promise<ArenaPlace | null> {
  const base = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
  const search = await getJson<WikidataSearch>(`${base}&action=wbsearchentities&language=en&limit=5&search=${encodeURIComponent(name)}`, signal);
  const ids = (search.search ?? []).map((s) => s.id);
  if (ids.length === 0) return null;
  const data = await getJson<WikidataEntities>(`${base}&action=wbgetentities&props=claims&ids=${ids.join('|')}`, signal);
  for (const id of ids) {
    const entity = data.entities?.[id];
    if (!entity) continue;
    const coord = claim<{ latitude: number; longitude: number }>(entity, 'P625');
    if (!coord || distanceKm(coord.latitude, coord.longitude, city[1], city[0]) > 60) continue;
    const way = claim<string>(entity, 'P10689');
    const relation = claim<string>(entity, 'P402');
    return {
      center: [coord.longitude, coord.latitude],
      precise: true,
      osm: way ? { type: 'W', id: Number(way) } : relation ? { type: 'R', id: Number(relation) } : undefined,
    };
  }
  return null;
}

function readCache(): Record<string, ArenaPlace> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, ArenaPlace>;
  } catch {
    return {};
  }
}

function writeCache(key: string, place: ArenaPlace) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [key]: place }));
  } catch {
    // Storage full or blocked: the next visit looks it up again.
  }
}

/**
 * Finds an indoor venue's building near the city the backend gave us. Searches only a box around
 * the city, and only accepts a result whose name shares a distinctive word with the venue's.
 */
export async function locateArena(venue: SportEvent['venue'], signal?: AbortSignal): Promise<ArenaPlace | null> {
  if (venue.lat == null || venue.lon == null) return null;
  const key = `${fold(venue.name)}|${fold(venue.city)}`;
  const cached = readCache()[key];
  if (cached) return cached;

  const city: LngLat = [venue.lon, venue.lat];
  const pad = 0.4;
  const bbox = [city[0] - pad, city[1] - pad, city[0] + pad, city[1] + pad].map((v) => v.toFixed(4)).join(',');
  const names = [venue.name, ...(ALIASES[fold(venue.name)] ?? [])];

  // A search that failed (rather than found nothing) means the answer below is only for now.
  let searchFailed = false;
  for (const name of names) {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&limit=5&bbox=${bbox}&lang=en`;
    let json: PhotonResult;
    try {
      json = await photon(url, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      searchFailed = true;
      continue;
    }
    const hit = json.features
      .filter((f) => f.properties.name && namesMatch(name, f.properties.name) && f.properties.osm_key !== 'highway')
      .sort((a, b) => placeRank(a.properties) - placeRank(b.properties))[0];
    if (hit) {
      // Photon writes the extent as [west, north, east, south].
      const x = hit.properties.extent;
      const extent: ArenaPlace['extent'] = x
        ? [Math.min(x[0], x[2]), Math.min(x[1], x[3]), Math.max(x[0], x[2]), Math.max(x[1], x[3])]
        : undefined;
      const { osm_type, osm_id } = hit.properties;
      const place: ArenaPlace = {
        center: hit.geometry.coordinates,
        extent,
        precise: true,
        osm: osm_type && osm_id ? { type: osm_type, id: osm_id } : undefined,
      };
      writeCache(key, place);
      return place;
    }
  }
  for (const name of names) {
    try {
      const place = await findOnWikidata(name, city, signal);
      if (place) {
        if (!searchFailed) writeCache(key, place);
        return place;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      searchFailed = true;
    }
  }
  const approximate: ArenaPlace = { center: city, precise: false };
  if (!searchFailed) writeCache(key, approximate);
  return approximate;
}

// ── An arena's exact outline (OpenStreetMap API, CORS-open, one request per arena, cached) ──

export interface Footprint {
  /** Outer rings, [lon, lat], closed. */
  rings: LngLat[][];
  /** Metres: the `height` tag, else levels × 3.5, else a typical arena roof. */
  heightM: number;
  /** False when OpenStreetMap's object is the grounds (a stadium area), not the building. */
  isBuilding: boolean;
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
}

// v2: footprints say whether they're a building.
const FOOTPRINT_KEY = 'gametime-desktop.footprints.v2';

function heightFrom(tags: Record<string, string> | undefined): number {
  const height = Number.parseFloat(tags?.height ?? '');
  if (Number.isFinite(height) && height > 3) return height;
  const levels = Number.parseFloat(tags?.['building:levels'] ?? '');
  if (Number.isFinite(levels) && levels > 0) return levels * 3.5;
  return 34;
}

/** Joins way pieces end to end into closed rings (multipolygon outers are often split). */
export function assembleRings(pieces: LngLat[][]): LngLat[][] {
  const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
  const rest = pieces.map((p) => [...p]);
  const rings: LngLat[][] = [];
  while (rest.length) {
    let ring = rest.shift()!;
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < rest.length; i++) {
        const p = rest[i];
        const end = ring[ring.length - 1];
        if (same(p[0], end)) ring = [...ring, ...p.slice(1)];
        else if (same(p[p.length - 1], end)) ring = [...ring, ...p.slice(0, -1).reverse()];
        else continue;
        rest.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length >= 4 && same(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

export async function fetchFootprint(osm: { type: 'N' | 'W' | 'R'; id: number }, signal?: AbortSignal): Promise<Footprint | null> {
  if (osm.type === 'N') return null;
  const key = `${osm.type}${osm.id}`;
  try {
    const cached = (JSON.parse(localStorage.getItem(FOOTPRINT_KEY) ?? '{}') as Record<string, Footprint>)[key];
    if (cached) return cached;
  } catch {
    // Unreadable cache: fetch again.
  }
  const kind = osm.type === 'W' ? 'way' : 'relation';
  const json = await getJson<{ elements: OsmElement[] }>(`https://api.openstreetmap.org/api/0.6/${kind}/${osm.id}/full.json`, signal);
  const nodes = new Map(json.elements.filter((e) => e.type === 'node').map((n) => [n.id, [n.lon!, n.lat!] as LngLat]));
  const ways = new Map(json.elements.filter((e) => e.type === 'way').map((w) => [w.id, w]));
  const line = (w: OsmElement | undefined) => (w?.nodes ?? []).map((id) => nodes.get(id)).filter((p): p is LngLat => !!p);
  const target = json.elements.find((e) => e.type === kind && e.id === osm.id);
  if (!target) return null;
  const rings =
    kind === 'way'
      ? assembleRings([line(target)])
      : assembleRings((target.members ?? []).filter((m) => m.type === 'way' && m.role !== 'inner').map((m) => line(ways.get(m.ref))));
  if (rings.length === 0) return null;
  const tags = target.tags ?? {};
  const footprint: Footprint = { rings, heightM: heightFrom(tags), isBuilding: !!(tags.building || tags['building:part']) };
  try {
    const all = JSON.parse(localStorage.getItem(FOOTPRINT_KEY) ?? '{}') as Record<string, Footprint>;
    localStorage.setItem(FOOTPRINT_KEY, JSON.stringify({ ...all, [key]: footprint }));
  } catch {
    // Storage full or blocked.
  }
  return footprint;
}
