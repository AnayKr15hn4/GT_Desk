import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TogglePill } from '@/components/ui/Segmented';
import { filterPresets, orderKinds, sessionKindsBySport, sessionLabels, sportMeta, sports, toggleKind } from '@/lib/sessions';
import { formatMinuteOfDay, nightLength } from '@/lib/time';
import { usePreferences, useClock } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import { openSignIn } from '@/stores/ui';

/** What you follow, beside the list, so changing it shows the effect immediately. */
export function FollowPanel() {
  const prefs = usePreferences();
  const { hour12 } = useClock();
  const user = useSession((s) => s.user);
  const hours = Math.round((nightLength(prefs.night) / 60) * 10) / 10;
  return (
    <aside className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-[20px] border border-hairline bg-surface p-6 shadow-1">
        <h3 className="text-[15px] font-[640]">What you follow</h3>
        <div className="flex flex-wrap gap-2">
          {sports.map((s) => (
            <TogglePill key={s} pressed={prefs.followedSports.includes(s)} onClick={() => prefs.toggleSport(s)}>
              {sportMeta[s].name}
            </TogglePill>
          ))}
        </div>
        {sports
          .filter((s) => prefs.followedSports.includes(s))
          .map((sport) => {
            const kinds = prefs.sessionFilters[sport];
            return (
              <div key={sport} className="flex flex-col gap-3 border-t border-hairline pt-5">
                <p className="text-[13px] font-[620] text-ink-2">{sportMeta[sport].short} sessions</p>
                <div className="flex flex-wrap gap-1.5">
                  {sessionKindsBySport[sport].map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={kinds.includes(k)}
                      onClick={() => prefs.setKinds(sport, orderKinds(sport, toggleKind(kinds, k, sessionKindsBySport[sport])))}
                      className={
                        kinds.includes(k)
                          ? 'h-7 rounded-full bg-ink px-3 text-[12.5px] font-[580] text-canvas'
                          : 'h-7 rounded-full border border-edge px-3 text-[12.5px] font-[560] text-ink-2 hover:text-ink'
                      }
                    >
                      {sessionLabels[k].short}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {filterPresets[sport].map((p) => (
                    <button key={p.id} type="button" onClick={() => prefs.setKinds(sport, p.kinds)} className="text-[12.5px] font-[560] text-gold hover:underline">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      <div className="flex flex-col gap-3 rounded-[20px] border border-hairline bg-surface p-6 shadow-1">
        <div className="flex items-center gap-2.5">
          <Icon name="moon" size={18} className="text-gold" />
          <h3 className="text-[15px] font-[640]">Your night</h3>
        </div>
        <p className="tabular text-[22px] font-[300] tracking-[-0.02em]">
          {formatMinuteOfDay(prefs.night.startMin, hour12)} to {formatMinuteOfDay(prefs.night.endMin, hour12)}
        </p>
        <p className="text-[13px] text-ink-2">
          {hours} hours. Sessions that start inside it are marked overnight.{' '}
          <Link to="/settings#night" className="font-[560] text-gold hover:underline">
            Change
          </Link>
        </p>
      </div>

      {!user ? (
        <div className="flex flex-col gap-4 rounded-[20px] border border-hairline bg-raised p-6">
          <p className="text-[15px] font-[620]">Wake-up calls need an account</p>
          <p className="text-[13.5px] text-ink-2">Sign in with the email you use on your phone. Alarms you set here ring your phone, even with this computer asleep.</p>
          <Button variant="secondary" onClick={() => openSignIn()} className="self-start">
            Sign in
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
