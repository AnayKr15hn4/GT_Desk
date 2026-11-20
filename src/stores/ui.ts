import { create } from 'zustand';

/** Which dialog is open. One at a time, so dialogs never stack. */
export type DialogState =
  | { kind: 'none' }
  | { kind: 'sign-in'; then?: DialogState }
  | { kind: 'set-alarm'; eventId: string; sessionIds?: string[]; lead?: number; alertType?: 'call' | 'push' }
  | { kind: 'phone'; then?: DialogState }
  | { kind: 'premium'; reason: 'calls' | 'limit' }
  | { kind: 'palette' }
  | { kind: 'shortcuts' };

interface UiState {
  dialog: DialogState;
  open(dialog: DialogState): void;
  close(): void;
  /** Closes the current dialog and opens what it was waiting for (e.g. set alarm after sign-in). */
  continueFlow(): void;
}

export const useUi = create<UiState>()((set, get) => ({
  dialog: { kind: 'none' },
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: { kind: 'none' } }),
  continueFlow: () => {
    const d = get().dialog;
    const then = 'then' in d ? d.then : undefined;
    set({ dialog: then ?? { kind: 'none' } });
  },
}));

export const openSetAlarm = (eventId: string, sessionIds?: string[]) => useUi.getState().open({ kind: 'set-alarm', eventId, sessionIds });
export const openSignIn = (then?: DialogState) => useUi.getState().open({ kind: 'sign-in', then });
