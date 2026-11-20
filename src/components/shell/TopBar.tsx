import clsx from 'clsx';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { Icon, Mark } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/misc';
import { useAlarms } from '@/data/queries';
import { useNow } from '@/hooks/use-now';
import { nextAlarm } from '@/lib/alarms';
import { clockParts, formatRelative, zoneAbbreviation } from '@/lib/time';
import { useClock } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import { openSignIn, useUi } from '@/stores/ui';

const links = [
  { to: '/', label: 'Up next', end: true },
  { to: '/season', label: 'Season' },
  { to: '/alarms', label: 'Alarms' },
  { to: '/settings', label: 'Settings' },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color] duration-300',
        scrolled ? 'border-b border-glass-edge bg-glass-strong backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-4 px-5 md:gap-8 md:px-8">
        <NavLink to="/" className="flex items-center gap-2.5 rounded-full pr-2" aria-label="GameTime, up next">
          <Mark size={28} />
          <span className="wide hidden text-[17px] font-[680] tracking-[-0.01em] sm:inline">GameTime</span>
        </NavLink>

        <nav data-idle-hide aria-label="Main" className="flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                clsx(
                  'relative rounded-full px-3.5 py-2 text-[14px] font-[560] transition-colors duration-200',
                  isActive ? 'text-ink' : 'text-ink-2 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  {isActive ? (
                    <motion.span
                      layoutId="nav-mark"
                      className="absolute inset-x-3.5 -bottom-[3px] h-[2px] rounded-full bg-gold"
                      transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Complication />
          <button
            data-idle-hide
            type="button"
            onClick={() => useUi.getState().open({ kind: 'palette' })}
            className="flex h-9 items-center gap-2.5 rounded-full border border-edge px-3.5 text-[13.5px] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            <Icon name="search" size={16} />
            <span className="hidden md:inline">Search</span>
            <span className="hidden items-center gap-0.5 md:flex">
              <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <span data-idle-hide className="contents">
            <AccountButton />
          </span>
        </div>
      </div>
    </header>
  );
}

/** A watch complication: your time and zone, and the next wake-up when one is set. */
function Complication() {
  const now = useNow(1000);
  const { timeZone, hour12 } = useClock();
  const alarms = useAlarms();
  const next = alarms.data ? nextAlarm(alarms.data, now) : undefined;
  const iso = now.toISOString();
  const { time, period } = clockParts(iso, timeZone, hour12);
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return (
    <div className="hidden items-center gap-4 pr-2 lg:flex" aria-label="Your time">
      {next ? (
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <Icon name="bellRing" size={16} className="text-gold" />
          <span>Wake-up {formatRelative(next.alertTimeUtc, now).toLowerCase()}</span>
        </span>
      ) : null}
      <span className="flex items-baseline gap-1.5 text-ink">
        <span className="tabular text-[15px] font-[400]">
          {time}
          <span className="text-ink-3">:{seconds}</span>
        </span>
        {period ? <span className="text-[11px] font-[600] text-ink-2">{period}</span> : null}
        <span className="text-[11.5px] font-[520] text-ink-3">{zoneAbbreviation(iso, timeZone)}</span>
      </span>
    </div>
  );
}

function AccountButton() {
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  if (!ready) return <span className="size-9" />;
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openSignIn()}
        className="h-9 rounded-full bg-ink px-4 text-[13.5px] font-[600] text-canvas transition-transform active:scale-[0.97]"
      >
        Sign in
      </button>
    );
  }
  return (
    <NavLink
      to="/settings"
      aria-label={`Account, ${user.email ?? user.name}`}
      className="grid size-9 place-items-center rounded-full border border-edge bg-raised text-[13px] font-[680] uppercase text-ink transition-colors hover:border-ink-3"
    >
      {user.name.slice(0, 1)}
    </NavLink>
  );
}
