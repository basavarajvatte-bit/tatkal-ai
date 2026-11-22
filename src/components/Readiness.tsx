import type { Journey } from '../lib/types';
import { readiness } from '../lib/readiness';
import { saveJourney } from '../lib/store';
import { syncClock, getClock } from '../lib/clock';
import { useClock, useIrctcReachable, useOnline } from '../lib/hooks';
import { ScoreBadge } from './ui';

export function useReadiness(j: Journey | null) {
  const online = useOnline();
  const clock = useClock();
  const [irctcOk, recheck] = useIrctcReachable(online);
  const env = { online, clockSynced: clock.source !== 'device' && clock.lastSync != null, irctcReachable: irctcOk };
  return { r: j ? readiness(j, env) : null, recheck };
}

export function ReadinessList({ j, onlyMissing = false }: { j: Journey; onlyMissing?: boolean }) {
  const { r, recheck } = useReadiness(j);
  if (!r) return null;
  const act = (a: string | undefined) => {
    if (a === 'irctcAccount' || a === 'aadhaar' || a === 'payment') {
      saveJourney({ ...j, checks: { ...j.checks, [a]: true }, updatedAt: Date.now() });
    } else if (a === 'sync') void syncClock();
    else if (a === 'retry') {
      recheck();
      if (getClock().source === 'device') void syncClock();
    }
  };
  const list = onlyMissing ? r.missing : r.items;
  return (
    <div>
      <div className="row between mb">
        <ScoreBadge score={r.score} />
        <span className="muted small">{r.items.length - r.missing.length}/{r.items.length} done</span>
      </div>
      <div className="meter"><div style={{ width: `${r.score}%` }} className={r.ready ? 'meter-ok' : ''} /></div>
      <ul className="checklist">
        {list.map((i) => (
          <li key={i.key} className={i.ok ? 'ok' : 'miss'}>
            <span className="tick" aria-hidden>{i.ok ? '✓' : '!'}</span>
            <div className="grow">
              <div>{i.label}</div>
              <div className="muted small">{i.hint}</div>
            </div>
            {!i.ok &&
              (i.fix.href ? (
                <a className="btn btn-sm" href={i.fix.href}>{i.fix.label}</a>
              ) : (
                <button className="btn btn-sm" onClick={() => act(i.fix.action)}>{i.fix.label}</button>
              ))}
          </li>
        ))}
        {onlyMissing && !list.length && <li className="ok"><span className="tick">✓</span><div>Everything is ready</div></li>}
      </ul>
    </div>
  );
}
