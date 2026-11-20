import { Link } from 'react-router';

import { DelftFlourish } from '@/components/delft/Delft';
import { usePageTitle } from '@/hooks/use-page-title';

export function NotFoundPage() {
  usePageTitle('Off the schedule');
  return (
    <div className="relative mx-auto flex max-w-[1280px] flex-col items-start gap-6 px-8 pt-40 pb-32">
      <DelftFlourish className="pointer-events-none absolute top-28 right-8 hidden w-[min(560px,48%)] lg:block" />
      <h1 className="wide text-[72px] leading-[0.9] font-[680] tracking-[-0.035em]">Off the schedule</h1>
      <p className="text-[17px] text-ink-2">There's no page at this address.</p>
      <Link to="/" className="text-[15px] font-[600] text-gold hover:underline">
        Back to Up next
      </Link>
    </div>
  );
}
