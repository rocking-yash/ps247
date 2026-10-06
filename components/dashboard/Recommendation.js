// The adaptive rule's recommendation in words, and how it combines with the
// instructor's base level. Shown beside the instructor controls so the rule
// is visible rather than hidden. `next` comes from nextAssignment().

import { LEVEL_UP_AT, LEVEL_DOWN_AT, describeConditions } from '@/lib/constants';
import { SKILL_NAMES } from '@/lib/weakness';
import { describeScript } from '@/lib/scripted';
import { ClearScripted } from './ScenarioActions';

const REASON = {
  raise: `${LEVEL_UP_AT} or more raises the level`,
  lower: `${LEVEL_DOWN_AT} or less lowers it`,
  hold: `between ${LEVEL_DOWN_AT} and ${LEVEL_UP_AT} holds it`,
};

export function SystemRecommends({ next }) {
  if (next.recommended === null) {
    return <span className="text-body">Nothing yet. It needs two completed sessions to go on.</span>;
  }
  return (
    <>
      <span className="font-semibold">Level {next.recommended}</span>
      <span className="block text-sm text-body">
        The last {next.basedOn} completed sessions averaged {Math.round(next.average)};{' '}
        {REASON[next.direction]}.
      </span>
    </>
  );
}

// trainee: { id, name }, so an instructor can take a scripted assignment back.
export function NextSession({ next, trainee }) {
  if (next.scripted) {
    return (
      <>
        <span className="font-semibold">Scripted: {next.scripted.name}</span>
        <span className="block text-sm text-body">
          Level {next.level}, {describeConditions(next)}. {describeScript(next.scripted)}.
        </span>
        <span className="mt-1 block text-sm text-body">
          Assigned by the instructor for one session. After it, generated sessions resume at
          level {next.adaptive.level}.
        </span>
        <ClearScripted traineeId={trainee.id} traineeName={trainee.name} />
      </>
    );
  }

  const held = next.recommended !== null && next.recommended < next.baseLevel;
  return (
    <>
      <span className="font-semibold">
        Level {next.level}, {describeConditions(next)}
      </span>
      <span className="block text-sm text-body">
        {next.setBy === 'adaptive' && 'Above the base level, on the system’s recommendation.'}
        {next.setBy === 'instructor' && held && 'Held at the base level; the system would have gone lower.'}
        {next.setBy === 'instructor' && !held && 'At the base level.'}
      </span>
      <span className="mt-1 block text-sm text-body">
        {next.focus
          ? `Shaped to practise ${SKILL_NAMES[next.focus].toLowerCase()}, the weak link.`
          : 'No practice focus: no skill is weak enough to target.'}
      </span>
    </>
  );
}
