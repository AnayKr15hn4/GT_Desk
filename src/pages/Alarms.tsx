import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import { Link } from 'react-router';

import { DelftFlourish } from '@/components/delft/Delft';
import { Button } from '@/components/ui/Button';
import { Clock, RollingText } from '@/components/ui/Clock';
import { Icon } from '@/components/ui/Icon';
import { InsetGroup, Row } from '@/components/ui/Inset';
import { EmptyState, Skeleton, Tag } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast-store';
import { messageOf } from '@/data/errors';
import { useAccount, useAlarmActions, useAlarms } from '@/data/queries';
import { useNow } from '@/hooks/use-now';
import { usePageTitle } from '@/hooks/use-page-title';
import { canRemove, canRestore, displayStatus, FREE_ACTIVE_ALARM_LIMIT, isActive, leadPhrase, leadTimeOptions, nextAlarm, statusLabels } from '@/lib/alarms';
import { maskPhone } from '@/lib/text';
import { countdown, formatCountdown, formatDayLabel, formatLead, formatLongDate } from '@/lib/time';
import type { Alarm } from '@/lib/types';
import { useClock } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import { openSignIn, useUi } from '@/stores/ui';

export function AlarmsPage() {
  usePageTitle('Alarms');
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const alarms = useAlarms();
  const account = useAccount();
  const now = useNow(1000);
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-alarms-in]', { opacity: 0, y: 26, duration: 1, stagger: 0.08, ease: 'expo.out' });
      });
      return () => mm.revert();
    },
    { scope, dependencies: [ready, !!user] },
  );

  const all = alarms.data ?? [];
  const active = all.filter((a) => isActive(a, now)).sort((a, b) => a.alertTimeUtc.localeCompare(b.alertTimeUtc));
  const past = all.filter((a) => !isActive(a, now)).sort((a, b) => b.sessionStartUtc.localeCompare(a.sessionStartUtc));
  const next = nextAlarm(all, now);
  const premium = account.data?.plan === 'premium';

  return (
    <div ref={scope} className="mx-auto flex max-w-[1280px] flex-col gap-16 px-5 pt-32 pb-32 md:px-8">
      <header data-alarms-in className="relative flex flex-wrap items-end justify-between gap-8">
        <DelftFlourish className="pointer-events-none absolute -top-16 -right-4 hidden w-[min(560px,48%)] lg:block" />
        <div className="flex max-w-[640px] flex-col gap-4">
          <h1 className="wide text-[clamp(52px,5vw,88px)] leading-[0.9] font-[680] tracking-[-0.035em]">Alarms</h1>
          <p className="text-[16.5px] leading-relaxed text-ink-2">
            The same list as on your phone. Our server rings your phone at the time you set, so it works with this computer asleep.
          </p>
        </div>
        {user ? (
          <div className="flex flex-col items-end gap-1.5 text-right">
            <span className="text-[13px] font-[600] text-ink-3">{premium ? 'Premium' : 'Free plan'}</span>
            <span className="text-[15px]">
              {premium ? 'Calls and unlimited alarms' : `${Math.min(active.length, FREE_ACTIVE_ALARM_LIMIT)} of ${FREE_ACTIVE_ALARM_LIMIT} alarms in use`}
            </span>
            {!premium ? (
              <button type="button" className="text-[13.5px] font-[600] text-gold hover:underline" onClick={() => useUi.getState().open({ kind: 'premium', reason: 'calls' })}>
                What Premium adds
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {!ready || (user && alarms.isLoading) ? (
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-56 w-full rounded-[28px]" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !user ? (
        <div data-alarms-in>
          <EmptyState icon="bell" title="Sign in to see your alarms" action={<Button variant="primary" onClick={() => openSignIn()}>Sign in</Button>}>
            Alarms belong to your account, so the ones you set on your phone show up here, and the ones you set here ring your phone.
          </EmptyState>
        </div>
      ) : alarms.isError ? (
        <EmptyState icon="bell" title="Your alarms didn't load" action={<Button onClick={() => void alarms.refetch()}>Try again</Button>}>
          {messageOf(alarms.error)}
        </EmptyState>
      ) : (
        <>
          {next ? <NextAlarmDial alarm={next} now={now} phone={account.data?.phone ?? null} /> : null}
          {active.length === 0 ? (
            <div data-alarms-in>
              <EmptyState icon="bellRing" title="No wake-ups set" action={<Link to="/" className="text-[14.5px] font-[600] text-gold hover:underline">Find a session</Link>}>
                Pick any session on Up next or the week chronograph and choose how early to be woken.
              </EmptyState>
            </div>
          ) : (
            <div data-alarms-in>
              <InsetGroup title="Set">
                {active.map((a) => (
                  <ActiveRow key={a.id} alarm={a} />
                ))}
              </InsetGroup>
            </div>
          )}
          {past.length ? (
            <div data-alarms-in>
              <InsetGroup title="Earlier" footer="Rung and cancelled alarms stay here until you remove them.">
                {past.map((a) => (
                  <PastRow key={a.id} alarm={a} now={now} />
                ))}
              </InsetGroup>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function NextAlarmDial({ alarm, now, phone }: { alarm: Alarm; now: Date; phone: { e164: string; verified: boolean } | null }) {
  const { timeZone, hour12 } = useClock();
  return (
    <section data-alarms-in className="dial grid grid-cols-1 items-end gap-8 rounded-[28px] p-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10 md:p-10" aria-label="Next wake-up">
      <div className="flex flex-col gap-4">
        <span className="flex items-center gap-2.5 text-[14px] text-ink-2">
          <Icon name={alarm.alertType === 'call' ? 'phone' : 'bellRing'} size={18} className="text-gold" />
          {alarm.alertType === 'call' ? `Next call to ${maskPhone(phone?.e164)}` : 'Next notification to your phone'}
        </span>
        <Clock iso={alarm.alertTimeUtc} timeZone={timeZone} hour12={hour12} size="mega" className="-ml-1" />
        <p className="text-[17px]">
          {formatLongDate(alarm.alertTimeUtc, timeZone)}, {leadPhrase(alarm.leadMinutes, alarm.sessionLabel)} at {/^UFC/.test(alarm.eventName) ? '' : 'the '}
          {alarm.eventName}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1.5 md:items-end">
        <span className="text-[13px] text-ink-3">Rings in</span>
        <RollingText text={formatCountdown(countdown(alarm.alertTimeUtc, now))} className="text-[34px] leading-none font-[250] tracking-[-0.02em]" />
      </div>
    </section>
  );
}

function ActiveRow({ alarm }: { alarm: Alarm }) {
  const { timeZone, hour12 } = useClock();
  const { cancel, restore, updateLead } = useAlarmActions();
  const now = useNow(60_000);
  const options = Array.from(new Set([...leadTimeOptions, alarm.leadMinutes])).sort((a, b) => a - b);
  return (
    <Row className="flex-wrap gap-x-6 gap-y-3 md:flex-nowrap">
      <div className="flex w-[148px] shrink-0 flex-col gap-1">
        <Clock iso={alarm.alertTimeUtc} timeZone={timeZone} hour12={hour12} size="time" />
        <span className="text-[12.5px] text-ink-3">{formatDayLabel(alarm.alertTimeUtc, timeZone, now)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15.5px] font-[600]">{alarm.sessionLabel}</span>
          <Tag icon={alarm.alertType === 'call' ? 'phone' : 'bell'}>{alarm.alertType === 'call' ? 'Call' : 'Notification'}</Tag>
        </span>
        <span className="truncate text-[13.5px] text-ink-2">
          {alarm.eventName}, {alarm.venueCity}
        </span>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-ink-3">
        <span className="sr-only">How early</span>
        <select
          value={alarm.leadMinutes}
          onChange={(e) =>
            updateLead.mutate(
              { id: alarm.id, lead: Number(e.target.value) },
              { onSuccess: () => toast('Wake-up moved', { icon: 'check' }), onError: (err) => toast(messageOf(err)) },
            )
          }
          className="h-9 rounded-full border border-edge bg-surface px-3.5 text-[13.5px] font-[540] text-ink outline-none hover:border-ink-3 focus:border-gold"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {formatLead(m)}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="ghost"
        size="sm"
        loading={cancel.isPending}
        onClick={() =>
          cancel.mutate(alarm.id, {
            onSuccess: () =>
              toast('Wake-up cancelled', {
                icon: 'bell',
                action: { label: 'Undo', run: () => restore.mutate(alarm.id, { onError: (err) => toast(messageOf(err)) }) },
              }),
            onError: (err) => toast(messageOf(err)),
          })
        }
      >
        Cancel
      </Button>
    </Row>
  );
}

function PastRow({ alarm, now }: { alarm: Alarm; now: Date }) {
  const { timeZone, hour12 } = useClock();
  const { restore, remove } = useAlarmActions();
  const status = displayStatus(alarm, now);
  return (
    <Row className="flex-wrap gap-x-6 gap-y-3 md:flex-nowrap">
      <div className="flex w-[148px] shrink-0 flex-col gap-1 opacity-60">
        <Clock iso={alarm.alertTimeUtc} timeZone={timeZone} hour12={hour12} size="time" />
        <span className="text-[12.5px] text-ink-3">{formatDayLabel(alarm.alertTimeUtc, timeZone, now)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-[560] text-ink-2">{alarm.sessionLabel}</span>
        <span className="truncate text-[13px] text-ink-3">
          {alarm.eventName}, {alarm.venueCity}
        </span>
      </div>
      <Tag tone={status === 'failed' ? 'live' : 'neutral'}>{statusLabels[status]}</Tag>
      {canRestore(alarm, now) ? (
        <Button variant="ghost" size="sm" icon="undo" loading={restore.isPending} onClick={() => restore.mutate(alarm.id, { onError: (err) => toast(messageOf(err)) })}>
          Restore
        </Button>
      ) : null}
      {canRemove(alarm) ? (
        <Button variant="quiet-danger" size="sm" icon="trash" loading={remove.isPending} onClick={() => remove.mutate(alarm.id, { onError: (err) => toast(messageOf(err)) })}>
          Remove
        </Button>
      ) : null}
    </Row>
  );
}
