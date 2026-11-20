import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { defaultSessionFilters, type SessionFilters } from '@/lib/sessions';
import { DEFAULT_NIGHT, deviceTimeZone, deviceUses12h, type NightWindow } from '@/lib/time';
import type { SessionKind, Sport } from '@/lib/types';
import { deviceTemperatureUnit, type TemperatureUnit } from '@/lib/weather';

/** 'event': Midnight when the next session starts inside your night, Porcelain otherwise. */
export type ThemeMode = 'system' | 'event' | 'midnight' | 'porcelain';
export type ClockMode = 'auto' | '12h' | '24h';

/** Your choices, kept in this browser. Account state lives on the server. */
export interface PreferencesState {
  theme: ThemeMode;
  /** null follows the computer's zone. */
  timeZone: string | null;
  clock: ClockMode;
  temperature: TemperatureUnit | 'auto';
  followedSports: Sport[];
  sessionFilters: SessionFilters;
  night: NightWindow;
  defaultLead: number;
  /** Slowly orbit the venue maps. Off for people who'd rather the map stay still. */
  orbit: boolean;
  /** While GameTime is open, also chime and show a notification on this computer when an alarm rings. */
  chime: boolean;
  setTheme(theme: ThemeMode): void;
  setTimeZone(zone: string | null): void;
  setClock(clock: ClockMode): void;
  setTemperature(unit: TemperatureUnit | 'auto'): void;
  toggleSport(sport: Sport): void;
  setKinds(sport: Sport, kinds: SessionKind[]): void;
  setNight(night: NightWindow): void;
  setDefaultLead(minutes: number): void;
  setOrbit(orbit: boolean): void;
  setChime(chime: boolean): void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'midnight',
      timeZone: null,
      clock: 'auto',
      temperature: 'auto',
      followedSports: ['f1', 'ufc'],
      sessionFilters: defaultSessionFilters,
      night: DEFAULT_NIGHT,
      defaultLead: 10,
      orbit: true,
      chime: false,
      setTheme: (theme) => set({ theme }),
      setTimeZone: (timeZone) => set({ timeZone }),
      setClock: (clock) => set({ clock }),
      setTemperature: (temperature) => set({ temperature }),
      toggleSport: (sport) =>
        set((s) => {
          const has = s.followedSports.includes(sport);
          // Keep at least one sport, or the schedule would be empty with no way to tell why.
          if (has && s.followedSports.length === 1) return s;
          return { followedSports: has ? s.followedSports.filter((x) => x !== sport) : [...s.followedSports, sport] };
        }),
      setKinds: (sport, kinds) => set((s) => ({ sessionFilters: { ...s.sessionFilters, [sport]: kinds } })),
      setNight: (night) => set({ night }),
      setDefaultLead: (defaultLead) => set({ defaultLead }),
      setOrbit: (orbit) => set({ orbit }),
      setChime: (chime) => set({ chime }),
    }),
    {
      name: 'gametime-desktop.preferences',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** The zone and clock to render with, after "follow the computer" defaults are resolved. */
export function useClock(): { timeZone: string; hour12: boolean; isOverride: boolean } {
  const zone = usePreferences((s) => s.timeZone);
  const clock = usePreferences((s) => s.clock);
  return {
    timeZone: zone ?? deviceTimeZone(),
    hour12: clock === 'auto' ? deviceUses12h() : clock === '12h',
    isOverride: zone !== null,
  };
}

export function useTemperatureUnit(): TemperatureUnit {
  const unit = usePreferences((s) => s.temperature);
  return unit === 'auto' ? deviceTemperatureUnit() : unit;
}
