# GameTime desktop

The desktop web app for GameTime: every F1 session and UFC card in your time, with wake-up calls that ring your phone. It shares its Supabase backend, account and alarms with the phone app (Expo, in `C:\projects\Programming\gametime` and the team repo).

- `HANDOFF.md`: what's been built, where it stands and what's next. Read it first in a new chat.
- `README.md`: features, data sources and the file layout.
- `DESIGN.md`: the design rules.

## Commands

```bash
npm run dev         # http://localhost:5180 (or the gametime-desktop config in .claude/launch.json)
npm run typecheck   # TypeScript 7 (tsc -b)
npm run lint        # oxlint
npm test            # vitest
npm run build       # into dist/; the gametime-desktop-preview config serves it on 5181
```

Run typecheck, lint, test and build before calling anything done.

## Checking it in a browser

- **Visuals:** check them in Claude in Chrome on localhost. The user's Chrome window is 1280×665, a good short-laptop size.
- **The built-in browser pane:** it's small and usually hidden. While hidden it pauses requestAnimationFrame and ResizeObserver, so the 3D maps and lazy-loaded photos never appear there.
  - Use it for phone-width emulation and JavaScript layout checks.
  - Its notifications are denied, so the desktop chime only shows its in-page toast there.
- **Frame rates:** measure them with the chrome-devtools MCP against `vite preview` (port 5181). Call `select_page` with `bringToFront` first, because a covered Chrome window drops to about 1 fps. The screen is 120 Hz.

## Shipping

- Commit or push only when the user asks. Then run `bash scripts/ship.sh "What changed"`.
- **What ship.sh does:**
  1. Runs `git add -A`, commits, and pushes GT_Desk `main`. Vercel then deploys gt-desk.vercel.app.
  2. Copies this folder into `../gametime-team-desktop/apps/desktop`. It skips node_modules, dist, `*.local`, .git, package-lock.json, CLAUDE.md, HANDOFF.md and `.claude/`.
  3. Pushes the team branch `desktop/app`.
- Because ship.sh adds and copies everything, keep scratch files out of this folder.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never commit `.env` or `.env.local`, and never put the Supabase values in docs.

## Rules

- **Copy:**
  - sentence case
  - no dashes or "A · B" strings
  - no arrows on buttons
  - buttons say what happens
  - errors say what happened and what to do
- **Look:**
  - gold only for what matters
  - wide Archivo for titles, light tabular numerals for times
  - glass only over the live map
- **Art and photos:** no brand logos in the art. Flag likeness or licence worries. Credit every photo with its author and licence.
- **Downloads:** ask before downloading files.
- **Explaining:** keep explanations simple and brief.

## Gotchas

- **MapLibre 6:** keep `optimizeDeps.exclude: ['maplibre-gl']` for dev, and `setWorkerUrl` with `maplibre-gl-worker.mjs?url` for production builds.
- **Driving app state from the console in dev:**
  - Import a store by the exact URL in `performance.getEntriesByType('resource')`. Vite adds `?t=` to modules changed since start, and a bare path loads a second copy.
  - To fake server data, patch `supabase().rest.fetch`, because supabase-js keeps its own fetch.
  - Reload afterwards.
- **Anime.js:** don't put `vector-effect: non-scaling-stroke` on paths it animates, because it then calls `getCTM()` every frame. Set `pathLength="1000"` and a hidden dash in the markup instead.
- **Screensaver:** `data-idle-hide` goes on wrappers, never on elements a GSAP intro animates.
- **Footer wordmark:** its size is the window width over `WORDMARK_WIDTH` (5.11, measured). Measure again if its font, weight, width or spacing changes.
- **Wikipedia and Wikidata:** they rate-limit Python's user agent (429). Try their APIs with `fetch` in the browser instead. HANDOFF.md explains how the photo search works.
- **Design skills:** frontend-design, avoid-ai-design, taste-skill, ui-ux-pro-max, unslop-ui, minimalist-ui and redesign-existing-projects live in `C:\projects\Programming\gametime\.claude\skills\`. Read a skill's `SKILL.md` from there when it helps.
