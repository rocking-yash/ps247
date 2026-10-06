import Link from 'next/link';
import { notFound } from 'next/navigation';
import ScoreTrend from '@/components/dashboard/ScoreTrend';
import { getTraineeDetail, listScripts } from '@/lib/dashboard';
import EventRow, { EventTableHead, TD } from '@/components/dashboard/EventRow';
import AssignmentControls from '@/components/dashboard/AssignmentControls';
import { NextSession, SystemRecommends } from '@/components/dashboard/Recommendation';
import Count from '@/components/Count';
import Disclosure from '@/components/Disclosure';
import { nextAssignment } from '@/lib/assignment';
import { sessionReplayable } from '@/lib/scenario';
import { SKILL_NAMES } from '@/lib/weakness';
import { VERDICT_LABELS, LEVEL_UP_AT, LEVEL_DOWN_AT } from '@/lib/constants';
import { formatDateTime, fullName } from '@/lib/format';
import { describeConditions, detectionLimits } from '@/lib/constants';

const limits = (conditions) => {
  const { fullMs, zeroMs } = detectionLimits(conditions);
  return `${fullMs / 1000} s to ${zeroMs / 1000} s`;
};
const nightLimits = `${limits('night')} rather than ${limits('day')}`;
const urbanLimits = limits({ lighting: 'day', terrain: 'urban' });

// Sessions shown before the rest are folded away under a disclosure.
const RECENT_SESSIONS = 5;

// One session in the verdict table: its header line, then a row per contact.
// script: the scripted scenario it ran, if it was scripted and that still exists.
function SessionGroup({ session, script }) {
  // Rebuilt from the stored seed and level (or the script) and checked against the record.
  const replayable = sessionReplayable(session, script);
  const scripted = session.scenario?.mode === 'scripted';

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
              {session.difficulty.focus && `, ${SKILL_NAMES[session.difficulty.focus].toLowerCase()} practice`}
            </span>
            <span className="capitalize">{describeConditions(session.conditions)}</span>
            <span>{scripted ? `Scripted: ${session.scenario.name}` : 'Procedural'}</span>
            {!session.completed && <span>Not completed</span>}
            <Link href={`/dashboard/sessions/${session._id}`} className="no-print link-wipe text-accent">
              Full breakdown
            </Link>
            {replayable ? (
              <Link
                href={`/simulator?replay=${session._id}`}
                className="no-print link-wipe text-accent"
              >
                Replay this scenario
              </Link>
            ) : (
              <span className="text-body">
                {scripted ? 'Its scripted scenario has been deleted' : 'Recorded under an earlier scenario generator'}
              </span>
            )}
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
    <div className="card-hover min-w-36 rounded-xl border border-rule bg-paper px-5 py-4">
      <dt className="text-sm font-medium text-body">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight">{value}</dd>
    </div>
  );
}

export default async function TraineePage({ params }) {
  const { id } = await params;
  const detail = await getTraineeDetail(id);
  if (!detail) notFound();

  const { trainee } = detail;
  const next = await nextAssignment(trainee);
  const scripts = new Map((await listScripts()).map((script) => [script.id, script]));
  const scriptOf = (session) => scripts.get(String(session.scenario?.scriptedId)) ?? null;
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
      <Link href="/dashboard" data-instructor-only className="no-print link-wipe text-sm text-accent">
        All trainees
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{fullName(trainee)}</h1>
      <dl className="mt-5 flex flex-wrap gap-4">
        <Fact label="Unit" value={trainee.unit} />
        <Fact label="Sessions" value={<Count value={sessions.length} />} />
        <Fact label="Average composite" value={<Count value={avgComposite} />} />
      </dl>

      {next.weakness && (
        <p className={`mt-6 max-w-prose text-lg ${next.focus ? 'font-semibold text-fail' : ''}`}>
          {next.weakness}
        </p>
      )}

      <section className="mt-10 border-t border-rule pt-4">
        <h2 className="text-lg font-semibold">Difficulty and conditions</h2>
        <p className="mt-1 max-w-prose text-sm text-body">
          The base level is the floor. The system recommends a level from recent scores, and the
          next session runs at whichever is higher, unless a scripted scenario is assigned. The instructor also sets the lighting and the
          terrain. Night is harder to see in, so detection is scored on looser limits there ({nightLimits}). In urban terrain buildings hide a contact for part of its run, so its detection clock starts when it first comes into sight and the limits are looser again ({urbanLimits} by day).
        </p>
        <div data-instructor-only className="mt-3">
          <AssignmentControls
            traineeId={String(trainee._id)}
            traineeName={fullName(trainee)}
            baseLevel={next.baseLevel}
            lightingChoice={next.lightingChoice}
            terrainChoice={next.terrainChoice}
          />
        </div>
        <dl className="mt-4 grid gap-x-12 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-body">System recommends</dt>
            <dd>
              <SystemRecommends next={next} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-body">Next session</dt>
            <dd>
              <NextSession next={next} trainee={{ id: String(trainee._id), name: fullName(trainee) }} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Verdicts</h2>
        <p className="mt-1 text-sm">
          <Link href={`/dashboard/sessions?trainee=${trainee._id}`} className="no-print link-wipe font-medium text-accent">
            View all of {fullName(trainee)}&apos;s sessions
          </Link>
        </p>
        <p className="mt-1 max-w-prose text-sm text-body">
          Every contact the trainee faced, latest session first.
          {earlier.length > 0 && ` The ${recent.length} most recent sessions are shown; earlier ones open below.`}
          {events.length > 0 && ` ${events.length} in total: ${tally}.`}
        </p>
        <div className="relative mt-4 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
          <table className="w-full min-w-[52rem] text-left">
            <EventTableHead />
            {recent.map((session) => (
              <SessionGroup key={String(session._id)} session={session} script={scriptOf(session)} />
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
              <div className="relative overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2 pt-2">
                <table className="w-full min-w-[52rem] text-left">
                  <EventTableHead />
                  {earlier.map((session) => (
                    <SessionGroup key={String(session._id)} session={session} script={scriptOf(session)} />
                  ))}
                </table>
              </div>
            </Disclosure>
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Composite score by session</h2>
        <p className="mt-1 max-w-prose text-sm text-body">
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
