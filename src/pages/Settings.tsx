import { useEffect, useState } from 'react';
import { useData, saveSettings, replaceAll, clearAll, getData } from '../lib/store';
import { syncClock } from '../lib/clock';
import { askPermission, notify, permission } from '../lib/notify';
import { Card, SyncStatus } from '../components/ui';

type BIPEvent = Event & { prompt: () => Promise<void> };

export default function Settings() {
  const { settings } = useData();
  const [perm, setPerm] = useState(permission());
  const [install, setInstall] = useState<BIPEvent | null>(null);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setInstall(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tatkal-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importData = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) return alert('File too large');
    try {
      const parsed = JSON.parse(await f.text());
      if (!confirm('Replace all current data with this backup?')) return;
      replaceAll(parsed);
      alert('Backup restored');
    } catch {
      alert('Not a valid Tatkal AI backup file');
    }
  };

  return (
    <div className="stack">
      <h1>Settings</h1>

      <Card title="Time sync" right={<button className="btn btn-sm" onClick={() => void syncClock()}>Sync now</button>}>
        <SyncStatus />
        <p className="muted small">Booking timezone: Asia/Kolkata (IST). Countdown uses server time, not just your phone clock, and keeps running offline.</p>
      </Card>

      <Card title="Notifications">
        <label className="check">
          <input type="checkbox" checked={settings.notifications} onChange={(e) => saveSettings({ notifications: e.target.checked })} />
          <span>Reminders at 15, 5, 2, 1 min and at opening</span>
        </label>
        <div className="small">Browser permission: <b>{perm}</b></div>
        {perm !== 'granted' && perm !== 'unsupported' && (
          <button className="btn btn-block" onClick={async () => setPerm(await askPermission())}>Allow notifications</button>
        )}
        {perm === 'granted' && <button className="btn btn-block" onClick={() => void notify('Test', 'Notifications work')}>Send test</button>}
        <p className="muted small">
          Reminders work while Tatkal AI is open or recently used. Phones may stop them when the app is fully closed – keep it open before booking.
          {ios && ' On iPhone, notifications need the app added to Home Screen (iOS 16.4+).'}
        </p>
      </Card>

      <Card title="Install app">
        {standalone ? (
          <p className="small">Installed ✓</p>
        ) : install ? (
          <button className="btn btn-primary btn-block" onClick={() => void install.prompt()}>Install Tatkal AI</button>
        ) : ios ? (
          <p className="small">Safari: tap <b>Share</b> → <b>Add to Home Screen</b>.</p>
        ) : (
          <p className="small">Browser menu (⋮) → <b>Install app</b> / <b>Add to Home screen</b>.</p>
        )}
      </Card>

      <Card title="Train ranking">
        <label className="field">
          <span>Preferred arrival time</span>
          <input type="time" value={settings.preferredArrival} onChange={(e) => saveSettings({ preferredArrival: e.target.value || '08:00' })} />
        </label>
      </Card>

      <Card title="Your data">
        <p className="small">Everything is stored only on this device. No account, no server copy. Passwords, OTPs, CVV, UPI PIN and Aadhaar numbers are never stored.</p>
        <div className="grid2">
          <button className="btn" onClick={exportData}>Export backup</button>
          <label className="btn">
            Import backup
            <input type="file" accept="application/json,.json" hidden onChange={(e) => void importData(e.target.files?.[0])} />
          </label>
        </div>
        <button className="btn btn-danger btn-block" onClick={() => confirm('Delete ALL journeys and history from this device?') && clearAll()}>Delete all data</button>
      </Card>

      <Card title="Fair use">
        <p className="small muted">
          Tatkal AI is a preparation assistant. It does not log in, solve CAPTCHA, read OTPs, fill IRCTC forms, pay or book for you.
          You complete login, Aadhaar OTP, booking and payment yourself on the official IRCTC site/app. Not affiliated with IRCTC or Indian Railways.
        </p>
      </Card>
    </div>
  );
}
