'use client';

// What an instructor can do with a scripted scenario once it exists: assign
// it as the next session of a trainee or a whole unit, take that assignment
// back, or delete the scenario.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD = 'rounded-lg border border-rule bg-paper px-2 py-1.5';
const QUIET = 'press border border-rule bg-paper px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40';

async function send(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save.');
  return data;
}

// units: ['Alpha Battery', ...]   trainees: [{ id, name, unit }]
export function AssignScenario({ scenarioId, scenarioName, units, trainees }) {
  const router = useRouter();
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState(null); // null | { text, failed }
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ text: await action() });
      router.refresh();
    } catch (err) {
      setStatus({ text: err.message, failed: true });
    }
    setBusy(false);
  }

  const assign = () => run(async () => {
    const [kind, value] = [target.slice(0, 1), target.slice(2)];
    const body = kind === 'u' ? { scenarioId, unit: value } : { scenarioId, traineeId: value };
    const { trainees: count } = await send('/api/assignments', 'PUT', body);
    setTarget('');
    return count === 1 ? 'Assigned to 1 trainee.' : `Assigned to ${count} trainees.`;
  });

  const remove = () => {
    if (!window.confirm(`Delete "${scenarioName}"? Anyone assigned it goes back to a generated session. Sessions already recorded keep its name.`)) return;
    run(async () => {
      await send(`/api/scenarios/${scenarioId}`, 'DELETE');
      return 'Deleted.';
    });
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <select
        aria-label={`Who runs ${scenarioName} next`}
        value={target}
        onChange={(e) => {
          setTarget(e.target.value);
          setStatus(null);
        }}
        className={FIELD}
      >
        <option value="">Assign to</option>
        <optgroup label="Whole unit">
          {units.map((unit) => (
            <option key={unit} value={`u:${unit}`}>
              Everyone in {unit}
            </option>
          ))}
        </optgroup>
        <optgroup label="One trainee">
          {trainees.map((t) => (
            <option key={t.id} value={`t:${t.id}`}>
              {t.name}
            </option>
          ))}
        </optgroup>
      </select>
      <button
        type="button"
        onClick={assign}
        disabled={busy || !target}
        className="press bg-accent px-4 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Assign
      </button>
      <button type="button" onClick={remove} disabled={busy} className={QUIET}>
        Delete
      </button>
      {status && (
        <span role="status" className={status.failed ? 'text-fail' : 'text-body'}>
          {status.text}
        </span>
      )}
    </div>
  );
}

// Takes a scripted assignment back, so the trainee's next session is generated.
export function ClearScripted({ traineeId, traineeName }) {
  const router = useRouter();
  const [state, setState] = useState('idle'); // idle | busy | failed

  async function clear() {
    setState('busy');
    try {
      await send('/api/assignments', 'PUT', { scenarioId: null, traineeId });
      setState('idle');
      router.refresh();
    } catch {
      setState('failed');
    }
  }

  return (
    <span data-instructor-only className="no-print mt-2 flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={clear}
        disabled={state === 'busy'}
        aria-label={`Clear the scripted scenario assigned to ${traineeName}`}
        className={QUIET}
      >
        Clear assignment
      </button>
      {state === 'failed' && (
        <span role="status" className="text-fail">
          Could not clear it.
        </span>
      )}
    </span>
  );
}
