import Link from 'next/link';
import { listTrainees, listUnits } from '@/lib/dashboard';
import Count from '@/components/Count';
import { SKILL_LABELS } from '@/lib/units';
import { formatDateTime } from '@/lib/format';

// Reads live session data — never prerender at build time.
export const dynamic = 'force-dynamic';

const TH = 'border-b border-ink py-2 pr-6 text-sm font-medium text-ink/70';
const TD = 'border-b border-rule py-3 pr-6';
const SKILLS = Object.keys(SKILL_LABELS);

// One skill figure in the unit table. The unit's weakest is the only one
// picked out, in the fail colour and bold.
function SkillCell({ unit, skill }) {
  if (!unit.skills) return <td className={`${TD} text-right`}>—</td>;
  const weakest = unit.weakest === skill;
  return (
    <td className={`${TD} text-right ${weakest ? 'font-semibold text-fail' : ''}`}>
      <Count value={unit.skills[skill]} />
    </td>
  );
}

export default async function DashboardPage() {
  const [units, trainees] = await Promise.all([listUnits(), listTrainees()]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Units</h1>
      <p className="mt-1 max-w-prose text-sm text-ink/70">
        Each unit&apos;s combined record across its trainees. The three skills are scored out of
        100 and averaged over completed sessions; the weakest is marked.
      </p>

      <div className="relative mt-6 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left">
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
              <tr key={unit.unit}>
                <th scope="row" className={`${TD} font-medium`}>
                  {unit.unit}
                </th>
                <td className={`${TD} text-right`}><Count value={unit.trainees} /></td>
                <td className={`${TD} text-right`}><Count value={unit.sessions} /></td>
                <td className={`${TD} text-right`}><Count value={unit.avgComposite} /></td>
                {SKILLS.map((skill) => (
                  <SkillCell key={skill} unit={unit} skill={skill} />
                ))}
                <td className={`${TD} ${unit.weakest ? 'font-semibold text-fail' : 'text-ink/50'}`}>
                  {unit.weakest ? SKILL_LABELS[unit.weakest] : 'No sessions yet'}
                </td>
                <td className={`${TD} text-right`}><Count value={unit.falsePositives} /></td>
                <td className={`${TD} pr-0 text-right`}><Count value={unit.missed} /></td>
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

      <h2 className="mt-14 text-2xl font-semibold">Trainees</h2>
      <p className="mt-1 max-w-prose text-sm text-ink/70">
        Listed by unit. Average composite score is out of 100 and covers completed sessions only.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className={TH}>Trainee</th>
              <th className={TH}>Unit</th>
              <th className={`${TH} text-right`}>Sessions</th>
              <th className={`${TH} text-right`}>Average composite</th>
              <th className={`${TH} pr-0`}>Last session</th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((trainee) => (
              <tr key={trainee.id}>
                <td className={TD}>
                  <Link href={`/dashboard/${trainee.id}`} className="font-medium underline underline-offset-4">
                    {trainee.name}
                  </Link>
                </td>
                <td className={TD}>{trainee.unit}</td>
                <td className={`${TD} text-right`}><Count value={trainee.sessionCount} /></td>
                <td className={`${TD} text-right`}><Count value={trainee.avgComposite} /></td>
                <td className={`${TD} whitespace-nowrap pr-0`}>{formatDateTime(trainee.lastSessionAt)}</td>
              </tr>
            ))}
            {trainees.length === 0 && (
              <tr>
                <td className={`${TD} pr-0`} colSpan={5}>
                  No trainees yet. Run a session in the simulator to create the first record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
