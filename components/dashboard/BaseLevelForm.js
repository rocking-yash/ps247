'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Instructor control: the trainee's base difficulty level.
export default function BaseLevelForm({ traineeId, baseLevel }) {
  const router = useRouter();
  const [level, setLevel] = useState(baseLevel);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | failed

  async function submit(e) {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch(`/api/trainees/${traineeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseLevel: level }),
      });
      if (!res.ok) throw new Error();
      setStatus('saved');
      router.refresh();
    } catch {
      setStatus('failed');
    }
  }

  return (
    <form onSubmit={submit} className="no-print flex flex-wrap items-center gap-3 text-sm">
      <label htmlFor="base-level">Base level</label>
      <select
        id="base-level"
        value={level}
        onChange={(e) => {
          setLevel(Number(e.target.value));
          setStatus('idle');
        }}
        className="border border-ink bg-paper px-2 py-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={status === 'saving' || level === baseLevel}
        className="press border border-ink px-3 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-40"
      >
        Set
      </button>
      <span role="status" className={status === 'failed' ? 'text-fail' : 'text-ink/70'}>
        {status === 'saving' && 'Saving.'}
        {status === 'saved' && 'Saved.'}
        {status === 'failed' && 'Could not save.'}
      </span>
    </form>
  );
}
