'use client';

// A stored seed, shortened so it does not crowd its row. The full value is
// the tooltip on hover, and a tap or click swaps it in.

import { useState } from 'react';

const SHOWN = 8;

export default function SeedValue({ seed }) {
  const [full, setFull] = useState(false);
  if (seed.length <= SHOWN + 4) return seed;

  return (
    <button
      type="button"
      title={seed}
      aria-expanded={full}
      aria-label={full ? `Seed ${seed}. Show it shortened` : `Seed beginning ${seed.slice(0, SHOWN)}. Show it in full`}
      onClick={() => setFull(!full)}
      className="break-all text-left underline decoration-dotted underline-offset-4"
    >
      {full ? seed : `${seed.slice(0, SHOWN)}…`}
    </button>
  );
}
