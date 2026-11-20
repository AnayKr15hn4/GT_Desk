import { useMemo } from 'react';

import { circuitForEvent } from '@/data/external';
import { useArena, useCircuits, useFootprint } from '@/data/queries';
import type { LngLat } from '@/lib/geo';
import type { SportEvent } from '@/lib/types';

import type { ArenaHint, VenueFocus } from './VenueMap';

export interface VenueView {
  focus: VenueFocus | null;
  track?: LngLat[];
  /** The arena whose building the map lights in gold. */
  arena?: ArenaHint;
  /** False when only the city is known (some arenas aren't in OpenStreetMap by name). */
  precise: boolean;
  kind: 'circuit' | 'arena';
  lapKm?: number;
  circuitName?: string;
  firstGp?: number;
}

/**
 * How to frame an event's venue: the whole lap of a circuit, or a close look at an arena with its
 * building in gold. Waits for the lookups (usually a few hundred ms) so the camera flies once.
 */
export function useVenueView(event: SportEvent | undefined): VenueView {
  const circuits = useCircuits();
  const arena = useArena(event);
  const footprint = useFootprint(arena.data);
  return useMemo(() => {
    if (!event) return { focus: null, precise: false, kind: 'arena' };
    const { lat, lon } = event.venue;
    const city: VenueFocus | null = lat != null && lon != null ? { center: [lon, lat], zoom: 14.6 } : null;

    if (event.sport === 'f1') {
      if (circuits.isLoading) return { focus: null, precise: false, kind: 'circuit' };
      const circuit = circuitForEvent(event, circuits.data);
      if (circuit) {
        return {
          focus: { center: circuit.center, fit: circuit.line },
          track: circuit.line,
          precise: true,
          kind: 'circuit',
          lapKm: circuit.lengthM ? circuit.lengthM / 1000 : undefined,
          circuitName: circuit.name,
          firstGp: circuit.firstGp,
        };
      }
      return { focus: city && { ...city, zoom: 14.2 }, precise: !!city, kind: 'circuit' };
    }

    if (arena.isLoading) return { focus: null, precise: false, kind: 'arena' };
    const place = arena.data;
    if (place?.precise) {
      return {
        focus: { center: place.center, zoom: 16.4 },
        // Wait for OpenStreetMap's outline (usually cached), so the building is picked out once.
        arena: footprint.isLoading ? undefined : { center: place.center, footprint: footprint.data ?? undefined, extent: place.extent },
        precise: true,
        kind: 'arena',
      };
    }
    if (place) return { focus: { center: place.center, zoom: 14.6 }, precise: false, kind: 'arena' };
    return { focus: city, precise: false, kind: 'arena' };
  }, [event, circuits.isLoading, circuits.data, arena.isLoading, arena.data, footprint.data, footprint.isLoading]);
}
