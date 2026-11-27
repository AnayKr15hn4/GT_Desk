import type { Forecast, HourlyForecast } from './types';

/** Open-Meteo's free forecast reaches 16 days ahead. */
export const FORECAST_DAYS = 16;

export type WeatherIcon = 'sun' | 'moon' | 'cloud-sun' | 'cloud-moon' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export interface WeatherLook {
  label: string;
  icon: WeatherIcon;
}

/** WMO weather interpretation codes (as returned by Open-Meteo) to a label and an icon. */
export function describeWeather(code: number, isDay: boolean): WeatherLook {
  if (code === 0) return { label: 'Clear', icon: isDay ? 'sun' : 'moon' };
  if (code === 1 || code === 2) return { label: code === 1 ? 'Mostly clear' : 'Partly cloudy', icon: isDay ? 'cloud-sun' : 'cloud-moon' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'drizzle' };
  if (code === 56 || code === 57 || code === 66 || code === 67) return { label: 'Freezing rain', icon: 'rain' };
  if (code === 61 || code === 63) return { label: 'Rain', icon: 'rain' };
  if (code === 65) return { label: 'Heavy rain', icon: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'rain' };
  if (code === 95) return { label: 'Thunderstorms', icon: 'storm' };
  if (code === 96 || code === 99) return { label: 'Storms and hail', icon: 'storm' };
  return { label: 'Unknown', icon: 'cloud' };
}

/** The hourly slot nearest the session start, or null when it falls outside the forecast. */
export function pickHour(forecast: Forecast | undefined, startUtc: string): HourlyForecast | null {
  if (!forecast || forecast.hours.length === 0) return null;
  const target = Date.parse(startUtc);
  let best: HourlyForecast | null = null;
  let bestDelta = Infinity;
  for (const hour of forecast.hours) {
    const delta = Math.abs(Date.parse(hour.timeUtc) - target);
    if (delta < bestDelta) {
      best = hour;
      bestDelta = delta;
    }
  }
  return bestDelta <= 90 * 60_000 ? best : null;
}

/** The hours around a session start (2 before, 4 after), for a small strip. */
export function hoursAround(forecast: Forecast | undefined, startUtc: string, before = 2, after = 4): HourlyForecast[] {
  if (!forecast) return [];
  const t = Date.parse(startUtc);
  return forecast.hours.filter((h) => {
    const d = (Date.parse(h.timeUtc) - t) / 3_600_000;
    return d >= -before - 0.01 && d <= after + 0.01;
  });
}

export function isWithinForecastHorizon(startUtc: string, now: Date = new Date()): boolean {
  return Date.parse(startUtc) - now.getTime() < (FORECAST_DAYS - 1) * 24 * 60 * 60_000;
}

export type TemperatureUnit = 'celsius' | 'fahrenheit';

function toUnit(celsius: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? celsius * (9 / 5) + 32 : celsius;
}

export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return `${Math.round(toUnit(celsius, unit))}°`;
}

export function formatWind(kph: number, unit: TemperatureUnit): string {
  return unit === 'fahrenheit' ? `${Math.round(kph * 0.621371)} mph` : `${Math.round(kph)} km/h`;
}

/** Countries that use Fahrenheit, keyed by the region part of a locale ("en-US" → "US"). */
const FAHRENHEIT_REGIONS = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH']);

export function deviceTemperatureUnit(): TemperatureUnit {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && FAHRENHEIT_REGIONS.has(region) ? 'fahrenheit' : 'celsius';
  } catch {
    return 'celsius';
  }
}
