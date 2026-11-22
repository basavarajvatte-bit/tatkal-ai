import { useState } from 'react';
import type { Berth, Gender, Profile } from '../lib/types';
import { useData, saveProfile, deleteProfile, saveGroup, deleteGroup, uid } from '../lib/store';
import { passengerErrors, clean } from '../lib/validate';
import { BERTHS, berthLabel } from '../lib/labels';
import { Card, Empty } from '../components/ui';

const blank = (): Profile => ({ id: uid(), name: '', age: null, gender: '', berth: 'NP', food: '', active: true });

function ProfileForm({ initial, onDone }: { initial: Profile; onDone: () => void }) {
  const [p, setP] = useState<Profile>(initial);
  const [tried, setTried] = useState(false);
  const errs = passengerErrors(p);
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });
  return (
    <div className="subcard">
      <label className="field">
        <span>Full name (ID proof jaisa)</span>
        <input value={p.name} maxLength={16} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="grid3">
        <label className="field">
          <span>Age</span>
          <input inputMode="numeric" maxLength={3} value={p.age ?? ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); set({ age: v ? +v : null }); }} />
        </label>
        <label className="field">
          <span>Gender</span>
          <select value={p.gender} onChange={(e) => set({ gender: e.target.value as Gender })}>
            <option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="T">Transgender</option>
          </select>
        </label>
        <label className="field">
          <span>Berth</span>
          <select value={p.berth} onChange={(e) => set({ berth: e.target.value as Berth })}>
            {BERTHS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Food / other (optional)</span>
        <input value={p.food ?? ''} maxLength={30} placeholder="Veg / No food" onChange={(e) => set({ food: e.target.value })} />
      </label>
      {tried && errs.length > 0 && <em className="err">{errs.join(' · ')}</em>}
      <div className="actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setTried(true);
            if (errs.length) return;
            saveProfile({ ...p, name: clean(p.name, 16), food: clean(p.food ?? '', 30) });
            onDone();
          }}
        >
          Save
        </button>
        <button className="btn btn-sm" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export default function Passengers() {
  const { profiles, groups } = useData();
  const [editing, setEditing] = useState<Profile | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [gName, setGName] = useState('');

  const createGroup = () => {
    const name = clean(gName, 30);
    if (!name || !pick.length) return;
    saveGroup({ id: uid(), name, profileIds: pick.slice(0, 4) });
    setPick([]);
    setGName('');
  };

  return (
    <div className="stack">
      <div className="row between">
        <h1>Passengers</h1>
        {!editing && <button className="btn btn-primary" onClick={() => setEditing(blank())}>+ New</button>}
      </div>
      <p className="muted small">Sirf is phone mein save hota hai. Aadhaar number, password, OTP kabhi nahi maanga jaata.</p>

      {editing && !profiles.some((p) => p.id === editing.id) && (
        <Card title="New passenger"><ProfileForm initial={editing} onDone={() => setEditing(null)} /></Card>
      )}

      <Card title={`Saved passengers (${profiles.length})`}>
        {!profiles.length && <Empty text="Abhi koi passenger save nahi hai." />}
        {profiles.map((p) =>
          editing?.id === p.id ? (
            <ProfileForm key={p.id} initial={editing} onDone={() => setEditing(null)} />
          ) : (
            <div key={p.id} className={`listrow ${p.active ? '' : 'dim'}`}>
              <label className="check">
                <input type="checkbox" checked={pick.includes(p.id)} onChange={() => setPick((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : s.length >= 4 ? s : [...s, p.id]))} aria-label={`Select ${p.name} for group`} />
                <span>
                  <b>{p.name || 'No name'}</b> · {p.age ?? '?'} · {p.gender || '?'} · {berthLabel(p.berth)}
                  {!p.active && <span className="chip chip-muted"> Off</span>}
                  {passengerErrors(p).length > 0 && <em className="err soft">{passengerErrors(p).join(' · ')}</em>}
                </span>
              </label>
              <div className="actions">
                <button className="btn btn-xs" onClick={() => setEditing({ ...p })}>Edit</button>
                <button className="btn btn-xs" onClick={() => saveProfile({ ...p, active: !p.active })}>{p.active ? 'Deactivate' : 'Activate'}</button>
                <button className="btn btn-xs btn-danger" onClick={() => confirm(`Delete ${p.name}?`) && deleteProfile(p.id)}>Delete</button>
              </div>
            </div>
          ),
        )}
        {pick.length > 0 && (
          <div className="row gap mt">
            <input className="grow input-sm" placeholder="Group naam (Family / Friends)" maxLength={30} value={gName} onChange={(e) => setGName(e.target.value)} />
            <button className="btn btn-sm" onClick={createGroup} disabled={!gName.trim()}>SAVE PASSENGER GROUP ({pick.length})</button>
          </div>
        )}
      </Card>

      <Card title={`Passenger groups (${groups.length})`}>
        {!groups.length && <p className="muted small">Upar passengers pe tick karo, naam do, aur group save karo.</p>}
        {groups.map((g) => (
          <div key={g.id} className="listrow">
            <div className="row between">
              <b>{g.name}</b>
              <button className="btn btn-xs btn-danger" onClick={() => confirm(`Delete group ${g.name}?`) && deleteGroup(g.id)}>Delete</button>
            </div>
            <span className="muted small">{g.profileIds.map((id) => profiles.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || 'Empty'}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
