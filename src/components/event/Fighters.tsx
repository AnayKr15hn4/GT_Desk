import clsx from 'clsx';

import { PhotoCredit } from '@/components/event/Gallery';
import { Icon } from '@/components/ui/Icon';
import { ExternalLink, LoadError, SectionTitle, Skeleton, Tag } from '@/components/ui/misc';
import { isPlaceholder, parseRecord, type FighterProfile } from '@/data/history';
import { useFighterProfiles } from '@/data/queries';
import type { Bout, Fighter, SportEvent } from '@/lib/types';

const WIKI_LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';

/** One side of the main event: the fighter, and their Wikipedia background when there is one. */
interface Corner {
  fighter: Fighter;
  profile?: FighterProfile;
}

/**
 * The main event's two fighters face to face, the way Revolut leads with photography: one card,
 * each fighter's photo running off their side and fading toward the middle, their name large over
 * it, and their numbers set against each other between them. Their stories from Wikipedia follow
 * as plain text. Left out when neither has an article.
 */
export function FighterBackgrounds({ event }: { event: SportEvent }) {
  const { data, isPending, isError, refetch } = useFighterProfiles(event);
  const bout = event.bouts?.find((b) => b.isMainEvent);
  if (!bout) return null;
  const corners = bout.fighters.map((fighter) => ({ fighter, profile: data?.find((p) => p.fighter.name === fighter.name) })) as [Corner, Corner];
  if (data && !corners.some((c) => c.profile)) return null;
  return (
    <section className="flex flex-col gap-10">
      <SectionTitle title="The fighters" detail="Where they come from and how they got here." />
      {isPending ? (
        <Skeleton className="h-[480px] w-full rounded-[32px]" />
      ) : isError ? (
        <LoadError onRetry={() => void refetch()}>The fighters' backgrounds didn't load.</LoadError>
      ) : (
        <>
          <FaceOff bout={bout} corners={corners} />
          <Stories corners={corners} />
          <p className="text-[12.5px] text-ink-3">
            Backgrounds from Wikipedia, shared under <ExternalLink href={WIKI_LICENSE}>CC BY-SA 4.0</ExternalLink>.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * The card: the two photos at its edges and the tale of the tape between them. On a narrow window
 * the photos sit side by side with the numbers underneath.
 */
function FaceOff({ bout, corners }: { bout: Bout; corners: [Corner, Corner] }) {
  const [a, b] = corners;
  const rows = tape(a, b);
  return (
    <article
      aria-label={`${a.fighter.name} against ${b.fighter.name}`}
      className="grid grid-cols-2 overflow-hidden rounded-[32px] bg-surface shadow-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <Portrait corner={a} side="left" />
      <div className="col-span-2 row-start-2 flex flex-col justify-center gap-9 px-6 pt-8 pb-10 md:col-span-1 md:row-start-auto md:px-2 md:py-12">
        <div className="flex flex-wrap justify-center gap-2">
          <Tag tone="gold">Main event</Tag>
          {bout.isTitleFight ? <Tag>Title fight</Tag> : null}
          {bout.weightClass ? <Tag>{bout.weightClass}</Tag> : null}
          {bout.rounds ? <Tag>{`${bout.rounds} rounds`}</Tag> : null}
        </div>
        <table className="w-full border-collapse">
          <caption className="sr-only">Tale of the tape</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{a.fighter.name}</th>
              <th scope="col">Stat</th>
              <th scope="col">{b.fighter.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i > 0 ? 'border-t border-hairline' : undefined}>
                <td className="py-5 text-left">
                  <Value text={row.left} />
                </td>
                <th scope="row" className="px-3 text-center text-[12.5px] font-[600] whitespace-nowrap text-ink-3">
                  {row.label}
                </th>
                <td className="py-5 text-right">
                  <Value text={row.right} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Portrait corner={b} side="right" />
    </article>
  );
}

function Value({ text }: { text?: string }) {
  return text ? <span className="numerals text-[clamp(28px,2.5vw,42px)] leading-none">{text}</span> : <span className="text-[13px] text-ink-3">Not listed</span>;
}

/** Record, share of fights won and age, side by side; a row neither has is left out. */
function tape(a: Corner, b: Corner): { label: string; left?: string; right?: string }[] {
  const record = (c: Corner) => {
    const r = parseRecord(c.fighter.record);
    return r ? `${r.wins}-${r.losses}${r.draws ? `-${r.draws}` : ''}` : undefined;
  };
  const won = (c: Corner) => {
    const r = parseRecord(c.fighter.record);
    const fights = r ? r.wins + r.losses + r.draws : 0;
    return r && fights > 0 ? `${Math.round((r.wins / fights) * 100)}%` : undefined;
  };
  const age = (c: Corner) => (c.profile?.age ? String(c.profile.age) : undefined);
  return [
    { label: 'Record', left: record(a), right: record(b) },
    { label: 'Fights won', left: won(a), right: won(b) },
    { label: 'Age', left: age(a), right: age(b) },
  ].filter((row) => row.left || row.right);
}

/** A fighter's photo at their edge of the card, with their name and country over it. */
function Portrait({ corner, side }: { corner: Corner; side: 'left' | 'right' }) {
  const { fighter, profile } = corner;
  const photo = profile?.photo;
  const right = side === 'right';
  return (
    <div className="relative aspect-[4/5] min-w-0 md:aspect-auto md:min-h-[480px]">
      {photo ? (
        // On a wide card the photo fades toward the middle, so the numbers sit on the card itself.
        <div
          className={clsx(
            'absolute inset-0',
            right ? 'md:[mask-image:linear-gradient(to_left,#000_58%,transparent)]' : 'md:[mask-image:linear-gradient(to_right,#000_58%,transparent)]',
          )}
        >
          <img src={photo.src} alt={fighter.name} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-[50%_22%]" />
          {/* Darkens the foot of the photo for the name, whatever the theme. */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgb(4 8 16 / 0.85), rgb(4 8 16 / 0.35) 34%, transparent 60%)' }} />
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-raised">
          <Icon name="person" size={52} className="text-ink-3" />
        </div>
      )}
      <div className={clsx('absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 md:p-7', right ? 'items-end text-right' : 'items-start', photo ? 'text-white' : 'text-ink')}>
        <h3 className="wide text-[clamp(20px,2.6vw,44px)] leading-[0.95] font-[680] tracking-[-0.025em] text-balance">
          {isPlaceholder(fighter.name) ? 'To be announced' : fighter.name}
        </h3>
        {fighter.country ? (
          <span className={clsx('inline-flex h-7 items-center gap-2 rounded-full px-3 text-[13px] font-[560]', photo ? 'bg-white/15 backdrop-blur-md' : 'bg-surface')}>
            {fighter.flagUrl ? <img src={fighter.flagUrl} alt="" width={16} height={16} className="size-4 rounded-full object-cover" /> : null}
            {fighter.country}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Each fighter's story, the opening of their Wikipedia article, side by side under the card. */
function Stories({ corners }: { corners: [Corner, Corner] }) {
  return (
    <div className="grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-2">
      {corners.map(({ fighter, profile }) =>
        profile ? (
          <div key={fighter.name} className="flex max-w-[66ch] flex-col gap-4">
            <h3 className="semiwide text-[19px] font-[640]">{fighter.name}</h3>
            {profile.article.paragraphs.slice(0, 2).map((p, i) => (
              <p key={i} className="text-[15px] leading-[1.65] text-pretty text-ink-2">
                {p}
              </p>
            ))}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-3">
              <ExternalLink href={profile.article.url} className="inline-flex items-center gap-1.5 text-[13.5px] font-[560] text-ink-2">
                Read more on Wikipedia
                <Icon name="external" size={14} />
              </ExternalLink>
              {profile.photo?.credit ? <PhotoCredit credit={profile.photo.credit} /> : null}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
