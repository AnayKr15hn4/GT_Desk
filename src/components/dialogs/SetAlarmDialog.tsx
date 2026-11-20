import clsx from 'clsx';
import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import ClickSpark, { type ClickSparkHandle } from '@/components/bits/ClickSpark';
import { Button } from '@/components/ui/Button';
import { Clock } from '@/components/ui/Clock';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Segmented, TogglePill } from '@/components/ui/Segmented';
import { Tag } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast-store';
import { messageOf } from '@/data/errors';
import { useAccount, useAlarms, useCreateAlarm, useEvent } from '@/data/queries';
import { useNow } from '@/hooks/use-now';
import { alarmForSession, FREE_ACTIVE_ALARM_LIMIT, gateForAlarm, isActive, leadPhrase, leadTimeOptions, newIdempotencyKey } from '@/lib/alarms';
import { headlineSession, upcomingSessions } from '@/lib/schedule';
import { maskPhone } from '@/lib/text';
import { alertTimeUtc, formatClock, formatDayLabel, isOvernight, venueTimeLine } from '@/lib/time';
import type { Alarm, AlertType, Session } from '@/lib/types';
import { useClock, usePreferences } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import { useUi } from '@/stores/ui';

export function SetAlarmDialog() {
  const dialog = useUi((s) => s.dialog);
  const close = useUi((s) => s.close);
  const open = dialog.kind === 'set-alarm';
  return (
    <Dialog open={open} onClose={close} title="Wake-up call" width={620}>
      {open ? (
        <SetAlarmForm
          key={dialog.eventId}
          eventId={dialog.eventId}
          preselected={dialog.sessionIds}
          initialLead={dialog.lead}
          initialType={dialog.alertType}
        />
      ) : null}
    </Dialog>
  );
}

/**
 * The form remounts when the dialog comes back from sign-in or phone verification, so the
 * choices made so far travel in the dialog state (sessions, lead, call or notification).
 */
function SetAlarmForm({
  eventId,
  preselected,
  initialLead,
  initialType,
}: {
  eventId: string;
  preselected?: string[];
  initialLead?: number;
  initialType?: AlertType;
}) {
  const navigate = useNavigate();
  const { event } = useEvent(eventId);
  const now = useNow(30_000);
  const { timeZone, hour12 } = useClock();
  const night = usePreferences((s) => s.night);
  const defaultLead = usePreferences((s) => s.defaultLead);
  const user = useSession((s) => s.user);
  const account = useAccount();
  const alarms = useAlarms();
  const create = useCreateAlarm();
  const ui = useUi();
  const spark = useRef<ClickSparkHandle>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const upcoming = useMemo(() => (event ? upcomingSessions(event, now) : []), [event, now]);
  const existing = (s: Session) => (alarms.data ? alarmForSession(alarms.data, s.id, now) : undefined);
  const initial = useMemo(() => {
    const wanted = preselected?.filter((id) => upcoming.some((s) => s.id === id));
    if (wanted && wanted.length) return wanted;
    const headline = event ? headlineSession(event) : undefined;
    const pick = upcoming.find((s) => s.id === headline?.id) ?? upcoming[0];
    return pick ? [pick.id] : [];
    // Chosen once when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [picked, setPicked] = useState<string[]>(initial);
  const [lead, setLead] = useState(initialLead ?? defaultLead);
  const isPremium = account.data?.plan === 'premium';
  const phone = account.data?.phone ?? null;
  const [alertType, setAlertType] = useState<AlertType>(initialType ?? (isPremium && phone?.verified ? 'call' : 'push'));
  const [saved, setSaved] = useState<Alarm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!event) return <p className="text-ink-2">Loading the event…</p>;

  const selected = upcoming.filter((s) => picked.includes(s.id) && !existing(s));
  const plans = selected.map((s) => ({ session: s, ringAt: alertTimeUtc(s.startUtc, lead) }));
  const tooLate = plans.filter((p) => Date.parse(p.ringAt) <= now.getTime());
  const activeCount = alarms.data?.filter((a) => isActive(a, now)).length ?? 0;
  const first = [...plans].sort((a, b) => a.ringAt.localeCompare(b.ringAt))[0];

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    setError(null);
    const gate = gateForAlarm({
      signedIn: !!user,
      isPremium,
      phoneVerified: !!phone?.verified,
      alertType,
      activeCount: activeCount + Math.max(0, plans.length - 1),
    });
    const back = { kind: 'set-alarm' as const, eventId, sessionIds: picked, lead, alertType };
    if (gate?.kind === 'sign-in') return ui.open({ kind: 'sign-in', then: back });
    if (gate?.kind === 'verify-phone') return ui.open({ kind: 'phone', then: back });
    if (gate?.kind === 'premium') return ui.open({ kind: 'premium', reason: gate.reason });

    setSaving(true);
    const results = await Promise.allSettled(
      plans.map((p) => create.mutateAsync({ sessionId: p.session.id, leadMinutes: lead, alertType, idempotencyKey: newIdempotencyKey() })),
    );
    setSaving(false);
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) setError(messageOf(failed.reason));
    if (ok.length) {
      setSaved(ok);
      const rect = buttonRef.current?.getBoundingClientRect();
      requestAnimationFrame(() => spark.current?.spark(rect ? rect.left + rect.width / 2 : undefined, rect ? rect.top + rect.height / 2 : undefined));
      toast(ok.length === 1 ? 'Wake-up call set' : `${ok.length} wake-up calls set`, {
        icon: 'bellRing',
        action: { label: 'See alarms', run: () => navigate('/alarms') },
      });
    }
  };

  if (saved && !error) {
    const soonest = [...saved].sort((a, b) => a.alertTimeUtc.localeCompare(b.alertTimeUtc))[0];
    return (
      <ClickSpark ref={spark} sparkColor={['#D4B67A', '#F3DFB2']} sparkCount={14} sparkRadius={46} sparkSize={12} ring>
        <div className="flex flex-col items-start gap-6 py-2">
          <SettledCheck />
          <div className="flex flex-col gap-2">
            <p className="text-[14px] text-ink-2">
              {saved.length === 1 ? 'Set for' : `${saved.length} set. The first rings at`}
            </p>
            <Clock iso={soonest.alertTimeUtc} timeZone={timeZone} hour12={hour12} size="hero" />
            <p className="text-[15px] text-ink-2">
              {formatDayLabel(soonest.alertTimeUtc, timeZone, now)}, {leadPhrase(soonest.leadMinutes, soonest.sessionLabel)}.{' '}
              {soonest.alertType === 'call' ? `We'll call ${maskPhone(phone?.e164)}.` : 'Your phone gets a notification.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" onClick={() => ui.close()}>
              Done
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                ui.close();
                navigate('/alarms');
              }}
            >
              See all alarms
            </Button>
          </div>
        </div>
      </ClickSpark>
    );
  }

  return (
    <ClickSpark ref={spark} sparkColor={['#D4B67A', '#F3DFB2']} sparkCount={14} sparkRadius={46} sparkSize={12} ring>
      <div className="flex flex-col gap-7">
        <div className="-mt-3 flex flex-col gap-1">
          <p className="semiwide text-[17px] font-[620]">{event.name}</p>
          <p className="text-[14px] text-ink-2">
            {event.venue.name}, {event.venue.city}
          </p>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-[13px] font-[620] text-ink-2">Sessions</legend>
          {upcoming.length === 0 ? <p className="text-[14px] text-ink-2">Every session of this event has started.</p> : null}
          <div className="flex flex-col divide-y divide-hairline overflow-hidden rounded-[20px] border border-hairline bg-surface">
            {upcoming.map((s) => {
              const set = existing(s);
              const on = picked.includes(s.id) && !set;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={!!set}
                  onClick={() => toggle(s.id)}
                  className={clsx('flex items-center gap-4 px-4.5 py-3.5 text-left transition-colors', !set && 'hover:bg-raised')}
                >
                  <span
                    className={clsx(
                      'grid size-5.5 shrink-0 place-items-center rounded-full border transition-colors',
                      on ? 'border-gold bg-gold text-on-gold' : 'border-edge',
                      set && 'border-transparent bg-gold-soft text-gold',
                    )}
                  >
                    {on || set ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-[560]">{s.label}</span>
                    <span className="text-[13px] text-ink-3">
                      {formatDayLabel(s.startUtc, timeZone, now)}
                      {venueTimeLine(s.startUtc, event.venue, hour12) ? `, ${venueTimeLine(s.startUtc, event.venue, hour12)}` : ''}
                    </span>
                  </span>
                  {set ? (
                    <Tag tone="gold" icon="bell">
                      Set for {formatClock(set.alertTimeUtc, timeZone, hour12)}
                    </Tag>
                  ) : isOvernight(s.startUtc, timeZone, night) ? (
                    <Tag tone="gold" icon="moon">
                      Overnight
                    </Tag>
                  ) : null}
                  <Clock iso={s.startUtc} timeZone={timeZone} hour12={hour12} size="row" className="w-[92px] justify-end" />
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-[1fr_auto] items-start gap-x-8 gap-y-6">
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[13px] font-[620] text-ink-2">How early</legend>
            <div className="flex flex-wrap gap-2">
              {leadTimeOptions.map((m) => (
                <TogglePill key={m} pressed={lead === m} onClick={() => setLead(m)}>
                  {m === 0 ? 'At start' : m < 60 ? `${m} min` : '1 hr'}
                </TogglePill>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[13px] font-[620] text-ink-2">How</legend>
            <Segmented<AlertType>
              label="How you're woken"
              value={alertType}
              onChange={setAlertType}
              options={[
                { value: 'call', label: 'Phone call' },
                { value: 'push', label: 'Notification' },
              ]}
            />
          </fieldset>
        </div>

        <Summary
          count={plans.length}
          first={first ? { ringAt: first.ringAt, session: first.session } : undefined}
          alertType={alertType}
          phone={phone}
          isPremium={isPremium}
          signedIn={!!user}
          timeZone={timeZone}
          hour12={hour12}
          now={now}
          lead={lead}
          freeLeft={Math.max(0, FREE_ACTIVE_ALARM_LIMIT - activeCount)}
        />

        {tooLate.length ? (
          <p className="text-[13.5px] text-warning" role="alert">
            {tooLate.length === 1 ? 'That time has already passed.' : 'Some of those times have already passed.'} Pick a shorter lead time.
          </p>
        ) : null}
        {error ? (
          <p className="text-[13.5px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <p className="text-[12.5px] text-ink-3">
            The server places the call, so it rings even with this computer off.
          </p>
          <Button
            ref={buttonRef}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={plans.length === 0 || tooLate.length > 0}
            onClick={() => void save()}
          >
            {plans.length > 1 ? `Set ${plans.length} wake-up calls` : 'Set wake-up call'}
          </Button>
        </div>
      </div>
    </ClickSpark>
  );
}

function Summary({
  count,
  first,
  alertType,
  phone,
  isPremium,
  signedIn,
  timeZone,
  hour12,
  now,
  lead,
  freeLeft,
}: {
  count: number;
  first?: { ringAt: string; session: Session };
  alertType: AlertType;
  phone: { e164: string; verified: boolean } | null;
  isPremium: boolean;
  signedIn: boolean;
  timeZone: string;
  hour12: boolean;
  now: Date;
  lead: number;
  freeLeft: number;
}) {
  if (!first || count === 0) return <p className="text-[14px] text-ink-3">Pick a session to wake up for.</p>;
  const day = formatDayLabel(first.ringAt, timeZone, now);
  const when = `${formatClock(first.ringAt, timeZone, hour12)} ${day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : `on ${day}`}`;
  const how =
    alertType === 'call'
      ? phone?.verified
        ? `We'll call ${maskPhone(phone.e164)}`
        : "We'll call your phone"
      : 'Your phone gets a notification';
  const lines = [
    count === 1
      ? `${how} at ${when}, ${leadPhrase(lead, first.session.label)}.`
      : `${count} wake-ups. ${how} first at ${when}.`,
  ];
  const notes: string[] = [];
  if (!signedIn) notes.push('Sign in first, so the alarm is saved to your account.');
  else if (alertType === 'call' && !isPremium) notes.push('Phone calls are part of Premium.');
  else if (alertType === 'call' && !phone?.verified) notes.push("You'll verify your number first.");
  else if (!isPremium && count > freeLeft) notes.push(`The free plan keeps ${FREE_ACTIVE_ALARM_LIMIT} alarms at a time.`);
  return (
    <motion.div layout className="dial flex items-start gap-4 rounded-[20px] px-5 py-4 !shadow-none">
      <Icon name={alertType === 'call' ? 'phone' : 'bellRing'} size={22} className="mt-0.5 text-gold" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-snug text-ink">{lines[0]}</p>
        {notes.map((n) => (
          <p key={n} className="text-[13px] text-ink-2">
            {n}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

/** The one celebratory moment: the check settles with a spring. */
function SettledCheck() {
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      className="grid size-14 place-items-center rounded-full bg-gold text-on-gold"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <motion.path
          d="m5 12.5 4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
    </motion.span>
  );
}
