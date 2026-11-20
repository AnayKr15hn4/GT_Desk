import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { FREE_ACTIVE_ALARM_LIMIT } from '@/lib/alarms';
import { useUi } from '@/stores/ui';

/** Premium is bought in the phone app (App Store or Google Play); the desktop app shows what it adds. */
export function PremiumDialog() {
  const dialog = useUi((s) => s.dialog);
  const close = useUi((s) => s.close);
  const open = dialog.kind === 'premium';
  const reason = open ? dialog.reason : 'calls';
  return (
    <Dialog
      open={open}
      onClose={close}
      title={reason === 'calls' ? 'Phone calls are part of Premium' : `The free plan keeps ${FREE_ACTIVE_ALARM_LIMIT} alarms`}
      description="Upgrade in the GameTime app on your phone. Your plan follows your account, so it works here right after."
      width={500}
    >
      <ul className="flex flex-col gap-4">
        {[
          { icon: 'phone' as const, title: 'A real phone call', body: 'It rings through Do Not Disturb settings that let calls in, which a notification can miss.' },
          { icon: 'bellRing' as const, title: 'As many alarms as you want', body: 'Every qualifying session of the season, set once.' },
          { icon: 'rotate' as const, title: 'A second try', body: "If you don't pick up, we call once more before the start." },
        ].map((f) => (
          <li key={f.title} className="flex items-start gap-4">
            <Icon name={f.icon} size={22} className="mt-0.5 text-gold" />
            <div className="flex flex-col gap-0.5">
              <p className="text-[15px] font-[600]">{f.title}</p>
              <p className="text-[14px] text-ink-2">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-7 flex justify-end">
        <Button variant="primary" onClick={close}>
          Got it
        </Button>
      </div>
    </Dialog>
  );
}
