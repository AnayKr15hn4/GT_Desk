import { Command } from 'cmdk';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Dialog } from '@/components/ui/Dialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/misc';
import { useEvents } from '@/data/queries';
import { useNow } from '@/hooks/use-now';
import { sessionState, upcomingEvents } from '@/lib/schedule';
import { sportMeta } from '@/lib/sessions';
import { fold } from '@/lib/text';
import { formatClock, formatDayLabel } from '@/lib/time';
import { useClock, usePreferences } from '@/stores/preferences';
import { openSetAlarm, useUi } from '@/stores/ui';

/** ⌘K: jump to any event, session or page, or run an action, from the keyboard. */
export function CommandPalette() {
  const open = useUi((s) => s.dialog.kind === 'palette');
  const close = useUi((s) => s.close);
  return (
    <Dialog open={open} onClose={close} title="Search" width={660} bare>
      {open ? <Palette onDone={close} /> : null}
    </Dialog>
  );
}

function Palette({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const { events } = useEvents();
  const now = useNow(60_000);
  const { timeZone, hour12 } = useClock();
  const prefs = usePreferences();
  const [query, setQuery] = useState('');
  const upcoming = useMemo(() => upcomingEvents(events, now), [events, now]);

  const go = (path: string) => {
    onDone();
    navigate(path);
  };

  return (
    <Command
      label="Search GameTime"
      className="flex max-h-[70vh] flex-col"
      loop
      // Every word must appear somewhere, in any order ("vegas race" finds "Race, Las Vegas GP").
      filter={(value, search) => {
        const words = fold(search).split(/\s+/).filter(Boolean);
        const text = fold(value);
        if (!words.every((w) => text.includes(w))) return 0;
        return text.startsWith(words[0] ?? '') ? 1 : 0.6;
      }}
    >
      <div className="flex items-center gap-3 border-b border-hairline px-6">
        <Icon name="search" size={20} className="text-ink-3" />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search events, sessions, venues"
          className="h-16 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-3"
        />
        <Kbd>Esc</Kbd>
      </div>
      <Command.List className="overflow-y-auto overscroll-contain px-3 py-3 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[12.5px] [&_[cmdk-group-heading]]:font-[620] [&_[cmdk-group-heading]]:text-ink-3">
        <Command.Empty className="px-4 py-10 text-center text-[14px] text-ink-2">Nothing matches “{query}”.</Command.Empty>

        <Command.Group heading="Events">
          {upcoming.map((e) => (
            <Item
              key={e.id}
              icon={e.sport === 'f1' ? 'flag' : 'glove'}
              value={`${e.name} ${e.shortName} ${e.venue.name} ${e.venue.city} ${e.venue.country} ${sportMeta[e.sport].name} ${e.subtitle ?? ''}`}
              onSelect={() => go(`/event/${e.id}`)}
              title={e.name}
              detail={`${e.venue.city}, ${e.venue.country}`}
            />
          ))}
        </Command.Group>

        {query.trim().length > 1 ? (
          <Command.Group heading="Sessions">
            {upcoming.flatMap((e) =>
              e.sessions
                .filter((s) => !s.isCancelled && sessionState(s, now) === 'upcoming')
                .map((s) => (
                  <Item
                    key={s.id}
                    icon="clock"
                    value={`${s.label} ${e.name} ${e.shortName} ${e.venue.city} session`}
                    onSelect={() => {
                      onDone();
                      openSetAlarm(e.id, [s.id]);
                    }}
                    title={`${s.label}, ${e.shortName}`}
                    detail={`${formatDayLabel(s.startUtc, timeZone, now)} at ${formatClock(s.startUtc, timeZone, hour12)}`}
                    hint="Set wake-up"
                  />
                )),
            )}
          </Command.Group>
        ) : null}

        <Command.Group heading="Go to">
          <Item icon="clock" value="up next home" onSelect={() => go('/')} title="Up next" />
          <Item icon="globe" value="season calendar globe" onSelect={() => go('/season')} title="Season" />
          <Item icon="bell" value="alarms wake-up calls" onSelect={() => go('/alarms')} title="Alarms" />
          <Item icon="gear" value="settings preferences" onSelect={() => go('/settings')} title="Settings" />
        </Command.Group>

        <Command.Group heading="Do">
          <Item
            icon={prefs.theme === 'porcelain' ? 'moon' : 'sun'}
            value="theme dark light appearance midnight porcelain"
            onSelect={() => {
              prefs.setTheme(prefs.theme === 'porcelain' ? 'midnight' : 'porcelain');
              onDone();
            }}
            title={prefs.theme === 'porcelain' ? 'Switch to Midnight' : 'Switch to Porcelain'}
          />
          <Item
            icon={prefs.orbit ? 'pause' : 'play'}
            value="orbit rotate map motion"
            onSelect={() => {
              prefs.setOrbit(!prefs.orbit);
              onDone();
            }}
            title={prefs.orbit ? 'Stop orbiting the maps' : 'Orbit the maps'}
          />
          <Item icon="keyboard" value="keyboard shortcuts help" onSelect={() => useUi.getState().open({ kind: 'shortcuts' })} title="Keyboard shortcuts" />
        </Command.Group>
      </Command.List>
    </Command>
  );
}

function Item({ icon, value, onSelect, title, detail, hint }: { icon: IconName; value: string; onSelect: () => void; title: string; detail?: string; hint?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3.5 rounded-[14px] px-3 py-2.5 text-ink-2 aria-selected:bg-raised aria-selected:text-ink"
    >
      <Icon name={icon} size={18} className="shrink-0" />
      <span className="flex min-w-0 flex-1 items-baseline gap-3">
        <span className="truncate text-[15px] font-[540] text-ink">{title}</span>
        {detail ? <span className="truncate text-[13px] text-ink-3">{detail}</span> : null}
      </span>
      {hint ? <span className="text-[12.5px] text-gold opacity-0 group-aria-selected:opacity-100">{hint}</span> : null}
    </Command.Item>
  );
}
