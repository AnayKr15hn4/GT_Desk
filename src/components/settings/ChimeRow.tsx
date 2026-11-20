import { useEffect, useState } from 'react';

import { notificationAccess, playChime, showSampleNotification, testChime, type NotificationAccess } from '@/app/chime';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TogglePill } from '@/components/ui/Segmented';
import { toast } from '@/components/ui/toast-store';
import { usePreferences } from '@/stores/preferences';

/** The switch for the chime on this computer, with a way to hear it. */
export function ChimeRow() {
  const enabled = usePreferences((s) => s.chime);
  const setChime = usePreferences((s) => s.setChime);
  const [access, setAccess] = useState<NotificationAccess>(notificationAccess);

  // Follow changes made in the browser's own site settings.
  useEffect(() => {
    let status: PermissionStatus | undefined;
    let gone = false;
    const update = () => setAccess(notificationAccess());
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((s) => {
        if (gone) return;
        status = s;
        s.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
      status?.removeEventListener('change', update);
    };
  }, []);

  const turnOn = () => {
    setChime(true);
    // Ask for notifications while the click still counts, before anything waits.
    const asking = access === 'default' ? Notification.requestPermission() : Promise.resolve(access);
    void Promise.all([asking, playChime()]).then(async ([result, played]) => {
      setAccess(result);
      if (result === 'granted') await showSampleNotification(played);
      else if (played) toast("Chimes are on. Notifications are off for this site, so you'll hear them without a pop-up.", { icon: 'bell' });
      else toast('This browser blocked both the sound and notifications for this site.', { icon: 'bell' });
    });
  };

  const test = () =>
    void testChime().then(({ played, shown }) => {
      if (!played && !shown) toast('This browser blocked both the sound and notifications for this site.', { icon: 'bell' });
    });

  const what = access === 'denied' || access === 'unsupported' ? 'chimes' : 'chimes and shows a notification';
  const note =
    access === 'denied'
      ? " Notifications for this site are blocked in your browser's settings, so there's no pop-up."
      : access === 'unsupported'
        ? " This browser can't show notifications, so there's no pop-up."
        : '';

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-5">
      <Icon name="bell" size={20} className="text-ink-2" />
      <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
        <span className="text-[15.5px] font-[560]">Chime on this computer</span>
        <span className="max-w-[62ch] text-[13px] leading-relaxed text-ink-3">
          While GameTime is open in a tab, this computer {what} when one of your alarms rings. Your phone still gets its call or reminder.{note}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {enabled ? (
          <Button variant="ghost" size="sm" icon="play" onClick={test}>
            Test chime
          </Button>
        ) : null}
        <TogglePill pressed={enabled} onClick={enabled ? () => setChime(false) : turnOn}>
          {enabled ? 'On' : 'Off'}
        </TogglePill>
      </div>
    </div>
  );
}
