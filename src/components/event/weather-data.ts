import type { IconName } from '@/components/ui/Icon';
import { useForecast } from '@/data/queries';
import { useNow } from '@/hooks/use-now';
import type { SportEvent } from '@/lib/types';
import { isWithinForecastHorizon, pickHour, type WeatherIcon } from '@/lib/weather';

export const weatherIcons: Record<WeatherIcon, IconName> = {
  sun: 'sun',
  moon: 'moon',
  'cloud-sun': 'cloudSun',
  'cloud-moon': 'cloud',
  cloud: 'cloud',
  fog: 'fog',
  drizzle: 'rain',
  rain: 'rain',
  snow: 'snow',
  storm: 'storm',
};

/** The forecast at a session's start, for outdoor venues within the 16-day horizon. */
export function useSessionWeather(event: SportEvent | undefined, startUtc: string | undefined) {
  const now = useNow(60_000);
  const outdoor = !!event && !event.venue.indoor;
  const inRange = !!startUtc && isWithinForecastHorizon(startUtc, now);
  const forecast = useForecast(event?.venue.lat, event?.venue.lon, outdoor && inRange);
  const hour = startUtc ? pickHour(forecast.data, startUtc) : null;
  return { hour, forecast: forecast.data, outdoor, inRange, isLoading: forecast.isLoading };
}
