// Unit-level aggregation for the after-action review: the same three skills
// the individual is graded on, averaged over everyone in the unit. Pure
// functions — no database access here.

import { detectionScore } from './constants.js';

export const SKILL_LABELS = { detect: 'Detect', classify: 'Classify', respond: 'Respond' };

// Each skill as a 0–100 figure for one session, so the three are comparable.
function skillScores(scores) {
  return {
    detect: detectionScore(scores.detectionAvgMs) * 100,
    classify: scores.classificationAccuracy * 100,
    respond: scores.responseAccuracy * 100,
  };
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// trainees: [{ id, unit }]   sessions: [{ traineeId, completed, scores }]
// Averages cover completed sessions only, like the individual figures. A unit
// with no completed sessions comes back with null averages.
export function summariseUnits(trainees, sessions) {
  const unitOf = new Map(trainees.map((t) => [t.id, t.unit]));
  const units = new Map();

  for (const trainee of trainees) {
    if (!units.has(trainee.unit)) units.set(trainee.unit, { unit: trainee.unit, trainees: 0, completed: [] });
    units.get(trainee.unit).trainees += 1;
  }
  for (const session of sessions) {
    const unit = units.get(unitOf.get(session.traineeId));
    if (unit && session.completed) unit.completed.push(session.scores);
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

      const perSession = completed.map(skillScores);
      const skills = {
        detect: mean(perSession.map((s) => s.detect)),
        classify: mean(perSession.map((s) => s.classify)),
        respond: mean(perSession.map((s) => s.respond)),
      };
      const weakest = Object.keys(skills).reduce((low, skill) => (skills[skill] < skills[low] ? skill : low));

      return {
        unit,
        trainees: traineeCount,
        sessions: completed.length,
        avgComposite: mean(completed.map((s) => s.composite)),
        skills,
        weakest,
        falsePositives: completed.reduce((sum, s) => sum + s.falsePositives, 0),
        missed: completed.reduce((sum, s) => sum + s.missed, 0),
      };
    });
}
