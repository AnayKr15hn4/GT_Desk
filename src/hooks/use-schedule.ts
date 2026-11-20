import { useMemo } from 'react';

import { useEvents } from '@/data/queries';
import { buildSchedule, type ScheduleItem } from '@/lib/schedule';
import { usePreferences } from '@/stores/preferences';

import { useNow } from './use-now';

/**
 * Your schedule: every session of the sports you follow and the kinds you keep, soonest first.
 * Recomputed once a minute, not every second.
 */
export function useSchedule() {
  const { events, isLoading, isError, failedSports, refetch } = useEvents();
  const sports = usePreferences((s) => s.followedSports);
  const filters = usePreferences((s) => s.sessionFilters);
  const minute = useNow(60_000);
  const items: ScheduleItem[] = useMemo(
    () => buildSchedule(events, { sports, filters, now: minute }),
    [events, sports, filters, minute],
  );
  return { items, events, isLoading, isError, failedSports, refetch, next: items[0] as ScheduleItem | undefined };
}
