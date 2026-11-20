import type { Session as AuthSession } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase, supabaseConfigured } from '@/data/supabase';

export interface SignedInUser {
  id: string;
  email?: string;
  /** The part of the email before the @, for a friendly greeting. */
  name: string;
}

interface SessionState {
  /** False until the saved session has been read, so the UI doesn't flash "Sign in". */
  ready: boolean;
  user: SignedInUser | null;
  set(session: AuthSession | null): void;
}

const toUser = (session: AuthSession | null): SignedInUser | null =>
  session
    ? { id: session.user.id, email: session.user.email, name: session.user.email?.split('@')[0] ?? 'GameTime fan' }
    : null;

export const useSession = create<SessionState>()((set) => ({
  ready: !supabaseConfigured,
  user: null,
  set: (session) => set({ ready: true, user: toUser(session) }),
}));

let started = false;

/** Follows the saved Supabase session. Called once at startup. */
export function startSessionSync(onChange?: (event: string) => void) {
  if (started || !supabaseConfigured) return;
  started = true;
  supabase().auth.onAuthStateChange((event, session) => {
    useSession.getState().set(session);
    onChange?.(event);
  });
}

// ── Email one-time code sign-in (same flow as the phone app) ──

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw Object.assign(new Error(error.message), { status: error.status ?? 0 });
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw Object.assign(new Error(error.message), { status: error.status ?? 0 });
}

export async function signOut(): Promise<void> {
  // Local: signing out here leaves the phone signed in.
  const { error } = await supabase().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** Plain words for a failed send or verify, from the HTTP status Supabase Auth returns. */
export function signInErrorMessage(error: unknown, step: 'send' | 'verify'): string {
  const status = (error as { status?: number })?.status ?? 0;
  if (status === 429) return 'Too many tries. Wait a minute and try again.';
  if (step === 'verify' && [400, 401, 403, 422].includes(status)) return 'That code is wrong or has expired. Check the email, or send a new code.';
  if (step === 'send' && [400, 422].includes(status)) return "That email address didn't work. Check it and try again.";
  return 'No connection to GameTime. Check your internet and try again.';
}
