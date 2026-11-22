import { useState } from 'react';
import { Card } from './ui';

/** Big "ENTER TRAIN NUMBER → SEARCH TRAIN" box. Opens #/train/<no>. */
export function TrainSearch({ initial = '' }: { initial?: string }) {
  const [no, setNo] = useState(initial);
  const [err, setErr] = useState('');
  const go = () => {
    if (!/^\d{5}$/.test(no)) return setErr('Train number 5 digit ka hota hai, jaise 12115');
    setErr('');
    location.hash = `#/train/${no}`;
  };
  return (
    <Card title="Search train number" className="search-card">
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <input
          className="search-input mono"
          inputMode="numeric"
          enterKeyHint="search"
          maxLength={5}
          placeholder="ENTER TRAIN NUMBER"
          aria-label="Train number"
          value={no}
          onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" className="btn btn-primary btn-lg">SEARCH TRAIN</button>
      </form>
      {err && <em className="err">{err}</em>}
    </Card>
  );
}
