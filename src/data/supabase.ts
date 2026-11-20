import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * GameTime's Supabase project, the same one the phone app uses. Both values are public: the
 * publishable key only reaches what row-level security allows. They come from .env.local.
 */
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let client: SupabaseClient | null = null;

/** Built on first use, so a missing .env.local shows a message instead of crashing at import. */
export function supabase(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  client ??= createClient(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'gametime-desktop.auth' },
  });
  return client;
}

export async function accessToken(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}
