import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  cancelAlarm,
  checkPhoneCode,
  createAlarm,
  getAccount,
  listAlarms,
  listEvents,
  removeAlarm,
  restoreAlarm,
  sendPhoneCode,
  updateAlarmLead,
} from './api';
import { fetchCircuits, fetchFootprint, fetchForecast, locateArena, type ArenaPlace } from './external';
import { cardFighters, fetchF1History, fetchFighterProfiles, fetchGallery, gallerySources } from './history';
import { useSession } from '@/stores/session';
import type { Alarm, AlertType, Sport, SportEvent } from '@/lib/types';

const SPORTS: Sport[] = ['f1', 'ufc'];

/** Every event of both sports. Each sport loads on its own, so one failing doesn't hide the other. */
export function useEvents() {
  return useQueries({
    queries: SPORTS.map((sport) => ({
      queryKey: ['events', sport],
      queryFn: ({ signal }: { signal: AbortSignal }) => listEvents(sport, signal),
      staleTime: 5 * 60_000,
      refetchInterval: 15 * 60_000,
    })),
    // Combined once per change, so `events` keeps its identity between renders.
    combine: (results) => ({
      events: results.flatMap((r) => r.data ?? []),
      isLoading: results.some((r) => r.isLoading),
      isError: results.every((r) => r.isError),
      failedSports: SPORTS.filter((_, i) => results[i].isError),
      error: results.find((r) => r.error)?.error ?? null,
      refetch: () => results.forEach((r) => void r.refetch()),
    }),
  });
}

export function useEvent(id: string | undefined): { event: SportEvent | undefined; isLoading: boolean; events: SportEvent[] } {
  const { events, isLoading } = useEvents();
  return { event: events.find((e) => e.id === id), isLoading, events };
}

export function useAccount() {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ['account', user?.id],
    queryFn: getAccount,
    enabled: !!user,
    staleTime: 60_000,
  });
}

const alarmsKey = (userId: string | undefined) => ['alarms', userId] as const;

/** Your alarms. inBackground keeps checking while the tab is hidden, for alarms set on your phone. */
export function useAlarms({ inBackground = false }: { inBackground?: boolean } = {}) {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: alarmsKey(user?.id),
    queryFn: listAlarms,
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: inBackground,
  });
}

/** Keeps the cached alarm list in step with what each action returns. */
function useAlarmCache() {
  const client = useQueryClient();
  const user = useSession((s) => s.user);
  const key = alarmsKey(user?.id);
  return {
    upsert: (alarm: Alarm) =>
      client.setQueryData<Alarm[]>(key, (old = []) =>
        old.some((a) => a.id === alarm.id) ? old.map((a) => (a.id === alarm.id ? alarm : a)) : [alarm, ...old],
      ),
    remove: (id: string) => client.setQueryData<Alarm[]>(key, (old = []) => old.filter((a) => a.id !== id)),
    refresh: () => client.invalidateQueries({ queryKey: key }),
  };
}

export function useCreateAlarm() {
  const cache = useAlarmCache();
  return useMutation({
    mutationFn: (input: { sessionId: string; leadMinutes: number; alertType: AlertType; idempotencyKey: string }) => createAlarm(input),
    onSuccess: (alarm) => cache.upsert(alarm),
  });
}

export function useAlarmActions() {
  const cache = useAlarmCache();
  const cancel = useMutation({ mutationFn: cancelAlarm, onSuccess: cache.upsert });
  const restore = useMutation({ mutationFn: restoreAlarm, onSuccess: cache.upsert });
  const updateLead = useMutation({
    mutationFn: ({ id, lead }: { id: string; lead: number }) => updateAlarmLead(id, lead),
    onSuccess: cache.upsert,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await removeAlarm(id);
      return id;
    },
    onSuccess: cache.remove,
  });
  return { cancel, restore, updateLead, remove, refresh: cache.refresh };
}

export function usePhoneVerification() {
  const client = useQueryClient();
  const user = useSession((s) => s.user);
  const send = useMutation({ mutationFn: sendPhoneCode });
  const check = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => checkPhoneCode(phone, code),
    onSuccess: (verified) => {
      if (verified) void client.invalidateQueries({ queryKey: ['account', user?.id] });
    },
  });
  return { send, check };
}

// ── Public data around a venue ─────────────────────────────────

export function useForecast(lat: number | undefined, lon: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['forecast', lat?.toFixed(2), lon?.toFixed(2)],
    queryFn: ({ signal }) => fetchForecast(lat!, lon!, signal),
    enabled: enabled && lat != null && lon != null,
    staleTime: 30 * 60_000,
  });
}

export function useCircuits() {
  return useQuery({ queryKey: ['circuits'], queryFn: ({ signal }) => fetchCircuits(signal), staleTime: Infinity, gcTime: Infinity });
}

export function useArena(event: SportEvent | undefined) {
  const indoor = !!event && event.sport !== 'f1';
  return useQuery({
    queryKey: ['arena', event?.venue.name, event?.venue.city],
    queryFn: ({ signal }) => locateArena(event!.venue, signal),
    enabled: indoor,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** The arena's exact outline from OpenStreetMap, once its object is known. */
export function useFootprint(place: ArenaPlace | null | undefined) {
  const osm = place?.precise ? place.osm : undefined;
  return useQuery({
    queryKey: ['footprint', osm?.type, osm?.id],
    queryFn: ({ signal }) => fetchFootprint(osm!, signal),
    enabled: !!osm && osm.type !== 'N',
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}

// ── The background on an event page ────────────────────────────

const DAY = 24 * 60 * 60_000;

/** A Grand Prix's history: its circuit, every winner there and the race's story. */
export function useF1History(event: SportEvent) {
  return useQuery({
    queryKey: ['history', event.id],
    queryFn: ({ signal }) => fetchF1History(event, signal),
    enabled: event.sport === 'f1',
    staleTime: DAY,
    retry: 1,
  });
}

/** The card's fighters' backgrounds (asked for again when the card changes). */
export function useFighterProfiles(event: SportEvent) {
  const names = cardFighters(event)
    .map((f) => f.fighter.name)
    .join('|');
  return useQuery({
    queryKey: ['fighters', event.id, names],
    queryFn: ({ signal }) => fetchFighterProfiles(event, signal),
    enabled: event.sport === 'ufc',
    staleTime: DAY,
    retry: 1,
  });
}

/**
 * Photos of the event. A Grand Prix's wait for its history, which says where to look (its years,
 * its circuit's article); a fight night's need only its arena and its city.
 */
export function useEventPhotos(event: SportEvent) {
  const history = useF1History(event);
  const waiting = event.sport === 'f1' && history.isPending;
  const sources = useMemo(() => (waiting ? null : gallerySources(event, history.data)), [waiting, event, history.data]);
  return useQuery({
    queryKey: ['photos', sources],
    queryFn: ({ signal }) => fetchGallery(sources!, signal),
    enabled: sources !== null,
    staleTime: DAY,
    retry: 1,
  });
}
