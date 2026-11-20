import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { toast } from '@/components/ui/toast-store';
import { useAlarms } from '@/data/queries';
import { chimeBody, chimeTitle, dueForChime, msUntilNextChime, pruneChimed } from '@/lib/chime';
import type { Alarm } from '@/lib/types';
import { usePreferences } from '@/stores/preferences';

/**
 * The chime on this computer. It's an extra: the server still calls or notifies your phone, and
 * nothing here creates, changes or confirms an alarm. It only works while a GameTime tab is open.
 */

const CHIMED_KEY = 'gametime-desktop.chimed';

/* The sound ------------------------------------------------------------------------------------ */

/** A struck metal gong: the note plus the higher partials of a bar, each fading faster. */
const PARTIALS: ReadonlyArray<readonly [ratio: number, gain: number, decaySeconds: number]> = [
  [1, 1, 2.6],
  [2.756, 0.28, 1.1],
  [5.404, 0.1, 0.5],
  [8.933, 0.04, 0.28],
];

function strike(ctx: AudioContext, out: AudioNode, frequency: number, at: number) {
  for (const [ratio, gain, decay] of PARTIALS) {
    const osc = ctx.createOscillator();
    osc.frequency.value = frequency * ratio;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/**
 * Two pairs of strikes, high then low, like the gongs of a minute-repeater watch. Browsers allow
 * sound only once you've clicked or typed on the page; when it isn't allowed this returns false,
 * and the notification falls back to the computer's own sound.
 */
export async function playChime(): Promise<boolean> {
  if (typeof AudioContext === 'undefined') return false;
  const ctx = new AudioContext();
  if (ctx.state !== 'running') {
    // A blocked resume() never settles, so don't wait on it for long.
    await Promise.race([ctx.resume().catch(() => undefined), new Promise((done) => setTimeout(done, 400))]);
  }
  if (ctx.state !== 'running') {
    // Close it, or the chime would play late, the next time you click.
    void ctx.close();
    return false;
  }
  const out = ctx.createGain();
  out.gain.value = 0.2;
  out.connect(ctx.destination);
  const t = ctx.currentTime + 0.04;
  strike(ctx, out, 1046.5, t); // C6
  strike(ctx, out, 784, t + 0.38); // G5
  strike(ctx, out, 1046.5, t + 1.1);
  strike(ctx, out, 784, t + 1.48);
  setTimeout(() => void ctx.close(), 4_600);
  return true;
}

/* The notification ----------------------------------------------------------------------------- */

export type NotificationAccess = NotificationPermission | 'unsupported';

export function notificationAccess(): NotificationAccess {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

let icon: Promise<string | undefined> | undefined;

/** The dial mark as a PNG: notifications on Windows and macOS don't show SVG icons. */
function notificationIcon(): Promise<string | undefined> {
  icon ??= (async () => {
    try {
      // Give the SVG a size first; without one, browsers draw it at 300 by 150.
      const svg = await (await fetch(`${import.meta.env.BASE_URL}favicon.svg`)).text();
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', '<svg width="192" height="192" '))}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 192;
      canvas.getContext('2d')?.drawImage(img, 0, 0, 192, 192);
      return canvas.toDataURL('image/png');
    } catch {
      return undefined;
    }
  })();
  return icon;
}

async function notify(title: string, body: string, options: { tag: string; silent: boolean; onOpen?: () => void }): Promise<boolean> {
  if (notificationAccess() !== 'granted') return false;
  try {
    const shown = new Notification(title, { body, tag: options.tag, silent: options.silent, icon: await notificationIcon() });
    shown.onclick = () => {
      window.focus();
      options.onOpen?.();
      shown.close();
    };
    return true;
  } catch {
    return false;
  }
}

/* Ringing ------------------------------------------------------------------------------------- */

function readChimed(): Record<string, number> {
  try {
    return pruneChimed(JSON.parse(localStorage.getItem(CHIMED_KEY) ?? '{}'), Date.now());
  } catch {
    return {};
  }
}

/** Marks the alarm as chimed. False when another tab, or an earlier visit, already rang it. */
async function claim(id: string): Promise<boolean> {
  const take = () => {
    const chimed = readChimed();
    if (chimed[id]) return false;
    chimed[id] = Date.now();
    try {
      localStorage.setItem(CHIMED_KEY, JSON.stringify(chimed));
    } catch {
      // Storage is off (a private window): this tab still rings, but a reload could ring again.
    }
    return true;
  };
  // One tab at a time, so two open GameTime tabs don't both ring.
  return 'locks' in navigator ? navigator.locks.request(CHIMED_KEY, take) : take();
}

async function ring(alarm: Alarm, open: (eventId: string) => void) {
  if (!(await claim(alarm.id))) return;
  const played = await playChime();
  const title = chimeTitle(alarm);
  const shown = await notify(title, chimeBody(alarm), { tag: `gametime-${alarm.id}`, silent: played, onOpen: () => open(alarm.eventId) });
  // On the page as well, for when notifications are off or you're looking right at it.
  if (!shown || document.visibilityState === 'visible') {
    toast(title, { icon: 'bellRing', action: { label: 'Open', run: () => open(alarm.eventId) } });
  }
}

/** A sample of what an alarm looks like on this computer. */
export function showSampleNotification(silent: boolean): Promise<boolean> {
  return notify('Chimes are on', 'When one of your alarms rings while GameTime is open, a notification like this one shows up.', { tag: 'gametime-sample', silent });
}

/** Plays the chime and shows the sample notification, so you know what to expect. */
export async function testChime(): Promise<{ played: boolean; shown: boolean }> {
  const played = await playChime();
  return { played, shown: await showSampleNotification(played) };
}

/**
 * While the chime is on, rings for each of your alarms as its time arrives. Mount it once, in the
 * shell. It wakes for the next ring time rather than polling.
 */
export function useDesktopChime() {
  const enabled = usePreferences((s) => s.chime);
  // Keep checking while the tab is hidden, so an alarm set on your phone still chimes here.
  const { data: alarms } = useAlarms({ inBackground: enabled });
  const navigate = useNavigate();
  const [wake, setWake] = useState(0);

  useEffect(() => {
    if (!enabled || !alarms?.length) return;
    const now = Date.now();
    const chimed = new Set(Object.keys(readChimed()));
    for (const alarm of dueForChime(alarms, now, chimed)) void ring(alarm, (eventId) => void navigate(`/event/${eventId}`));
    const wait = msUntilNextChime(alarms, now);
    if (wait === null) return;
    const timer = window.setTimeout(() => setWake((n) => n + 1), wait + 200);
    return () => window.clearTimeout(timer);
  }, [enabled, alarms, wake, navigate]);
}
