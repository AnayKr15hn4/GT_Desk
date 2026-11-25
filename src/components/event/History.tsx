import clsx from 'clsx';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { InsetGroup } from '@/components/ui/Inset';
import { ExternalLink, LoadError, SectionTitle, Skeleton } from '@/components/ui/misc';
import { summarizeWins, tally, type Article, type F1History } from '@/data/history';
import { useF1History } from '@/data/queries';
import type { SportEvent } from '@/lib/types';

const WIKI_LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';
/** Winners shown before "Show all". */
const FIRST_WINNERS = 8;
/** Paragraphs of the story shown before "Read the rest". */
const FIRST_PARAGRAPHS = 2;

/** A Grand Prix's history: a short read of who wins here, the race's story and every winner. */
export function RaceHistory({ event }: { event: SportEvent }) {
  const { data, isPending, isError, refetch } = useF1History(event);
  return (
    <section className="flex flex-col gap-10">
      <SectionTitle title="The history" detail="Who has won here, and the story of the race." />
      {isPending ? (
        <HistorySkeleton />
      ) : isError ? (
        <LoadError onRetry={() => void refetch()}>The race's history didn't load.</LoadError>
      ) : (
        <HistoryBody event={event} history={data} />
      )}
    </section>
  );
}

function HistoryBody({ event, history }: { event: SportEvent; history: F1History }) {
  const circuitName = history.circuit?.name ?? event.venue.name;
  const lead = summarizeWins(circuitName, history.wins);
  return (
    <div className={clsx('grid grid-cols-1 items-start gap-16', history.wins.length > 0 && 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]')}>
      <div className="flex flex-col gap-8">
        <p className="max-w-[44ch] text-[clamp(21px,1.7vw,27px)] leading-[1.3] font-[500] text-pretty text-ink">{lead.join(' ')}</p>
        {history.article ? <Story article={history.article} /> : null}
      </div>
      {history.wins.length > 0 ? (
        <div className="flex flex-col gap-12">
          <MostWins history={history} />
          <Winners event={event} history={history} />
        </div>
      ) : null}
    </div>
  );
}

/** The opening of the race's Wikipedia article, with its credit. */
function Story({ article }: { article: Article }) {
  const [all, setAll] = useState(false);
  const shown = all ? article.paragraphs : article.paragraphs.slice(0, FIRST_PARAGRAPHS);
  const more = article.paragraphs.length - FIRST_PARAGRAPHS;
  return (
    <div className="flex max-w-[66ch] flex-col gap-5">
      {shown.map((p, i) => (
        <p key={i} className="text-[15.5px] leading-[1.65] text-pretty text-ink-2">
          {p}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {more > 0 ? (
          <Button size="sm" variant="ghost" icon={all ? 'minus' : 'plus'} className="-ml-3" onClick={() => setAll((a) => !a)}>
            {all ? 'Show less' : 'Read the rest'}
          </Button>
        ) : null}
        <p className="text-[12.5px] text-ink-3">
          From the Wikipedia article <ExternalLink href={article.url}>{article.title}</ExternalLink>, shared under{' '}
          <ExternalLink href={WIKI_LICENSE}>CC BY-SA 4.0</ExternalLink>.
        </p>
      </div>
    </div>
  );
}

/** The drivers with the most wins here, as bars; the record holder in gold. */
function MostWins({ history }: { history: F1History }) {
  const top = tally(history.wins, (w) => w.driver).slice(0, 5);
  const best = top[0]?.wins ?? 1;
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="px-1 text-[13px] font-[620] text-ink-2">Most wins here</h3>
      <ol className="flex flex-col gap-4 rounded-[20px] border border-hairline bg-surface px-6 py-5 shadow-1">
        {top.map((d) => (
          <li key={d.name} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="truncate text-[15px] font-[600]">{d.name}</span>
              <span className="tabular text-[13px] text-ink-2">{d.wins === 1 ? '1 win' : `${d.wins} wins`}</span>
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
              <span className={clsx('block h-full rounded-full', d.wins === best ? 'bg-gold' : 'bg-ink-3/60')} style={{ width: `${(d.wins / best) * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Every race here, newest first, with its winner and team. */
function Winners({ event, history }: { event: SportEvent; history: F1History }) {
  const [all, setAll] = useState(false);
  const shown = all ? history.wins : history.wins.slice(0, FIRST_WINNERS);
  const total = history.wins.length;
  return (
    <InsetGroup
      title="Every winner here"
      footer={
        <>
          Results from the <ExternalLink href="https://jolpi.ca">Jolpica Formula 1 archive</ExternalLink>.
        </>
      }
    >
      {shown.map((w) => (
        <div key={`${w.season}-${w.raceName}`} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 px-6 py-3.5">
          <span className="numerals text-[22px] leading-none">{w.season}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-[600]">{w.driver}</span>
            {w.raceName !== event.name ? <span className="truncate text-[12.5px] text-ink-3">{w.raceName}</span> : null}
          </span>
          <span className="text-right text-[13px] text-ink-2">{w.team}</span>
        </div>
      ))}
      {total > FIRST_WINNERS ? (
        <div className="px-3 py-2">
          <Button size="sm" variant="ghost" icon={all ? 'minus' : 'plus'} onClick={() => setAll((a) => !a)}>
            {all ? 'Show fewer' : `Show all ${total} races`}
          </Button>
        </div>
      ) : null}
    </InsetGroup>
  );
}

function HistorySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-[86%]" />
        <Skeleton className="h-7 w-[62%]" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="h-4 w-[94%]" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
      <Skeleton className="h-[320px] w-full rounded-[20px]" />
    </div>
  );
}
