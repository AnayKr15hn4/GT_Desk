import { useMemo } from 'react';

import { DelftDivider } from '@/components/delft/Delft';
import { ComingUp } from '@/components/schedule/ComingUp';
import { FollowPanel } from '@/components/schedule/FollowPanel';
import { Hero } from '@/components/schedule/Hero';
import { WeekChronograph } from '@/components/schedule/WeekChronograph';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/misc';
import { useSchedule } from '@/hooks/use-schedule';
import { useNow } from '@/hooks/use-now';
import { usePageTitle } from '@/hooks/use-page-title';
import type { LngLat } from '@/lib/geo';
import { upcomingEvents } from '@/lib/schedule';
import { sportMeta } from '@/lib/sessions';

export function UpNextPage() {
  usePageTitle(null);
  const { items, events, isLoading, isError, failedSports, refetch, next } = useSchedule();
  const now = useNow(60_000);
  // Gold points on the globe: every venue still to come this season.
  const seasonPoints = useMemo(
    () =>
      upcomingEvents(events, now)
        .filter((e) => e.venue.lat != null && e.venue.lon != null)
        .map((e) => ({ id: e.id, lngLat: [e.venue.lon!, e.venue.lat!] as LngLat })),
    [events, now],
  );

  return (
    <>
      {/* Wait for both sports, so "next" doesn't switch from one event to another as they arrive. */}
      <Hero item={isLoading ? undefined : next} seasonPoints={seasonPoints} loading={isLoading} />
      <div className="relative z-10 mx-auto flex max-w-[1680px] flex-col gap-20 px-5 pt-16 pb-32 md:px-8 lg:gap-28">
        {isError ? (
          <EmptyState icon="globe" title="The schedule didn't load" action={<Button onClick={refetch}>Try again</Button>}>
            GameTime couldn't reach its server. Check your connection; the page tries again on its own every few minutes.
          </EmptyState>
        ) : null}
        {failedSports.length && !isError ? (
          <p className="text-[14px] text-warning">
            {failedSports.map((s) => sportMeta[s].name).join(' and ')} didn't load. Showing the rest.
          </p>
        ) : null}
        <WeekChronograph items={items} />
        {/* Porcelain only: a painted vine between the week and the list. */}
        <DelftDivider className="mx-auto -my-12 w-full max-w-[760px] lg:-my-16" />
        {/* Side by side on wide screens; on narrow ones what you follow comes first, then the list. */}
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-2 lg:order-1">
            <ComingUp items={items} />
          </div>
          <div className="order-1 lg:sticky lg:top-24 lg:order-2">
            <FollowPanel />
          </div>
        </div>
      </div>
    </>
  );
}
