import { useEffect, useRef } from 'react';
import { now } from '../lib/clock';
import { splitMs } from '../lib/time';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/**
 * Smooth countdown. Updates DOM text directly each animation frame (no React re-render),
 * so it stays light on low-end phones. Shows ms when `showMs`.
 */
export function Countdown({ target, size = 'lg', showMs = true }: { target: number; size?: 'md' | 'lg' | 'xl'; showMs?: boolean }) {
  const main = useRef<HTMLSpanElement>(null);
  const ms = useRef<HTMLSpanElement>(null);
  const days = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = '';
    const draw = () => {
      const left = target - now();
      const p = splitMs(Math.max(0, left));
      const text = `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
      if (text !== last && main.current) {
        main.current.textContent = text;
        last = text;
        if (days.current) days.current.textContent = p.days > 0 ? `${p.days} day${p.days > 1 ? 's' : ''} +` : left <= 0 ? 'OPEN NOW' : '';
      }
      if (ms.current) ms.current.textContent = `.${pad(p.millis, 3)}`;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <div className={`countdown cd-${size}`} role="timer" aria-live="off">
      <div ref={days} className="cd-days" />
      <span ref={main} className="cd-main">--:--:--</span>
      {showMs && <span ref={ms} className="cd-ms">.000</span>}
    </div>
  );
}
