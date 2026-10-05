// Unit-level aggregation for the after-action review: the same three skills
// the individual is graded on, read over every contact the unit's trainees
// faced. Pure functions — no database access here.

import { eventsWithLighting, skillProfile } from './weakness.js';

export const SKILL_LABELS = { detect: 'Detect', classify: 'Classify', respond: 'Respond' };

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// trainees: [{ id, unit }]   sessions: [{ traineeId, completed, scores, events, conditions }]
// Figures cover completed sessions only, like the individual ones. A unit
// with no completed sessions comes back with null averages. Skills and the
// weakest skill use the same reading as a trainee's (lib/weakness.js); the
// lowest of the three is always named here, even when all are strong.
export function summariseUnits(trainees, sessions) {
  const unitOf = new Map(trainees.map((t) => [t.id, t.unit]));
  const units = new Map();

  for (const trainee of trainees) {
    if (!units.has(trainee.unit)) units.set(trainee.unit, { unit: trainee.unit, trainees: 0, completed: [] });
    units.get(trainee.unit).trainees += 1;
  }
  for (const session of sessions) {
    const unit = units.get(unitOf.get(session.traineeId));
    if (unit && session.completed) unit.completed.push(session);
  }

  return [...units.values()]
    .sort((a, b) => a.unit.localeCompare(b.unit))
    .map(({ unit, trainees: traineeCount, completed }) => {
      if (completed.length === 0) {
        return {
          unit, trainees: traineeCount, sessions: 0,
          avgComposite: null, skills: null, weakest: null, falsePositives: 0, missed: 0,
        };
      }

      const profile = skillProfile(eventsWithLighting(completed));
      const skills = profile.scores;
      const weakest = skills && Object.keys(skills).reduce((low, skill) => (skills[skill] < skills[low] ? skill : low));

      return {
        unit,
        trainees: traineeCount,
        sessions: completed.length,
        avgComposite: mean(completed.map((s) => s.scores.composite)),
        skills,
        weakest,
        falsePositives: profile.falsePositives,
        missed: profile.missed,
      };
    });
}
