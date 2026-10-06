'use client';

// The instructor's form for writing a scripted scenario: a name, conditions,
// a difficulty level and the contacts in the order they appear. Nothing is
// saved until "Save scenario" is pressed; the server checks it again.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  APPROACHES, APPROACH_LABELS, DRONE_LABELS, DRONE_TYPES, SCRIPT_LIMITS, TERRAIN, TERRAIN_LABELS,
} from '@/lib/constants';
import { checkScript } from '@/lib/scripted';

const FIELD = 'rounded-lg border border-rule bg-paper px-2 py-1.5';
const TH = 'border-b border-rule py-2 pr-4 text-sm font-medium text-body';
const TD = 'border-b border-rule py-2 pr-4';

let nextKey = 1;
const blankContact = (seconds) => ({ key: nextKey++, droneType: DRONE_TYPES[0], seconds: String(seconds), approach: 'ahead' });

export default function ScenarioBuilder() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(2);
  const [lighting, setLighting] = useState('day');
  const [terrain, setTerrain] = useState('rural');
  const [contacts, setContacts] = useState(() => [blankContact(3)]);
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const [error, setError] = useState(null);

  const touch = () => {
    setStatus('idle');
    setError(null);
  };
  const change = (key, patch) => {
    touch();
    setContacts((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };
  const add = () => {
    touch();
    setContacts((list) => [...list, blankContact(Math.max(0, ...list.map((c) => Number(c.seconds) || 0)) + 5)]);
  };
  const remove = (key) => {
    touch();
    setContacts((list) => list.filter((c) => c.key !== key));
  };

  async function submit(e) {
    e.preventDefault();
    const draft = {
      name,
      level,
      lighting,
      terrain,
      contacts: contacts.map((c) => ({
        droneType: c.droneType,
        approach: c.approach,
        spawnTime: c.seconds.trim() === '' ? NaN : Number(c.seconds) * 1000,
      })),
    };
    const checked = checkScript(draft);
    if (checked.error) {
      setError(checked.error);
      return;
    }

    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checked.value),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the scenario.');
      setStatus('saved');
      setName('');
      setContacts([blankContact(3)]);
      router.refresh();
    } catch (err) {
      setStatus('idle');
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-rule bg-paper px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2">
          <span>Name</span>
          <input
            value={name}
            maxLength={SCRIPT_LIMITS.nameLength}
            onChange={(e) => {
              touch();
              setName(e.target.value);
            }}
            className={`${FIELD} w-64 phone:w-full`}
          />
        </label>
        <label className="flex items-center gap-2">
          <span>Conditions</span>
          <select
            value={lighting}
            onChange={(e) => {
              touch();
              setLighting(e.target.value);
            }}
            className={FIELD}
          >
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span>Terrain</span>
          <select
            value={terrain}
            onChange={(e) => {
              touch();
              setTerrain(e.target.value);
            }}
            className={FIELD}
          >
            {TERRAIN.toReversed().map((value) => (
              <option key={value} value={value}>
                {TERRAIN_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span>Difficulty level</span>
          <select
            value={level}
            onChange={(e) => {
              touch();
              setLevel(Number(e.target.value));
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
      </div>
      <p className="mt-2 max-w-prose text-body">
        In a scripted scenario the level sets how fast the contacts fly. How many there are, and
        when they appear, is what you write below.
      </p>

      <div className="relative mt-3 overflow-x-auto">
        <table className="cards w-full min-w-[40rem] text-left">
          <thead>
            <tr>
              <th className={TH}>Contact</th>
              <th className={TH}>Type</th>
              <th className={TH}>Appears at, seconds in</th>
              <th className={TH}>Approach</th>
              <th className={`${TH} pr-0`}>
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact, i) => (
              <tr key={contact.key}>
                <th data-card-title scope="row" className={`${TD} font-normal`}>
                  <span className="hidden phone:inline">Contact </span>
                  {i + 1}
                </th>
                <td data-label="Type" data-block className={TD}>
                  <select
                    aria-label={`Type of contact ${i + 1}`}
                    value={contact.droneType}
                    onChange={(e) => change(contact.key, { droneType: e.target.value })}
                    className={FIELD}
                  >
                    {DRONE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DRONE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </td>
                <td data-label="Appears at, seconds in" className={TD}>
                  <input
                    aria-label={`Seconds in at which contact ${i + 1} appears`}
                    type="number"
                    min="0"
                    max={SCRIPT_LIMITS.maxSpawnSeconds}
                    step="0.5"
                    value={contact.seconds}
                    onChange={(e) => change(contact.key, { seconds: e.target.value })}
                    className={`${FIELD} w-24`}
                  />
                </td>
                <td data-label="Approach" className={TD}>
                  <select
                    aria-label={`Approach of contact ${i + 1}`}
                    value={contact.approach}
                    onChange={(e) => change(contact.key, { approach: e.target.value })}
                    className={FIELD}
                  >
                    {APPROACHES.map((approach) => (
                      <option key={approach} value={approach}>
                        {APPROACH_LABELS[approach]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${TD} pr-0 text-right`}>
                  <button
                    type="button"
                    onClick={() => remove(contact.key)}
                    disabled={contacts.length === 1}
                    aria-label={`Remove contact ${i + 1}`}
                    className="press border border-rule bg-paper px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={contacts.length >= SCRIPT_LIMITS.maxContacts}
          className="press border border-rule bg-paper px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add contact
        </button>
        <button
          type="submit"
          disabled={status === 'saving'}
          className="press bg-accent px-4 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save scenario
        </button>
        <span role="status" className={error ? 'text-fail' : 'text-body'}>
          {error}
          {!error && status === 'saving' && 'Saving.'}
          {!error && status === 'saved' && 'Saved. It is in the list above.'}
        </span>
      </div>
    </form>
  );
}
