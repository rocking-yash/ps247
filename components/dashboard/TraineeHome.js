'use client';

// What /dashboard shows in trainee view: a way to your own record, or, if
// nobody has been picked in this browser yet, the list to pick from.

import Link from 'next/link';
import { TRAINEE_KEY, setStored, useStored } from '@/lib/identity';
import { fullName } from '@/lib/format';

// trainees: [{ id, name, rank, unit }]
export default function TraineeHome({ trainees }) {
  const storedId = useStored(TRAINEE_KEY);
  const me = trainees.find((t) => t.id === storedId) ?? null;
  const units = [...new Set(trainees.map((t) => t.unit))];

  if (me) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight">{fullName(me)}</h1>
        <p className="mt-1 text-sm text-body">{me.unit}. Trainee view shows your own record only.</p>
        <p className="mt-6 flex flex-wrap gap-3">
          <Link href={`/dashboard/${me.id}`} className="press bg-accent px-4 py-2 font-medium text-white">
            Open your record
          </Link>
          <Link href="/simulator" className="press border border-rule px-4 py-2 font-medium">
            Run a session
          </Link>
          <button
            type="button"
            onClick={() => setStored(TRAINEE_KEY, null)}
            className="press border border-rule px-4 py-2 font-medium"
          >
            Not you? Pick again
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Who are you?</h1>
      <p className="mt-1 max-w-prose text-sm text-body">
        Pick your name to see your own record. This browser remembers the choice; there is no
        password.
      </p>
      {trainees.length === 0 && <p className="mt-6 border-y border-rule py-6">No trainees have been added yet.</p>}
      {units.map((unit) => (
        <section key={unit} className="mt-8">
          <h2 className="border-b border-rule pb-2 text-sm font-medium text-body">{unit}</h2>
          <ul>
            {trainees.filter((t) => t.unit === unit).map((t) => (
              <li key={t.id} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => setStored(TRAINEE_KEY, t.id)}
                  className="press w-full px-2 py-3 text-left font-medium"
                >
                  {fullName(t)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
