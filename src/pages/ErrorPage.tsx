import { Link, useRouteError } from 'react-router';

import { DelftFlourish } from '@/components/delft/Delft';

/** Shown instead of a blank window if a page fails to draw. */
export function ErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="relative mx-auto flex min-h-[100svh] max-w-[1280px] flex-col items-start justify-center gap-6 px-8">
      <DelftFlourish className="pointer-events-none absolute top-[calc(50%-150px)] right-8 hidden w-[min(560px,48%)] lg:block" />
      <h1 className="wide text-[64px] leading-[0.9] font-[680] tracking-[-0.035em]">This page tripped</h1>
      <p className="max-w-[56ch] text-[17px] text-ink-2">
        Something on it failed to load. Your alarms are safe on the server; reload the page, or go back to Up next.
      </p>
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 rounded-full bg-primary px-6 text-[15px] font-[600] text-on-primary transition-transform active:scale-[0.97]"
        >
          Reload
        </button>
        <Link to="/" className="text-[15px] font-[600] text-gold hover:underline">
          Back to Up next
        </Link>
      </div>
    </div>
  );
}
