import { fold } from './text';
import type { SessionKind, Sport } from './types';

export const sports: readonly Sport[] = ['f1', 'ufc'];

export const sportMeta: Record<Sport, { name: string; short: string; keywords: string }> = {
  f1: { name: 'Formula 1', short: 'F1', keywords: 'formula one motorsport motor racing grand prix cars' },
  ufc: { name: 'UFC', short: 'UFC', keywords: 'ultimate fighting championship mma mixed martial arts fights' },
};

export const sessionKindsBySport: Record<Sport, readonly SessionKind[]> = {
  f1: ['fp1', 'fp2', 'fp3', 'sprint_quali', 'sprint', 'qualifying', 'race'],
  ufc: ['early_prelims', 'prelims', 'main_card', 'main_event'],
};

export const sessionLabels: Record<SessionKind, { label: string; short: string }> = {
  fp1: { label: 'Practice 1', short: 'FP1' },
  fp2: { label: 'Practice 2', short: 'FP2' },
  fp3: { label: 'Practice 3', short: 'FP3' },
  sprint_quali: { label: 'Sprint Qualifying', short: 'Sprint Quali' },
  sprint: { label: 'Sprint', short: 'Sprint' },
  qualifying: { label: 'Qualifying', short: 'Quali' },
  race: { label: 'Race', short: 'Race' },
  early_prelims: { label: 'Early Prelims', short: 'Early Prelims' },
  prelims: { label: 'Prelims', short: 'Prelims' },
  main_card: { label: 'Main Card', short: 'Main Card' },
  main_event: { label: 'Main Event', short: 'Main Event' },
};

/** Typical length of each session, used to decide when a session is live or over. */
export const sessionDurationMinutes: Record<SessionKind, number> = {
  fp1: 60,
  fp2: 60,
  fp3: 60,
  sprint_quali: 45,
  sprint: 60,
  qualifying: 60,
  race: 120,
  early_prelims: 75,
  prelims: 120,
  main_card: 180,
  main_event: 30,
};

/** The main event is the last fight of the main card, so the main card always comes with it. */
export const sessionRequires: Partial<Record<SessionKind, SessionKind>> = { main_card: 'main_event' };

export function toggleKind(current: readonly SessionKind[], kind: SessionKind, available: readonly SessionKind[]): SessionKind[] {
  if (current.includes(kind)) return current.filter((k) => k !== kind && sessionRequires[k] !== kind);
  const needed = sessionRequires[kind];
  const extra = needed && !current.includes(needed) && available.includes(needed) ? [needed] : [];
  return [...current, kind, ...extra];
}

export type SessionFilters = Record<Sport, SessionKind[]>;

export const defaultSessionFilters: SessionFilters = {
  f1: ['sprint', 'qualifying', 'race'],
  ufc: ['main_card', 'main_event'],
};

export interface FilterPreset {
  id: string;
  label: string;
  kinds: SessionKind[];
}

export const filterPresets: Record<Sport, FilterPreset[]> = {
  f1: [
    { id: 'quali-race', label: 'Quali and race', kinds: ['qualifying', 'race'] },
    { id: 'race', label: 'Race only', kinds: ['race'] },
    { id: 'everything', label: 'Everything', kinds: [...sessionKindsBySport.f1] },
  ],
  ufc: [
    { id: 'main-card', label: 'Main card', kinds: ['main_card', 'main_event'] },
    { id: 'main-event', label: 'Main event only', kinds: ['main_event'] },
    { id: 'full-card', label: 'Full card', kinds: [...sessionKindsBySport.ufc] },
  ],
};

export function orderKinds(sport: Sport, kinds: readonly SessionKind[]): SessionKind[] {
  return sessionKindsBySport[sport].filter((k) => kinds.includes(k));
}

export function summarizeKinds(sport: Sport, kinds: readonly SessionKind[]): string {
  const ordered = orderKinds(sport, kinds);
  if (ordered.length === 0) return 'Nothing';
  if (ordered.length === sessionKindsBySport[sport].length) return 'All sessions';
  return ordered.map((k) => sessionLabels[k].short).join(', ');
}

export function sportsMatching(query: string): Sport[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return sports.filter((sport) => {
    const meta = sportMeta[sport];
    const sessions = sessionKindsBySport[sport].map((k) => sessionLabels[k].label).join(' ');
    const text = fold(`${meta.name} ${meta.short} ${meta.keywords} ${sessions}`);
    return words.every((w) => text.includes(w));
  });
}
