import { Icon } from '@/components/ui/Icon';
import type { SportEvent } from '@/lib/types';
import { describeWeather, formatTemperature, formatWind } from '@/lib/weather';
import { useTemperatureUnit } from '@/stores/preferences';

import { useSessionWeather, weatherIcons } from './weather-data';

export function WeatherReading({ event, startUtc, compact }: { event: SportEvent; startUtc: string; compact?: boolean }) {
  const unit = useTemperatureUnit();
  const { hour, outdoor, inRange } = useSessionWeather(event, startUtc);
  if (!outdoor) return compact ? null : <span className="text-[13.5px] text-ink-2">Indoors</span>;
  if (!inRange || !hour) return compact ? null : <span className="text-[13.5px] text-ink-3">Forecast opens 16 days out</span>;
  const look = describeWeather(hour.weatherCode, hour.isDay);
  return (
    <span className="inline-flex items-center gap-2 text-[13.5px] text-ink">
      <Icon name={weatherIcons[look.icon]} size={18} className="text-ink-2" />
      <span className="tabular font-[520]">{formatTemperature(hour.temperatureC, unit)}</span>
      <span className="text-ink-2">{look.label}</span>
      {!compact && hour.precipitationProbability != null ? (
        <span className="text-ink-3">{hour.precipitationProbability}% rain</span>
      ) : null}
      {!compact ? <span className="text-ink-3">{formatWind(hour.windKph, unit)}</span> : null}
    </span>
  );
}
