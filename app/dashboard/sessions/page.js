import Link from 'next/link';
import SessionsTable from '@/components/dashboard/SessionsTable';
import { listSessions } from '@/lib/dashboard';
import { LEVEL_UP_AT, LEVEL_DOWN_AT } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

// Reads live session data — never prerender at build time.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'All sessions — Counter-Drone Trainer',
};

// /dashboard/sessions lists every session. ?unit=, ?trainee=<id> and
// ?lighting=day|night open it already filtered.
export default async function SessionsPage({ searchParams }) {
  const query = await searchParams;
  const sessions = (await listSessions()).map((s) => ({ ...s, dateLabel: formatDateTime(s.startedAt) }));

  const units = [...new Set(sessions.map((s) => s.unit))].sort();
  const seen = new Map(sessions.map((s) => [s.traineeId, s.trainee]));
  const trainees = [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  // Only honour filter values that exist, so a stale link shows everything rather than nothing.
  const initial = {
    unit: units.includes(query.unit) ? query.unit : '',
    trainee: seen.has(query.trainee) ? query.trainee : '',
    lighting: query.lighting === 'day' || query.lighting === 'night' ? query.lighting : '',
  };

  return (
    <>
      <div data-trainee-only>
        <h1 className="text-3xl font-bold tracking-tight">All sessions</h1>
        <p className="mt-1 max-w-prose text-sm text-body">
          The full record across every trainee is part of the instructor view. Switch to instructor
          view to see it, or open your own record from the dashboard.
        </p>
      </div>

      <div data-instructor-only>
        <Link href="/dashboard" className="no-print link-wipe text-sm text-accent">
          Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">All sessions</h1>
        <p className="mt-1 max-w-prose text-sm text-body">
          Every session across all trainees, one row each. Select a column heading to sort by it,
          and a row to open its full breakdown. The three skills are out of 100. Composite is
          tinted green at {LEVEL_UP_AT} or above and red at {LEVEL_DOWN_AT} or below, the same
          thresholds the adaptive difficulty uses.
        </p>
        <SessionsTable sessions={sessions} units={units} trainees={trainees} initial={initial} />
      </div>
    </>
  );
}
