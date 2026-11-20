import { animate, stagger } from 'animejs';
import clsx from 'clsx';
import { formatInTimeZone } from 'date-fns-tz';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Clock } from '@/components/ui/Clock';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/misc';
import { useAlarms } from '@/data/queries';
import { useElementSize } from '@/hooks/use-element-size';
import { useNow } from '@/hooks/use-now';
import { prefersReducedMotion } from '@/hooks/use-reduced-motion';
import { alarmForSession } from '@/lib/alarms';
import { sessionState, type ScheduleItem } from '@/lib/schedule';
import { sessionLabels } from '@/lib/sessions';
import { formatDayLabel, formatMinuteOfDay, isOvernight, localDateKey, localMinuteOfDay, venueTimeLine } from '@/lib/time';
import { assignLanes, buildWeek, nightBands, toPercent, type WeekBlock } from '@/lib/week';
import { useClock, usePreferences } from '@/stores/preferences';
import { openSetAlarm } from '@/stores/ui';

const LANE = 30;
const MIN_BLOCK_PX = 96;
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

function hourLabel(h: number, hour12: boolean) {
  if (!hour12) return `${String(h).padStart(2, '0')}:00`;
  if (h === 0) return '12 AM';
  if (h === 12) return 'Noon';
  return `${h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

function dayParts(key: string, todayKey: string) {
  const noon = `${key}T12:00:00Z`;
  const diff = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000);
  const name = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : formatInTimeZone(noon, 'UTC', 'EEEE');
  return { name, date: formatInTimeZone(noon, 'UTC', 'MMM d') };
}

/**
 * Your week as a chronograph: seven days on your clock, your night shaded, every session where it
 * really falls. The desktop view of the GMT reading: you see at a glance which nights are short.
 */
export function WeekChronograph({ items }: { items: ScheduleItem[] }) {
  const now = useNow(60_000);
  const { timeZone, hour12 } = useClock();
  const night = usePreferences((s) => s.night);
  const alarms = useAlarms();
  const navigate = useNavigate();
  const rows = useMemo(() => buildWeek(items, timeZone, now), [items, timeZone, now]);
  const bands = useMemo(() => nightBands(night), [night]);
  const todayKey = localDateKey(now.toISOString(), timeZone);
  const nowPct = toPercent(localMinuteOfDay(now.toISOString(), timeZone));
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ block: WeekBlock; x: number; y: number; hostWidth: number } | null>(null);
  const showHover = (block: WeekBlock, el: HTMLElement) => {
    const host = trackRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setHover({ block, x: r.left - host.left + r.width / 2, y: r.top - host.top, hostWidth: host.width });
  };
  const played = useRef(false);
  // Capsules keep a readable width (their label) however short the session, so lanes allow for it.
  const [laneRef, lane] = useElementSize<HTMLDivElement>();
  const pxPerMin = lane.width > 0 ? lane.width / (24 * 60) : 0.7;
  const minWidthMin = Math.ceil(MIN_BLOCK_PX / pxPerMin);
  const minWidthPct = (minWidthMin / (24 * 60)) * 100;

  // The blocks fill in once, the first time the week scrolls into view.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || played.current) return;
    if (prefersReducedMotion()) {
      played.current = true;
      return;
    }
    const blocks = el.querySelectorAll<HTMLElement>('[data-week-block]');
    blocks.forEach((b) => (b.style.opacity = '0'));
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played.current) return;
        played.current = true;
        animate(blocks, {
          opacity: { from: 0, to: 1 },
          scaleX: { from: 0.2, to: 1 },
          duration: 900,
          delay: stagger(26, { start: 120 }),
          ease: 'outExpo',
        });
        animate(el.querySelectorAll('[data-week-night]'), { opacity: { from: 0, to: 1 }, duration: 1200, ease: 'outQuad' });
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rows.length]);

  const sessions = rows.reduce((n, r) => n + r.blocks.filter((b) => b.isStart).length, 0);
  const overnight = rows.reduce((n, r) => n + r.blocks.filter((b) => b.isStart && isOvernight(b.item.session.startUtc, timeZone, night)).length, 0);

  return (
    <section className="flex flex-col gap-10" aria-labelledby="week-title">
      <SectionTitle
        title="Your week"
        detail={
          sessions === 0
            ? 'Nothing you follow in the next seven days.'
            : `${sessions} ${sessions === 1 ? 'session' : 'sessions'} in the next seven days, on your clock. ${overnight ? `${overnight} start${overnight === 1 ? 's' : ''} during your night.` : 'None during your night.'}`
        }
        action={
          <div className="flex items-center gap-5 text-[13px] text-ink-2">
            <span className="flex items-center gap-2">
              <span className="night-hatch h-3.5 w-7 rounded-[4px] border border-hairline" />
              Your night, {formatMinuteOfDay(night.startMin, hour12)} to {formatMinuteOfDay(night.endMin, hour12)}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-7 rounded-full bg-gold" />
              Wake-up set
            </span>
            <Link to="/settings#night" className="font-[560] text-gold hover:underline">
              Change your night
            </Link>
          </div>
        }
      />

      <div ref={trackRef} className="relative rounded-[28px] border border-hairline bg-surface p-6 shadow-1" onMouseLeave={() => setHover(null)}>
        {/* Hour scale (also measures the track width) */}
        <div ref={laneRef} className="relative ml-[100px] h-6 md:ml-[148px]">
          {HOURS.map((h) => (
            <span key={h} className="absolute top-0 -translate-x-1/2 text-[11.5px] font-[540] text-ink-3 tabular" style={{ left: `${(h / 24) * 100}%` }}>
              {hourLabel(h, hour12)}
            </span>
          ))}
        </div>

        <div className="flex flex-col">
          {rows.map((row) => {
            const { lanes, count } = assignLanes(row.blocks, 12, minWidthMin);
            const isToday = row.key === todayKey;
            const { name, date } = dayParts(row.key, todayKey);
            return (
              <div key={row.key} className="flex items-stretch border-t border-hairline first:border-t-0">
                <div className="flex w-[100px] shrink-0 flex-col justify-center py-3 pr-3 md:w-[148px] md:pr-4">
                  <span className={clsx('text-[14.5px] font-[600]', isToday ? 'text-ink' : 'text-ink-2')}>{name}</span>
                  <span className="text-[12.5px] text-ink-3">{date}</span>
                </div>
                <div className="relative flex-1" style={{ height: count * LANE + 24 }}>
                  {/* Hour gridlines */}
                  {HOURS.map((h) => (
                    <span key={h} className="absolute inset-y-0 w-px bg-hairline" style={{ left: `${(h / 24) * 100}%` }} />
                  ))}
                  {/* Your night */}
                  {bands.map((b) => (
                    <span key={b.left} data-week-night className="night-hatch absolute inset-y-1 rounded-[8px]" style={{ left: `${b.left}%`, width: `${b.width}%` }} />
                  ))}
                  {isToday ? (
                    <span className="absolute inset-y-0 z-[3] w-px bg-ink" style={{ left: `${nowPct}%` }} aria-hidden>
                      <span className="absolute -top-1 -left-[3.5px] size-2 rounded-full bg-ink" />
                    </span>
                  ) : null}
                  {row.blocks.map((block, i) => {
                    const { event, session } = block.item;
                    const alarm = alarms.data ? alarmForSession(alarms.data, session.id, now) : undefined;
                    const overnightStart = block.isStart && isOvernight(session.startUtc, timeZone, night);
                    const live = sessionState(session, now) === 'live';
                    // The piece after midnight is a plain extension of the one before, so it keeps its true length.
                    const width = block.isStart ? Math.max(toPercent(block.toMin) - toPercent(block.fromMin), minWidthPct) : toPercent(block.toMin);
                    // Late starts keep their label inside the track.
                    const left = Math.min(toPercent(block.fromMin), 100 - width);
                    return (
                      <button
                        key={`${session.id}-${block.isStart}`}
                        type="button"
                        data-week-block
                        onClick={() => navigate(`/event/${event.id}`)}
                        onMouseEnter={(e) => showHover(block, e.currentTarget)}
                        onFocus={(e) => showHover(block, e.currentTarget)}
                        onBlur={() => setHover(null)}
                        aria-label={`${session.label}, ${event.name}, ${formatDayLabel(session.startUtc, timeZone, now)}`}
                        className={clsx(
                          'absolute z-[2] flex h-[24px] origin-left items-center gap-1.5 overflow-hidden rounded-full px-2.5 text-left text-[11.5px] font-[600] whitespace-nowrap transition-[filter,transform] duration-150 hover:brightness-110',
                          alarm
                            ? 'bg-gold text-on-gold'
                            : overnightStart
                              ? 'border border-[color-mix(in_srgb,var(--gold)_55%,transparent)] bg-[color-mix(in_srgb,var(--gold)_12%,var(--raised))] text-gold'
                              : 'border border-edge bg-raised text-ink',
                          !block.isStart && 'rounded-l-md opacity-80',
                          live && 'ring-2 ring-live/70',
                        )}
                        style={{ left: `${left}%`, width: `${width}%`, top: 12 + lanes[i] * LANE }}
                      >
                        {block.isStart ? (
                          <>
                            {alarm ? <Icon name="bell" size={12} strokeWidth={2} /> : live ? <span className="live-dot size-1.5 shrink-0 rounded-full bg-live" /> : null}
                            <span className="truncate">
                              {sessionLabels[session.kind].short}
                              <span className="font-[450] opacity-75"> {event.shortName}</span>
                            </span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <AnimatePresence>
          {hover ? (
            <motion.div
              key={hover.block.item.session.id}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              className="pointer-events-none absolute z-20 w-[300px] -translate-x-1/2 -translate-y-full"
              style={{ left: Math.min(Math.max(hover.x, 160), hover.hostWidth - 160), top: hover.y - 10 }}
            >
              <HoverCard block={hover.block} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

function HoverCard({ block }: { block: WeekBlock }) {
  const { timeZone, hour12 } = useClock();
  const now = useNow(60_000);
  const { event, session } = block.item;
  const venue = venueTimeLine(session.startUtc, event.venue, hour12);
  return (
    <div className="glass pointer-events-auto flex flex-col gap-3 rounded-[20px] p-4.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-ink-2">{event.name}</span>
        <span className="text-[16px] font-[620]">{session.label}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <Clock iso={session.startUtc} timeZone={timeZone} hour12={hour12} size="time" />
        <span className="text-[12.5px] text-ink-3">{formatDayLabel(session.startUtc, timeZone, now)}</span>
      </div>
      {venue ? <span className="text-[13px] text-ink-2">{venue}</span> : null}
      <button
        type="button"
        onClick={() => openSetAlarm(event.id, [session.id])}
        className="mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-full bg-gold text-[13.5px] font-[600] text-on-gold transition-transform active:scale-[0.97]"
      >
        <Icon name="bellRing" size={16} />
        Set wake-up call
      </button>
    </div>
  );
}
