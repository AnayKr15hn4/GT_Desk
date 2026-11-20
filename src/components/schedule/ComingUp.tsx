import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Clock } from '@/components/ui/Clock';
import { InsetGroup, Row } from '@/components/ui/Inset';
import { EmptyState, SectionTitle, Tag } from '@/components/ui/misc';
import { useNow } from '@/hooks/use-now';
import { groupByLocalDay, sessionState, type ScheduleItem } from '@/lib/schedule';
import { formatDayLabel, isOvernight, venueTimeLine } from '@/lib/time';
import { useClock, usePreferences } from '@/stores/preferences';

import { AlarmButton } from './AlarmButton';

const PAGE_DAYS = 10;

/** Everything ahead, a day at a time: your time large, the venue's quietly underneath. */
export function ComingUp({ items }: { items: ScheduleItem[] }) {
  const { timeZone } = useClock();
  const now = useNow(60_000);
  const [shown, setShown] = useState(PAGE_DAYS);
  const days = useMemo(() => groupByLocalDay(items, timeZone), [items, timeZone]);

  return (
    <section className="flex flex-col gap-10" aria-labelledby="coming-up">
      <SectionTitle title="Coming up" detail="Every session you follow, soonest first. Pick one to see the venue, or set a wake-up straight from the list." />
      {days.length === 0 ? (
        <EmptyState icon="calendar" title="Nothing on your schedule">
          Follow another sport or keep more sessions in the panel beside this list.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-9">
          {days.slice(0, shown).map((day) => (
            <InsetGroup key={day.key} title={formatDayLabel(day.firstStartUtc, timeZone, now)}>
              {day.items.map((item) => (
                <SessionRow key={item.session.id} item={item} />
              ))}
            </InsetGroup>
          ))}
          {days.length > shown ? (
            <Button variant="secondary" className="self-start" onClick={() => setShown((n) => n + PAGE_DAYS)}>
              Show {Math.min(PAGE_DAYS, days.length - shown)} more days
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SessionRow({ item }: { item: ScheduleItem }) {
  const navigate = useNavigate();
  const now = useNow(60_000);
  const { timeZone, hour12 } = useClock();
  const night = usePreferences((s) => s.night);
  const { event, session } = item;
  const live = sessionState(session, now) === 'live';
  const venue = venueTimeLine(session.startUtc, event.venue, hour12);
  return (
    <Row onClick={() => navigate(`/event/${event.id}`)} className="group flex-nowrap gap-4 sm:gap-6">
      <Clock iso={session.startUtc} timeZone={timeZone} hour12={hour12} size="row" className="w-[84px] shrink-0 sm:w-[104px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* In a narrow window the tags drop under the session's name rather than squeeze it to a letter. */}
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="truncate text-[15.5px] font-[600]">{session.label}</span>
          {live ? <Tag tone="live">Live</Tag> : null}
          {!live && isOvernight(session.startUtc, timeZone, night) ? (
            <Tag tone="gold" icon="moon">
              Overnight
            </Tag>
          ) : null}
          {session.isEstimated ? <Tag>Estimated</Tag> : null}
        </span>
        <span className="truncate text-[13.5px] text-ink-2">
          {event.shortName}
          {venue ? <span className="text-ink-3">, {venue}</span> : null}
        </span>
      </div>
      <AlarmButton eventId={event.id} sessionId={session.id} />
    </Row>
  );
}
