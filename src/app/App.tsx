import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { ErrorPage } from '@/pages/ErrorPage';
import { NotFoundPage } from '@/pages/NotFound';
import { UpNextPage } from '@/pages/UpNext';
import { startSessionSync } from '@/stores/session';

import { Shell } from './Shell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

// Follow the saved session; on sign-out, forget account data so the next person doesn't see it.
startSessionSync((event) => {
  if (event === 'SIGNED_OUT') {
    queryClient.removeQueries({ queryKey: ['alarms'] });
    queryClient.removeQueries({ queryKey: ['account'] });
  }
});

// Up next loads with the app; the other pages load the first time you open them (the router keeps
// the current page on screen until the next one is ready, so there's no spinner).
const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <UpNextPage /> },
      { path: 'season', lazy: async () => ({ Component: (await import('@/pages/Season')).SeasonPage }) },
      { path: 'event/:id', lazy: async () => ({ Component: (await import('@/pages/Event')).EventPage }) },
      { path: 'alarms', lazy: async () => ({ Component: (await import('@/pages/Alarms')).AlarmsPage }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('@/pages/Settings')).SettingsPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Motion follows the computer's reduced-motion setting, like the CSS, GSAP and the maps. */}
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  );
}
