'use client';

import { useId, useState } from 'react';

// A section that opens under its button. The height animates (.reveal in
// globals.css) so it is clear what opened and what it pushed down.
export default function Disclosure({ closedLabel, openLabel, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="press no-print border border-ink px-3 py-1.5 text-sm font-medium"
      >
        {open ? openLabel : closedLabel}
      </button>
      <div id={id} className="reveal" data-open={open}>
        <div inert={!open}>{children}</div>
      </div>
    </>
  );
}
