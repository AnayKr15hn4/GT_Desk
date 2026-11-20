import clsx from 'clsx';

import { Icon } from '@/components/ui/Icon';
import { formatClock } from '@/lib/time';
import type { SportEvent } from '@/lib/types';
import { describeWeather, formatTemperature, hoursAround } from '@/lib/weather';
import { useClock, useTemperatureUnit } from '@/stores/preferences';

import { useSessionWeather, weatherIcons } from './weather-data';

/** Hour by hour around a session's start, in the venue's own time. */
export function WeatherStrip({ event, startUtc }: { event: SportEvent; startUtc: string }) {
  const { hour12 } = useClock();
  const unit = useTemperatureUnit();
  const { forecast, outdoor, inRange } = useSessionWeather(event, startUtc);
  const zone = event.venue.timeZone ?? 'UTC';
  if (!outdoor) return <p className="text-[14.5px] text-ink-2">Indoors, so the weather won't matter.</p>;
  if (!inRange) return <p className="text-[14.5px] text-ink-2">The forecast opens 16 days before the start.</p>;
  const hours = hoursAround(forecast, startUtc, 2, 4);
  if (hours.length === 0) return <p className="text-[14.5px] text-ink-3">Loading the forecast…</p>;
  const startHour = Math.round(Date.parse(startUtc) / 3_600_000);
  return (
    <ol className="grid grid-cols-7 gap-2">
      {hours.slice(0, 7).map((h) => {
        const look = describeWeather(h.weatherCode, h.isDay);
        const isStart = Math.round(Date.parse(h.timeUtc) / 3_600_000) === startHour;
        return (
          <li
            key={h.timeUtc}
            className={clsx(
              'flex flex-col items-center gap-2.5 rounded-[16px] border px-2 py-4',
              isStart ? 'border-[color-mix(in_srgb,var(--gold)_45%,transparent)] bg-gold-soft' : 'border-hairline bg-surface',
            )}
          >
            <span className={clsx('tabular text-[12px] font-[560]', isStart ? 'text-gold' : 'text-ink-3')}>{isStart ? 'Start' : formatClock(h.timeUtc, zone, hour12)}</span>
            <Icon name={weatherIcons[look.icon]} size={22} className="text-ink-2" />
            <span className="numerals text-[22px] leading-none font-[300]">{formatTemperature(h.temperatureC, unit)}</span>
            <span className="tabular text-[11.5px] text-ink-3">{h.precipitationProbability ?? 0}%</span>
          </li>
        );
      })}
    </ol>
  );
}
