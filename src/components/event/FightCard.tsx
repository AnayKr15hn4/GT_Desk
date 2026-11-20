import { InsetGroup } from '@/components/ui/Inset';
import { Tag } from '@/components/ui/misc';
import { sessionLabels } from '@/lib/sessions';
import type { Bout, Fighter, UfcSessionKind } from '@/lib/types';

const order: UfcSessionKind[] = ['main_card', 'prelims', 'early_prelims'];

/** The fight card, main card first, each bout as one row. */
export function FightCard({ bouts }: { bouts: Bout[] }) {
  if (bouts.length === 0) return <p className="text-[14.5px] text-ink-2">The card hasn't been announced yet.</p>;
  return (
    <div className="flex flex-col gap-8">
      {order.map((segment) => {
        const list = bouts.filter((b) => (b.isMainEvent ? 'main_card' : b.segment) === segment);
        if (list.length === 0) return null;
        const sorted = [...list].sort((a, b) => Number(b.isMainEvent) - Number(a.isMainEvent));
        return (
          <InsetGroup key={segment} title={sessionLabels[segment].label}>
            {sorted.map((b) => (
              <div key={b.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-4">
                <FighterSide fighter={b.fighters[0]} align="start" />
                <div className="flex flex-col items-center gap-1.5">
                  {b.isMainEvent ? <Tag tone="gold">Main event</Tag> : null}
                  {b.isTitleFight ? <Tag>Title fight</Tag> : null}
                  <span className="text-[12.5px] whitespace-nowrap text-ink-3">
                    {b.weightClass ?? 'Bout'}
                    {b.rounds ? `, ${b.rounds} rounds` : ''}
                  </span>
                </div>
                <FighterSide fighter={b.fighters[1]} align="end" />
              </div>
            ))}
          </InsetGroup>
        );
      })}
    </div>
  );
}

function FighterSide({ fighter, align }: { fighter: Fighter; align: 'start' | 'end' }) {
  return (
    <div className={align === 'end' ? 'flex items-center justify-end gap-3 text-right' : 'flex items-center gap-3'}>
      {align === 'start' && fighter.flagUrl ? <Flag url={fighter.flagUrl} country={fighter.country} /> : null}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[15.5px] font-[600]">{fighter.name}</span>
        <span className="tabular text-[12.5px] text-ink-3">
          {fighter.record ?? ''}
          {fighter.record && fighter.country ? ', ' : ''}
          {fighter.country ?? ''}
        </span>
      </div>
      {align === 'end' && fighter.flagUrl ? <Flag url={fighter.flagUrl} country={fighter.country} /> : null}
    </div>
  );
}

function Flag({ url, country }: { url: string; country?: string }) {
  return <img src={url} alt={country ? `${country} flag` : ''} width={28} height={28} loading="lazy" className="size-7 shrink-0 rounded-full border border-hairline object-cover" />;
}
