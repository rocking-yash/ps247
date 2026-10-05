// One graded contact as a row of the verdict table. Shared by the trainee
// review sheet and the sample on the landing page.

import { DRONE_LABELS, RESPONSE_LABELS, VERDICT_LABELS } from '@/lib/constants';
import { formatSeconds } from '@/lib/format';

export const TH = 'border-b border-ink py-2 pr-5 text-sm font-medium text-ink/70';
export const TD = 'border-b border-rule py-3.5 pr-5 align-baseline';

// Tick or cross beside a graded answer. The colour repeats what the shape
// and the hidden text already say.
function Mark({ ok }) {
  return (
    <>
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={`mr-2 inline-block h-3 w-3 ${ok ? 'text-pass' : 'text-fail'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {ok ? <path d="M1.5 6.5 4.5 9.5 10.5 2.5" /> : <path d="M2 2 10 10M10 2 2 10" />}
      </svg>
      <span className="sr-only">{ok ? 'Correct: ' : 'Incorrect: '}</span>
    </>
  );
}

function Graded({ label, ok }) {
  if (!label) return <span className="text-ink/50">Not reached</span>;
  return (
    <>
      <Mark ok={ok} />
      {label}
    </>
  );
}

export function EventTableHead() {
  return (
    <thead>
      <tr>
        <th className={`${TH} pl-4`}>Verdict</th>
        <th className={TH}>Contact</th>
        <th className={TH}>Detected after</th>
        <th className={TH}>Classified as</th>
        <th className={`${TH} pr-0`}>Response</th>
      </tr>
    </thead>
  );
}

export default function EventRow({ event }) {
  const pass = event.verdict === 'correct';
  const missed = event.verdict === 'missed';

  return (
    <tr>
      <td className={`${TD} border-l-4 pl-3 ${pass ? 'border-l-pass' : 'border-l-fail'}`}>
        <span className={`whitespace-nowrap text-base font-semibold ${pass ? 'text-pass' : 'text-fail'}`}>
          {VERDICT_LABELS[event.verdict]}
        </span>
      </td>
      <td className={`${TD} whitespace-nowrap`}>{DRONE_LABELS[event.droneType]}</td>
      <td className={`${TD} whitespace-nowrap`}>
        {missed ? (
          <>
            <Mark ok={false} />
            Not detected
          </>
        ) : (
          formatSeconds(event.detectionLatency)
        )}
      </td>
      <td className={TD}>
        <Graded label={DRONE_LABELS[event.classifiedAs]} ok={event.classifiedCorrectly} />
      </td>
      <td className={`${TD} whitespace-nowrap pr-0`}>
        <Graded label={RESPONSE_LABELS[event.responseChosen]} ok={event.respondedCorrectly} />
      </td>
    </tr>
  );
}
