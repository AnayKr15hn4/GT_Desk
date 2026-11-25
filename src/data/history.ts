import { namesMatch, venueAliases } from '@/data/external';
import { distanceKm } from '@/lib/geo';
import { fold } from '@/lib/text';
import type { Fighter, SportEvent } from '@/lib/types';

/**
 * The background on an event page, from keyless public services the browser reads directly (all
 * CORS-open):
 * - Wikipedia: a Grand Prix's story, a fighter's background (text under CC BY-SA 4.0, credited
 *   and linked where it's shown).
 * - Wikimedia Commons: photos, each under its own free licence and credited to its author.
 * - Jolpica, the Ergast Formula 1 archive: who has won at a circuit.
 */

const WIKIPEDIA = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

/** A MediaWiki API URL (anonymous, so CORS allows it from any page). */
function wiki(base: string, params: Record<string, string | number>): string {
  const all: Record<string, string> = { format: 'json', formatversion: '2', origin: '*' };
  for (const [k, v] of Object.entries(params)) all[k] = String(v);
  return `${base}?${new URLSearchParams(all)}`;
}

/** Plain text from the bits of HTML in Commons metadata. */
export function plain(html: string | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Articles ───────────────────────────────────────────────────

export interface Article {
  title: string;
  /** The article's opening, a paragraph at a time. */
  paragraphs: string[];
  url: string;
}

interface WikiPage {
  title: string;
  missing?: boolean;
  extract?: string;
  fullurl?: string;
  thumbnail?: { source: string; width: number; height: number };
  /** The lead photo's file name. */
  pageimage?: string;
}

interface WikiQuery {
  query?: {
    pages?: WikiPage[];
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
  };
}

/**
 * An intro's paragraphs, without the "(Arabic: ...)" glosses and pronunciation notes in its first
 * line. A birth date in one stays: "(Russian: ...; born 16 May 1994)" becomes "(born 16 May 1994)".
 */
export function paragraphsOf(extract: string): string[] {
  return extract
    .split('\n')
    .map((p) =>
      p
        .replace(/\s*\(((?:[A-Z][\w-]*(?: [A-Z][\w-]*)?:|pronounced|lit\.|listen)[^()]*)\)/g, (_, inside: string) => {
          const born = /\bborn\b[^;()]*/.exec(inside);
          return born ? ` (${born[0].trim()})` : '';
        })
        .replace(/\s+([,.;:])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((p) => p.length > 0);
}

function articleFrom(page: WikiPage | undefined): Article | null {
  if (!page || page.missing || !page.extract || /\bmay (also )?refer to\b/.test(page.extract)) return null;
  const paragraphs = paragraphsOf(page.extract);
  if (paragraphs.length === 0) return null;
  return { title: page.title, paragraphs, url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` };
}

/** "https://en.wikipedia.org/wiki/Losail_International_Circuit" becomes "Losail International Circuit" (a "#Section" dropped). */
export function wikiTitle(url: string | undefined): string | null {
  const path = url?.split('/wiki/')[1]?.split('#')[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path).replace(/_/g, ' ');
  } catch {
    return path.replace(/_/g, ' ');
  }
}

/** A Wikipedia article's opening, by its title (redirects followed). */
export async function fetchArticle(title: string, signal?: AbortSignal): Promise<Article | null> {
  const json = await getJson<WikiQuery>(wiki(WIKIPEDIA, { action: 'query', prop: 'extracts|info', inprop: 'url', exintro: 1, explaintext: 1, redirects: 1, titles: title }), signal);
  return articleFrom(json.query?.pages?.[0]);
}

// ── Formula 1: the race's story ────────────────────────────────

export interface PastWin {
  season: number;
  /** What the race was called that year (a circuit can host more than one Grand Prix). */
  raceName: string;
  driver: string;
  team: string;
}

export interface F1History {
  circuit: { id: string; name: string; url?: string } | null;
  /** Every race at this circuit, newest first, with its winner. */
  wins: PastWin[];
  /** The Grand Prix's own story (or the circuit's, when the race has no article). */
  article: Article | null;
}

interface JolpicaRaces {
  MRData: {
    RaceTable: {
      Races: {
        season: string;
        raceName: string;
        Circuit: { circuitId: string; circuitName: string; url?: string };
        Results?: { Driver: { givenName: string; familyName: string }; Constructor: { name: string } }[];
      }[];
    };
  };
}

export async function fetchF1History(event: SportEvent, signal?: AbortSignal): Promise<F1History> {
  // The Jolpica id is "season-round".
  const [season, round] = event.externalId.split('-');
  let circuit: F1History['circuit'] = null;
  if (event.source === 'jolpica' && season && round) {
    const race = await getJson<JolpicaRaces>(`${JOLPICA}/${season}/${round}.json`, signal);
    const c = race.MRData.RaceTable.Races[0]?.Circuit;
    if (c) circuit = { id: c.circuitId, name: c.circuitName, url: c.url };
  }
  const [wins, article] = await Promise.all([
    circuit
      ? getJson<JolpicaRaces>(`${JOLPICA}/circuits/${circuit.id}/results/1.json?limit=100`, signal).then((json) =>
          json.MRData.RaceTable.Races.flatMap((r): PastWin[] => {
            const winner = r.Results?.[0];
            return winner ? [{ season: Number(r.season), raceName: r.raceName, driver: `${winner.Driver.givenName} ${winner.Driver.familyName}`, team: winner.Constructor.name }] : [];
          }).sort((a, b) => b.season - a.season),
        )
      : Promise.resolve([]),
    fetchArticle(event.name, signal).then((a) => {
      const circuitArticle = wikiTitle(circuit?.url);
      return a ?? (circuitArticle ? fetchArticle(circuitArticle, signal) : null);
    }),
  ]);
  return { circuit, wins, article };
}

/** Wins per driver (or team), most first, ties in the order they first won here. */
export function tally(wins: PastWin[], by: (w: PastWin) => string): { name: string; wins: number }[] {
  const counts = new Map<string, number>();
  // Oldest first, so a tie keeps whoever got there first.
  for (const w of [...wins].reverse()) counts.set(by(w), (counts.get(by(w)) ?? 0) + 1);
  return [...counts].map(([name, n]) => ({ name, wins: n })).sort((a, b) => b.wins - a.wins);
}

const TIMES = ['', 'once', 'twice', 'three times', 'four times', 'five times', 'six times', 'seven times', 'eight times', 'nine times', 'ten times'];
const times = (n: number) => TIMES[n] ?? `${n} times`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => WORDS[n] ?? String(n);

function leaders(wins: PastWin[], by: (w: PastWin) => string): { names: string[]; count: number } {
  const all = tally(wins, by);
  const count = all[0]?.wins ?? 0;
  return { names: all.filter((t) => t.wins === count).map((t) => t.name), count };
}

const andList = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** A short read of a circuit's history from its winners: how long, who's won most, who won last. */
export function summarizeWins(circuitName: string, wins: PastWin[]): string[] {
  const n = wins.length;
  if (n === 0) return [`This is Formula 1's first race at ${circuitName}.`];
  const latest = wins[0];
  const first = wins[n - 1].season;
  if (n === 1) return [`Formula 1 has raced at ${circuitName} once before, in ${first}, when ${latest.driver} won for ${latest.team}.`];
  const lines = [`Formula 1 has raced at ${circuitName} ${n} times, first in ${first}.`];
  const drivers = leaders(wins, (w) => w.driver);
  if (drivers.count < 2) lines.push('No one has won here twice: every race has had a different winner.');
  else if (drivers.names.length === 1) lines.push(`${drivers.names[0]} has won here ${times(drivers.count)}, more than anyone else.`);
  else if (drivers.names.length <= 3) lines.push(`${andList(drivers.names)} have each won here ${times(drivers.count)}, more than anyone else.`);
  const teams = leaders(wins, (w) => w.team);
  if (teams.count >= 2 && teams.names.length === 1) lines.push(`${teams.names[0]} have won ${word(teams.count)} of the ${n}.`);
  let streak = 1;
  while (streak < n && wins[streak].driver === latest.driver) streak++;
  if (streak >= 2) lines.push(`${latest.driver} has won the last ${word(streak)} in a row, most recently in ${latest.season} for ${latest.team}.`);
  else lines.push(`${latest.driver} won the most recent race here, in ${latest.season}, for ${latest.team}.`);
  return lines;
}

// ── UFC: the fighters' backgrounds ─────────────────────────────

/** Who took a photo and its licence, as its file page gives them. */
export interface Credit {
  author: string;
  license: string;
  licenseUrl?: string;
  /** The file's page, with its full credit. */
  page: string;
}

export interface FighterProfile {
  fighter: Fighter;
  article: Article;
  /** Wikipedia's lead photo of them (only ever a freely licensed one), when it has one. */
  photo?: { src: string; width: number; height: number; credit?: Credit };
  /** Worked out from the birth date in the article's first line. */
  age?: number;
  mainEvent: boolean;
}

/** "24-5-0" (or "24-5", or "24-5-0, 1 NC") as wins, losses and draws. */
export function parseRecord(record: string | undefined): { wins: number; losses: number; draws: number } | null {
  const m = /^\s*(\d+)-(\d+)(?:-(\d+))?/.exec(record ?? '');
  return m ? { wins: Number(m[1]), losses: Number(m[2]), draws: Number(m[3] ?? 0) } : null;
}

const PLACEHOLDER = /\b(tba|tbd)\b/i;
/** "TBA" or "TBD": a fighter not named yet. */
export const isPlaceholder = (name: string) => PLACEHOLDER.test(name);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Age now from "born 22 July 1989" or "born July 22, 1989" in an article's first paragraph. */
export function ageFrom(text: string, now = new Date()): number | undefined {
  const m = /\bborn (?:(\d{1,2}) ([A-Za-z]+),? (\d{4})|([A-Za-z]+) (\d{1,2}),? (\d{4}))/.exec(text);
  if (!m) return undefined;
  const day = Number(m[1] ?? m[5]);
  const month = MONTHS.indexOf((m[2] ?? m[4]).toLowerCase());
  const year = Number(m[3] ?? m[6]);
  if (month < 0) return undefined;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() < month || (now.getUTCMonth() === month && now.getUTCDate() < day)) age--;
  return age > 15 && age < 70 ? age : undefined;
}

/** True for an article about a fighter (not a namesake): it speaks of mixed martial arts. */
export function isFighterArticle(article: Article | null): article is Article {
  return !!article && /mixed martial|\bMMA\b|\bUFC\b|Ultimate Fighting Championship|kickbox/i.test(article.paragraphs.join(' '));
}

const surname = (name: string) => fold(name).split(' ').filter(Boolean).pop() ?? '';

/** The main event's fighters first, then the rest of the main card, real names only. */
export function cardFighters(event: SportEvent): { fighter: Fighter; mainEvent: boolean }[] {
  const bouts = [...(event.bouts ?? [])].filter((b) => b.isMainEvent || b.segment === 'main_card').sort((a, b) => Number(b.isMainEvent) - Number(a.isMainEvent));
  return bouts.flatMap((b) => b.fighters.filter((f) => f.name && !PLACEHOLDER.test(f.name)).map((fighter) => ({ fighter, mainEvent: b.isMainEvent })));
}

export async function fetchFighterProfiles(event: SportEvent, signal?: AbortSignal): Promise<FighterProfile[]> {
  const fighters = cardFighters(event).slice(0, 12);
  if (fighters.length === 0) return [];
  const props = { action: 'query', prop: 'extracts|pageimages|info', inprop: 'url', exintro: 1, explaintext: 1, exlimit: 20, piprop: 'thumbnail|name', pithumbsize: GRID_PX, pilimit: 20, redirects: 1 };
  // Most fighters' articles are under their own name: one request for the lot.
  const json = await getJson<WikiQuery>(wiki(WIKIPEDIA, { ...props, titles: fighters.map((f) => f.fighter.name).join('|') }), signal);
  const pages = new Map((json.query?.pages ?? []).map((p) => [p.title, p]));
  const renamed = new Map([...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])].map((r) => [r.from, r.to]));
  const pageFor = (name: string) => {
    let title = name;
    for (let hops = 0; hops < 3 && renamed.has(title); hops++) title = renamed.get(title) ?? title;
    return pages.get(title);
  };
  const profiles = await Promise.all(
    fighters.map(async ({ fighter, mainEvent }): Promise<{ profile: FighterProfile; file?: string } | null> => {
      let page = pageFor(fighter.name);
      let article = articleFrom(page);
      // The main event's fighters are worth a search when their name alone finds someone else.
      if (!isFighterArticle(article) && mainEvent) {
        const found = await getJson<WikiQuery>(wiki(WIKIPEDIA, { ...props, generator: 'search', gsrsearch: `${fighter.name} mixed martial artist`, gsrlimit: 1 }), signal);
        page = found.query?.pages?.[0];
        article = page && fold(page.title).includes(surname(fighter.name)) ? articleFrom(page) : null;
      }
      if (!isFighterArticle(article)) return null;
      const thumb = page?.thumbnail;
      return {
        profile: { fighter, article, photo: thumb ? { src: thumb.source, width: thumb.width, height: thumb.height } : undefined, age: ageFrom(article.paragraphs[0]), mainEvent },
        file: thumb ? page?.pageimage : undefined,
      };
    }),
  );
  const found = profiles.filter((p) => p !== null);
  // Each photo's credit, in one more request (a missing one only leaves its credit out).
  const credits = await creditsFor(found.flatMap((p) => (p.file ? [p.file] : [])), signal).catch(() => new Map<string, Credit>());
  return found.map(({ profile, file }) => {
    const credit = file ? credits.get(fileKey(file)) : undefined;
    return profile.photo && credit ? { ...profile, photo: { ...profile.photo, credit } } : profile;
  });
}

const fileKey = (name: string) => name.replace(/^File:/, '').replace(/_/g, ' ');

/** Credits for files by name, from their file pages (Commons' own, through Wikipedia, or Wikipedia's). */
async function creditsFor(files: string[], signal?: AbortSignal): Promise<Map<string, Credit>> {
  const credits = new Map<string, Credit>();
  if (files.length === 0) return credits;
  const json = await getJson<{ query?: { pages?: CommonsFile[] } }>(
    wiki(WIKIPEDIA, { action: 'query', titles: files.map((f) => `File:${fileKey(f)}`).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl' }),
    signal,
  );
  for (const file of json.query?.pages ?? []) {
    const info = file.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = plain(meta.LicenseShortName?.value);
    if (!info || !license) continue;
    credits.set(fileKey(file.title), {
      author: plain(meta.Artist?.value).slice(0, 80) || 'Unknown author',
      license,
      licenseUrl: meta.LicenseUrl?.value || undefined,
      page: info.descriptionurl,
    });
  }
  return credits;
}

// ── Photos ─────────────────────────────────────────────────────

export interface Photo extends Credit {
  /** About 960 px wide for the panels, and `large` (up to 1920 px) for a big screen and the viewer. */
  src: string;
  large: string;
  width: number;
  height: number;
  /** How wide `large` is. */
  largeWidth: number;
  caption: string;
  /** The file's name on Commons, without "File:". */
  title: string;
  /** The Commons categories it's filed under: what's in it, which race, which car. */
  categories: string[];
}

/** A photo in an event's gallery, and the set it's in: "On track", the circuit, the town, a fighter. */
export interface GalleryPhoto extends Photo {
  group: string;
}

interface CommonsFile {
  title: string;
  index?: number;
  imageinfo?: {
    url: string;
    descriptionurl: string;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    width: number;
    height: number;
    mime: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
}

/** Commons serves thumbnails in fixed steps; these are two of them. */
const GRID_PX = 960;
const LARGE_PX = 1920;
/** Not a photograph, by its name or a category: maps, logos, flags, satellite views, old prints. */
const NOT_A_PHOTO =
  /\b(logos?|flags?|maps?|layouts?|diagrams?|charts?|coats? of arms|emblems?|icons?|seals?|posters?|tickets?|screenshots?|signatures?|plans?|satellites?|renders?|renderings?|drawings?|illustrations?|engravings?|paintings?|lithographs?|postcards?|black and white)\b/i;

/**
 * A photo worth showing (a real photograph, big enough, freely licensed), or null. Everything on
 * Commons is freely licensed. PNGs are left out (nearly all are diagrams, maps and renders), and
 * photos must be 640 px wide.
 */
export function photoFrom(file: CommonsFile): Photo | null {
  const info = file.imageinfo?.[0];
  if (!info || !/^image\/(jpeg|webp)$/.test(info.mime)) return null;
  if (info.width < 640 || info.height < 400 || info.width / info.height > 3 || info.height / info.width > 2.2) return null;
  const name = file.title.replace(/^File:/, '');
  const meta = info.extmetadata ?? {};
  const categories = plain(meta.Categories?.value)
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (NOT_A_PHOTO.test(name) || categories.some((c) => NOT_A_PHOTO.test(c))) return null;
  const license = plain(meta.LicenseShortName?.value);
  if (!license || /fair use|non-free/i.test(license)) return null;
  // Without the uploader's notes on where a video still came from: "taken from ... channel", "(Cropped at 8:48)".
  const description = plain(meta.ImageDescription?.value)
    .replace(/,?\s*taken from [^.]*\.?/gi, '')
    .replace(/\s*\((?:cropped|crop)\b[^)]*\)?\.*/gi, '')
    .trim();
  const caption = description && description.length <= 160 ? description : description ? `${description.slice(0, 157).replace(/\s+\S*$/, '')}...` : nameOf(name);
  const grid = info.thumburl ?? info.url;
  const scaled = info.width > LARGE_PX && !!info.thumburl;
  return {
    src: grid,
    large: scaled ? grid.replace(`/${GRID_PX}px-`, `/${LARGE_PX}px-`) : info.url,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    largeWidth: scaled ? LARGE_PX : info.width,
    caption,
    title: name,
    categories,
    author: plain(meta.Artist?.value).slice(0, 80) || 'Unknown author',
    license,
    licenseUrl: meta.LicenseUrl?.value || undefined,
    page: info.descriptionurl,
  };
}

/** A file's name as words: "Grand_Stand.JPG" becomes "Grand Stand". */
const nameOf = (file: string) =>
  file
    .replace(/\.[a-z]+$/i, '')
    .replace(/\s*\(\d{6,}\)/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const IMAGE_INFO = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: GRID_PX, iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ImageDescription|Categories' };

/** The photos from a query on Commons or Wikipedia (a search, a category, an article's images), in its order. */
async function photosFrom(base: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<Photo[]> {
  // Commons scales at most 50 images a request, so no query asks for more.
  const json = await getJson<{ query?: { pages?: CommonsFile[] } }>(wiki(base, { action: 'query', ...params, ...IMAGE_INFO }), signal);
  return (json.query?.pages ?? [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((file) => photoFrom(file))
    .filter((p): p is Photo => p !== null);
}

/** Photos on Commons for a search (its own syntax: quotes, incategory:, intitle:). */
const searchCommons = (search: string, limit: number, signal?: AbortSignal) =>
  photosFrom(COMMONS, { generator: 'search', gsrnamespace: 6, gsrsearch: `${search} filetype:bitmap`, gsrlimit: limit }, signal);

/**
 * The newest photos filed directly in a Commons category. Sorted by date, the API ignores its
 * files-only filter, so files are asked for by their namespace (6) instead.
 */
const photosInCategory = (category: string, signal?: AbortSignal) =>
  photosFrom(COMMONS, { generator: 'categorymembers', gcmtitle: `Category:${category}`, gcmnamespace: 6, gcmsort: 'timestamp', gcmdir: 'desc', gcmlimit: 50 }, signal);

/** The photos a Wikipedia article shows. */
const photosInArticle = (title: string, signal?: AbortSignal) => photosFrom(WIKIPEDIA, { generator: 'images', titles: title, gimlimit: 50 }, signal);

/** A place as the schedule names it (a town, an arena), and where the venue is. */
export interface Place {
  name: string;
  /** Other names it has gone by: an arena renamed for a new sponsor. */
  aliases?: string[];
  /** An arena's town, whose name doesn't tell one of its buildings from another ("Sydney SuperDome"). */
  city?: string;
  lat?: number;
  lon?: number;
}

/**
 * Where an event's photos come from: for a Grand Prix, the race's years, its circuit and the town;
 * for a fight night, its arena and its city.
 */
export type GallerySources =
  | { sport: 'f1'; raceName: string; seasons: number[]; circuit: { name: string; articles: string[] }; place: Place }
  | { sport: 'ufc'; venue: Place; place: Place };

/**
 * An event's photo sources. A Grand Prix's come from its history, so pass that once it has loaded
 * (or failed); a fight night's are its arena's and its city's.
 */
export function gallerySources(event: SportEvent, history: F1History | null | undefined): GallerySources {
  if (event.sport === 'f1') {
    return {
      sport: 'f1',
      raceName: event.name,
      // Only the years it ran under this name, newest first: Commons names each year's category after the race.
      seasons: (history?.wins ?? []).filter((w) => w.raceName === event.name).map((w) => w.season),
      // The circuit's article as the archive links it, then the schedule's name for the venue: the
      // archive links Las Vegas to the race's article, and Wikipedia redirects a venue's name to its circuit.
      circuit: {
        name: history?.circuit?.name ?? event.venue.name,
        articles: [...new Set([wikiTitle(history?.circuit?.url), event.venue.name].filter((t): t is string => !!t))],
      },
      place: { name: event.venue.city, lat: event.venue.lat, lon: event.venue.lon },
    };
  }
  const { name, city, lat, lon } = event.venue;
  return { sport: 'ufc', venue: { name, aliases: venueAliases(name), city, lat, lon }, place: { name: city, lat, lon } };
}

/** Photos in each of a Grand Prix's three sets: cars on track, the circuit, the town. */
export const PER_SET = 2;
/** Photos in each of a fight night's two sets: its arena and its city. */
export const PER_FIGHT_SET = 3;
/** Years of a race asked about in one search. */
const YEARS_PER_SEARCH = 12;
/** How near the venue a town's or arena's article must be, so "Spa" is the town and not the bath. */
const NEAR_KM = 80;

/** A word of a driver's name: capitalised, or a particle ("Paul di Resta", "Pedro de la Rosa"). */
const NAME_PART = "(?:[A-Z][\\p{L}'.-]+|de|da|di|du|la|le|van|von|der|den|dos|del)";
/** Commons files each car as its model (always with a number) and driver: "McLaren MCL38 of Lando Norris". */
const CAR = new RegExp(`\\d[^|]* of ${NAME_PART}(?: ${NAME_PART})* [A-Z][\\p{L}'.-]+$`, 'u');
/** Etihad's planes in race livery are filed the same way ("Boeing 787-9 of Etihad Airways"). */
const AIR = /\b(aircraft|airport|airbus|boeing|airways|airlines)\b/i;

/** The cars a photo is filed under, as model and driver: "Lotus E20 of Kimi Räikkönen". */
export function carsIn(categories: string[]): { car: string; driver: string }[] {
  if (categories.some((c) => AIR.test(c))) return [];
  return categories
    .filter((c) => CAR.test(c))
    .map((c) => {
      const at = c.lastIndexOf(' of ');
      return { car: c.slice(0, at), driver: c.slice(at + 4) };
    });
}

/**
 * A photo of a Formula 1 car, by its categories. Drivers off track, crowds, flags, fireworks and
 * fly-pasts are filed under the race too, but never under a car.
 */
export function isF1Shot(categories: string[]): boolean {
  return carsIn(categories).length > 0;
}

/**
 * What a race photo shows, from what it's filed under ("Kimi Räikkönen in the Lotus E20 at the
 * 2012 Abu Dhabi Grand Prix"): the uploader's own descriptions can be anything, adverts included.
 */
export function carCaption(photo: Photo, year: number, raceName: string): string {
  const cars = carsIn(photo.categories);
  const at = year ? `the ${year} ${raceName}` : `the ${raceName}`;
  if (cars.length === 1) return `${cars[0].driver} in the ${cars[0].car} at ${at}`;
  if (cars.length === 2) return `${cars[0].driver} and ${cars[1].driver} at ${at}`;
  return CAMERA_NAME.test(photo.caption) ? `At ${at}` : photo.caption;
}

/** A retouched or cropped copy of another photo. */
const isCopy = (p: Photo) => /\b(cropped|retouched)\b/i.test(p.title) || p.categories.some((c) => /^(Retouched pictures|Extracted images|Uploaded with derivativeFX)$/.test(c));

/**
 * One of each shot: a retouched or cropped copy (same photographer, same description) counts as
 * the photo it was made from, and the original is kept. A photographer's different shots that
 * share one description all stay.
 */
export function oneOfEach(photos: Photo[]): Photo[] {
  const out: Photo[] = [];
  const at = new Map<string, number>();
  for (const p of photos) {
    const key = `${p.author}\n${p.caption}`;
    const i = at.get(key);
    if (i === undefined || (!isCopy(out[i]) && !isCopy(p))) {
      at.set(key, out.length);
      out.push(p);
    } else if (isCopy(out[i]) && !isCopy(p)) {
      out[i] = p;
    }
  }
  return out;
}

/** Up to `count` photos in order, one for each key (a year, say) before any key twice. */
export function varied<K>(photos: Photo[], keyOf: (p: Photo) => K, count: number): Photo[] {
  const used = new Set<K>();
  const first: Photo[] = [];
  const again: Photo[] = [];
  for (const photo of photos) {
    const key = keyOf(photo);
    (used.has(key) ? again : first).push(photo);
    used.add(key);
  }
  return [...first, ...again].slice(0, count);
}

/** The best photo, then the best by someone else: one photographer's shots of a place are often near twins. */
export function otherHandSecond(photos: Photo[]): Photo[] {
  const [best, ...rest] = photos;
  const other = rest.findIndex((p) => p.author !== best?.author);
  return other < 0 ? photos : [best, rest[other], ...rest.filter((_, i) => i !== other)];
}

/** A caption that is only a camera's file name: "IMG_6389", "DSC_0043", "20240707_143512". */
export const CAMERA_NAME = /^(?:[a-z]{1,5}[ _-]?\d{3,}|\d{6,}(?:[ _-]\d+)*)$/i;

/** Photos captioned with only a camera's file name say where they're from instead. */
export function captioned(photos: Photo[], where: (p: Photo) => string): Photo[] {
  return photos.map((p) => (CAMERA_NAME.test(p.caption) ? { ...p, caption: where(p) } : p));
}

const unique = (photos: Photo[]) => [...new Map(photos.map((p) => [p.page, p])).values()];

/** Each set's first photos, in set order, with no photo twice. */
export function gather(sets: { group: string; photos: Photo[]; count: number }[]): GalleryPhoto[] {
  const seen = new Set<string>();
  const out: GalleryPhoto[] = [];
  for (const { group, photos, count } of sets) {
    for (const photo of photos.filter((p) => !seen.has(p.page)).slice(0, count)) {
      seen.add(photo.page);
      out.push({ ...photo, group });
    }
  }
  return out;
}

// ── Photos: what's in them ──

/** Commons files a person's year as "Alain Prost in 1991" (a place's is "... photographed in 2010"). */
const PERSON_YEAR = /^(?!.*\bphotographed in \d{4}$).* in \d{4}$/;
/** People rather than a place: drivers, crowds, podiums. */
const PEOPLE = /\b(portraits?|people|drivers?|podiums?|fans|spectators?|crowds?|celebrat\w*|mechanics?|marshals?)\b/i;
/** Anything driven or raced: those photos are of the machine, not the place. */
const RACING =
  /\b(car numbers?|cars?|automobiles?|vehicles?|motorcycles?|motorbikes?|superbikes?|karts?|karting|trucks?|bus(?:es)?|vans?|aircraft|helicopters?|bicycles?|cycling|drift\w*|dragsters?|formula (?:one|two|three|e|renault|ford|\d)|gp[23]|indycar|nascar|dtm|wec|elms|le mans|superleague|touring cars?|btcc|blancpain|gt[34]|supercup|moto?gp|moto[23]|sbk|w series)\b/i;
/** Food stalls, shops and car parks: at the circuit, but not of it. */
const AMENITY = /\b(food|bars?|outlets?|burgers?|ice cream|shops?|stores?|merchandise|toilets?|parking|restaurants?|caf[eé]s?|museums?|showrooms?|offices?|headquarters)\b/i;
/** A visit or a photo call, by its caption: officials and guests, whatever car or place is behind them. */
const VISIT = /\b(secretary|director|president|minister|governor|mayor|senator|ceo|chairman|chairwoman|ambassador|officials?|visits?|visited|visiting|poses?|posing|meets?|met with)\b/i;
/** A car off track: in the pits or garage, on the grid, on show. */
const OFF_TRACK = /\b(pit ?lanes?|pit ?stops?|pits|garages?|paddock|parc ferm[eé]|grid|launch|presentation|show ?cars?|display|museum|exhibition|demonstration|parade|podium)\b/i;
/** The parts of a circuit worth a photo (in the languages its photos are named in), and the light it looks best in. */
const TRACK_PART =
  /\b(grandstands?|stands?|tribunes?|tribünen?|tribunas?|pit (?:lane|buildings?|straight)|boxen\w*|paddock|fahrerlager|straights?|corners?|turns?|hairpins?|chicanes?|curves?|curvas?|kurven?|virages?|raidillon|bochten?|bends?|esses|panoram\w*|views?|vistas?|overview|towers?|hotel|sunset|sunrise|dusk|night|floodlit|start line|finish line)\b/i;
const TRACK_WORD = /\b(circuit|track|course|ring|autodromo|raceway|speedway)\b/i;
const AERIAL = /\b(aerial|from above|bird'?s[- ]eye|drone|luftaufnahme|luftbild|a[eé]rea|a[eé]rienne)\b/i;
/** A town's sights, and the light they look best in. */
const SIGHT =
  /\b(views?|panoram\w*|skylines?|cityscapes?|sunset|sunrise|dusk|night|old town|centre|center|squares?|plaza|platz|piazza|streets?|church(?:es)?|cathedrals?|duomo|mosques?|temples?|shrines?|castles?|palaces?|towers?|bridges?|harbou?rs?|marinas?|ports?|beach(?:es)?|bays?|lakes?|rivers?|waterfronts?|promenades?|parks?|gardens?)\b/i;
/** The parts of an arena worth a photo, under any of its names ("Amway Center" before it was the Kia Center). */
const VENUE_PART =
  /\b(exteriors?|interiors?|inside|outside|entrances?|fa[cç]ades?|front|views?|night|panoram\w*|buildings?|arenas?|stadiums?|centers?|centres?|seating|seats|bowl|roof|dome|plaza|marquee)\b/i;
/** A show on the floor rather than the building: a concert, a game, a fight. */
const SHOW =
  /\b(concerts?|tours?|performances?|performing|musicians?|singers?|guitarists?|drummers?|percussionists?|bands?|players?|games?|matches|fights?|fighters?|bouts?|weigh-?ins?|nba|nhl|wnba|ncaa|all-star)\b/i;
/** Indoors: a hotel's lobby says less about a town than its streets. */
const INDOORS = /\b(interiors?|inside|reception|lobby|lobbies)\b/i;
/** The racing (its own set) rather than the town. */
const AT_THE_RACE = /\b(circuit|grand prix|racing|race ?track|raceway|autodrom\w*|speedway|motorsport|formula)\b/i;
/** Commons' own picks: its quality, featured and valued images. */
const QUALITY = /^(quality images|featured pictures|valued images)\b/i;

const mentions = (photo: Photo, re: RegExp) => re.test(photo.title) || photo.categories.some((c) => re.test(c));
const commonsPick = (photo: Photo) => photo.categories.some((c) => QUALITY.test(c));
/** Up to 2 for a big photo. */
const sizeScore = (photo: Photo) => Math.min(2, photo.largeWidth / GRID_PX);
/** Not a car, a person or racing of any kind. */
const ofThePlace = (photo: Photo) => !isF1Shot(photo.categories) && !photo.categories.some((c) => PERSON_YEAR.test(c)) && !mentions(photo, PEOPLE) && !mentions(photo, RACING);

/** Words too common in circuits' names to tell one from another. */
const GENERIC = new Set(['circuit', 'international', 'grand', 'prix', 'street', 'autodromo', 'nazionale', 'de', 'di', 'del', 'la', 'le', 'of', 'the', 'ring', 'raceway', 'speedway', 'motor', 'racing', 'course', 'park']);

/** The words that name a circuit: "Las Vegas Strip Circuit" gives las, vegas and strip. */
export const nameWords = (name: string) => wordsOf(name).filter((w) => !GENERIC.has(w));

/**
 * How good a photo of the circuit itself is, or null for one that isn't: a car, a person, a food
 * stall, or anything that doesn't say it shows the track (an article's photo of the stream a
 * corner is named after). Aerial views and the parts of a track (a hairpin, a grandstand) say
 * so, as does a photo the circuit's own article chose that names the place (a street circuit's
 * photos are of streets). Commons' own picks and the article's photos then score higher, then
 * bigger photos.
 */
export function trackScore(photo: Photo, fromArticle: boolean, names: string[] = []): number | null {
  if (!ofThePlace(photo) || mentions(photo, AMENITY) || VISIT.test(photo.caption)) return null;
  const words = fromArticle ? wordsOf(`${photo.title} ${photo.categories.join(' ')}`) : [];
  const shows =
    (mentions(photo, AERIAL) ? 3 : 0) +
    (TRACK_PART.test(photo.title) ? 2 : photo.categories.some((c) => TRACK_PART.test(c)) ? 1 : 0) +
    (TRACK_WORD.test(photo.title) ? 1 : 0) +
    (names.some((w) => words.includes(w)) ? 1 : 0);
  if (shows === 0) return null;
  return shows + (commonsPick(photo) ? 4 : 0) + (fromArticle ? 2 : 0) + sizeScore(photo);
}

/**
 * How good a photo of the town is, or null for one of the racing, a car or a person. Commons' own
 * picks, sights (a skyline, a square, the harbour), photos named for the town and the photos its
 * Wikipedia article chose score higher, then bigger photos.
 */
export function townScore(photo: Photo, town: string, fromArticle: boolean): number | null {
  if (!ofThePlace(photo) || mentions(photo, AT_THE_RACE) || mentions(photo, INDOORS)) return null;
  const signs = (commonsPick(photo) ? 4 : 0) + (SIGHT.test(photo.title) ? 2 : 0) + (fold(photo.title).includes(fold(town)) ? 2 : 0) + (fromArticle ? 2 : 0);
  return signs > 0 ? signs + sizeScore(photo) : null;
}

/**
 * How good a photo of an arena is, or null for one of a show on its floor (a concert, a game, a
 * fight), a person, a shop or another building. It must be filed under the arena's category or
 * named for it (an article's photo of the stadium next door is neither). Aerial views and photos
 * named for the arena or a part of it (its front, its bowl) say they show it; Commons' own picks
 * and the photos its Wikipedia article chose then score higher, then bigger photos.
 */
export function venueScore(photo: Photo, fromArticle: boolean, names: string[], category: string): number | null {
  // "Sydney 2000 Olympic Games venues" is about the building, not a game on its floor.
  const onTheFloor = SHOW.test(photo.title) || photo.categories.some((c) => SHOW.test(c) && !/\bvenues?\b/i.test(c));
  if (!ofThePlace(photo) || mentions(photo, AMENITY) || onTheFloor || VISIT.test(photo.caption)) return null;
  const words = wordsOf(photo.title);
  const named = names.some((w) => words.includes(w));
  if (!named && !photo.categories.some((c) => fold(c) === fold(category))) return null;
  const shows = (mentions(photo, AERIAL) ? 3 : 0) + (VENUE_PART.test(photo.title) ? 2 : 0) + (named ? 2 : 0);
  if (shows === 0) return null;
  return shows + (commonsPick(photo) ? 4 : 0) + (fromArticle ? 2 : 0) + sizeScore(photo);
}

/** Photos by a score, best first, leaving out the ones it rules out; a copy counts as its original. */
export function ranked(photos: Photo[], score: (p: Photo) => number | null): Photo[] {
  const scored = unique(photos)
    .map((photo) => ({ photo, score: score(photo) }))
    .filter((s): s is { photo: Photo; score: number } => s.score !== null)
    .sort((a, b) => b.score - a.score);
  return otherHandSecond(oneOfEach(scored.map((s) => s.photo)));
}

// ── Photos: where to find them ──

const wordsOf = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/**
 * The Commons category an article links to (Albert Park Circuit's is "Melbourne Grand Prix
 * Circuit"; Silverstone Circuit links a gallery named like the category). Of several, the one
 * sharing most words with the article (Suzuka Circuit also links Honda's); without one, the
 * article's own title.
 */
export function commonsCategory(title: string, links: { title: string }[]): string {
  const words = new Set(wordsOf(title));
  const best = links
    .map((l) => l.title.replace(/_/g, ' ').replace(/^Category:/, ''))
    .filter((name) => !name.includes(':'))
    .map((name) => ({ name, shared: wordsOf(name).filter((w) => words.has(w)).length }))
    .sort((a, b) => b.shared - a.shared)[0];
  return best && best.shared > 0 ? best.name : title;
}

/** Of a search's titles, the town's own article: "Spa, Belgium" for Spa, "Austin, Texas" for Austin. */
export function townTitle(name: string, titles: string[]): string | null {
  return titles.filter((t) => t === name || t.startsWith(`${name}, `) || t.startsWith(`${name} (`)).sort((a, b) => a.length - b.length)[0] ?? null;
}

interface PlacePage extends WikiPage {
  pageprops?: { disambiguation?: string };
  coordinates?: { lat: number; lon: number }[];
  iwlinks?: { prefix: string; title: string }[];
}

/** An article and the Commons category it links, with its place on the map and whether it's a list of namesakes. */
async function lookUp(title: string, signal?: AbortSignal): Promise<PlacePage | undefined> {
  const json = await getJson<{ query?: { pages?: PlacePage[] } }>(
    wiki(WIKIPEDIA, { action: 'query', titles: title, redirects: 1, prop: 'pageprops|coordinates|iwlinks', ppprop: 'disambiguation', iwprefix: 'commons', iwlimit: 50 }),
    signal,
  );
  const page = json.query?.pages?.[0];
  return page && !page.missing ? page : undefined;
}

/**
 * A town's or an arena's Wikipedia article and Commons category, or null when there's no telling
 * which it is. Each of its names is tried, then a search near the venue: for a town, an article
 * named for it (a name shared with other places, like "Spa" or "Austin"); for an arena, one that
 * mentions it (renamed for a sponsor, its article may still have the old name).
 */
async function findPlace(place: Place, kind: 'town' | 'venue', signal?: AbortSignal): Promise<{ title: string; category: string } | null> {
  const { lat, lon } = place;
  const fits = (page?: PlacePage): page is PlacePage => {
    const at = page?.coordinates?.[0];
    if (!page || page.pageprops?.disambiguation !== undefined || !at) return false;
    return lat === undefined || lon === undefined || distanceKm(lat, lon, at.lat, at.lon) <= NEAR_KM;
  };
  const found = (page: PlacePage) => ({ title: page.title, category: commonsCategory(page.title, page.iwlinks ?? []) });
  for (const name of [place.name, ...(place.aliases ?? [])]) {
    const page = await lookUp(name, signal);
    if (fits(page)) return found(page);
  }
  if (lat === undefined || lon === undefined) return null;
  const quoted = `"${place.name.replace(/"/g, '')}"`;
  const json = await getJson<{ query?: { search?: { title: string }[] } }>(
    wiki(WIKIPEDIA, { action: 'query', list: 'search', srsearch: `${kind === 'town' ? `intitle:${quoted}` : quoted} nearcoord:${NEAR_KM}km,${lat},${lon}`, srlimit: 20, srprop: '' }),
    signal,
  );
  const titles = (json.query?.search ?? []).map((r) => r.title);
  const names = [place.name, ...(place.aliases ?? [])];
  const title = kind === 'town' ? townTitle(place.name, titles) : (titles.find((t) => names.some((n) => namesMatch(n, t))) ?? null);
  const page = title ? await lookUp(title, signal) : undefined;
  return page ? found(page) : null;
}

/** Two years' cars on track, newest first: action before cars in the pits or on show. */
async function carPhotos(raceName: string, seasons: number[], signal?: AbortSignal): Promise<Photo[]> {
  const yearOf = (p: Photo) => Number(p.categories.find((c) => /^\d{4} /.test(c) && c.endsWith(` ${raceName}`))?.slice(0, 4) ?? 0);
  let shots: Photo[] = [];
  // The newest years first; older ones only while there are few.
  for (let i = 0; i < Math.min(seasons.length, YEARS_PER_SEARCH * 2) && shots.length < PER_SET * 3; i += YEARS_PER_SEARCH) {
    const years = seasons.slice(i, i + YEARS_PER_SEARCH);
    const found = await searchCommons(`incategory:"${years.map((y) => `${y} ${raceName}`).join('|')}"`, 50, signal);
    shots = unique([...shots, ...found.filter((p) => isF1Shot(p.categories))]);
  }
  // Racing first: not in the pits or on show, and not of the people around the car (a visit's photos
  // are filed under every car in the garage they toured). A driver's year ("Max Verstappen in 2023")
  // is no sign either way: Commons files many racing shots under it too.
  const racing = (p: Photo) => Number(!mentions(p, OFF_TRACK) && !mentions(p, PEOPLE) && !VISIT.test(p.caption));
  const wide = (p: Photo) => Number(p.width > p.height);
  const order = oneOfEach(shots)
    .map((photo, i) => ({ photo, i }))
    // Newest first; within a year, a car on track makes a wide photo, a tall one is usually someone beside it.
    .sort((a, b) => racing(b.photo) - racing(a.photo) || yearOf(b.photo) - yearOf(a.photo) || wide(b.photo) - wide(a.photo) || a.i - b.i)
    .map((r) => r.photo);
  // A shot that may not be racing only fills in, and only once: two would be a garage tour.
  const picks = [...varied(order.filter((p) => racing(p)), yearOf, PER_SET * 2), ...order.filter((p) => !racing(p)).slice(0, 1)];
  return picks.map((p) => ({ ...p, caption: carCaption(p, yearOf(p), raceName) }));
}

/** The circuit itself, from the first of its articles to have enough photos of it. */
async function trackPhotos(articles: string[], signal?: AbortSignal): Promise<Photo[]> {
  let found: Photo[] = [];
  for (const article of articles) {
    found = unique([...found, ...(await circuitPhotos(article, signal))]);
    if (found.length >= PER_SET) break;
  }
  return found;
}

/** A circuit's photos from its Wikipedia article and the newest in its Commons category. */
async function circuitPhotos(article: string, signal?: AbortSignal): Promise<Photo[]> {
  const page = await lookUp(article, signal);
  if (!page) return [];
  const [shown, filed] = await Promise.all([photosInArticle(page.title, signal), photosInCategory(commonsCategory(page.title, page.iwlinks ?? []), signal)]);
  const chosen = new Set(shown.map((p) => p.page));
  const names = nameWords(page.title);
  // A grandstand's uploader may describe the motorbike race that day: the file's name says what it shows.
  return ranked([...shown, ...filed], (p) => trackScore(p, chosen.has(p.page), names)).map((p) => (RACING.test(p.caption) ? { ...p, caption: nameOf(p.title) } : p));
}

/** The photos at the top of a Wikipedia article (its infobox included), in the order shown, that pass `keep`. */
async function topPhotos(title: string, keep: (p: Photo) => boolean, signal?: AbortSignal): Promise<Photo[]> {
  const top = await getJson<{ parse?: { images?: string[] } }>(wiki(WIKIPEDIA, { action: 'parse', page: title, prop: 'images', section: 0, redirects: 1 }), signal);
  const names = (top.parse?.images ?? []).map(fileKey).filter((name) => /\.(jpe?g|webp)$/i.test(name)).slice(0, 12);
  if (names.length === 0) return [];
  const order = new Map(names.map((name, i) => [name, i]));
  return (await photosFrom(WIKIPEDIA, { titles: names.map((name) => `File:${name}`).join('|') }, signal))
    .filter((p) => !isF1Shot(p.categories) && !p.categories.some((c) => PERSON_YEAR.test(c)) && keep(p))
    .sort((a, b) => (order.get(a.title) ?? 0) - (order.get(b.title) ?? 0));
}

/**
 * The town: the photos at the top of its Wikipedia article (its skyline and landmarks), in order.
 * A small town's top has one photo or none; then the rest of its article and its Commons category.
 */
async function townPhotos(place: Place, count: number, signal?: AbortSignal): Promise<Photo[]> {
  const town = await findPlace(place, 'town', signal);
  if (!town) return [];
  const lead = await topPhotos(town.title, (p) => !mentions(p, AT_THE_RACE) && !mentions(p, INDOORS) && !INDOORS.test(p.caption), signal);
  if (lead.length >= count) return lead;
  const [shown, filed] = await Promise.all([photosInArticle(town.title, signal), photosInCategory(town.category, signal)]);
  const chosen = new Set(shown.map((p) => p.page));
  return unique([...lead, ...ranked([...shown, ...filed], (p) => townScore(p, place.name, chosen.has(p.page)))]);
}

/**
 * The arena: the photos at the top of its Wikipedia article (usually the building from outside),
 * then the best of the rest of its article and its Commons category. Shows on its floor (concerts,
 * games, fights) and the people at them are left out.
 */
async function venuePhotos(venue: Place, signal?: AbortSignal): Promise<Photo[]> {
  const arena = await findPlace(venue, 'venue', signal);
  if (!arena) return [];
  const [lead, shown, filed] = await Promise.all([
    topPhotos(arena.title, (p) => !mentions(p, PEOPLE) && !mentions(p, SHOW) && !VISIT.test(p.caption), signal),
    photosInArticle(arena.title, signal),
    photosInCategory(arena.category, signal),
  ]);
  const chosen = new Set(shown.map((p) => p.page));
  const town = new Set(wordsOf(venue.city ?? ''));
  const names = [...new Set([venue.name, ...(venue.aliases ?? []), arena.title].flatMap(nameWords))].filter((w) => !town.has(w));
  const best = ranked([...shown, ...filed], (p) => venueScore(p, chosen.has(p.page), names, arena.category));
  // One photographer at a time: a visitor's shots of an arena are often near twins.
  return unique([...lead, ...varied(best, (p) => p.author, best.length)]);
}

/**
 * An event's photos, in sets. A Grand Prix: two of cars on track (two different years), two of the
 * circuit and two of the town it's in. A fight night: three of its arena and three of its city.
 */
export async function fetchGallery(sources: GallerySources, signal?: AbortSignal): Promise<GalleryPhoto[]> {
  if (sources.sport === 'f1') {
    const { circuit, place } = sources;
    const sets = await Promise.allSettled([
      carPhotos(sources.raceName, sources.seasons, signal),
      trackPhotos(circuit.articles, signal).then((photos) => captioned(photos, () => circuit.name)),
      townPhotos(place, PER_SET, signal).then((photos) => captioned(photos, () => place.name)),
    ]);
    // A set that didn't load is left out; only when none did is it an error.
    if (sets.every((s) => s.status === 'rejected')) throw (sets[0] as PromiseRejectedResult).reason;
    const groups = ['On track', circuit.name, place.name];
    return gather(sets.map((set, i) => ({ group: groups[i], photos: set.status === 'fulfilled' ? set.value : [], count: PER_SET })));
  }
  const { venue, place } = sources;
  const sets = await Promise.allSettled([
    venuePhotos(venue, signal).then((photos) => captioned(photos, () => venue.name)),
    townPhotos(place, PER_FIGHT_SET, signal).then((photos) => captioned(photos, () => place.name)),
  ]);
  if (sets.every((s) => s.status === 'rejected')) throw (sets[0] as PromiseRejectedResult).reason;
  const groups = [venue.name, place.name];
  return gather(sets.map((set, i) => ({ group: groups[i], photos: set.status === 'fulfilled' ? set.value : [], count: PER_FIGHT_SET })));
}
