'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LIGHTING_OPTIONS = [
  ['alternate', 'Alternate day and night'],
  ['day', 'Day'],
  ['night', 'Night'],
];

const FIELD = 'rounded-lg border border-rule bg-paper px-2 py-1.5';

// Instructor controls for one trainee: base difficulty level and lighting.
// Nothing is saved until "Set" is pressed.
export default function AssignmentControls({ traineeId, traineeName, baseLevel, lightingChoice }) {
  const router = useRouter();
  const [level, setLevel] = useState(baseLevel);
  const [lighting, setLighting] = useState(lightingChoice);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | failed

  const changed = level !== baseLevel || lighting !== lightingChoice;

  async function submit(e) {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch(`/api/trainees/${traineeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseLevel: level, lightingChoice: lighting }),
      });
      if (!res.ok) throw new Error();
      setStatus('saved');
      router.refresh();  // recompute what the next session will be
    } catch {
      setStatus('failed');
    }
  }

  return (
    <form onSubmit={submit} className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <label className="flex items-center gap-2">
        <span>Base level</span>
        <select
          aria-label={`Base level for ${traineeName}`}
          value={level}
          onChange={(e) => {
            setLevel(Number(e.target.value));
            setStatus('idle');
          }}
          className={FIELD}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span>Conditions</span>
        <select
          aria-label={`Conditions for ${traineeName}`}
          value={lighting}
          onChange={(e) => {
            setLighting(e.target.value);
            setStatus('idle');
          }}
          className={FIELD}
        >
          {LIGHTING_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={status === 'saving' || !changed}
        className="press bg-accent px-4 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Set
      </button>
      <span role="status" className={status === 'failed' ? 'text-fail' : 'text-body'}>
        {status === 'saving' && 'Saving.'}
        {status === 'saved' && !changed && 'Saved.'}
        {status === 'failed' && 'Could not save.'}
      </span>
    </form>
  );
}
