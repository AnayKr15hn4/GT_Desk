/** An error with something a person can read, plus the backend's short code when there is one. */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 0) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

/**
 * The backend's short error codes (raised by the Postgres functions and Edge Functions), in the
 * words the app shows. Mirrors errorMessages in the phone app's services/supabase/client.ts.
 */
const errorMessages: Record<string, string> = {
  not_signed_in: 'Sign in first.',
  not_found: 'That alarm is gone. It may have been removed on another device.',
  session_not_found: 'That session is no longer on the schedule.',
  session_cancelled: 'That session was cancelled.',
  time_passed: 'That time has already passed.',
  cannot_restore: 'That alarm would ring too late to bring back.',
  not_scheduled: 'That alarm is no longer active.',
  still_active: 'Cancel the alarm before removing it.',
  invalid_lead: 'Choose a time up to 3 hours before the start.',
  paywall_calls: 'Phone calls are part of Premium.',
  paywall_limit: 'The free plan keeps two alarms at a time.',
  verify_phone: 'Verify your phone number first.',
  too_many_codes: 'Too many codes sent. Try again in an hour.',
  invalid_phone: 'Enter the number with its country code, like +1 732 555 0134.',
  twilio_error: "The code couldn't be sent. Try again in a moment.",
  delete_failed: "Your account couldn't be deleted. Try again.",
};

export function fromCode(code: string, status = 0): AppError {
  return new AppError(errorMessages[code] ?? 'Something went wrong. Try again.', code, status);
}

/** Readable text for anything thrown. */
export function messageOf(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof TypeError) return 'No connection. Check your internet and try again.';
  return fallback;
}
