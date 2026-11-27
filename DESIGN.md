# GameTime desktop design

The phone app's system (team repo `apps/mobile/DESIGN.md`) holds here too: a watch dial at night,
one champagne-gold accent, times as large ultralight tabular numerals, the venue's clock quietly
under yours, sentence case, capsules for anything pressed. This file adds what a big screen needs.

## The idea

**The venue is the photograph.** Revolut's site opens every section on a cinematic image with a
huge headline and one pill button over it. GameTime's equivalent is the place where the session
happens: a live 3D model of the circuit or arena, slowly orbiting. Every hero is a real place,
never a gradient.

**One neutral, one vibrant.** On the maps the city is a single neutral (midnight steel, or white
porcelain clay) and only the venue is vibrant: the racing line, the lapping car, the arena's
building, the season's points on the globe. All in champagne gold.

**Your time is loud, theirs is quiet.** The GMT reading from the phone, larger: mega numerals for
your start, the venue's time and the hour difference beside it, and on the event page the same
start three ways (you, the venue, UTC).

## Tokens

| Role | Midnight | Porcelain |
|---|---|---|
| canvas | `#0B1220` | `#F3F4F6` |
| surface / raised | `#121B2D` / `#19243A` | `#FFFFFF` / `#ECEEF2` |
| ink / 2 / 3 | `#EEF1F6` / `#A9B2C3` / `#8590A5` | `#0F1726` / `#4A5466` / `#5D6679` |
| gold (accent) | `#D4B67A` | `#7F6127` (UI), `#B8913F` (map material) |
| primary button | gold | ink |
| dial | `#2A3D66 → #16233D → #0E1729`, with a sunray finish | `#FFFFFF → #F1F3F6 → #E5E8EE` |
| Delft line work | `#9DB1EE` (pale blue); `#FF4B3E` and `#EEF1F8` for Leclerc's red and white | `#23439A` (cobalt), hairlines only |

Map palettes live in `src/components/map/style.ts`; the gold on the map is a material, so on
Porcelain it is brighter than the gold used for text.

## Type

One family, **Archivo** (variable): its width axis gives two voices.

- Event names and page titles run **wide** (125% width, 680 weight, tight tracking).
- Times are **numerals**: 200 weight, tabular, slightly tight, with a small AM/PM.
- Everything else is Archivo at normal width.
- Labels are sentence case. No eyebrows in capitals.
- Sizes on the heroes follow both width and height (`clamp` with `vw` and `vh`), so the hero fits
  a 1280×665 laptop and still fills a 1440×900 or larger screen.

## Depth

Four layers, each a step closer:

1. The map (or the canvas).
2. Scrims that darken the map behind the copy.
3. Surfaces: hairline-edged groups, and glass panels where content floats over the live map.
4. The dial: one per screen, for the most important thing (the next session, the next alarm, the
   night setting, a dialog). Lit from the top centre with a fine sunray finish and a crystal rim;
   on Up next a soft light follows the pointer across it (React Bits SpotlightCard).

Shadows stay neutral. Glass appears only where something really floats over moving content, and
over a live map it's "still glass" (`glass-still`): the same tint and edge without the blur, which
would otherwise be worked out again every frame the map moves.

## Delft line work

Porcelain borrows from Delftware's blue painting, as thin cobalt lines and nothing else: no plates,
no fills, no patterns behind text. A vine grows from its root, leaves open off it on alternate
sides, tendrils curl, three dots now and then, a small rosette at the tip
(`src/components/delft/`). It holds for a while, fades the way it grew, and grows again in a
second shape. Midnight has line work too, but only in the hero, in its own colours.

- **Where:** beside the big titles on Settings, Alarms and the not-found and error pages, in the
  empty space to the right; and as a divider (a rosette with a vine growing out each side) between
  the week and the list on Up next, and between the times and the venue on an event page. These
  vines and dividers are Porcelain's only.
- **Porcelain's hero flowers:** on Up next, a large rose (then a peony) is painted on the light at
  the left of the hero, cropped by the edge, its stem down the margin beside the dial card, a bud
  above the headline and a leafy tendril running out into the map. It sits fainter than the other
  line work because it's behind the headline, and keeps out of the small lines of text.
- **Midnight's hero pieces:** a blue jay taking off (its head a little in from the left edge, its
  wings spread across to the map) and a hummingbird at ocotillo flowers (mirrored, so the flowers
  reach in from the left), both in one pale blue, with slightly stronger lines than Porcelain's.
- **A scene for Formula 1:** on an F1 weekend the two hero pieces take turns with a traced scene:
  a piece, the scene, the other piece, the scene again. Porcelain's scene is the winner standing
  on the car, fists up, in Delft blue. Midnight's is Charles Leclerc pulling on his gloves, set a
  little in from the left edge, each line red or white as his suit and helmet are in the photo
  the drawing was made from. UFC weekends have no scene: Porcelain shows its flowers and Midnight
  its birds. (`traced/champion.ts`, the champion with his belts, is kept but not shown.)
- **Traced pieces:** `scripts/trace-line-art.py` turns a coloring-page drawing into strokes, with
  its lettering and logos left out, painted outward from the head. Each tracing is its own small
  file, loaded only when it's shown. Adding a scene: a preset in the script and an entry in
  `SCENES` or `NIGHT_SCENES` (`src/components/delft/Delft.tsx`).
- **In the hero:** one piece at a time, each painted, held and lifted before the next, and the
  first starts as the camera lands. Each sits against the left edge or a little in from it
  (nothing looks cut off when the dial card lifts away on scroll) and fades out across its own
  right side before its edge. Wide windows only.
- Never on the map itself, and never over a control.
- **How it reads:** strokes are 1.1 px outlines at about two-thirds strength, 0.75 px veins and
  dots fainter still, so they sit back from the ink.
- **Motion:** each stroke starts as the growing tip reaches it (Anime.js drawables on one
  timeline). The vines and dividers go round for ever; each hero piece plays once and hands over
  to the next. Off screen it waits. With reduced motion it's simply drawn.

## Motion

- **One orchestrated moment.** On first open the camera starts in space and comes down to the next
  venue while the headline rises line by line (GSAP SplitText) and the buildings grow out of the
  ground.
- **Ambient, slow, stoppable.** The map orbits the venue at 2.4° a second, and a car laps the
  circuit; the orbit stops the moment you touch the map and resumes a few seconds later. Settings
  can turn the orbit off.
- **Motion that answers you.** The nav mark and pill selections slide (Motion); the countdown
  rolls only the digits that change; dialogs rise in; the week's sessions fill in once when you
  first scroll to them (Anime.js); the circuit draws itself in gold (Anime.js SVG); setting an
  alarm is the one celebration (the check settles with a spring and a small gold spark).
- **Cheap to run.** The orbit and the lap move the camera at most 60 times a second and stop
  when the map is off screen; line work updates at most 60 times a second and pauses off screen;
  nothing over the map blurs.
- **Reduced motion.** With the computer's reduced-motion setting, the camera jumps instead of
  flying, nothing orbits or laps, smooth scrolling is off and every transition is instant.
- **Screensaver.** On Up next, after 7 still seconds at the top of the page, everything marked
  `data-idle-hide` fades out (cards, chips, nav, search) and the cursor hides, leaving the event
  name, the clock and the logo over the map; any mouse, key, scroll or touch brings it back.
  Put `data-idle-hide` on a wrapper, never on an element a GSAP intro animates: a `.from()` reads
  the element's own styles to know where to finish, and the fade there leaves it stuck halfway.

## Photos and the foot of the page

- **The photos close an event page the way the map opens it:** edge to edge, the full height of
  the window. They're a row of tall panels sharing it evenly; the one you point at (or tab to)
  opens to five times the width, lights up and shows its set, caption and credit, and the
  others sit back in the dark. Each set names itself up the side of its first panel. Clicking
  the open panel shows the whole photo. On a narrow window the panels become bands, one above
  the other, and the title moves above them.
- **The footer** is a screen of its own on the deepest tone of the canvas: a big light line
  ("Sleep easy. We'll call you.") with the two main actions as outlined pills, the pages listed
  large on the right, and "GameTime" set huge across the bottom, past the page's margins to 8 px
  from each edge of the window, as if about to run off it. It's the one place the name runs at
  normal width (heavy, tight), so it stands as tall as the window's width allows. Its font size is
  the window's width over the word's measured width (`WORDMARK_WIDTH` in `Footer.tsx`); change its
  type and measure again. Under it, one line of small print:
  the year, where the data comes from (each linked), that it isn't affiliated, and a theme chip
  that steps through the themes. No gold: nothing in it needs attention.

## Copy

Same rules as the phone: buttons say what happens ("Set wake-up call"), errors say what happened
and what to do, no dashes or "A · B" strings, no arrows stapled to buttons.
