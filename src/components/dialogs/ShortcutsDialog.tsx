import { shortcutList } from '@/app/shortcuts';
import { Dialog } from '@/components/ui/Dialog';
import { Kbd } from '@/components/ui/misc';
import { useUi } from '@/stores/ui';

export function ShortcutsDialog() {
  const open = useUi((s) => s.dialog.kind === 'shortcuts');
  const close = useUi((s) => s.close);
  return (
    <Dialog open={open} onClose={close} title="Keyboard shortcuts" width={520}>
      <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-[20px] border border-hairline bg-surface">
        {shortcutList.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-6 px-5 py-3">
            <span className="text-[14.5px] text-ink">{s.label}</span>
            <span className="flex flex-wrap justify-end gap-1.5">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
