import { Fragment } from 'react';
import Link from 'next/link';
import TraineeHome from '@/components/dashboard/TraineeHome';
import { listScripts, listTrainees, listUnits } from '@/lib/dashboard';
import Disclosure from '@/components/Disclosure';
import ScenarioBuilder from '@/components/dashboard/ScenarioBuilder';
import { AssignScenario } from '@/components/dashboard/ScenarioActions';
import { describeScript } from '@/lib/scripted';
import { nextAssignment } from '@/lib/assignment';
import AssignmentControls from '@/components/dashboard/AssignmentControls';
import { NextSession, SystemRecommends } from '@/components/dashboard/Recommendation';
import Count from '@/components/Count';
import { SKILL_LABELS } from '@/lib/units';
import { formatDateTime, fullName } from '@/lib/format';
import { APPROACH_LABELS, DRONE_LABELS, TERRAIN_LABELS, describeConditions, detectionLimits } from '@/lib/constants';

// "3 s to 13 s rather than 2 s to 10 s", from the scoring constants.
const limits = (conditions) => {
  const { fullMs, zeroMs } = detectionLimits(conditions);
  return `${fullMs / 1000} s to ${zeroMs / 1000} s`;
};
const nightLimits = `${limits('night')} rather than ${limits('day')}`;
const urbanLimits = limits({ lighting: 'day', terrain: 'urban' });

// Reads live session data — never prerender at build time.
export const dynamic = 'force-dynamic';

const TH = 'border-b border-rule py-3 pr-6 text-sm font-medium text-body';
const TD = 'border-b border-rule py-3 pr-6';
const SKILLS = Object.keys(SKILL_LABELS);

// One skill figure in the unit table. The unit's weakest is the only one
// picked out, in the fail colour and bold.
function SkillCell({ unit, skill }) {
  if (!unit.skills) return <td data-label={SKILL_LABELS[skill]} className={`${TD} text-right`}>—</td>;
  const weakest = unit.weakest === skill;
  return (
    <td data-label={SKILL_LABELS[skill]} className={`${TD} text-right ${weakest ? 'font-semibold text-fail' : ''}`}>
      <Count value={unit.skills[skill]} />
    </td>
  );
}

export default async function DashboardPage() {
  const [units, trainees, scripts] = await Promise.all([listUnits(), listTrainees(), listScripts()]);
  const unitNames = [...new Set(trainees.map((t) => t.unit))];
  // What each trainee's next session will be, and how that was arrived at.
  const assignments = await Promise.all(
    trainees.map((t) => nextAssignment({
      _id: t.id, baseLevel: t.baseLevel, lightingChoice: t.lightingChoice, terrainChoice: t.terrainChoice,
      assignedScenario: t.assignedScenario,
    })),
  );
  const pickable = trainees.map((t) => ({ id: t.id, name: fullName(t), unit: t.unit }));

  return (
    <>
      {/* Trainee view: only a way to your own record */}
      <div data-trainee-only>
        <TraineeHome trainees={trainees.map(({ id, name, rank, unit }) => ({ id, name, rank, unit }))} />
      </div>

      {/* Instructor view: every unit and trainee */}
      <div data-instructor-only>
      <h1 className="text-3xl font-bold tracking-tight">Units</h1>
      <p className="mt-1 max-w-prose text-sm text-body">
        Each unit&apos;s combined record across its trainees. The three skills are scored out of
        100 and averaged over completed sessions; the weakest is marked.
      </p>

      <div className="relative mt-6 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
        <table className="cards w-full min-w-[56rem] text-left">
          <thead>
            <tr>
              <th className={TH}>Unit</th>
              <th className={`${TH} text-right`}>Trainees</th>
              <th className={`${TH} text-right`}>Sessions</th>
              <th className={`${TH} text-right`}>Average composite</th>
              {SKILLS.map((skill) => (
                <th key={skill} className={`${TH} text-right`}>
                  {SKILL_LABELS[skill]}
                </th>
              ))}
              <th className={TH}>Weakest skill</th>
              <th className={`${TH} text-right`}>False positives</th>
              <th className={`${TH} pr-0 text-right`}>Misses</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.unit} className="row-hover">
                <th data-card-title scope="row" className={`${TD} whitespace-nowrap font-medium`}>
                  {unit.unit}
                </th>
                <td data-label="Trainees" className={`${TD} text-right`}><Count value={unit.trainees} /></td>
                <td data-label="Sessions" className={`${TD} text-right`}><Count value={unit.sessions} /></td>
                <td data-label="Average composite" className={`${TD} text-right`}><Count value={unit.avgComposite} /></td>
                {SKILLS.map((skill) => (
                  <SkillCell key={skill} unit={unit} skill={skill} />
                ))}
                <td data-label="Weakest skill" className={`${TD} ${unit.weakest ? 'font-semibold text-fail' : 'text-body/70'}`}>
                  {unit.weakest ? SKILL_LABELS[unit.weakest] : 'No sessions yet'}
                </td>
                <td data-label="False positives" className={`${TD} text-right`}><Count value={unit.falsePositives} /></td>
                <td data-label="Misses" className={`${TD} pr-0 text-right`}><Count value={unit.missed} /></td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td className={`${TD} pr-0`} colSpan={10}>
                  No units yet. A unit appears here once it has a trainee.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6">
        <Link href="/dashboard/sessions" className="link-wipe font-medium text-accent">
          View all sessions
        </Link>
      </p>

      <h2 className="mt-16 text-3xl font-bold tracking-tight">Trainees</h2>
      <p className="mt-1 max-w-prose text-sm text-body">
Grouped by unit. Average composite score is out of 100 and covers completed sessions only.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
        <table className="cards w-full text-left">
          <thead>
            <tr>
              <th className={TH}>Trainee</th>
              <th className={`${TH} text-right`}>Sessions</th>
              <th className={`${TH} text-right`}>Average composite</th>
              <th className={`${TH} pr-0`}>Last session</th>
            </tr>
          </thead>
          <tbody>
            {unitNames.map((unit) => (
              <Fragment key={unit}>
                <tr>
                  <th colSpan={4} scope="rowgroup" className="pb-1 pt-6 text-left text-sm font-semibold">
                    {unit}
                  </th>
                </tr>
                {trainees.filter((trainee) => trainee.unit === unit).map((trainee) => (
                  <tr key={trainee.id} className="row-hover">
                    <td data-card-title className={TD}>
                      <Link href={`/dashboard/${trainee.id}`} className="link-wipe font-medium text-accent">
                        {fullName(trainee)}
                      </Link>
                    </td>
                    <td data-label="Sessions" className={`${TD} text-right`}><Count value={trainee.sessionCount} /></td>
                    <td data-label="Average composite" className={`${TD} text-right`}><Count value={trainee.avgComposite} /></td>
                    <td data-label="Last session" className={`${TD} whitespace-nowrap pr-0`}>{formatDateTime(trainee.lastSessionAt)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {trainees.length === 0 && (
              <tr>
                <td className={`${TD} pr-0`} colSpan={4}>
                  No trainees yet. Run `npm run seed` to add the demo trainees.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-16 text-3xl font-bold tracking-tight">Scripted scenarios</h2>
      <p className="mt-1 max-w-prose text-sm text-body">
        A scripted scenario is a fixed sequence of contacts that you write. Everyone assigned it
        faces the identical exercise, so their results can be compared directly. Assign one to a
        trainee or a whole unit and it runs as their next session, once; without one, sessions
        are generated from a fresh seed as before.
      </p>

      <div className="relative mt-6 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
        <table className="cards w-full min-w-[60rem] text-left">
          <thead>
            <tr>
              <th className={TH}>Scenario</th>
              <th className={TH}>Contacts, in order</th>
              <th className={TH}>Assigned to</th>
              <th className={`${TH} pr-0`}>Assign</th>
            </tr>
          </thead>
          <tbody>
            {scripts.map((script) => {
              const assigned = trainees.filter((t) => t.assignedScenario === script.id);
              return (
                <tr key={script.id} className="row-hover">
                  <th data-card-title scope="row" className={`${TD} align-top font-medium`}>
                    {script.name}
                    <span className="block text-sm font-normal text-body">
                      Level {script.level}, {describeConditions(script)}
                    </span>
                    <span className="block text-sm font-normal text-body">{describeScript(script)}</span>
                  </th>
                  <td data-label="Contacts, in order" data-block className={`${TD} align-top text-sm`}>
                    <ol>
                      {script.contacts.map((contact, i) => (
                        <li key={i} className="whitespace-nowrap">
                          T+{+(contact.spawnTime / 1000).toFixed(1)} s, {DRONE_LABELS[contact.droneType]},{' '}
                          {APPROACH_LABELS[contact.approach].toLowerCase()}
                        </li>
                      ))}
                    </ol>
                  </td>
                  <td data-label="Assigned to" data-block className={`${TD} align-top text-sm`}>
                    {assigned.length === 0 ? (
                      <span className="text-body">No one</span>
                    ) : (
                      <ul>
                        {assigned.map((t) => (
                          <li key={t.id} className="whitespace-nowrap">{fullName(t)}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td data-label="Assign" data-block className={`${TD} pr-0 align-top`}>
                    <AssignScenario scenarioId={script.id} scenarioName={script.name} units={unitNames} trainees={pickable} />
                  </td>
                </tr>
              );
            })}
            {scripts.length === 0 && (
              <tr>
                <td className={`${TD} pr-0`} colSpan={4}>
                  No scripted scenarios yet. Write one below, or run `npm run seed` to add the three examples.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <Disclosure closedLabel="Write a new scenario" openLabel="Close the new scenario form">
          <ScenarioBuilder />
        </Disclosure>
      </div>

      <h2 className="mt-16 text-3xl font-bold tracking-tight">Difficulty and conditions</h2>
      <p className="mt-1 max-w-prose text-sm text-body">
        Set each trainee&apos;s base level, lighting and terrain; the trainee cannot change them. The
        system then recommends a level from their recent scores. The base level is the floor: the
        next session runs at whichever is higher, unless a scripted scenario is assigned, which
        runs in its place. Night is harder to see in, so detection is scored on looser limits there
        ({nightLimits}), and a night session is not marked down for the condition. In urban terrain buildings hide a contact for part of its run, so its detection clock starts when it first comes into sight and the limits are looser again ({urbanLimits} by day).
      </p>

      <div className="relative mt-6 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
        <table className="cards w-full min-w-[56rem] text-left">
          <thead>
            <tr>
              <th className={TH}>Trainee</th>
              <th className={TH}>Instructor sets</th>
              <th className={TH}>System recommends</th>
              <th className={`${TH} pr-0`}>Next session</th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((trainee, i) => (
              <tr key={trainee.id} className="row-hover">
                <th data-card-title scope="row" className={`${TD} align-top font-medium`}>
                  {fullName(trainee)}
                  <span className="block text-sm font-normal text-body">{trainee.unit}</span>
                </th>
                <td data-label="Instructor sets" data-block className={`${TD} align-top`}>
                  <AssignmentControls
                    traineeId={trainee.id}
                    traineeName={fullName(trainee)}
                    baseLevel={assignments[i].baseLevel}
                    lightingChoice={assignments[i].lightingChoice}
                    terrainChoice={assignments[i].terrainChoice}
                  />
                  <span className="hidden text-sm print:block">
                    Base level {assignments[i].baseLevel}, {assignments[i].lightingChoice}, {TERRAIN_LABELS[assignments[i].terrainChoice].toLowerCase()}
                  </span>
                </td>
                <td data-label="System recommends" data-block className={`${TD} align-top`}>
                  <SystemRecommends next={assignments[i]} />
                </td>
                <td data-label="Next session" data-block className={`${TD} pr-0 align-top`}>
                  <NextSession next={assignments[i]} trainee={{ id: trainee.id, name: fullName(trainee) }} />
                </td>
              </tr>
            ))}
            {trainees.length === 0 && (
              <tr>
                <td className={`${TD} pr-0`} colSpan={4}>
                  No trainees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}
