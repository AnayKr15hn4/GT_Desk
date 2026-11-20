import { AppError, fromCode } from './errors';
import { accessToken, supabase, supabaseConfigured, supabaseKey, supabaseUrl } from './supabase';
import type { Alarm, AlertType, ServerAccount, Sport, SportEvent } from '@/lib/types';

/**
 * Every call the desktop app makes to the GameTime backend. These are the same Postgres
 * functions and Edge Functions the phone app uses; the server owns alarms and enforces Premium.
 */

type RpcError = { message: string; code?: string } | null;

function check<T>(data: T, error: RpcError): T {
  if (error) {
    // Postgres `raise exception 'paywall_calls'` arrives as message "paywall_calls".
    const code = error.message?.trim();
    if (code && /^[a-z_]+$/.test(code)) throw fromCode(code, 400);
    throw new AppError('The server could not do that. Try again.', 'server', 500);
  }
  return data;
}

// ── Events (public) ───────────────────────────────────────────

export async function listEvents(sport: Sport, signal?: AbortSignal): Promise<SportEvent[]> {
  if (!supabaseConfigured) throw new AppError('Add your Supabase keys to .env.local to load the schedule.', 'not_configured');
  const query = supabase().rpc('list_events', { p_sport: sport });
  const { data, error } = signal ? await query.abortSignal(signal) : await query;
  return check((data ?? []) as SportEvent[], error);
}

// ── Account ────────────────────────────────────────────────────

export async function getAccount(): Promise<ServerAccount | null> {
  const { data, error } = await supabase().rpc('get_account');
  return check((data ?? null) as ServerAccount | null, error);
}

// ── Alarms (signed in) ─────────────────────────────────────────

export async function listAlarms(): Promise<Alarm[]> {
  const { data, error } = await supabase().rpc('list_alarms');
  return check((data ?? []) as Alarm[], error);
}

export async function createAlarm(input: {
  sessionId: string;
  leadMinutes: number;
  alertType: AlertType;
  idempotencyKey: string;
}): Promise<Alarm> {
  const { data, error } = await supabase().rpc('create_alarm', {
    p_session_id: input.sessionId,
    p_lead_minutes: input.leadMinutes,
    p_alert_type: input.alertType,
    p_idempotency_key: input.idempotencyKey,
  });
  return check(data as Alarm, error);
}

export async function cancelAlarm(alarmId: string): Promise<Alarm> {
  const { data, error } = await supabase().rpc('cancel_alarm', { p_alarm_id: alarmId });
  return check(data as Alarm, error);
}

export async function updateAlarmLead(alarmId: string, leadMinutes: number): Promise<Alarm> {
  const { data, error } = await supabase().rpc('update_alarm_lead', { p_alarm_id: alarmId, p_lead_minutes: leadMinutes });
  return check(data as Alarm, error);
}

export async function restoreAlarm(alarmId: string): Promise<Alarm> {
  const { data, error } = await supabase().rpc('restore_alarm', { p_alarm_id: alarmId });
  return check(data as Alarm, error);
}

export async function removeAlarm(alarmId: string): Promise<void> {
  const { error } = await supabase().rpc('remove_alarm', { p_alarm_id: alarmId });
  check(null, error);
}

// ── Phone verification (Twilio Verify, through the phone-verify Edge Function) ──

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const token = await accessToken();
  if (!token) throw fromCode('not_signed_in', 401);
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: supabaseKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AppError('No connection. Check your internet and try again.', 'network', 0);
  }
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // Not JSON.
  }
  if (!response.ok) {
    const code = typeof json.error === 'string' ? json.error : typeof json.message === 'string' ? json.message : '';
    throw code ? fromCode(code, response.status) : new AppError(`The server said no (${response.status}). Try again.`, 'server', response.status);
  }
  return json as T;
}

export async function sendPhoneCode(phoneE164: string): Promise<void> {
  await callFunction('phone-verify', { action: 'send', phone: phoneE164 });
}

export async function checkPhoneCode(phoneE164: string, code: string): Promise<boolean> {
  const { verified } = await callFunction<{ verified: boolean }>('phone-verify', { action: 'check', phone: phoneE164, code });
  return verified;
}
