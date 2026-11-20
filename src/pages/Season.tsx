import { useGSAP } from '@gsap/react';
import clsx from 'clsx';
import { formatInTimeZone } from 'date-fns-tz';
import gsap from 'gsap';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useResolvedTheme } from '@/app/theme';
import { VenueMap, type VenueFocus } from '@/components/map/VenueMap';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { Tag } from '@/components/ui/misc';
import { useEvents } from '@/data/queries';
import { useElementSize } from '@/hooks/use-element-size';
import { useNow } from '@/hooks/use-now';
import { usePageTitle } from '@/hooks/use-page-title';
import type { LngLat } from '@/lib/geo';
import { eventSpan, eventStatus, headlineSession } from '@/lib/schedule';
import { formatClock } from '@/lib/time';
import type { Sport, SportEvent } from '@/lib/types';
import { useClock } from '@/stores/preferences';

type Filter = 'all' | Sport;

/** The whole season on a turning globe, beside the list of every event. */
export function SeasonPage() {
  usePageTitle('The season');
  const theme = useResolvedTheme();
  const navigate = useNavigate();
  const { events } = useEvents();
  const now = useNow(60_000);
  const { timeZone, hour12 } = useClock();
  const [filter, setFilter] = useState<Filter>('all');
  const [hovered, setHovered] = useState<SportEvent | null>(null);
  const scope = useRef<HTMLElement>(null);

  const list = useMemo(
    () =>
      events
        .filter((e) => filter === 'all' || e.sport === filter)
        .filter((e) => eventSpan(e))
        .sort((a, b) => eventSpan(a)!.firstUtc.localeCompare(eventSpan(b)!.firstUtc)),
    [events, filter],
  );
  // What's ahead first, by month; finished events after, under one heading.
  const months = useMemo(() => {
    const groups: { key: string; label: string; events: SportEvent[] }[] = [];
    const finished: SportEvent[] = [];
    for (const e of list) {
      if (eventStatus(e.sessions, now) === 'completed') {
        finished.push(e);
        continue;
      }
      const first = eventSpan(e)!.firstUtc;
      const key = formatInTimeZone(first, timeZone, 'yyyy-MM');
      const label = formatInTimeZone(first, timeZone, 'MMMM yyyy');
      const last = groups[groups.length - 1];
      if (last?.key === key) last.events.push(e);
      else groups.push({ key, label, events: [e] });
    }
    if (finished.length) groups.push({ key: 'finished', label: 'Earlier this season', events: finished.reverse() });
    return groups;
  }, [list, timeZone, now]);

  // Gold points for what's still to come; finished venues stay dark.
  const points = useMemo(
    () =>
      list
        .filter((e) => e.venue.lat != null && e.venue.lon != null && eventStatus(e.sessions, now) !== 'completed')
        .map((e) => ({ id: e.id, lngLat: [e.venue.lon!, e.venue.lat!] as LngLat })),
    [list, now],
  );
  const upcomingCount = list.filter((e) => eventStatus(e.sessions, now) !== 'completed').length;

  // The globe fills the space under the title: radius in px = 512 · 2^zoom / 2π.
  const [frameRef, frame] = useElementSize<HTMLElement>();
  const top = Math.round(Math.max(200, frame.height * 0.34));
  const radius = Math.max(140, (frame.height - top - 36) / 2);
  const globeZoom = Math.log2((radius * 2 * Math.PI) / 512);
  const focus: VenueFocus = useMemo(
    () =>
      hovered && hovered.venue.lon != null && hovered.venue.lat != null
        ? { center: [hovered.venue.lon, hovered.venue.lat], zoom: globeZoom + 1.9 }
        : { center: [12, 22], zoom: globeZoom },
    [hovered, globeZoom],
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline({ defaults: { ease: 'expo.out' } })
          .from('[data-season-copy]', { opacity: 0, y: 24, duration: 1.1, stagger: 0.08 })
          .from('[data-season-list]', { opacity: 0, x: 40, duration: 1.1 }, 0.15);
      });
      return () => mm.revert();
    },
    { scope },
  );

  // Wide windows float the list over the globe; narrow ones put it under the globe.
  const wide = frame.width === 0 || frame.width >= 1024;
  const listPanel = (
    <aside
      data-season-list
      data-lenis-prevent={wide || undefined}
      className={
        wide
          ? 'glass-still absolute top-24 right-8 bottom-10 z-20 w-[540px] overflow-y-auto overscroll-contain rounded-[28px] px-4 py-4'
          : 'mx-5 mb-24 rounded-[28px] border border-hairline bg-surface px-4 py-4 shadow-1 md:mx-8'
      }
      aria-label="Every event"
      onMouseLeave={() => setHovered(null)}
    >
      {months.map((m) => (
        <div key={m.key} className="pb-4">
          <p className="semiwide px-3 pt-3 pb-2 text-[14px] font-[640] text-ink-2">{m.label}</p>
          {m.events.map((e) => {
            const span = eventSpan(e)!;
            const status = eventStatus(e.sessions, now);
            const headline = headlineSession(e);
            const done = status === 'completed';
            return (
              <button
                key={e.id}
                type="button"
                onMouseEnter={() => setHovered(e)}
                onFocus={() => setHovered(e)}
                onClick={() => navigate(`/event/${e.id}`)}
                className={clsx(
                  'group flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] sm:gap-4',
                  done && 'opacity-55',
                )}
              >
                <span className="flex w-[60px] shrink-0 flex-col sm:w-[74px]">
                  {/* The day of the session whose time is shown, so the date and time read together. */}
                  <span className="tabular text-[13px] font-[600] text-ink">{formatInTimeZone(headline?.startUtc ?? span.firstUtc, timeZone, 'MMM d')}</span>
                  <span className="text-[11.5px] text-ink-3">{e.sport === 'f1' ? (e.round ? `Round ${e.round}` : 'F1') : 'UFC'}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-[600]">
                    {e.sport === 'ufc' && /fight night/i.test(e.name) && e.subtitle ? e.subtitle : e.name}
                  </span>
                  <span className="truncate text-[12.5px] text-ink-3">
                    {e.venue.city}, {e.venue.country}
                  </span>
                </span>
                {status === 'live' ? (
                  <Tag tone="live">Live</Tag>
                ) : done ? (
                  <span className="text-[12px] text-ink-3">Finished</span>
                ) : headline ? (
                  <span className="flex flex-col items-end">
                    <span className="tabular text-[13.5px] font-[520]">{formatClock(headline.startUtc, timeZone, hour12)}</span>
                    <span className="text-[11.5px] text-ink-3">{headline.label}</span>
                  </span>
                ) : null}
                {/* Shown on hover, so it has no use (or room) on a phone. */}
                <Icon name="chevronRight" size={16} className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden" />
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );

  return (
    <>
      <section
        ref={(el) => {
          scope.current = el;
          frameRef.current = el;
        }}
        className="relative h-[100svh] min-h-[620px] overflow-hidden"
        aria-label="The season"
      >
        <VenueMap
          className="absolute inset-0"
          focus={frame.height > 0 ? focus : null}
          theme={theme}
          seasonPoints={points}
          spin={!hovered}
          markVenue={!!hovered}
          orbit={false}
          pitch={0}
          padding={{ right: wide ? 600 : 0, left: 0, top, bottom: 0 }}
          label="Globe with a gold point at every venue of the season"
        />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--scrim-corner)' }} />

        <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1680px] flex-col px-5 pt-[clamp(84px,13vh,112px)] pb-14 md:px-8">
          <div className="pointer-events-auto flex max-w-[600px] flex-col gap-5">
            <h1 data-season-copy className="wide text-[clamp(44px,min(5.2vw,9.5vh),96px)] leading-[0.9] font-[680] tracking-[-0.035em]">
              The season
            </h1>
            <p data-season-copy className="text-[17px] leading-relaxed text-ink-2">
              {upcomingCount} {upcomingCount === 1 ? 'event' : 'events'} still to come, each a gold point on the globe. Point at one to fly there.
            </p>
            <div data-season-copy>
              <Segmented<Filter>
                label="Sports"
                value={filter}
                onChange={setFilter}
                tone="glass"
                options={[
                  { value: 'all', label: 'Everything' },
                  { value: 'f1', label: 'Formula 1' },
                  { value: 'ufc', label: 'UFC' },
                ]}
              />
            </div>
          </div>
        </div>

        {wide ? listPanel : null}
      </section>
      {wide ? null : listPanel}
    </>
  );
}
