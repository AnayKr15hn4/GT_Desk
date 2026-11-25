import type { SVGProps } from 'react';

/**
 * A small set of line icons drawn for GameTime (1.5px strokes on a 24 grid). Monochrome; they take
 * the text colour. Gold only when they mark state, which callers decide.
 */
const paths = {
  moon: <path d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  bellRing: (
    <>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0M3 8.5A9 9 0 0 1 5.5 4M21 8.5A9 9 0 0 0 18.5 4" />
    </>
  ),
  phone: <path d="M6.6 3.5h2.6l1.6 4.2-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4.2 1.6v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevronDown: <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4-2-1.6Z" />
    </>
  ),
  list: <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5Z" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  signOut: <path d="M14 4.5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4M10 16.5 5.5 12 10 7.5M5.5 12H15" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  undo: <path d="M8 6.5 4.5 10 8 13.5M4.5 10h9a5.5 5.5 0 0 1 0 11H10" />,
  flag: <path d="M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11" />,
  glove: (
    <>
      <path d="M8 13.5V8a4 4 0 0 1 4-4h1.5A4.5 4.5 0 0 1 18 8.5v4.2a5.3 5.3 0 0 1-5.3 5.3H10.8A2.8 2.8 0 0 1 8 15.2v-1.7Z" />
      <path d="M8 11.5h3.2a2 2 0 0 1 2 2v.5M9.5 18v2.5h6V17" />
    </>
  ),
  cloud: <path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.2 18.5H7Z" />,
  cloudSun: (
    <>
      <path d="M9 19a4 4 0 0 1-.5-8 5.2 5.2 0 0 1 9.9 1.4A3.3 3.3 0 0 1 17.9 19H9Z" />
      <path d="M6 9.2A3.5 3.5 0 0 1 10.4 5M4.5 5.5l.9.9M2.5 10h1.2M7 2.5v1.2" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.2 15H7Z" />
      <path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" />
    </>
  ),
  snow: (
    <>
      <path d="M7 14.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.2 14.5H7Z" />
      <path d="M8.5 18.5h.01M12 20h.01M15.5 18.5h.01" />
    </>
  ),
  storm: (
    <>
      <path d="M7 14.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.2 14.5H7Z" />
      <path d="m12.5 14-2.5 4h3.5l-2 3.5" />
    </>
  ),
  fog: <path d="M4.5 9.5h15M3.5 13h17M5.5 16.5h13M7.5 20h9M8 6h8" />,
  wind: <path d="M3.5 9h11a2.5 2.5 0 1 0-2.5-2.5M3.5 15h14a2.5 2.5 0 1 1-2.5 2.5M3.5 12h7" />,
  drop: <path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0c0-4 5.5-10 5.5-10Z" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  rotate: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4.5v4h-4" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  play: <path d="M7.5 5.5v13l11-6.5-11-6.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  external: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  photo: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m3.5 16.5 4.6-4.1 3.4 3 3.2-3.1 5.8 5.2" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, strokeWidth = 1.5, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

/** The GameTime mark: a dial with one gold index at twelve and the hands just before. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <defs>
        <radialGradient id="gt-mark" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="var(--dial-1)" />
          <stop offset="60%" stopColor="var(--dial-2)" />
          <stop offset="100%" stopColor="var(--dial-3)" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#gt-mark)" stroke="var(--dial-rim)" />
      <rect x="15" y="3.5" width="2" height="5" rx="1" fill="var(--gold)" />
      <path d="M16 16 L16 9.5" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 16 L11.2 12.6" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.6" fill="var(--gold)" />
    </svg>
  );
}
