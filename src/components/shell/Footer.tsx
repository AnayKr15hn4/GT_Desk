import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/misc';
import { modKey } from '@/lib/platform';
import { usePreferences, type ThemeMode } from '@/stores/preferences';
import { useUi } from '@/stores/ui';

const PAGES = [
  { to: '/', label: 'Up next' },
  { to: '/season', label: 'Season' },
  { to: '/alarms', label: 'Alarms' },
  { to: '/settings', label: 'Settings' },
];

/** Where everything on screen comes from, each linked. */
const SOURCES = [
  { name: 'Jolpica', href: 'https://jolpi.ca' },
  { name: 'ESPN', href: 'https://www.espn.com/mma/' },
  { name: 'OpenFreeMap', href: 'https://openfreemap.org' },
  { name: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { name: 'Open-Meteo', href: 'https://open-meteo.com' },
  { name: 'Wikipedia', href: 'https://en.wikipedia.org' },
  { name: 'Wikimedia Commons', href: 'https://commons.wikimedia.org' },
];

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Automatic' },
  { value: 'event', label: 'By start time' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'porcelain', label: 'Porcelain' },
];

const YEAR = new Date().getFullYear();

/**
 * "GameTime" set in the wordmark's type (Archivo, weight 800, normal width, tracking -0.05em) is
 * this many times wider than its font size, measured in the browser. A font size of the window's
 * width over it fills the window edge to edge; measure again if the type changes.
 */
const WORDMARK_WIDTH = 5.11;

const PILL =
  'inline-flex h-11 items-center gap-2.5 rounded-full border border-edge px-5 text-[14px] font-[560] text-ink transition-colors hover:border-ink-3 hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]';

/**
 * The foot of every page, a screen of its own: a line on what GameTime does with its two main
 * actions, the pages, and the name set huge across the whole window, almost to its edges, over a
 * line of small print (where the data comes from, and the theme).
 */
export function Footer({ onSetNext }: { onSetNext?: () => void }) {
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const open = useUi((s) => s.open);
  const current = Math.max(0, THEMES.findIndex((t) => t.value === theme));
  const next = THEMES[(current + 1) % THEMES.length];

  return (
    <footer className="flex min-h-[min(100svh,1000px)] flex-col justify-between gap-16 overflow-x-clip bg-canvas-deep pt-[clamp(88px,14vh,160px)] pb-6">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col justify-between gap-14 px-5 md:flex-row md:items-start md:px-8">
        <div className="flex flex-col items-start gap-9">
          <p className="text-[clamp(44px,5.4vw,84px)] leading-[0.96] font-[430] tracking-[-0.04em]">
            Sleep easy.
            <br />
            We'll call you.
          </p>
          <div className="flex flex-wrap gap-3">
            {onSetNext ? (
              <button type="button" onClick={onSetNext} className={PILL}>
                Set the next wake-up call
                <Icon name="bellRing" size={17} />
              </button>
            ) : (
              <Link to="/season" className={PILL}>
                See the season
                <Icon name="globe" size={17} />
              </Link>
            )}
            <button type="button" onClick={() => open({ kind: 'palette' })} className={PILL}>
              Search events
              <span className="flex items-center gap-0.5">
                <Kbd>{modKey}</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          </div>
        </div>

        <nav aria-label="Pages" className="flex flex-col items-start gap-1 md:min-w-[240px] md:pt-3">
          {PAGES.map((p) => (
            <FooterLink key={p.to} to={p.to}>
              {p.label}
            </FooterLink>
          ))}
          <button
            type="button"
            onClick={() => open({ kind: 'shortcuts' })}
            className="text-[clamp(18px,1.5vw,22px)] leading-[1.3] text-ink underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
          >
            Keyboard shortcuts
          </button>
        </nav>
      </div>

      <div className="flex flex-col gap-6">
        {/*
          The name across the whole window, 8 px from each edge (past the page's margins): its size
          is the space's width over the word's own width.
        */}
        <div aria-hidden className="px-2">
          <div className="[container-type:inline-size]">
            <p
              className="-mb-[0.06em] leading-[0.8] font-[800] tracking-[-0.05em] whitespace-nowrap text-ink select-none"
              style={{ fontSize: `calc(100cqw / ${WORDMARK_WIDTH})` }}
            >
              GameTime
            </p>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-5 text-[12.5px] text-ink-3 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <p className="shrink-0">© {YEAR} GameTime</p>
          <p>
            Data from{' '}
            {SOURCES.map((s, i) => (
              <span key={s.name}>
                <SourceLink href={s.href}>{s.name}</SourceLink>
                {i < SOURCES.length - 2 ? ', ' : i === SOURCES.length - 2 ? ' and ' : ''}
              </span>
            ))}
          </p>
          <p className="shrink-0">Not affiliated with Formula 1 or the UFC.</p>
          <button
            type="button"
            onClick={() => setTheme(next.value)}
            title={`Theme: ${THEMES[current].label}. Change to ${next.label}.`}
            aria-label={`Theme, ${THEMES[current].label}. Change to ${next.label}`}
            className="shrink-0 self-start rounded-md border border-edge px-2 py-0.5 text-[11.5px] font-[640] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink lg:self-auto"
          >
            {THEMES[current].label}
          </button>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="text-[clamp(18px,1.5vw,22px)] leading-[1.3] text-ink underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
    >
      {children}
    </Link>
  );
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-ink-2 underline decoration-[color-mix(in_srgb,currentColor_30%,transparent)] underline-offset-[3px] transition-colors hover:text-ink hover:decoration-current"
    >
      {children}
    </a>
  );
}
