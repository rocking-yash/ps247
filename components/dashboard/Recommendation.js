// The adaptive rule's recommendation in words, and how it combines with the
// instructor's base level. Shown beside the instructor controls so the rule
// is visible rather than hidden. `next` comes from nextAssignment().

import { LEVEL_UP_AT, LEVEL_DOWN_AT } from '@/lib/constants';
import { SKILL_NAMES } from '@/lib/weakness';

const REASON = {
  raise: `${LEVEL_UP_AT} or more raises the level`,
  lower: `${LEVEL_DOWN_AT} or less lowers it`,
  hold: `between ${LEVEL_DOWN_AT} and ${LEVEL_UP_AT} holds it`,
};

export function SystemRecommends({ next }) {
  if (next.recommended === null) {
    return <span className="text-ink/70">Nothing yet. It needs two completed sessions to go on.</span>;
  }
  return (
    <>
      <span className="font-semibold">Level {next.recommended}</span>
      <span className="block text-sm text-ink/70">
        The last {next.basedOn} completed sessions averaged {Math.round(next.average)};{' '}
        {REASON[next.direction]}.
      </span>
    </>
  );
}

export function NextSession({ next }) {
  const held = next.recommended !== null && next.recommended < next.baseLevel;
  return (
    <>
      <span className="font-semibold">
        Level {next.level}, {next.lighting}
      </span>
      <span className="block text-sm text-ink/70">
        {next.setBy === 'adaptive' && 'Above the base level, on the system’s recommendation.'}
        {next.setBy === 'instructor' && held && 'Held at the base level; the system would have gone lower.'}
        {next.setBy === 'instructor' && !held && 'At the base level.'}
      </span>
      <span className="mt-1 block text-sm text-ink/70">
        {next.focus
          ? `Shaped to practise ${SKILL_NAMES[next.focus].toLowerCase()}, the weak link.`
          : 'No practice focus: no skill is weak enough to target.'}
      </span>
    </>
  );
}
