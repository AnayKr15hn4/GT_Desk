import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useResolvedTheme } from '@/app/theme';
import Magnet from '@/components/bits/Magnet';
import SpotlightCard from '@/components/bits/SpotlightCard';
import { DelftHeroArt } from '@/components/delft/Delft';
import { WeatherReading } from '@/components/event/Weather';
import { useVenueView } from '@/components/map/useVenueView';
import { VenueMap } from '@/components/map/VenueMap';
import { Button } from '@/components/ui/Button';
import { Clock, RollingText } from '@/components/ui/Clock';
import { Icon } from '@/components/ui/Icon';
import { Skeleton, Tag } from '@/components/ui/misc';
import { useAlarms } from '@/data/queries';
import { useElementSize } from '@/hooks/use-element-size';
import { useNow } from '@/hooks/use-now';
import { alarmForSession } from '@/lib/alarms';
import type { LngLat } from '@/lib/geo';
import { sessionState, type ScheduleItem } from '@/lib/schedule';
import { countdown, formatClock, formatCountdown, formatLongDate, isOvernight, venueOffsetLine, venueTimeLine } from '@/lib/time';
import { displayName } from '@/lib/names';
import { useClock, usePreferences } from '@/stores/preferences';
import { openSetAlarm } from '@/stores/ui';

gsap.registerPlugin(SplitText, ScrollTrigger);


let introPlayed = false;

export function Hero({ item, seasonPoints, loading }: { item?: ScheduleItem; seasonPoints?: { lngLat: LngLat; id: string }[]; loading?: boolean }) {
  const theme = useResolvedTheme();
  const orbit = usePreferences((s) => s.orbit);
  const view = useVenueView(item?.event);
  const [frameRef, frame] = useElementSize<HTMLDivElement>();
  const scope = useRef<HTMLElement>(null);
  // The flight from space plays once per visit, not every time you come back to this page.
  const [intro] = useState(() => !introPlayed);
  // The line work starts as the camera lands: after the zoom in from the globe on a first visit,
  // after the shorter flight otherwise. If the map can't run, it starts after a while anyway.
  const [landed, setLanded] = useState(false);
  const land = useCallback(() => setLanded(true), []);
  useEffect(() => {
    const fallback = window.setTimeout(land, 12_000);
    return () => window.clearTimeout(fallback);
  }, [land]);
  useEffect(() => {
    introPlayed = true;
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const title = scope.current?.querySelector<HTMLElement>('[data-hero-title]');
        if (!title) return;
        const split = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'pb-[0.06em]' });
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        tl.from('[data-hero-kicker]', { opacity: 0, y: 12, filter: 'blur(6px)', duration: 0.9 }, 0.1)
          .from(split.lines, { yPercent: 112, duration: 1.25, stagger: 0.09 }, 0.15)
          .from('[data-hero-venue]', { opacity: 0, y: 10, duration: 0.9 }, 0.45)
          .from('[data-hero-dial]', { opacity: 0, y: 36, scale: 0.985, duration: 1.2 }, 0.42)
          .from('[data-hero-chip]', { opacity: 0, x: 18, duration: 0.9, stagger: 0.07 }, 0.7);
        // As you scroll on, the copy lifts away and the map dims under the next section.
        gsap.to('[data-hero-content]', {
          y: -90,
          opacity: 0.15,
          ease: 'none',
          scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom 30%', scrub: true },
        });
        gsap.to('[data-hero-dim]', {
          opacity: 0.85,
          ease: 'none',
          scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: true },
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope, dependencies: [item?.event.id, item?.session.id] },
  );

  // Wide windows: the venue sits right of the copy. Narrow ones stack the copy over the dial card,
  // so the venue sits in the band between them.
  const padding = useMemo(
    () =>
      frame.width >= 1024
        ? { left: Math.round(frame.width * 0.44), top: 64, right: 0, bottom: 40 }
        : { left: 0, right: 0, top: Math.round(frame.height * 0.3), bottom: Math.round(frame.height * 0.36) },
    [frame.width, frame.height],
  );

  return (
    <section ref={scope} className="relative h-[100svh] min-h-[620px] overflow-hidden" aria-label="Next session">
      <div ref={frameRef} className="absolute inset-0">
        {frame.width > 0 ? (
          <VenueMap
            className="absolute inset-0"
            focus={view.focus}
            theme={theme}
            track={view.track}
            arena={view.arena}
            seasonPoints={seasonPoints}
            intro={intro}
            orbit={orbit}
            lap={view.kind === 'circuit'}
            padding={padding}
            pitch={view.kind === 'circuit' ? 58 : 64}
            label={item ? `3D map of ${item.event.venue.name}, ${item.event.venue.city}` : 'Map of the world'}
            onArrive={land}
            onFailure={land}
          />
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--scrim)' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64" style={{ background: 'var(--scrim-bottom)' }} />
      {/* Porcelain only: Delft line work painted on the light at the left, fading out to the right.
          Each sport's traced scene (F1: the winner on the car; UFC: the champion) takes turns with the flowers. */}
      {item ? (
        <div className="delft-hero-fade pointer-events-none absolute inset-0 hidden lg:block">
          <DelftHeroArt key={item.event.sport} sport={item.event.sport} ready={landed} waitMs={350} />
        </div>
      ) : null}
      <div data-hero-dim className="pointer-events-none absolute inset-0 bg-canvas opacity-0 will-change-[opacity]" />

      {/* Keyed by session: SplitText rewrites the headline's DOM, so a new session gets fresh nodes. */}
      <div
        key={item?.session.id ?? 'empty'}
        data-hero-content
        className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col justify-between gap-6 px-5 pt-[clamp(84px,14vh,128px)] pb-[clamp(20px,4.5vh,48px)] md:px-8"
      >
        <div className="flex items-start justify-between gap-8">
          {item ? <HeroCopy item={item} /> : <HeroCopySkeleton loading={loading} />}
          {item ? <HeroChips item={item} lapKm={view.lapKm} precise={view.precise} kind={view.kind} /> : null}
        </div>
        {item ? <DialCard item={item} /> : null}
      </div>
    </section>
  );
}

function HeroCopy({ item }: { item: ScheduleItem }) {
  const { title, kicker } = displayName(item.event);
  const { venue } = item.event;
  return (
    <div className="flex max-w-full flex-col gap-[clamp(10px,2.2vh,20px)] lg:max-w-[min(760px,52vw)]">
      {/* The screensaver fades the wrappers; the intro animates what's inside (never both on one element). */}
      <div data-idle-hide>
        <p data-hero-kicker className="text-[15px] font-[560] text-ink-2">
          {kicker}
        </p>
      </div>
      <h1 data-hero-title className="wide text-[clamp(48px,min(5.7vw,10.5vh),104px)] leading-[0.9] font-[680] tracking-[-0.035em] text-ink">
        {title}
      </h1>
      <div data-idle-hide>
        <p data-hero-venue className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[16px] text-ink-2">
          {/* The pin stays with the venue when a narrow window wraps the line. */}
          <span className="flex min-w-0 items-start gap-2">
            <Icon name="pin" size={18} className="mt-[3px] shrink-0" />
            <span>
              {venue.name}, {venue.city}, {venue.country}
            </span>
          </span>
          <Link to={`/event/${item.event.id}`} className="font-[600] whitespace-nowrap text-gold hover:underline">
            Event details
          </Link>
        </p>
      </div>
    </div>
  );
}

function HeroCopySkeleton({ loading }: { loading?: boolean }) {
  if (!loading) {
    return (
      <div className="flex max-w-[640px] flex-col gap-4">
        <h1 className="wide text-[64px] leading-[0.92] font-[680] tracking-[-0.035em]">The season is resting</h1>
        <p className="text-[17px] text-ink-2">Nothing you follow is on the schedule yet. New events appear here as soon as they're announced.</p>
      </div>
    );
  }
  return (
    <div className="flex max-w-[640px] flex-col gap-5" aria-busy>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-20 w-[560px]" />
      <Skeleton className="h-20 w-[420px]" />
    </div>
  );
}

function DialCard({ item }: { item: ScheduleItem }) {
  const now = useNow(1000);
  const { timeZone, hour12 } = useClock();
  const night = usePreferences((s) => s.night);
  const alarms = useAlarms();
  const { event, session } = item;
  const state = sessionState(session, now);
  const alarm = alarms.data ? alarmForSession(alarms.data, session.id, now) : undefined;
  const venueLine = venueTimeLine(session.startUtc, event.venue, hour12);
  const offset = venueOffsetLine(session.startUtc, timeZone, event.venue.timeZone);

  return (
    <div data-idle-hide className="w-full max-w-[640px] lg:w-[min(640px,48vw)]">
      <div data-hero-dial className="dial-sheer rounded-[28px]">
        <SpotlightCard
          className="rounded-[28px]! p-0! [--spotlight-card-border:transparent]"
          style={{ '--spotlight-card-surface': 'transparent', '--spotlight-card-shadow': 'none' } as React.CSSProperties}
          spotlightColor="rgba(212, 182, 122, 0.55)"
          intensity={0.12}
          spotlightSize={340}
          borderGlow={0.5}
        >
          <div className="flex flex-col p-[clamp(20px,3.6vh,32px)]">
            <div className="flex items-center gap-3">
              <span className="semiwide text-[18px] font-[640]">{session.label}</span>
              {state === 'live' ? <Tag tone="live">Live now</Tag> : null}
              {state === 'upcoming' && isOvernight(session.startUtc, timeZone, night) ? (
                <Tag tone="gold" icon="moon">
                  Overnight
                </Tag>
              ) : null}
              {session.isEstimated ? <Tag>Estimated start</Tag> : null}
              <span className="ml-auto text-[13px] text-ink-3">Your time</span>
            </div>
            <Clock iso={session.startUtc} timeZone={timeZone} hour12={hour12} size="mega" className="mt-[clamp(8px,1.8vh,16px)] -ml-1 text-ink" />
            <div className="mt-[clamp(8px,1.8vh,16px)] flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="text-[17px] font-[540]">{formatLongDate(session.startUtc, timeZone)}</span>
              {venueLine ? (
                <span className="text-[15px] text-ink-2">
                  {venueLine}
                  {offset && offset !== 'Same time as you' ? `, ${offset}` : ''}
                </span>
              ) : null}
            </div>
            <div className="my-[clamp(12px,2.6vh,24px)] h-px bg-[var(--dial-rim)]" />
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-3">{state === 'live' ? 'Started' : 'Starts in'}</span>
                {state === 'live' ? (
                  <span className="numerals text-[30px] leading-none text-ink">{formatClock(session.startUtc, timeZone, hour12)}</span>
                ) : (
                  <RollingText text={formatCountdown(countdown(session.startUtc, now))} className="text-[clamp(24px,3.6vh,30px)] leading-none font-[250] tracking-[-0.02em] whitespace-nowrap text-ink" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {alarm ? (
                  <Link to="/alarms" className="inline-flex h-13 items-center gap-2 rounded-full bg-gold-soft px-6 text-[15px] font-[600] text-gold">
                    <Icon name={alarm.alertType === 'call' ? 'phone' : 'bellRing'} size={18} />
                    Wake-up at {formatClock(alarm.alertTimeUtc, timeZone, hour12)}
                  </Link>
                ) : state === 'upcoming' ? (
                  <Magnet padding={60} magnetStrength={4} maxOffset={10}>
                    <Button variant="primary" size="lg" icon="bellRing" onClick={() => openSetAlarm(event.id, [session.id])}>
                      Set wake-up call
                    </Button>
                  </Magnet>
                ) : null}
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

function HeroChips({ item, lapKm, precise, kind }: { item: ScheduleItem; lapKm?: number; precise: boolean; kind: 'circuit' | 'arena' }) {
  const now = useNow(1000);
  const { hour12 } = useClock();
  const { event, session } = item;
  // Over the orbiting map: still glass, so nothing is blurred again every frame.
  const chip = 'glass-still flex items-center gap-2.5 rounded-full px-4.5 py-2.5 text-[13.5px] !shadow-none';
  return (
    <div data-idle-hide className="hidden shrink-0 flex-col items-end gap-2.5 pt-1 lg:flex">
      {!event.venue.indoor ? (
        <div data-hero-chip className={chip}>
          <WeatherReading event={event} startUtc={session.startUtc} compact />
        </div>
      ) : null}
      {lapKm ? (
        <div data-hero-chip className={chip}>
          <Icon name="flag" size={17} className="text-ink-2" />
          <span className="tabular">{lapKm.toFixed(3)} km lap</span>
        </div>
      ) : null}
      {event.venue.timeZone ? (
        <div data-hero-chip className={chip}>
          <Icon name="clock" size={17} className="text-ink-2" />
          <span>
            It's <span className="tabular">{formatClock(now.toISOString(), event.venue.timeZone, hour12)}</span> in {event.venue.city}
          </span>
        </div>
      ) : null}
      {kind === 'arena' && !precise ? (
        <div data-hero-chip className={chip}>
          <Icon name="pin" size={17} className="text-ink-2" />
          <span className="text-ink-2">Map shows {event.venue.city}; the arena isn't on the map by name</span>
        </div>
      ) : null}
    </div>
  );
}
