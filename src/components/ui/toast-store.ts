import { create } from 'zustand';

import type { IconName } from './Icon';

export interface Toast {
  id: number;
  message: string;
  icon?: IconName;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  show(toast: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id }] }));
    setTimeout(() => get().dismiss(id), toast.action ? 7000 : 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, extra: Omit<Toast, 'id' | 'message'> = {}) => useToasts.getState().show({ message, ...extra });
