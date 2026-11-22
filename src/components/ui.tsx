import type { ReactNode } from 'react';
import type { Journey, Train } from '../lib/types';
import { classLabel, durationMin, fmtDuration } from '../lib/time';
import { useClock, useNow } from '../lib/hooks';

export const IRCTC_URL = 'https://www.irctc.co.in/nget/train-search';

export function Card({ title, children, right, className = '' }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="card-h">
          <h2>{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {action}
    </div>
  );
}

export function OpenIrctcButton({ big = false, pulse = false }: { big?: boolean; pulse?: boolean }) {
  return (
    <a className={`btn btn-primary btn-block ${big ? 'btn-xl' : ''} ${pulse ? 'pulse' : ''}`} href={IRCTC_URL} target="_blank" rel="noopener noreferrer">
      OPEN OFFICIAL IRCTC ↗
    </a>
  );
}

export function TrainRow({ t, tag, score }: { t: Train; tag?: string; score?: number | null }) {
  return (
    <div className="train">
      <div className="train-top">
        <span className="mono strong">{t.number || '—'}</span>
        <span className="train-name">{t.name || 'Unnamed train'}</span>
        {tag && <span className="chip">{tag}</span>}
        {score != null && <span className="chip chip-muted">Score {score}</span>}
      </div>
      <div className="train-meta">
        <span>Dep {t.dep || '—'}</span>
        <span>Arr {t.arr || '—'}{t.arrDays ? ` +${t.arrDays}d` : ''}</span>
        <span>{fmtDuration(durationMin(t.dep, t.arr, t.arrDays))}</span>
      </div>
      {t.route && <div className="muted small">Route: {t.route}</div>}
    </div>
  );
}

export function JourneyLine({ j }: { j: Journey }) {
  return (
    <div className="jline">
      <span className="strong">{j.from || '—'}</span>
      <span className="arrow">→</span>
      <span className="strong">{j.to || '—'}</span>
      <span className="chip">{j.travelClass}</span>
      <span className="chip chip-muted">{j.quota}</span>
      <span className="sr-only">{classLabel(j.travelClass)}</span>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const cls = score === 100 ? 'ok' : score >= 70 ? 'warn' : 'bad';
  return <span className={`score score-${cls}`}>{score === 100 ? 'READY' : 'INCOMPLETE'} – {score}%</span>;
}

/** Shows clock source, latency, device drift and when sync was last verified. */
export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const c = useClock();
  const t = useNow(5000);
  const ago = c.lastSync == null ? null : Math.max(0, Math.round((t - c.lastSync) / 1000));
  const agoText = ago == null ? 'never' : ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.round(ago / 60)} min ago` : `${Math.round(ago / 3600)} h ago`;
  const synced = c.source !== 'device' && c.lastSync != null;
  const drift = -c.offset; // device minus server
  const driftText = Math.abs(drift) < 50 ? 'accurate' : `${(Math.abs(drift) / 1000).toFixed(2)}s ${drift > 0 ? 'fast' : 'slow'}`;
  if (compact)
    return (
      <span className={`sync ${synced ? 'sync-ok' : 'sync-bad'}`}>
        {c.syncing ? 'Syncing…' : synced ? `Synced ${agoText}` : 'Not synced – using phone clock'}
      </span>
    );
  return (
    <div className="sync-grid small">
      <div><span className="muted">Time source</span><b>{c.source === 'server' ? 'Server' : c.source === 'header' ? 'Server (header)' : 'Phone only'}</b></div>
      <div><span className="muted">Last verified</span><b>{c.syncing ? 'Syncing…' : agoText}</b></div>
      <div><span className="muted">Network latency</span><b>{c.rtt == null ? '—' : `${c.rtt} ms`}</b></div>
      <div><span className="muted">Phone clock</span><b>{synced ? driftText : 'unknown'}</b></div>
      {c.jumpDetected && <div className="warn-text">Phone clock changed – re-syncing</div>}
      {c.error && <div className="warn-text">{c.error}</div>}
    </div>
  );
}
