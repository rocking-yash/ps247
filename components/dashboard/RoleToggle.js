'use client';

// Demo switch between the instructor's view and a trainee's. It is not access
// control: it sets data-role on <html>, and the stylesheet hides whatever is
// marked data-instructor-only or data-trainee-only for the other role.

import { useEffect } from 'react';
import { ROLE_KEY, setStored, useStored } from '@/lib/identity';

const ROLES = [
  ['instructor', 'Instructor view'],
  ['trainee', 'Trainee view'],
];

export default function RoleToggle() {
  const role = useStored(ROLE_KEY) === 'trainee' ? 'trainee' : 'instructor';

  useEffect(() => {
    document.documentElement.dataset.role = role;
    return () => {
      delete document.documentElement.dataset.role;
    };
  }, [role]);

  return (
    <div role="group" aria-label="View as" className="no-print flex text-sm">
      {ROLES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={role === value}
          onClick={() => setStored(ROLE_KEY, value)}
          className={`border px-3 py-1.5 font-medium first:rounded-l-lg first:border-r-0 last:rounded-r-lg ${
            role === value ? 'border-accent bg-accent text-white' : 'border-rule bg-paper'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
