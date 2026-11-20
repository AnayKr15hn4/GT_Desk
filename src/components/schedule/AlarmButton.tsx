import clsx from 'clsx';
import { useNavigate } from 'react-router';

import { Icon } from '@/components/ui/Icon';
import { useAlarms } from '@/data/queries';
import { useNow } from '@/hooks/use-now';
import { alarmForSession } from '@/lib/alarms';
import { formatClock } from '@/lib/time';
import { useClock } from '@/stores/preferences';
import { openSetAlarm } from '@/stores/ui';

/** Gold with the ring time when a wake-up is set; a quiet "Set wake-up" otherwise. */
export function AlarmButton({ eventId, sessionId, className }: { eventId: string; sessionId: string; className?: string }) {
  const alarms = useAlarms();
  const now = useNow(30_000);
  const navigate = useNavigate();
  const { timeZone, hour12 } = useClock();
  const alarm = alarms.data ? alarmForSession(alarms.data, sessionId, now) : undefined;
  if (alarm) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigate('/alarms');
        }}
        className={clsx(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-gold-soft px-3 text-[12.5px] font-[600] text-gold transition-transform active:scale-[0.97]',
          className,
        )}
        title="Wake-up set. Open Alarms to change it."
      >
        <Icon name={alarm.alertType === 'call' ? 'phone' : 'bell'} size={14} />
        <span className="tabular">{formatClock(alarm.alertTimeUtc, timeZone, hour12)}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openSetAlarm(eventId, [sessionId]);
      }}
      className={clsx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-edge px-3 text-[12.5px] font-[580] text-ink-2 transition-[color,border-color,transform] hover:border-ink-3 hover:text-ink active:scale-[0.97]',
        className,
      )}
    >
      <Icon name="bell" size={14} />
      Set wake-up
    </button>
  );
}
