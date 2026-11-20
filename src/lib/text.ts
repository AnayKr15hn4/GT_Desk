/** Lowercase, accents removed, so "Pérez" matches "perez". */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** "+15125550134" becomes "•••• 0134". */
export function maskPhone(e164?: string | null): string {
  return e164 ? `•••• ${e164.slice(-4)}` : 'your phone';
}

/** "+1 (512) 555-0134" becomes "+15125550134"; null when it can't be a full international number. */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('+')) return null;
  const e164 = `+${trimmed.replace(/\D/g, '')}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Keeps only digits, so a pasted " 123 456 " becomes "123456". */
export const cleanCode = (value: string) => value.replace(/\D/g, '');

export const isCompleteCode = (code: string) => /^\d{6,10}$/.test(code);
