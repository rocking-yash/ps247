import Link from 'next/link';
import { notFound } from 'next/navigation';
import ScoreTrend from '@/components/dashboard/ScoreTrend';
import { getTraineeDetail } from '@/lib/dashboard';
import EventRow, { EventTableHead, TD } from '@/components/dashboard/EventRow';
import BaseLevelForm from '@/components/dashboard/BaseLevelForm';
import Count from '@/components/Count';
import Disclosure from '@/components/Disclosure';
import { nextAssignment } from '@/lib/assignment';
import { buildScenario } from '@/lib/scenario';
import { VERDICT_LABELS, LEVEL_UP_AT, LEVEL_DOWN_AT } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

// Sessions shown before the rest are folded away under a disclosure.
const RECENT_SESSIONS = 5;

// Rebuilds the scenario from the stored seed and level and checks it against
// what was recorded: same contacts, same types, same spawn times.
function seedReproduces(session) {
  const { drones } = buildScenario(session.scenarioSeed, session.difficulty.level);
  return (
    drones.length === session.events.length &&
    drones.every((drone, i) => {
      const event = session.events[i];
      return drone.droneType === event.droneType && drone.spawnTime === event.spawnTime;
    })
  );
}

// One session in the verdict table: its header line, then a row per contact.
function SessionGroup({ session }) {
  return (
    <tbody>
      <tr>
        <th colSpan={5} scope="rowgroup" className="pb-1 pt-6 text-left text-sm font-normal">
          <span className="flex flex-wrap items-baseline gap-x-6">
            <span className="font-semibold">Session {session.number}</span>
            <span>{formatDateTime(session.startedAt)}</span>
            <span>
              Level {session.difficulty.level}
              {session.difficulty.setBy === 'adaptive' && ', adaptive'}
            </span>
            <span className="capitalize">{session.conditions.lighting}</span>
            {!session.completed && <span>Not completed</span>}
            <span className="text-ink/70">
              {seedReproduces(session)
                ? 'Seed regenerates these contacts'
                : 'Recorded under an earlier scenario generator'}
            </span>
            <span className="ml-auto">
              Composite <span className="font-semibold">{session.scores.composite}</span>
            </span>
          </span>
        </th>
      </tr>
      {session.events.map((event, i) => (
        <EventRow key={i} event={event} />
      ))}
    </tbody>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-ink/70">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
}

export default async function TraineePage({ params }) {
  const { id } = await params;
  const detail = await getTraineeDetail(id);
  if (!detail) notFound();

  const { trainee } = detail;
  const next = await nextAssignment(trainee);
  const sessions = detail.sessions.map((session, i) => ({ ...session, number: i + 1 }));
  const completed = sessions.filter((s) => s.completed);
  const avgComposite = completed.length
    ? completed.reduce((sum, s) => sum + s.scores.composite, 0) / completed.length
    : null;

  const points = completed.map((s) => ({
    number: s.number,
    date: formatDateTime(s.startedAt),
    composite: s.scores.composite,
    level: s.difficulty.level,
    lighting: s.conditions.lighting,
  }));

  const latestFirst = [...sessions].reverse();
  const recent = latestFirst.slice(0, RECENT_SESSIONS);
  const earlier = latestFirst.slice(RECENT_SESSIONS);

  const events = sessions.flatMap((s) => s.events);
  const tally = Object.keys(VERDICT_LABELS)
    .map((verdict) => [verdict, events.filter((e) => e.verdict === verdict).length])
    .filter(([, count]) => count > 0)
    .map(([verdict, count]) => `${count} ${VERDICT_LABELS[verdict].toLowerCase()}`)
    .join(', ');

  return (
    <>
      <Link href="/dashboard" className="no-print text-sm underline underline-offset-4">
        All trainees
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{trainee.name}</h1>
      <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-4">
        <Fact label="Unit" value={trainee.unit} />
        <Fact label="Sessions" value={<Count value={sessions.length} />} />
        <Fact label="Average composite" value={<Count value={avgComposite} />} />
      </dl>

      <section className="mt-10 border-t border-rule pt-4">
        <h2 className="text-lg font-semibold">Difficulty</h2>
        <p className="mt-1 max-w-prose text-sm text-ink/70">
          The next session will run at level <span className="font-semibold text-ink">{next.level}</span>
          {next.setBy === 'adaptive' ? ', adapted from the last three completed sessions' : ', the base level'}
          , by {next.lighting}. The level rises and falls with performance but never drops below
          the base level set here.
        </p>
        <div className="mt-3">
          <BaseLevelForm traineeId={String(trainee._id)} baseLevel={next.baseLevel} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Verdicts</h2>
        <p className="mt-1 max-w-prose text-sm text-ink/70">
          Every contact the trainee faced, latest session first.
          {earlier.length > 0 && ` The ${recent.length} most recent sessions are shown; earlier ones open below.`}
          {events.length > 0 && ` ${events.length} in total: ${tally}.`}
        </p>
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left">
            <EventTableHead />
            {recent.map((session) => (
              <SessionGroup key={String(session._id)} session={session} />
            ))}
            {sessions.length === 0 && (
              <tbody>
                <tr>
                  <td className={`${TD} pr-0`} colSpan={5}>
                    No sessions recorded.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>

        {earlier.length > 0 && (
          <div className="mt-6">
            <Disclosure
              closedLabel={`Show ${earlier.length} earlier ${earlier.length === 1 ? 'session' : 'sessions'}`}
              openLabel="Hide earlier sessions"
            >
              <div className="relative overflow-x-auto pt-2">
                <table className="w-full min-w-[52rem] text-left">
                  <EventTableHead />
                  {earlier.map((session) => (
                    <SessionGroup key={String(session._id)} session={session} />
                  ))}
                </table>
              </div>
            </Disclosure>
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Composite score by session</h2>
        <p className="mt-1 max-w-prose text-sm text-ink/70">
          Out of 100, completed sessions in the order they were run. The dashed lines are the
          adaptive difficulty thresholds: a three-session average of {LEVEL_UP_AT} or more raises
          the level, {LEVEL_DOWN_AT} or less lowers it.
        </p>
        <div className="mt-4">
          {points.length > 0 ? (
            <ScoreTrend points={points} />
          ) : (
            <p className="border-y border-rule py-8 text-sm">No completed sessions yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
