import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Graded, Mark, TH, TD } from '@/components/dashboard/EventRow';
import { getSessionDetail } from '@/lib/dashboard';
import { CORRECT_RESPONSE, scoreBreakdown } from '@/lib/models';
import { sessionReplayable } from '@/lib/scenario';
import { skillProfile, weaknessSentence, SKILL_NAMES } from '@/lib/weakness';
import { DRONE_LABELS, RESPONSE_LABELS, VERDICT_LABELS, SCORING, describeConditions } from '@/lib/constants';
import { formatDateTime, formatSeconds, fullName } from '@/lib/format';

export const metadata = {
  title: 'Session breakdown — Counter-Drone Trainer',
};

const CARD = 'card-hover min-w-36 rounded-xl border border-rule bg-paper px-5 py-4';
const TABLE_CARD = 'relative mt-4 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2';

// Time on the session clock: seconds from the start of the session.
const clock = (ms) => (ms === null || ms === undefined ? '—' : `T+${(ms / 1000).toFixed(1)} s`);
const points = (n) => `${n.toFixed(2).replace(/\.?0+$/, '')}`;
const percent = (share) => `${Math.round(share * 100)}%`;

function Fact({ label, children }) {
  return (
    <div className={CARD}>
      <dt className="text-sm font-medium text-body">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight">{children}</dd>
    </div>
  );
}

// One line of the score arithmetic: what it is, how it was worked out, and the points.
function Step({ label, working, value, total = false }) {
  return (
    <tr className={total ? 'font-semibold' : ''}>
      <th data-card-title scope="row" className={`${TD} whitespace-nowrap ${total ? '' : 'font-normal'}`}>
        {label}
      </th>
      <td data-label="Working" data-block className={`${TD} text-body`}>{working}</td>
      <td data-label="Points" className={`${TD} whitespace-nowrap pr-0 text-right`}>{value}</td>
    </tr>
  );
}

export default async function SessionPage({ params }) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) notFound();

  const { session, trainee, script } = detail;
  const scripted = session.scenario?.mode === 'scripted';
  const conditions = { lighting: session.conditions?.lighting ?? 'day', terrain: session.conditions?.terrain ?? 'rural' };
  const urban = conditions.terrain === 'urban';
  const focus = session.difficulty.focus ?? null;
  const b = scoreBreakdown(session.events, conditions);
  const stored = session.scores.composite;
  const replayable = sessionReplayable(session, script);
  const weakness = weaknessSentence(skillProfile(session.events, conditions));
  const limits = `${b.limits.fullMs / 1000} s or faster is full marks, ${b.limits.zeroMs / 1000} s or slower is none, by ${conditions.lighting}${urban ? ' in urban terrain' : ''}`;

  return (
    <>
      <p className="no-print flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link href="/dashboard/sessions" data-instructor-only className="link-wipe text-accent">
          All sessions
        </Link>
        {trainee && (
          <Link href={`/dashboard/${trainee._id}`} className="link-wipe text-accent">
            {fullName(trainee)}&apos;s record
          </Link>
        )}
      </p>

      <h1 className="mt-3 text-3xl font-bold tracking-tight">Session of {formatDateTime(session.startedAt)}</h1>
      <p className="mt-1 text-sm text-body">
        {trainee ? `${fullName(trainee)}, ${trainee.unit}` : 'Trainee no longer on record'}
        {!session.completed && '. Not completed, so it is left out of averages'}
      </p>

      <dl className="mt-5 flex flex-wrap gap-4">
        <Fact label="Composite">{stored} of 100</Fact>
        <Fact label="Conditions">
          <span className="capitalize">{describeConditions(conditions)}</span>
        </Fact>
        <Fact label="Level">
          {session.difficulty.level}
          <span className="ml-2 text-sm font-medium text-body">
            {session.difficulty.setBy === 'adaptive' ? 'adaptive' : 'set by instructor'}
            {focus && `, ${SKILL_NAMES[focus].toLowerCase()} practice`}
          </span>
        </Fact>
        <Fact label="Scenario">
          {scripted ? 'Scripted' : 'Procedural'}
          {scripted && <span className="ml-2 text-sm font-medium text-body">{session.scenario.name}</span>}
        </Fact>
        <Fact label="Contacts">{b.contacts}</Fact>
      </dl>

      {weakness && <p className="mt-6 max-w-prose text-lg">{weakness}</p>}

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <p className="mt-1 max-w-prose text-sm text-body">
          Every contact that appeared, in order. Times are on the session clock, in seconds from
          the start. A tick or cross marks each graded answer.
          {urban && ' In urban terrain a contact can appear behind a building, so latency is counted from the moment it first came into sight.'}
        </p>
        <div className={TABLE_CARD}>
          <table className="cards w-full min-w-[60rem] text-left">
            <thead>
              <tr>
                <th className={`${TH} pl-4`}>Verdict</th>
                <th className={TH}>Contact was</th>
                <th className={`${TH} text-right`}>Appeared</th>
                {urban && <th className={`${TH} text-right`}>In sight from</th>}
                <th className={`${TH} text-right`}>Detected</th>
                <th className={`${TH} text-right`}>Latency</th>
                <th className={TH}>Classified as</th>
                <th className={TH}>Response chosen</th>
                <th className={`${TH} pr-0`}>Correct response</th>
              </tr>
            </thead>
            <tbody>
              {session.events.map((event, i) => {
                const pass = event.verdict === 'correct';
                const detected = event.detectedAt !== null && event.detectedAt !== undefined;
                return (
                  <tr key={i}>
                    <td data-card-title className={`${TD} border-l-4 pl-3 ${pass ? 'border-l-pass' : 'border-l-fail'}`}>
                      <span className={`whitespace-nowrap text-base font-semibold ${pass ? 'text-pass' : 'text-fail'}`}>
                        {VERDICT_LABELS[event.verdict]}
                      </span>
                    </td>
                    <td data-label="Contact was" className={TD}>{DRONE_LABELS[event.droneType]}</td>
                    <td data-label="Appeared" className={`${TD} whitespace-nowrap text-right`}>{clock(event.spawnTime)}</td>
                    {urban && (
                      <td data-label="In sight from" className={`${TD} whitespace-nowrap text-right`}>{clock(event.visibleFrom ?? event.spawnTime)}</td>
                    )}
                    <td data-label="Detected" className={`${TD} whitespace-nowrap text-right`}>
                      {detected ? clock(event.detectedAt) : (
                        <>
                          <Mark ok={false} />
                          Not detected
                        </>
                      )}
                    </td>
                    <td data-label="Latency" className={`${TD} whitespace-nowrap text-right`}>{detected ? formatSeconds(event.detectionLatency) : '—'}</td>
                    <td data-label="Classified as" className={TD}>
                      <Graded label={DRONE_LABELS[event.classifiedAs]} ok={event.classifiedCorrectly} />
                    </td>
                    <td data-label="Response chosen" className={`${TD} whitespace-nowrap`}>
                      <Graded label={RESPONSE_LABELS[event.responseChosen]} ok={event.respondedCorrectly} />
                    </td>
                    <td data-label="Correct response" className={`${TD} whitespace-nowrap pr-0`}>{RESPONSE_LABELS[CORRECT_RESPONSE[event.droneType]]}</td>
                  </tr>
                );
              })}
              {session.events.length === 0 && (
                <tr>
                  <td className={`${TD} pr-0`} colSpan={urban ? 9 : 8}>
                    No contacts were recorded in this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">How the score was worked out</h2>
        <p className="mt-1 max-w-prose text-sm text-body">
          Each of the three skills earns a share of its weight, penalties come off, and the result
          is rounded and kept between 0 and 100.
        </p>
        <div className={TABLE_CARD}>
          <table className="cards w-full min-w-[44rem] text-left">
            <thead>
              <tr>
                <th className={TH}>Step</th>
                <th className={TH}>Working</th>
                <th className={`${TH} pr-0 text-right`}>Points</th>
              </tr>
            </thead>
            <tbody>
              <Step
                label="Detection"
                working={
                  b.flagged === 0
                    ? `No contact was flagged, so none of the ${b.weights.detection} points.`
                    : `${b.flagged} of ${b.contacts} contacts flagged, after ${formatSeconds(b.detectionAvgMs)} on average. ${limits.charAt(0).toUpperCase()}${limits.slice(1)}, which makes ${percent(b.detectionShare)} of ${b.weights.detection}.`
                }
                value={points(b.points.detection)}
              />
              <Step
                label="Classification"
                working={
                  b.flagged === 0
                    ? `Nothing was flagged, so nothing was classified.`
                    : `${b.classified} of ${b.flagged} flagged contacts identified correctly: ${percent(b.classificationAccuracy)} of ${b.weights.classification}.`
                }
                value={points(b.points.classification)}
              />
              <Step
                label="Response"
                working={
                  b.flagged === 0
                    ? `Nothing was flagged, so no response was chosen.`
                    : `${b.responded} of ${b.flagged} flagged contacts given the correct response: ${percent(b.responseAccuracy)} of ${b.weights.response}.`
                }
                value={points(b.points.response)}
              />
              <Step
                label="False positives"
                working={`${b.falsePositives} civilian ${b.falsePositives === 1 ? 'decoy' : 'decoys'} engaged, at ${SCORING.falsePositivePenalty} points each.`}
                value={b.penalties.falsePositives ? `−${points(b.penalties.falsePositives)}` : '0'}
              />
              <Step
                label="Missed contacts"
                working={`${b.missed} ${b.missed === 1 ? 'contact' : 'contacts'} never flagged, at ${SCORING.missedPenalty} points each.`}
                value={b.penalties.missed ? `−${points(b.penalties.missed)}` : '0'}
              />
              <Step
                label="Composite"
                working={`${points(b.points.detection)} + ${points(b.points.classification)} + ${points(b.points.response)} − ${points(b.penalties.falsePositives)} − ${points(b.penalties.missed)} = ${points(b.raw)}, rounded${b.raw < 0 ? ' and not allowed below 0' : ''}.`}
                value={`${b.composite} of 100`}
                total
              />
            </tbody>
          </table>
        </div>
        {b.composite !== stored && (
          <p className="mt-3 max-w-prose text-sm text-body">
            The record holds a composite of <span className="font-semibold text-ink">{stored}</span> for
            this session. It was saved under earlier scoring rules; under the current rules shown
            above it comes to {b.composite}. Saved scores are not recalculated.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Scenario</h2>
        <p className="mt-1 max-w-prose text-sm text-body">
          {scripted
            ? 'Scripted: the contacts were written out by an instructor, so everyone assigned this scenario faced the same ones at the same moments.'
            : 'Procedural: the seed, the level and the practice focus are what generated this session’s contacts.'}
        </p>
        <dl className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <dt className="text-sm font-medium text-body">{scripted ? 'Scripted scenario' : 'Seed'}</dt>
            <dd className="break-all font-semibold">{scripted ? session.scenario.name : session.scenarioSeed}</dd>
          </div>
          <div className="no-print">
            {replayable ? (
              <Link href={`/simulator?replay=${session._id}`} className="press bg-accent px-4 py-2 font-medium text-white">
                Replay this scenario
              </Link>
            ) : (
              <span className="text-sm text-body">
                {scripted
                  ? 'This scripted scenario has since been deleted, so it cannot be replayed.'
                  : 'Recorded under an earlier scenario generator, so it cannot be replayed exactly.'}
              </span>
            )}
          </div>
        </dl>
      </section>
    </>
  );
}
