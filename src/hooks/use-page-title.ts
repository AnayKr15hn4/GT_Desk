import { useEffect } from 'react';

/** The window title: "GameTime" on its own, or "Las Vegas Grand Prix, GameTime" on a page about something. */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title}, GameTime` : 'GameTime';
  }, [title]);
}
