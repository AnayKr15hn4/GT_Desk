import { useGSAP } from '@gsap/react';
import clsx from 'clsx';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useResolvedTheme } from '@/app/theme';
import { DelftDivider } from '@/components/delft/Delft';
import { CircuitOutline } from '@/components/event/CircuitOutline';
import { FightCard } from '@/components/event/FightCard';
import { FighterBackgrounds } from '@/components/event/Fighters';
import { EventPhotos } from '@/components/event/Gallery';
import { RaceHistory } from '@/components/event/History';
import { WeatherReading } from '@/components/event/Weather';
import { WeatherStrip } from '@/components/event/WeatherStrip';
import { useVenueView } from '@/components/map/useVenueView';
import { VenueMap } from '@/components/map/VenueMap';
import { AlarmButton } from '@/components/schedule/AlarmButton';
import { Button, IconButton } from '@/components/ui/Button';
import { Clock } from '@/components/ui/Clock';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, SectionTitle, Skeleton, Tag } from '@/components/ui/misc';
import { useEvent } from '@/data/queries';
import { useElementSize } from '@/hooks/use-element-size';
import { useNow } from '@/hooks/use-now';
import { usePageTitle } from '@/hooks/use-page-title';
import { displayName } from '@/lib/names';
import { modKey } from '@/lib/platform';
import { groupByLocalDay, headlineSession, sessionState } from '@/lib/schedule';
import {
  formatClock,
  formatDayLabel,
  formatLongDate,
  formatUtcOffset,
  isOvernight,
  venueOffsetLine,
  venueTimeLine,
  zoneCity,
  zoneOffsetMinutes,
} from '@/lib/time';
import type { SportEvent } from '@/lib/types';
import { useClock, usePreferences } from '@/stores/preferences';
import { openSetAlarm } from '@/stores/ui';

gsap.registerPlugin(SplitText);

export function EventPage() {
  const { id } = useParams();
  const { event, isLoading } = useEvent(id);
  if (!event) {
    return (
      <div className="mx-auto max-w-[1680px] px-8 pt-36 pb-24">
        {isLoading ? (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-[640px]" />
          </div>
        ) : (
          <EmptyState icon="calendar" title="That event isn't on the schedule" action={<Link to="/" className="text-[14.5px] font-[600] text-gold">Back to Up next</Link>}>
            It may have finished, or the link is from an older season.
          </EmptyState>
        )}
      </div>
    );
  }
  return <EventView key={event.id} event={event} />;
}

function EventView({ event }: { event: SportEvent }) {
  usePageTitle(displayName(event).title);
  const theme = useResolvedTheme();
  const orbitPref = usePreferences((s) => s.orbit);
  const [orbit, setOrbit] = useState(orbitPref);
  const [nonce, setNonce] = useState(0);
  const view = useVenueView(event);
  const scope = useRef<HTMLElement>(null);
  const [frameRef, frame] = useElementSize<HTMLDivElement>();
  // Wide windows float the sessions panel over the map; narrow ones put it under the map.
  const wide = frame.width === 0 || frame.width >= 1024;
  // The venue sits in the open area below the title (and left of the panel when it floats).
  const padding = useMemo(
    () => ({ right: wide ? 560 : 0, left: 0, top: Math.round(frame.height * 0.36), bottom: 0 }),
    [frame.height, wide],
  );
  const { title, kicker } = displayName(event);
  const headline = headlineSession(event);

  // Recentering re-sends the same view as a new object, which re-runs the camera.
  const focus = useMemo(
    () =>
      view.focus
        ? {
            ...view.focus,
            fit: view.focus.fit ? [...view.focus.fit] : undefined,
            // A negligible zoom change is what re-runs the camera for an arena (it has no lap to copy).
            zoom: view.focus.zoom != null ? view.focus.zoom + nonce * 1e-6 : undefined,
          }
        : null,
    [view.focus, nonce],
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const el = scope.current?.querySelector<HTMLElement>('[data-event-title]');
        if (!el) return;
        const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'pb-[0.06em]' });
        gsap
          .timeline({ defaults: { ease: 'expo.out' } })
          .from('[data-event-kicker]', { opacity: 0, y: 10, duration: 0.8 }, 0)
          .from(split.lines, { yPercent: 110, duration: 1.15, stagger: 0.08 }, 0.05)
          .from('[data-event-panel]', { opacity: 0, x: 40, duration: 1.1 }, 0.2)
          .from('[data-event-meta]', { opacity: 0, y: 8, duration: 0.8, stagger: 0.06 }, 0.35);
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope },
  );

  return (
    <>
      <section ref={scope} className="relative h-[100svh] min-h-[620px] overflow-hidden" aria-label={`${event.name} venue`}>
        <div ref={frameRef} className="absolute inset-0">
          {frame.height > 0 ? (
            <VenueMap
              className="absolute inset-0"
              focus={focus}
              theme={theme}
              track={view.track}
              arena={view.arena}
              orbit={orbit}
              lap={view.kind === 'circuit'}
              interactive
              padding={padding}
              pitch={view.kind === 'circuit' ? 56 : 62}
              label={`3D map of ${event.venue.name}, ${event.venue.city}. Drag to rotate, hold Ctrl or Command and scroll to zoom.`}
            />
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--scrim-corner)' }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32" style={{ background: 'var(--scrim-bottom)' }} />

        <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1680px] flex-col justify-between px-5 pt-[clamp(84px,13vh,112px)] pb-[clamp(20px,4vh,40px)] md:px-8">
          <div className="pointer-events-auto flex max-w-full flex-col gap-5 lg:max-w-[min(720px,46vw)]">
            <Link to="/" data-event-kicker className="flex items-center gap-1.5 self-start rounded-full text-[14px] font-[560] text-ink-2 hover:text-ink">
              <Icon name="chevronLeft" size={16} />
              Up next
            </Link>
            <p data-event-kicker className="text-[15px] font-[560] text-ink-2">
              {kicker}
            </p>
            <h1 data-event-title className="wide text-[clamp(44px,min(5.2vw,9.5vh),96px)] leading-[0.9] font-[680] tracking-[-0.035em]">
              {title}
            </h1>
            <p data-event-meta className="flex items-center gap-2 text-[16px] text-ink-2">
              <Icon name="pin" size={18} />
              {event.venue.name}, {event.venue.city}, {event.venue.country}
            </p>
            <div data-event-meta className="flex flex-wrap items-center gap-2">
              {view.lapKm ? <Tag icon="flag">{view.lapKm.toFixed(3)} km lap</Tag> : null}
              {event.venue.indoor ? <Tag>Indoors</Tag> : headline ? <WeatherTag event={event} startUtc={headline.startUtc} /> : null}
              {event.broadcasters?.length ? <Tag icon="play">{event.broadcasters.join(', ')}</Tag> : null}
              {view.kind === 'arena' && !view.precise ? <Tag icon="pin">Map shows {event.venue.city}</Tag> : null}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <div className="glass-still flex items-center gap-1 rounded-full p-1 !shadow-none">
              <IconButton icon={orbit ? 'pause' : 'play'} label={orbit ? 'Stop orbiting' : 'Orbit the venue'} onClick={() => setOrbit((o) => !o)} size={36} />
              <IconButton icon="rotate" label="Recenter the map" onClick={() => setNonce((n) => n + 1)} size={36} />
            </div>
            <span className="text-[12.5px] text-ink-3">Drag to turn the map. Hold {modKey} and scroll to zoom.</span>
          </div>
        </div>

        {wide ? <SessionsPanel event={event} floating /> : null}
      </section>

      <div className="mx-auto flex max-w-[1680px] flex-col gap-20 px-5 pt-16 pb-32 md:px-8 lg:gap-24">
        {!wide ? <SessionsPanel event={event} /> : null}
        {headline ? <GmtReading event={event} startUtc={headline.startUtc} label={headline.label} /> : null}
        {/* Porcelain only: a painted vine between the times and the venue. */}
        <DelftDivider className="mx-auto -my-10 w-full max-w-[760px] lg:-my-12" />

        {event.sport === 'f1' ? (
          <section className="grid grid-cols-1 items-start gap-16 lg:grid-cols-2">
            <div className="flex flex-col gap-8">
              <SectionTitle title="The circuit" detail={view.circuitName ? `${view.circuitName}, drawn north up from its racing line.` : 'Racing line not available for this circuit yet.'} />
              {view.track ? <CircuitOutline line={view.track} className="h-[460px] w-full" /> : null}
            </div>
            <div className="flex flex-col gap-12">
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[20px] border border-hairline bg-hairline">
                <Fact label="Lap" value={view.lapKm ? `${view.lapKm.toFixed(3)} km` : 'Not listed'} />
                <Fact label="First Grand Prix" value={view.firstGp ? String(view.firstGp) : 'Not listed'} />
                <Fact label="Round" value={event.round ? String(event.round) : 'Not listed'} />
              </dl>
              {headline ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <h3 className="semiwide text-[22px] font-[640]">{headline.label} weather</h3>
                    <p className="text-[14.5px] text-ink-2">Hour by hour around the start, in the venue's own time.</p>
                  </div>
                  <WeatherStrip event={event} startUtc={headline.startUtc} />
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-8">
            <SectionTitle title="Fight card" detail={event.subtitle ? `Headlined by ${event.subtitle}.` : undefined} />
            <FightCard bouts={event.bouts ?? []} />
          </section>
        )}

        {/* The background: the race's history, or the fighters' stories. */}
        {event.sport === 'f1' ? <RaceHistory event={event} /> : <FighterBackgrounds event={event} />}
      </div>

      {/* The photos fill the window, edge to edge, to close the page as the map opens it. */}
      <EventPhotos event={event} />
    </>
  );
}

function WeatherTag({ event, startUtc }: { event: SportEvent; startUtc: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-raised px-2.5">
      <WeatherReading event={event} startUtc={startUtc} compact />
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-6 py-5">
      <dt className="text-[12.5px] font-[600] text-ink-3">{label}</dt>
      <dd className="numerals text-[30px] leading-none font-[260]">{value}</dd>
    </div>
  );
}

/** Every session, a day at a time: floating on the right of the map, or under it on narrow windows. */
function SessionsPanel({ event, floating = false }: { event: SportEvent; floating?: boolean }) {
  const now = useNow(30_000);
  const { timeZone, hour12 } = useClock();
  const night = usePreferences((s) => s.night);
  const sessions = event.sessions.filter((s) => !s.isCancelled);
  const days = groupByLocalDay(
    sessions.map((session) => ({ event, session })).sort((a, b) => a.session.startUtc.localeCompare(b.session.startUtc)),
    timeZone,
  );
  const anyUpcoming = sessions.some((s) => sessionState(s, now) === 'upcoming');
  return (
    <aside
      data-event-panel
      className={
        floating
          ? 'glass-still absolute top-24 right-8 bottom-10 z-20 flex w-[500px] flex-col overflow-hidden rounded-[28px]'
          : 'flex flex-col overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-1'
      }
      aria-label="Sessions"
    >
      <div className="flex items-baseline justify-between px-7 pt-6 pb-4">
        <h2 className="semiwide text-[20px] font-[640]">Sessions</h2>
        <span className="text-[13px] text-ink-3">Your time, {zoneCity(timeZone)}</span>
      </div>
      <div className={floating ? 'flex-1 overflow-y-auto overscroll-contain px-4 pb-4' : 'px-4 pb-4'} data-lenis-prevent={floating || undefined}>
        {days.map((day) => (
          <div key={day.key} className="flex flex-col pb-3">
            <p className="px-3 pt-2 pb-1.5 text-[12.5px] font-[620] text-ink-3">{formatDayLabel(day.firstStartUtc, timeZone, now)}</p>
            {day.items.map(({ session }) => {
              const state = sessionState(session, now);
              const venue = venueTimeLine(session.startUtc, event.venue, hour12);
              return (
                <div key={session.id} className="flex items-center gap-3 rounded-[16px] px-3 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] sm:gap-4">
                  <Clock iso={session.startUtc} timeZone={timeZone} hour12={hour12} size="row" className={clsx('w-[80px] shrink-0 sm:w-[96px]', state === 'finished' && 'opacity-45')} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className={state === 'finished' ? 'text-[15px] font-[560] text-ink-3' : 'text-[15px] font-[600]'}>{session.label}</span>
                      {state === 'live' ? <Tag tone="live">Live</Tag> : null}
                      {state === 'upcoming' && isOvernight(session.startUtc, timeZone, night) ? <Icon name="moon" size={15} className="text-gold" aria-label="Overnight" /> : null}
                    </span>
                    {venue ? <span className="text-[12.5px] text-ink-3">{venue}</span> : null}
                  </div>
                  {state === 'upcoming' ? <AlarmButton eventId={event.id} sessionId={session.id} /> : <span className="text-[12px] text-ink-3">{state === 'live' ? 'On now' : 'Finished'}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-glass-edge px-7 py-5">
        <Button variant="primary" size="lg" icon="bellRing" className="w-full" disabled={!anyUpcoming} onClick={() => openSetAlarm(event.id)}>
          {anyUpcoming ? 'Set wake-up calls' : 'This event is over'}
        </Button>
      </div>
    </aside>
  );
}

/** The GMT reading, spelled out: the headline session on your clock, the venue's, and UTC. */
function GmtReading({ event, startUtc, label }: { event: SportEvent; startUtc: string; label: string }) {
  const { timeZone, hour12 } = useClock();
  const venueZone = event.venue.timeZone;
  const clocks = [
    { name: 'You', zone: timeZone, note: zoneCity(timeZone) },
    ...(venueZone ? [{ name: event.venue.city, zone: venueZone, note: venueOffsetLine(startUtc, timeZone, venueZone) ?? '' }] : []),
    { name: 'UTC', zone: 'UTC', note: 'Coordinated time' },
  ];
  return (
    <section className="flex flex-col gap-8">
      <SectionTitle title={`${label} start, three ways`} detail={`${formatLongDate(startUtc, timeZone)} on your calendar.`} />
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[28px] border border-hairline bg-hairline md:grid-cols-3">
        {clocks.map((c) => (
          <div key={c.name} className="flex flex-col gap-4 bg-surface px-8 py-7">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-[620]">{c.name}</span>
              <span className="tabular text-[12.5px] text-ink-3">{formatUtcOffset(zoneOffsetMinutes(startUtc, c.zone))}</span>
            </div>
            <Clock iso={startUtc} timeZone={c.zone} hour12={c.zone === 'UTC' ? false : hour12} size="clock" />
            <span className="text-[13.5px] text-ink-2">
              {formatDayLabel(startUtc, c.zone)}, {c.note || formatClock(startUtc, c.zone, hour12)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
