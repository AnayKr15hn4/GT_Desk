/** True on a Mac, where shortcuts use ⌘ (the same test the map uses for its scroll-to-zoom key). */
export const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

/** The key held with others in shortcuts: ⌘ on a Mac, Ctrl everywhere else. */
export const modKey = isMac ? '⌘' : 'Ctrl';
