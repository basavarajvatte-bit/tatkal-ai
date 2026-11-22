import { lazy, Suspense, useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import { useData, focusJourney, opening } from './lib/store';
import { onToast, scheduleReminders, type Toast } from './lib/notify';
import { readiness } from './lib/readiness';
import { getClock } from './lib/clock';
import { SyncStatus } from './components/ui';

const Journeys = lazy(() => import('./pages/Journeys'));
const JourneyEdit = lazy(() => import('./pages/JourneyEdit'));
const Trains = lazy(() => import('./pages/Trains'));
const Booking = lazy(() => import('./pages/Booking'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));

const NAV = [
  { href: '#/', label: 'Home', icon: '⌂' },
  { href: '#/journeys', label: 'Journeys', icon: '☰' },
  { href: '#/trains', label: 'Trains', icon: '⇄' },
  { href: '#/booking', label: 'Book', icon: '⏱' },
  { href: '#/history', label: 'History', icon: '✓' },
  { href: '#/settings', label: 'Settings', icon: '⚙' },
];

function useHashRoute() {
  const get = () => location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => {
      setRoute(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function Page({ route }: { route: string }) {
  const parts = route.split('/').filter(Boolean);
  switch (parts[0]) {
    case undefined:
      return <Dashboard />;
    case 'journeys':
      return parts[1] ? <JourneyEdit id={parts[1]} /> : <Journeys />;
    case 'trains':
      return <Trains />;
    case 'booking':
      return <Booking id={parts[1]} />;
    case 'history':
      return <History />;
    case 'settings':
      return <Settings />;
    default:
      return <div className="card"><h2>Page not found</h2><a href="#/">Go home</a></div>;
  }
}

function Toasts() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setList((l) => [...l.slice(-2), t]);
        setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 7000);
      }),
    [],
  );
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))}>{t.text}</div>
      ))}
    </div>
  );
}

/** Keeps reminders scheduled for the journey in focus. */
function Reminders() {
  const data = useData();
  const j = focusJourney(data.journeys);
  const key = j ? `${j.id}:${opening(j).epoch}:${data.settings.notifications}` : '';
  useEffect(() => {
    if (!j || !data.settings.notifications) return;
    const label = `${j.from} → ${j.to} (${j.travelClass})`;
    scheduleReminders(opening(j).epoch, label, () => {
      const c = getClock();
      return readiness(j, { online: navigator.onLine, clockSynced: c.source !== 'device', irctcReachable: true }).missing.map((m) => m.label);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export default function App() {
  const route = useHashRoute();
  const top = '#/' + (route.split('/').filter(Boolean)[0] ?? '');
  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">TATKAL <span>AI</span></a>
        <SyncStatus compact />
      </header>
      <main className="main">
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Page route={route} />
        </Suspense>
      </main>
      <nav className="bottomnav" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} className={top === n.href || (n.href === '#/' && top === '#/') ? 'active' : ''}>
            <span aria-hidden className="nav-i">{n.icon}</span>
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <Toasts />
      <Reminders />
    </div>
  );
}
