import clsx from 'clsx';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState, ExternalLink, LoadError, SectionTitle, Tag } from '@/components/ui/misc';
import type { Credit, GalleryPhoto } from '@/data/history';
import { useEventPhotos } from '@/data/queries';
import type { SportEvent } from '@/lib/types';

/** How many times wider the open panel is than a closed one. */
const OPEN = 5;
/** Panels shown while the photos load. */
const LOADING = 6;
/** Darkens a photo's foot for the words over it, and the section's top for its title, whatever the theme. */
const FOOT = 'linear-gradient(to top, rgb(4 8 16 / 0.86), rgb(4 8 16 / 0.3) 36%, transparent 60%)';
const HEAD = 'linear-gradient(to bottom, rgb(4 8 16 / 0.72), rgb(4 8 16 / 0.26) 55%, transparent)';

/**
 * The event's photos as a row of tall panels filling the window, evenly shared at rest: pointing
 * at a panel (or tabbing to it) opens it to show the photo and what it is; clicking the open one
 * shows all of it with its credit. For a Grand Prix, two photos each of cars on track, the
 * circuit and the town; for a fight night, three each of its arena and its city.
 */
export function EventPhotos({ event }: { event: SportEvent }) {
  const { data, isPending, isError, refetch } = useEventPhotos(event);
  const detail = describe(event, data);

  // Nothing to show: a plain section in the page's column, not a window of nothing.
  if (isError || data?.length === 0) {
    return (
      <section className="mx-auto flex max-w-[1680px] flex-col gap-10 px-5 pb-32 md:px-8">
        <SectionTitle title="Photos" detail={detail} />
        {isError ? (
          <LoadError onRetry={() => void refetch()}>The photos didn't load.</LoadError>
        ) : (
          <EmptyState icon="photo" title={event.sport === 'ufc' ? `No photos of ${event.venue.name} or ${event.venue.city} yet` : 'No photos of this one yet'}>
            {event.sport === 'ufc'
              ? 'The photos here come from Wikimedia Commons, which has none of the arena or its city so far.'
              : 'The photos here come from Wikimedia Commons, and none there match this event so far.'}
          </EmptyState>
        )}
      </section>
    );
  }

  return (
    // On a wide window the title sits over the photos; on a narrow one, above the bands, clear of their labels.
    <section aria-labelledby="photos-title" className="relative flex h-[100svh] min-h-[560px] flex-col overflow-hidden bg-canvas">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden h-[clamp(200px,34vh,320px)] md:block" style={{ background: HEAD }} />
      <div className="z-20 mx-auto flex w-full max-w-[1680px] items-start justify-between gap-8 px-5 pt-20 pb-6 md:pointer-events-none md:absolute md:inset-x-0 md:top-0 md:px-8 md:pt-[clamp(84px,13vh,112px)] md:pb-0 md:text-white">
        <div className="flex flex-col gap-2">
          <h2 id="photos-title" className="wide text-[clamp(28px,2.6vw,40px)] leading-[1.02] font-[640]">
            Photos
          </h2>
          <p className="max-w-[44ch] text-[15px] text-ink-2 md:text-white/80">{detail}</p>
        </div>
        <p className="pointer-events-auto hidden max-w-[34ch] pt-1.5 text-right text-[12.5px] leading-relaxed text-white/70 md:block">
          From{' '}
          <a
            href="https://commons.wikimedia.org"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-white/35 underline-offset-[3px] transition-colors hover:text-white hover:decoration-white"
          >
            Wikimedia Commons
          </a>
          . Open a photo to see all of it and who took it.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        {isPending ? <LoadingPanels /> : <Panels photos={data} />}
      </div>
      {isPending ? (
        <p role="status" className="sr-only">
          Loading photos
        </p>
      ) : null}
    </section>
  );
}

/**
 * What the photos show, from the sets found: "The circuit and Lusail." when there are no cars,
 * "Riyadh." when the arena has no photos.
 */
function describe(event: SportEvent, photos: GalleryPhoto[] | undefined): string {
  const town = event.venue.city;
  const groups = new Set(photos?.map((p) => p.group));
  const all = photos === undefined;
  if (event.sport !== 'f1') {
    const arena = all || groups.has(event.venue.name);
    const city = all || groups.has(town);
    return arena && city ? `${event.venue.name} and ${town}.` : `${arena ? event.venue.name : town}.`;
  }
  const parts = [
    all || groups.has('On track') ? 'cars on track' : '',
    all || [...groups].some((g) => g !== 'On track' && g !== town) ? 'the circuit' : '',
    all || groups.has(town) ? town : '',
  ].filter(Boolean);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function LoadingPanels() {
  return (
    <ul aria-hidden className="flex size-full flex-col gap-[3px] md:flex-row">
      {Array.from({ length: LOADING }, (_, i) => (
        <li key={i} className="skeleton min-h-0 min-w-0 flex-1" />
      ))}
    </ul>
  );
}

function Panels({ photos }: { photos: GalleryPhoto[] }) {
  // None open at rest: the panels share the row evenly until one is pointed at or tabbed to.
  const [open, setOpen] = useState<number | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  // The open panel's share of the row: how wide its words are set, and how big a photo it needs.
  const share = OPEN / (OPEN + photos.length - 1);
  // Stepping through the viewer opens each photo's panel, so closing it leaves you where you were.
  const view = useCallback((i: number | null) => {
    setViewing(i);
    if (i !== null) setOpen(i);
  }, []);

  return (
    <>
      <ul
        className="flex size-full flex-col gap-[3px] md:flex-row"
        style={{ '--open-w': `${share * 100}vw` } as CSSProperties}
        // Back to even when the mouse leaves (a finger's tap keeps its panel open) or focus moves on.
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setOpen(null);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null);
        }}
      >
        {photos.map((photo, i) => {
          const isOpen = i === open;
          const firstOfSet = i === 0 || photos[i - 1].group !== photo.group;
          return (
            <li
              key={photo.page}
              className="relative min-h-0 min-w-0 overflow-hidden transition-[flex-grow] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
              style={{ flexGrow: isOpen ? OPEN : 1, flexBasis: 0 }}
            >
              <button
                type="button"
                aria-label={`${photo.group}: ${photo.caption}`}
                aria-haspopup="dialog"
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') setOpen(i);
                }}
                onFocus={() => setOpen(i)}
                // A tap opens a closed panel; the open one shows the whole photo.
                onClick={() => (isOpen ? view(i) : setOpen(i))}
                className={clsx('absolute inset-0 block size-full text-left focus-visible:-outline-offset-4', isOpen ? 'cursor-zoom-in' : 'cursor-pointer')}
              >
                <img
                  src={photo.src}
                  srcSet={photo.largeWidth > photo.width ? `${photo.src} ${photo.width}w, ${photo.large} ${photo.largeWidth}w` : undefined}
                  sizes={sizesFor(photo, share)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover"
                />
                {/* Closed panels sit back in the dark. */}
                <span aria-hidden className={clsx('absolute inset-0 bg-[rgb(4_8_16)] transition-opacity duration-500', isOpen ? 'opacity-0' : 'opacity-[0.42]')} />
                <span aria-hidden className="absolute inset-0" style={{ background: FOOT }} />

                {/* A closed panel names its set, written up its side, on the first photo of each. */}
                {firstOfSet ? (
                  <span
                    aria-hidden
                    className={clsx(
                      'absolute bottom-5 left-5 text-[13px] font-[620] whitespace-nowrap text-white/90 transition-opacity md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:rotate-180 md:[writing-mode:vertical-rl]',
                      isOpen ? 'opacity-0 duration-150' : 'opacity-100 delay-300 duration-300',
                    )}
                  >
                    {photo.group}
                  </span>
                ) : null}

                {/* The open panel's words, set at its open width so they don't reflow as it widens. */}
                <span
                  aria-hidden
                  className={clsx(
                    'absolute bottom-0 left-0 flex w-full flex-col items-start gap-3 p-6 text-white transition-[opacity,translate] md:w-[min(calc(var(--open-w)_-_24px),680px)] md:p-10',
                    isOpen ? 'translate-y-0 opacity-100 delay-200 duration-500' : 'translate-y-6 opacity-0 duration-150',
                  )}
                >
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-[600] backdrop-blur-md">{photo.group}</span>
                  <span className="semiwide text-[clamp(18px,1.7vw,26px)] leading-[1.2] font-[620] text-balance">{photo.caption}</span>
                  <span className="text-[12.5px] text-white/70">
                    Photo by {photo.author}, {photo.license}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <PhotoViewer photos={photos} index={viewing} onIndex={view} />
    </>
  );
}

/**
 * How wide a panel's photo is drawn when it's open, so a big screen gets the big copy: it covers
 * the panel, so it's the wider of the panel and the photo scaled to the panel's height.
 */
function sizesFor(photo: GalleryPhoto, share: number): string {
  const shape = photo.width / photo.height;
  const pct = (n: number) => Math.round(n * 100);
  return `(min-width: 768px) max(${pct(share)}vw, ${pct(shape)}vh), max(100vw, ${pct(shape * share)}vh)`;
}

/** One photo at a time, as large as the window allows, with its caption and credit. */
function PhotoViewer({ photos, index, onIndex }: { photos: GalleryPhoto[]; index: number | null; onIndex: (i: number | null) => void }) {
  const count = photos.length;
  const photo = index === null ? undefined : photos[index];
  const step = useCallback((by: number) => onIndex(index === null ? null : (index + by + count) % count), [index, count, onIndex]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    // The neighbours load ahead, so stepping to them is instant.
    for (const i of [index - 1, index + 1]) {
      const next = photos[(i + count) % count];
      if (next) new Image().src = next.large;
    }
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, photos, step]);

  return (
    <Dialog open={photo !== undefined} onClose={() => onIndex(null)} title="Photo" bare width={1320}>
      {photo ? (
        <div className="flex min-h-0 flex-col">
          <div className="relative grid min-h-[240px] place-items-center bg-black">
            {/* The panel's copy shows at once; the large one replaces it when it arrives. */}
            <img
              key={photo.page}
              src={photo.large}
              alt={photo.caption}
              className="block max-h-[calc(100dvh-220px)] w-auto max-w-full bg-contain bg-center bg-no-repeat object-contain"
              style={{ backgroundImage: `url("${photo.src}")` }}
            />
            <OverPhotoButton icon="close" label="Close" onClick={() => onIndex(null)} className="top-4 right-4" />
            {count > 1 ? (
              <>
                <OverPhotoButton icon="chevronLeft" label="Previous photo" onClick={() => step(-1)} className="top-1/2 left-4 -translate-y-1/2" />
                <OverPhotoButton icon="chevronRight" label="Next photo" onClick={() => step(1)} className="top-1/2 right-4 -translate-y-1/2" />
              </>
            ) : null}
          </div>
          <div className="flex items-start justify-between gap-8 px-7 py-5">
            <div className="flex min-w-0 flex-col items-start gap-2">
              <Tag>{photo.group}</Tag>
              <p className="text-[14.5px] leading-snug text-ink">{photo.caption}</p>
              <p className="text-[12.5px] text-ink-3">
                <PhotoCredit credit={photo} />
              </p>
            </div>
            <span className="tabular shrink-0 pt-0.5 text-[13px] text-ink-3">
              {(index ?? 0) + 1} of {count}
            </span>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

/** A round button over the photo: light on a dark disc, whatever the theme. */
function OverPhotoButton({ icon, label, onClick, className }: { icon: IconName; label: string; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`absolute grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 ${className}`}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

/** "Photo by Jane Doe, CC BY-SA 4.0": the name links to the photo's own page, the licence to its terms. */
export function PhotoCredit({ credit }: { credit: Credit }) {
  return (
    <span>
      Photo by <ExternalLink href={credit.page}>{credit.author}</ExternalLink>,{' '}
      {credit.licenseUrl ? <ExternalLink href={credit.licenseUrl}>{credit.license}</ExternalLink> : credit.license}
    </span>
  );
}
