# GameTime for desktop

Every F1 session and UFC card in your time, on a big screen, with wake-up calls that ring your
phone. Same account, same alarms and the same server as the GameTime phone app.

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
```

`.env.local` holds the two public Supabase values (git ignores it; `.env.example` shows the shape):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Checks, before calling anything done:

```bash
npm run typecheck  # TypeScript 7 (tsc -b)
npm run lint       # oxlint
npm test           # vitest: time and night, week grid, alarms and chimes, arenas, history and photos
npm run build      # production build into dist/
npm run preview    # serve the build
```

It installs as a desktop app from Chrome or Edge (Install app in the address bar), thanks to the
web app manifest in `public/`.

## What it does

| Page | What's on it |
|---|---|
| **Up next** | The next session's venue in 3D, flown into from space on first open. Its start in your time in dial numerals, the venue's own clock, a rolling countdown, and **Set wake-up call**. Below: **Your week**, a chronograph of the next seven days on your clock with your night shaded, then **Coming up** with what you follow beside it. |
| **Event** | The venue in interactive 3D (drag to turn, Ctrl or ⌘ + scroll to zoom). F1: the racing line glows gold and a car laps it; the circuit drawn north up; race-day weather hour by hour. UFC: the arena's own building in gold; the fight card. Every session in your time and the venue's, and the start "three ways" (you, the venue, UTC). Then the background: for a Grand Prix, a short read of who wins there, the race's story and every winner; for a fight night, the fighters' stories and numbers. Last, photos filling the window as tall panels, evenly shared until you point at one: for a Grand Prix two each of cars on track, the circuit and its town; for a fight night, three each of the arena and its city. Each is credited, and opens larger. |
| **Season** | A turning night globe with a gold point at every venue still to come. Point at an event in the list to fly there. |
| **Alarms** | The next wake-up on the dial, every alarm with its ring time, lead time you can change in place, cancel with undo, restore, remove. |
| **Settings** | Account and phone number, **Your night** on a 24-hour dial you drag, time zone, 12/24-hour clock, temperature, sports and sessions, default lead time, **Chime on this computer**, theme (Automatic, By start time, Midnight or Porcelain), map orbit. |

Keyboard: **⌘K / Ctrl K** or **/** searches events and sessions (Enter on a session opens its
wake-up), **G then U / S / A** goes to Up next, Season, Alarms, **,** opens Settings, **N** sets a
wake-up for the next session, **?** lists the shortcuts.

## How it connects

The server owns alarms and enforces Premium, exactly as for the phone app:

- Events: `list_events(p_sport)` (public).
- Sign-in: Supabase Auth email one-time code (`signInWithOtp`, then `verifyOtp`).
- Account and alarms: `get_account`, `list_alarms`, `create_alarm`, `cancel_alarm`,
  `update_alarm_lead`, `restore_alarm`, `remove_alarm`.
- Phone number: the `phone-verify` Edge Function (Twilio Verify).

Alarms you set here are stored by the server, which calls or notifies your phone at the ring
time, even with this computer off. Buying Premium happens in the phone app; its plan shows here
right away.

**Chime on this computer** (Settings, off by default) is an extra on top of the phone: while a
GameTime tab is open, the computer plays a soft two-note chime (synthesized with Web Audio, like
the gongs of a minute-repeater watch) and shows a notification at each ring time. It only reads
your alarms, never creates or confirms one. It rings up to two minutes late (a computer waking
from sleep), never twice for the same alarm, and only once with several tabs open (Web Locks).
Browsers allow the sound only after you've clicked on the page once; without that, the
notification uses the computer's own sound.

## Where the map comes from

All keyless and open:

- **Tiles:** [OpenFreeMap](https://openfreemap.org) (OpenMapTiles schema, OpenStreetMap data),
  drawn by [MapLibre GL JS](https://maplibre.org) 6 with a custom style in
  `src/components/map/style.ts`: one neutral (the city in midnight steel, or white porcelain clay)
  and one vibrant (champagne gold, only for the venue).
- **Racing lines:** [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT).
- **Arenas:** the backend knows only the city for UFC venues, so
  [Photon](https://photon.komoot.io) finds the arena by name near that city (Wikidata when Photon
  doesn't know it), and the [OpenStreetMap API](https://wiki.openstreetmap.org/wiki/API_v0.6)
  gives its outline. The map then picks the arena's own building out of the buildings it already
  draws and lights it in gold piece by piece, at its real heights (a roof that steps up, a tower
  on a podium), including pieces the map tiles cut in two (`src/lib/venue-parts.ts`). An arena
  the map only knows as 5 m tall (no height in OpenStreetMap) rises to a typical arena roof.
  Lookups are cached in the browser. When the map has no building at the spot, a dashed gold
  ring marks it; when the arena can't be found at all, the map shows the city and says so.
- **Weather:** [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
- **An event's background:** who has won at a circuit from the [Jolpica](https://jolpi.ca) Formula 1
  archive; a race's story and the fighters' from Wikipedia (CC BY-SA 4.0, credited where shown);
  photos from Wikimedia Commons, freely licensed only and each credited to its author
  (`src/data/history.ts`). A Grand Prix's photos come in three sets: cars filed under the race's
  own years; the circuit from its Wikipedia article and its Commons category (only photos that say
  they show the track: an aerial view, a corner, a grandstand); and the town from the top of its
  Wikipedia article (its skyline and landmarks), found near the venue when its name is shared.
  A fight night's come in two: the arena (found under any name it has had, from its article and
  its Commons category, without concerts, games or the people at them) and its city, as above.

## Built with

React 19, Vite 8, TypeScript 7, Tailwind CSS 4, TanStack Query, Zustand, React Router 7,
MapLibre GL JS 6, GSAP 3.15 (SplitText, ScrollTrigger), Anime.js 4 (SVG drawing, staggers),
Motion 14 (layout and presence), Lenis (smooth scrolling), cmdk (the search palette), date-fns-tz,
and the Archivo variable font (width axis for the wide headlines, ultralight for the numerals).

From [React Bits](https://reactbits.dev) (MIT + Commons Clause, vendored in
`src/components/bits/`): SpotlightCard (light on the dial card), Magnet (the main button),
ClickSpark (the gold burst when an alarm is set). A few keyframes follow
[Animista](https://animista.net) patterns. Spline isn't used: its scenes need an account and an
editor, and MapLibre already gives a real 3D model of every venue.

## Layout

```
src/
  app/          App, router, shell, theme, smooth scroll, keyboard shortcuts, the chime
  pages/        Up next, Event, Season, Alarms, Settings, not found, error
  components/
    shell/      the top bar and the footer
    map/        VenueMap (MapLibre), its style, how to frame each venue
    schedule/   Hero, week chronograph, Coming up, follow panel, alarm button
    event/      circuit drawing, weather, fight card, history, fighters, photos
    delft/      the painted line work and its traced pieces
    dialogs/    sign in, wake-up call, phone, Premium, search, shortcuts
    settings/   the night dial, the chime switch
    ui/         buttons, pills, clocks, dialogs, rows, icons, toasts
    bits/       vendored React Bits components
  data/         Supabase client, API calls, public data (weather, circuits, arenas, history, photos), queries
  hooks/        the clock tick, element size, page title, reduced motion, schedule, screensaver
  lib/          pure logic: time and night window, schedule, week grid, alarms, chime timing, geo, venue buildings
  stores/       preferences, session, open dialog
  styles/       tokens and global CSS
```

See `DESIGN.md` for the design rules.
