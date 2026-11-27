# GameTime desktop: handoff

Everything about the GameTime desktop app, built 18 to 24 November 2026, so a new chat can carry on.

- `CLAUDE.md` has the rules for working here.
- This file has what was built, where it stands and what's next.
- `README.md` has the features, the data sources and the file layout.
- `DESIGN.md` has the design rules.

## What it is

- The desktop version of GameTime. It shows every F1 session and UFC card in your own time on a big screen, and sets wake-up calls that ring your phone.
- It uses the same account, alarms and Supabase server as the phone app. The phone app is Expo and lives in `C:\projects\Programming\gametime` and in the team repo (`apps/mobile`).
- It's a web app (React), so it runs in a browser and installs as a desktop app from Chrome or Edge with "Install app" (it has a manifest and icons).
- The user asked for a desktop version "optimized for desktop use but still calls the phone". It can use more computing power than the phone app for smooth animations and 3D maps.

## Where things are

| What | Where |
|---|---|
| Code | `C:\projects\Programming\gametime-desktop` (git, branch `main`) |
| GitHub | `github.com/AnayKr15hn4/GT_Desk`, branch `main` |
| Team copy | Team repo `AmoghRB/gametime`, folder `apps/desktop`, branch `desktop/app`. The local clone is `C:\projects\Programming\gametime-team-desktop`. Pull request #7 merged the first version of `desktop/app` into the team's `main` on 19 Nov. The `desktop/app` commits since then (7 of them, 19 to 25 Nov, checked 27 Nov) still need a new pull request. Open one at `github.com/AmoghRB/gametime/pull/new/desktop/app` when the user wants. |
| Live site | `https://gt-desk.vercel.app`. Vercel deploys it from GT_Desk on every push. The two Supabase values are set in Vercel as environment variables. |
| Secrets | `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key). Git ignores it. Never commit it or copy its values into docs. |
| Dev server configs | `.claude/launch.json`: `gametime-desktop` (dev, port 5180) and `gametime-desktop-preview` (the production build, port 5181; run `npm run build` first) |

## Where it stands (27 November 2026)

- **Last commit:** `c4981e5` "Event history, fighters, photo panels and a footer" (25 Nov). GT_Desk `main` and the team's `desktop/app` both have it, and the live site deploys from it.
  - It added the event background (history, fighters, photo panels), the footer, `CLAUDE.md`, this file and `.claude/launch.json`.
- **After it, a tidy-up (27 Nov):** no change to what the app does or how it looks.
  - Removed unused code: helpers, a hook, a component, five icons, a button style, some CSS and the `jsdom` dev dependency.
  - Fixed comments that no longer matched the code, and brought `DESIGN.md`, `README.md` and this file up to date.
  - If `git status` still shows it, it isn't shipped yet: `bash scripts/ship.sh "Tidy code and docs"`. Only do this when the user says so.
- **Checks:** typecheck, lint, all 81 tests (7 files) and the build pass.
- **Git stashes:** two hold work that was taken out (see the line art section).
- **Team clone:** it had an untracked `package-lock.json` at its root (seen 24 Nov). ship.sh only adds `apps/desktop`, so it never gets committed.

## Built with

- React 19, Vite 8, TypeScript 7, Tailwind CSS 4, TanStack Query, Zustand and React Router 7.
- MapLibre GL 6 with OpenFreeMap tiles.
- GSAP (SplitText), Anime.js 4, Motion, Lenis, cmdk and the Archivo variable font.
- React Bits components, vendored in `src/components/bits/`.

## How it talks to the server

- **Events:** `list_events` (public).
- **Sign-in:** a Supabase Auth email one-time code (`signInWithOtp`, then `verifyOtp`).
- **Account and alarms:** the RPCs `get_account`, `list_alarms`, `create_alarm`, `cancel_alarm`, `update_alarm_lead`, `restore_alarm` and `remove_alarm`, in `src/data/api.ts`.
- **Phone number:** the `phone-verify` Edge Function (Twilio Verify). Text codes are waiting on a Twilio upgrade.
- **Alarms and Premium:** the server owns alarms and enforces Premium, and it rings the phone at the ring time even with the computer off. Premium is bought in the phone app; the desktop only shows the plan.
- **Changes to the server:** any change to these RPCs affects the phone app too.

## Pages and features

- **Up next**
  - A hero with the next venue in 3D. On first open the camera flies down from space.
  - The dial card shows the start in your time, the venue's clock and a rolling countdown, with "Set wake-up call".
  - Below that: "Your week" (a seven-day chronograph with your night shaded) and "Coming up".
- **Event page**
  - The venue in interactive 3D. F1 shows a gold racing line with a car lapping it. UFC lights the arena's own building in gold.
  - A sessions panel, and the start shown "three ways" (you, the venue, UTC).
  - F1: the circuit outline, its facts and race-day weather. UFC: the fight card.
  - Then the history, the fighters and the photos (see "Latest work").
- **Season:** a night globe with a gold point at each venue still to come.
- **Alarms:** change the lead time, cancel with undo, restore and remove.
- **Settings**
  - Account and phone, the night dial, time zone, 12 or 24-hour clock, temperature, sports and sessions, and the default lead time.
  - "Chime on this computer". While a GameTime tab is open, it plays a soft two-note chime and shows a notification at each ring time. It never rings twice, even with several tabs open.
  - Theme: Automatic (follows the computer), By start time, Midnight or Porcelain. "By start time" switches to Midnight when the next session starts in your night hours, and to Porcelain otherwise.
  - Map orbit.
- **Search and shortcuts**
  - Ctrl K or `/` searches.
  - G then U, S or A changes page.
  - N sets the next wake-up.
  - `?` lists the shortcuts.
- **Screensaver:** on Up next, after 7 seconds without moving at the top of the page, everything fades except the event name, the clock and the logo.
  - It works by putting `data-idle-hide` on wrappers, never on elements a GSAP intro animates.
- **Footer:** on every page (see "Latest work").
- **Hosting fixes:** PWA icons, `public/_redirects` and `vercel.json` rewrites, so every page link works on a static host.

## The line art (Delft style)

- **Porcelain (light theme):** thin Delft-blue lines that draw themselves, hold, then erase.
  - Vines sit beside page titles and as dividers.
  - The Up next hero alternates a big rose and a peony.
  - On an F1 weekend it starts with a flower, then alternates it with a traced drawing of the race winner standing on the car (`traced/celebration.ts`).
  - UFC weekends show flowers only. `traced/champion.ts` is kept but not used.
- **Midnight (dark theme):**
  - A blue jay taking off and a hummingbird at flowers (mirrored), both in one pale blue (`#9db1ee`).
  - On an F1 weekend they alternate with Charles Leclerc pulling on his gloves, traced in red and white to match his suit and helmet.
- **Where it's set up:** `src/components/delft/Delft.tsx`.
  - `SCENES` holds Porcelain's per-sport scene.
  - `NIGHT_SCENES` holds Leclerc, with `pad: 310` (how far in from the left).
  - `NIGHT_PIECES` holds the jay (`pad: 260`) and the hummingbird (no pad).
  - Each piece fades out across its right side.
  - Drawing starts once the camera has landed.
- **The tracer:** `scripts/trace-line-art.py` turns a coloring-page drawing into strokes.
  - Presets: `f1-celebration`, `ufc-champion`, `f1-leclerc`, `night-jay` and `night-hummingbird`.
  - `--colours=photo.jpg` gives each stroke the colour it runs over in the original photo.
  - The preset options `flip` and `trim` mirror a drawing and cut its empty left margin.
- **Tried and removed:**
  - a Daytona-style watch face
  - an x-ray effect
  - star trails
  - kintsugi
  - moonlight on the map
  - landmark art and lit windows: the user asked to "remove all art from dark mode", and later asked for the birds and Leclerc.
- **Saved in git stashes, not in the app:**
  - `stash@{0}`: lit windows on Midnight's map buildings.
  - `stash@{1}`: landmark line art for 75 cities.

## Latest work: event background, photos and footer (shipped 25 Nov in `c4981e5`)

This is for the desktop app only. Each event page has more sections after the circuit or fight card.

### F1: "The history"

- A short read of the circuit's winners: how many races, who has won most, the top team, and any winning streak.
- The race's Wikipedia introduction, with a "Read the rest" button and a CC BY-SA credit.
- "Most wins here" bars, with the leader in gold.
- "Every winner here", showing 8 then "Show all".

### UFC: "The fighters"

This covers the main event only. The user asked to remove "Also on the main card".

- **The face-off card:** one card in a Revolut style (the user asked for Revolut as inspiration).
  - Each fighter's photo runs off their side of the card and fades toward the middle.
  - Their name sits big and white over the photo, with a frosted country chip.
  - Between them: pills (Main event, weight class, rounds, title fight) and a tale of the tape (Record, Fights won %, Age) in big light numerals. It's a real table for screen readers.
  - On a phone, the photos sit side by side with the numbers underneath.
- **Under the card:** each fighter's story as plain text (two paragraphs, a Wikipedia link, the photo credit).
- **Missing fighters:** a fighter without a Wikipedia article still gets their side of the card (placeholder photo, ESPN record). The section hides only if neither has an article.

### Photos (both sports): a full-window panel gallery

The user asked for the CodeFronts "flexbox expanding panel gallery" look.

- **Layout**
  - It's the last section of the event page, outside the page column: edge to edge, the full height of the window (`h-[100svh]`).
  - Each set's name runs up the side of its first panel.
  - The "Photos" title sits over the photos on wide windows, and above them on narrow ones (where the panels become stacked bands).
  - The line under the title follows what was found ("The circuit and Lusail." when there are no cars, "Riyadh." when the arena has none).
- **How the panels behave**
  - Tall panels share the row evenly when the mouse isn't over them (the user asked for this).
  - Pointing at a panel (or tabbing to it) opens it to 5 times the width, with its set, caption and credit. Leaving puts them back to even.
  - A tap on a touch screen opens a panel. Clicking the open one shows the whole photo in the viewer, with arrow keys, the author and the licence.
- **F1: two each of cars on track, the circuit, and the town.** The user asked for 2/2/2. The code is in `src/data/history.ts`, `fetchGallery`.
  - **Cars:**
    - How Commons files them: each year's race in a category like "2024 British Grand Prix", and each car as "McLaren MCL38 of Lando Norris".
    - It searches the race's own years and keeps photos filed under a car, from two different years, newest first. Captions come from the car category.
    - Racing comes first. Garage shots, pit lanes and photos from a visit (captions naming officials) can fill only one slot. Las Vegas 2025 is mostly a government visit's photos.
  - **Circuit:**
    - Where photos come from: the circuit's Wikipedia article, plus the newest in its Commons category (found from the article's Commons link; Albert Park's is "Melbourne Grand Prix Circuit").
    - Only photos that say they show the track count:
      - an aerial view
      - a corner
      - a grandstand, also in local words like "Luftaufnahme" or "raidillon"
      - an article photo naming a street circuit's place
    - Cars, people, other series (MotoGP and so on) and food stalls are left out.
    - If the archive's link has none (Las Vegas links the race article), the venue's own name is tried.
  - **Town:**
    - It reads the town's Wikipedia article. A shared name like "Spa" or "Austin" is looked up near the venue's coordinates.
    - It takes the photos at the top of the article in order (the skyline and landmarks).
    - Small towns fall back to the rest of the article and the town's Commons category.
    - Indoor shots and racing photos are left out.
  - **Checked in Chrome:** Abu Dhabi, Qatar (no cars on Commons, so 3 photos), Spa, Austria, Monaco, Monza, Singapore, Mexico City, Las Vegas, Melbourne and Zandvoort.
- **UFC: three photos of the arena and three of its city.** The user asked to drop the fighters' photos, then said the place means the arena and the city. The fighters keep their portraits on the face-off card.
  - **Finding the arena:** by its name and any old one (`venueAliases` in `src/data/external.ts`; Meta APEX is the "UFC Apex" article), then by a search near the venue.
  - **Which arena photos:**
    - The order: photos from the top of its Wikipedia article (usually the building from outside), then its article and Commons category, scored by `venueScore`.
    - A photo has to be filed under the arena or named for it, not the stadium next door.
    - It has to show the building: a front, an entrance, the bowl or an aerial view.
    - No concerts, games, fights or people.
    - One photographer at a time.
  - **City:** the same as an F1 town.
  - **Checked:**
    - T-Mobile Arena and American Airlines Center.
    - Scotiabank Arena.
    - Rocket Arena (photos under its old names).
    - Kia Center (old "Amway Center" photos).
    - Afterpay Arena (the Sydney SuperDome).
    - ANB Arena in Riyadh and Meta APEX have no free photos, so those pages show only the city.
- **Every photo:** no maps, logos, flags, satellite views, posters, diagrams, paintings or old prints, by name or category.

### The footer

It's on every page (`src/components/shell/Footer.tsx`, rendered in `Shell.tsx`). The user asked for a modern clean one, then for the look of a reference with large oversized text at the bottom.

- **Layout:** a screen of its own on the deepest canvas tone.
  - **Top left:** "Sleep easy. We'll call you." in big light type, with two outlined pills:
    - "Set the next wake-up call", or "See the season" when nothing's next
    - "Search events" with Ctrl K
  - **Top right:** the pages listed large, plus Keyboard shortcuts.
- **The wordmark:** "GameTime" runs huge across the whole window at the bottom, 8 px from each edge. The user asked for it larger, "almost overflowing off the screen", with the letters pressing against each other and the edges.
  - It's heavy (800), normal width and tightly spaced (-0.05em).
  - Its font size is the window's width over the word's measured width (`WORDMARK_WIDTH`, 5.11). Measure again if its font, weight, width or spacing changes.
- **Small print:** under the wordmark, on one line:
  - "© 2026 GameTime"
  - "Data from" with each source linked
  - "Not affiliated with Formula 1 or the UFC."
  - a small theme chip that steps through the four themes

### Data and files

- **Data:** the Jolpica F1 API (winners), the Wikipedia API (stories, ages, photos) and the Wikimedia Commons API (gallery). None need keys, and all work straight from the browser. Results are cached for a day.
- **Files**
  - `src/data/history.ts` (fetching and the pure helpers) and `src/data/history.test.ts`.
  - Hooks in `src/data/queries.ts`: `useF1History`, `useFighterProfiles` and `useEventPhotos`.
  - Components in `src/components/event/`: `History.tsx`, `Fighters.tsx` and `Gallery.tsx` (the panels and the viewer).
  - `ExternalLink` and `LoadError` in `src/components/ui/misc.tsx`, and a `photo` icon in `Icon.tsx`.
  - Wired into `src/pages/Event.tsx`.
- **Checked:** in Chrome in both themes, and at phone width in the built-in browser.

### Known limits

- Photos depend on what's on Commons.
  - Qatar has no F1 race categories, and Lusail's circuit category is nearly all MotoGP, so its page shows one track photo and two of Lusail.
  - Las Vegas only has 2025 car photos, nearly all from one government visit, so it shows one car.
  - Small towns (Silverstone, Sakhir) have few photos of their own, so the town set can be short.
  - Some arenas (ANB Arena, Meta APEX) have no free photos, so their pages show only the city.

## How the photo search works (for changing it)

- **The API calls.** Everything is keyless, from the browser, with `origin=*` and `formatversion=2`.
  - **Commons category:** Wikipedia `prop=iwlinks&iwprefix=commons` gives an article's Commons category. `pageprops` flags disambiguation pages, and `coordinates` gives the place.
  - **Lead photos:** `action=parse&prop=images&section=0` lists the photos at the top of an article, in order.
  - **Places with shared names:** a search with `nearcoord:80km,lat,lon` plus `intitle:"Name"` (towns) or a phrase (venues) finds the right one.
  - **Newest files:** Commons `generator=categorymembers` with `gcmnamespace=6`, `gcmsort=timestamp`, `gcmdir=desc` and `gcmlimit=50`. `gcmtype=file` is ignored when sorting by timestamp, so use the namespace.
  - **Photo details:** `imageinfo` scales at most 50 files per request. Its `extmetadata` Categories include Quality, Featured and Valued images, which score higher.
- **Scoring:** in `src/data/history.ts`.
  - `trackScore`, `townScore` and `venueScore` score each photo.
  - `ranked` takes one of each and puts the other hand second.
  - `varied` takes one per year or per photographer first.
  - Word lists (regexes) decide what counts as racing, people, officials' visits, amenities, indoors, track parts (in several languages), aerial views and arenas.
- **Which files count as photos:** `photoFrom` keeps only JPEG and WebP photos at least 640×400. It drops maps, logos, flags, posters, diagrams, paintings, engravings, old prints, postcards and black-and-white photos.
- **Testing calls by hand:** Wikipedia and Wikidata rate-limit Python's user agent (429), so try API calls with `fetch` in the browser console.
- **"local" or "shared":** files from the Commons API come back as imagerepository "local". Only through Wikipedia's API are Commons files "shared".
- **To check a change, open several event pages:**
  - F1: the circuits listed above.
  - UFC: T-Mobile Arena, American Airlines Center, Scotiabank Arena, Rocket Arena, Kia Center, Sydney, Riyadh and Meta APEX.

## Decisions made

- **A web app, not an installer, for now.** The user asked on 18 and 24 Nov whether a desktop app is different code from a web app.
  - **The answer:** about 95% of the code is the same. It stays a web app that installs from Chrome or Edge.
  - **What wrapping it would change:** Tauri (small, uses the system's own web view) or Electron (bundles Chrome) would add a shell folder and open links in the system browser.
  - **What it would add:** a tray icon, starting with the computer, a chime with the window closed, and always-on-top windows.
  - **What it would cost:** separate Windows and Mac installers, auto-updates and signing certificates (Apple's is $99 a year).
  - **Why it can wait:** wake-up calls ring the phone from the server, so the computer doesn't need to be on. Tauri can come later if the user wants the tray icon or start-with-computer.
- **Two homes for the code.** The user asked for every change to go to both:
  - GT_Desk is the user's own repo.
  - The team repo gets a copy under `apps/desktop` on `desktop/app`.
  - `scripts/ship.sh` does both.
- **UFC photos show the arena and the city, not the fighters.** The fighters keep their portraits on the face-off card.

## What's next

1. **Ship the tidy-up** if it's still uncommitted, when the user asks.
2. **Pick the next feature.** These were offered on 24 Nov, and the user hasn't chosen yet:
   - **A pop-out countdown (the top pick):** a small always-on-top window with the next session's countdown, using the Document Picture-in-Picture API. It works in Chrome and Edge, including the installed app.
   - **Results with a spoiler shield:** results after a session, hidden until you choose to see them.
   - **"Add to calendar"** for a session.
   - **F1 standings and UFC rankings.**
   - **A full real-alarm test** from the desktop to the phone.
3. **Open a new team pull request** for the `desktop/app` commits since #7, when the user wants.
