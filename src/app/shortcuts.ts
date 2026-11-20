import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useUi } from '@/stores/ui';

export const shortcutList: { keys: string[]; label: string }[] = [
  { keys: ['⌘ K', 'Ctrl K', '/'], label: 'Search events and sessions' },
  { keys: ['G then U'], label: 'Go to Up next' },
  { keys: ['G then S'], label: 'Go to Season' },
  { keys: ['G then A'], label: 'Go to Alarms' },
  { keys: [','], label: 'Open Settings' },
  { keys: ['N'], label: 'Set a wake-up call for the next session' },
  { keys: ['?'], label: 'Show these shortcuts' },
  { keys: ['Esc'], label: 'Close a dialog' },
];

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Desktop keyboard shortcuts. Single keys only fire when you're not typing in a field. */
export function useShortcuts(onNextAlarm: () => void) {
  const navigate = useNavigate();
  useEffect(() => {
    let gPressedAt = 0;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.open(ui.dialog.kind === 'palette' ? { kind: 'none' } : { kind: 'palette' });
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || ui.dialog.kind !== 'none') return;
      const key = e.key.toLowerCase();
      if (key === '/') {
        e.preventDefault();
        ui.open({ kind: 'palette' });
      } else if (e.key === '?') {
        ui.open({ kind: 'shortcuts' });
      } else if (key === ',') {
        navigate('/settings');
      } else if (key === 'n') {
        onNextAlarm();
      } else if (key === 'g') {
        gPressedAt = Date.now();
      } else if (Date.now() - gPressedAt < 1200) {
        gPressedAt = 0;
        if (key === 'u') navigate('/');
        if (key === 's') navigate('/season');
        if (key === 'a') navigate('/alarms');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, onNextAlarm]);
}
