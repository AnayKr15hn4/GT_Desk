import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';

import { DelftFlourish } from '@/components/delft/Delft';
import { ChimeRow } from '@/components/settings/ChimeRow';
import { NightDial } from '@/components/settings/NightDial';
import { Button } from '@/components/ui/Button';
import { InsetGroup, Row } from '@/components/ui/Inset';
import { Icon } from '@/components/ui/Icon';
import { Segmented, TogglePill } from '@/components/ui/Segmented';
import { Kbd } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast-store';
import { useAccount } from '@/data/queries';
import { useNow } from '@/hooks/use-now';
import { usePageTitle } from '@/hooks/use-page-title';
import { supabaseConfigured } from '@/data/supabase';
import { leadTimeOptions } from '@/lib/alarms';
import { sessionKindsBySport, sessionLabels, sportMeta, sports, toggleKind, orderKinds } from '@/lib/sessions';
import { DEFAULT_NIGHT, deviceTimeZone, formatMinuteOfDay, formatUtcOffset, zoneCity, zoneOffsetMinutes } from '@/lib/time';
import { maskPhone } from '@/lib/text';
import { useClock, usePreferences, type ClockMode, type ThemeMode } from '@/stores/preferences';
import { signOut, useSession } from '@/stores/session';
import { openSignIn, useUi } from '@/stores/ui';

const NIGHT_PRESETS = [
  { label: 'Early riser', night: { startMin: 21 * 60 + 30, endMin: 5 * 60 } },
  { label: 'Default', night: DEFAULT_NIGHT },
  { label: 'Night owl', night: { startMin: 0, endMin: 8 * 60 } },
];

export function SettingsPage() {
  usePageTitle('Settings');
  const prefs = usePreferences();
  const { timeZone, hour12, isOverride } = useClock();
  const user = useSession((s) => s.user);
  const account = useAccount();
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [hash]);

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [deviceTimeZone()];
    }
  }, []);
  const now = useNow(60_000).toISOString();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-16 px-5 pt-32 pb-32 md:px-8">
      <header className="relative flex flex-col gap-4">
        <DelftFlourish className="pointer-events-none absolute -top-16 -right-4 hidden w-[min(560px,48%)] lg:block" />
        <h1 className="wide text-[clamp(52px,5vw,88px)] leading-[0.9] font-[680] tracking-[-0.035em]">Settings</h1>
        <p className="max-w-[60ch] text-[16.5px] text-ink-2">Choices here are kept on this computer. Your alarms and plan live with your account.</p>
      </header>

      <InsetGroup title="Account">
        {user ? (
          <>
            <Row>
              <Icon name="person" size={20} className="text-ink-2" />
              <div className="flex flex-1 flex-col">
                <span className="text-[15.5px] font-[600]">{user.email ?? user.name}</span>
                <span className="text-[13px] text-ink-3">{account.data?.plan === 'premium' ? 'Premium' : 'Free plan'}</span>
              </div>
              <Button
                variant="ghost"
                icon="signOut"
                onClick={() =>
                  void signOut()
                    .then(() => toast('Signed out of this computer. Your phone stays signed in.'))
                    .catch(() => toast("Couldn't sign out. Check your connection and try again."))
                }
              >
                Sign out
              </Button>
            </Row>
            <Row>
              <Icon name="phone" size={20} className="text-ink-2" />
              <div className="flex flex-1 flex-col">
                <span className="text-[15.5px] font-[600]">Phone number</span>
                <span className="text-[13px] text-ink-3">
                  {account.data?.phone ? `${maskPhone(account.data.phone.e164)}${account.data.phone.verified ? ', verified' : ', not verified yet'}` : 'Wake-up calls need a verified number'}
                </span>
              </div>
              <Button variant="secondary" onClick={() => useUi.getState().open({ kind: 'phone' })}>
                {account.data?.phone?.verified ? 'Change number' : 'Verify a number'}
              </Button>
            </Row>
          </>
        ) : (
          <Row>
            <Icon name="person" size={20} className="text-ink-2" />
            <div className="flex flex-1 flex-col">
              <span className="text-[15.5px] font-[600]">Not signed in</span>
              <span className="text-[13px] text-ink-3">{supabaseConfigured ? 'Sign in with the email you use on your phone.' : 'Add the Supabase keys to .env.local to sign in.'}</span>
            </div>
            <Button variant="primary" onClick={() => openSignIn()} disabled={!supabaseConfigured}>
              Sign in
            </Button>
          </Row>
        )}
      </InsetGroup>

      <section id="night" className="scroll-mt-28 flex flex-col gap-2.5">
        <h3 className="px-1 text-[13px] font-[620] text-ink-2">Your night</h3>
        <div className="grid grid-cols-1 items-center justify-items-center gap-10 rounded-[28px] border border-hairline bg-surface p-8 shadow-1 md:grid-cols-[auto_minmax(0,1fr)] md:justify-items-stretch md:gap-12 md:p-10">
          <NightDial night={prefs.night} onChange={prefs.setNight} hour12={hour12} />
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="numerals text-[40px] leading-none">
                {formatMinuteOfDay(prefs.night.startMin, hour12)} <span className="text-ink-3">to</span> {formatMinuteOfDay(prefs.night.endMin, hour12)}
              </p>
              <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-ink-2">
                The hours you'd rather be asleep. Sessions that start inside them are marked overnight, and the week chronograph shades them. Drag the handles, or focus one and use the arrow keys.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {NIGHT_PRESETS.map((p) => (
                <TogglePill key={p.label} pressed={p.night.startMin === prefs.night.startMin && p.night.endMin === prefs.night.endMin} onClick={() => prefs.setNight(p.night)}>
                  {p.label}
                </TogglePill>
              ))}
            </div>
          </div>
        </div>
      </section>

      <InsetGroup title="Time" footer={`Times show in ${zoneCity(timeZone)} time (${formatUtcOffset(zoneOffsetMinutes(now, timeZone))}). Travelling? Pick the zone you'll be in.`}>
        <Row>
          <Icon name="globe" size={20} className="text-ink-2" />
          <span className="flex-1 text-[15.5px] font-[560]">Time zone</span>
          <select
            value={isOverride ? timeZone : ''}
            onChange={(e) => prefs.setTimeZone(e.target.value || null)}
            className="h-10 max-w-[min(320px,100%)] rounded-full border border-edge bg-surface px-4 text-[14px] text-ink outline-none hover:border-ink-3 focus:border-gold"
          >
            <option value="">Follow this computer ({zoneCity(deviceTimeZone())})</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Row>
        <Row>
          <Icon name="clock" size={20} className="text-ink-2" />
          <span className="flex-1 text-[15.5px] font-[560]">Clock</span>
          <Segmented<ClockMode>
            label="Clock"
            value={prefs.clock}
            onChange={prefs.setClock}
            size="sm"
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: '12h', label: '12-hour' },
              { value: '24h', label: '24-hour' },
            ]}
          />
        </Row>
        <Row>
          <Icon name="sun" size={20} className="text-ink-2" />
          <span className="flex-1 text-[15.5px] font-[560]">Temperature</span>
          <Segmented
            label="Temperature"
            value={prefs.temperature}
            onChange={prefs.setTemperature}
            size="sm"
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'celsius', label: '°C' },
              { value: 'fahrenheit', label: '°F' },
            ]}
          />
        </Row>
      </InsetGroup>

      <InsetGroup title="Sports and sessions" footer="The schedule, the week chronograph and search show only these.">
        {sports.map((sport) => {
          const kinds = prefs.sessionFilters[sport];
          const followed = prefs.followedSports.includes(sport);
          return (
            <div key={sport} className="flex flex-col gap-4 px-5 py-5">
              <div className="flex items-center gap-4">
                <Icon name={sport === 'f1' ? 'flag' : 'glove'} size={20} className="text-ink-2" />
                <span className="flex-1 text-[15.5px] font-[600]">{sportMeta[sport].name}</span>
                <TogglePill pressed={followed} onClick={() => prefs.toggleSport(sport)}>
                  {followed ? 'Following' : 'Follow'}
                </TogglePill>
              </div>
              {followed ? (
                <div className="flex flex-wrap gap-2 pl-9">
                  {sessionKindsBySport[sport].map((k) => (
                    <TogglePill key={k} pressed={kinds.includes(k)} onClick={() => prefs.setKinds(sport, orderKinds(sport, toggleKind(kinds, k, sessionKindsBySport[sport])))}>
                      {sessionLabels[k].label}
                    </TogglePill>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </InsetGroup>

      <InsetGroup title="Wake-up calls">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5">
          <Icon name="bellRing" size={20} className="text-ink-2" />
          <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <span className="text-[15.5px] font-[560]">How early, by default</span>
            <span className="text-[13px] text-ink-3">The starting choice each time you set one.</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {leadTimeOptions.map((m) => (
              <TogglePill key={m} pressed={prefs.defaultLead === m} onClick={() => prefs.setDefaultLead(m)}>
                {m === 0 ? 'At start' : m < 60 ? `${m} min` : '1 hr'}
              </TogglePill>
            ))}
          </div>
        </div>
        <ChimeRow />
      </InsetGroup>

      <InsetGroup title="Appearance">
        <Row>
          <Icon name="moon" size={20} className="text-ink-2" />
          <span className="flex-1 text-[15.5px] font-[560]">Theme</span>
          <Segmented<ThemeMode>
            label="Theme"
            value={prefs.theme}
            onChange={prefs.setTheme}
            size="sm"
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'event', label: 'By start time' },
              { value: 'midnight', label: 'Midnight' },
              { value: 'porcelain', label: 'Porcelain' },
            ]}
          />
        </Row>
        <Row>
          <Icon name="rotate" size={20} className="text-ink-2" />
          <div className="flex flex-1 flex-col">
            <span className="text-[15.5px] font-[560]">Orbit the venue maps</span>
            <span className="text-[13px] text-ink-3">The maps turn slowly around the venue. Your computer's reduced motion setting always stops it.</span>
          </div>
          <TogglePill pressed={prefs.orbit} onClick={() => prefs.setOrbit(!prefs.orbit)}>
            {prefs.orbit ? 'On' : 'Off'}
          </TogglePill>
        </Row>
        <Row onClick={() => useUi.getState().open({ kind: 'shortcuts' })}>
          <Icon name="keyboard" size={20} className="text-ink-2" />
          <span className="flex-1 text-[15.5px] font-[560]">Keyboard shortcuts</span>
          <Kbd>?</Kbd>
        </Row>
      </InsetGroup>

      <section className="flex flex-col gap-2.5">
        <h3 className="px-1 text-[13px] font-[620] text-ink-2">Data sources</h3>
        <p className="max-w-[78ch] px-1 text-[13px] leading-relaxed text-ink-3">
          Schedules from GameTime's server (Formula 1 from Jolpica and OpenF1, UFC from ESPN's public data). Maps from OpenFreeMap with OpenMapTiles, data from OpenStreetMap
          contributors. Racing lines from bacinger/f1-circuits (MIT). Arena locations from Photon by komoot. Weather from Open-Meteo.com (CC BY 4.0). Interface pieces from React Bits.
          GameTime is not affiliated with Formula 1 or the UFC.
        </p>
      </section>
    </div>
  );
}
