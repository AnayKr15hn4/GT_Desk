import { describe, expect, it } from 'vitest';

import { distanceKm, grow, type LngLat } from '@/lib/geo';
import type { SportEvent } from '@/lib/types';

import { fromCode, messageOf } from './errors';
import { assembleRings, circuitForEvent, namesMatch, type Circuit } from './external';

describe('arena lookup', () => {
  it('matches names on a distinctive word, not on "Arena"', () => {
    expect(namesMatch('Scotiabank Arena', 'Scotiabank Arena')).toBe(true);
    expect(namesMatch('T-Mobile Arena', 'T-Mobile Arena')).toBe(true);
    expect(namesMatch('ANB Arena', 'ZAG Arena')).toBe(false);
    expect(namesMatch('Meta APEX', 'UFC Apex')).toBe(true);
  });
});

describe('arena outline', () => {
  const a: LngLat = [0, 0];
  const b: LngLat = [1, 0];
  const c: LngLat = [1, 1];
  const d: LngLat = [0, 1];

  it('joins split way pieces into a closed ring, reversing pieces when needed', () => {
    const rings = assembleRings([
      [a, b],
      [c, b],
      [c, d, a],
    ]);
    expect(rings).toEqual([[a, b, c, d, a]]);
  });

  it('drops pieces that never close', () => {
    expect(assembleRings([[a, b, c]])).toEqual([]);
  });

  it('grows a ring outward by about the asked distance', () => {
    const square: LngLat[] = [
      [-115.1793, 36.1016],
      [-115.1771, 36.1016],
      [-115.1771, 36.1037],
      [-115.1793, 36.1037],
    ];
    const grown = grow(square, 1);
    const before = distanceKm(square[0][1], square[0][0], square[2][1], square[2][0]) * 1000;
    const after = distanceKm(grown[0][1], grown[0][0], grown[2][1], grown[2][0]) * 1000;
    expect(after - before).toBeGreaterThan(1.9);
    expect(after - before).toBeLessThan(2.1);
  });
});

describe('circuit match', () => {
  const vegas: Circuit = { id: 'us-2023', name: 'Las Vegas Street Circuit', line: [], center: [-115.169, 36.115] };
  const event = (lat: number, lon: number, sport: 'f1' | 'ufc' = 'f1') => ({ sport, venue: { lat, lon } }) as SportEvent;

  it('finds the circuit within 5 km of the venue', () => {
    expect(circuitForEvent(event(36.1147, -115.173), [vegas])?.id).toBe('us-2023');
    expect(circuitForEvent(event(36.3, -115.173), [vegas])).toBeNull();
    expect(circuitForEvent(event(36.1147, -115.173, 'ufc'), [vegas])).toBeNull();
  });
});

describe('server errors', () => {
  it('turns backend codes into plain sentences', () => {
    expect(fromCode('paywall_calls').message).toBe('Phone calls are part of Premium.');
    expect(fromCode('something_new').message).toBe('Something went wrong. Try again.');
    expect(messageOf(new TypeError('Failed to fetch'))).toMatch(/No connection/);
  });
});
