// What a trainee's next session should be: difficulty level, lighting and
// practice focus. Server-only. Callers must have connected to the database.
//
// Nothing here is stored on the trainee. It is worked out from their saved
// sessions each time it is asked for, so it cannot go stale when an
// instructor changes the base level or a session is removed.

import mongoose from 'mongoose';
import { DEFAULT_BASE_LEVEL, LEVEL_UP_AT, LEVEL_DOWN_AT } from './constants';
import { Session, User, recommendDifficulty } from './models';
import { SKILL_NAMES, eventsWithLighting, skillProfile, weaknessEvidence, weaknessSentence } from './weakness';

// Stand-in until trainees are real accounts: every session without a
// traineeId is filed under one shared demo trainee.
export async function demoTrainee() {
  return User.findOneAndUpdate(
    { name: 'Demo Trainee', role: 'trainee' },
    { $setOnInsert: { unit: 'Demo' } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
}

// The trainee with this id, or null. Identity only: no credential is checked.
export async function findTrainee(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return User.findOne({ _id: id, role: 'trainee' }).lean();
}

// What the next scenario does differently for each weak skill, in the
// trainee's terms. The mechanics are FOCUS in lib/scenario.js.
const FOCUS_CHANGE = {
  detect: 'Contacts will first appear further out',
  classify: 'It will carry more look-alike contacts and fewer obvious ones',
  respond: 'It will mix all three types evenly, so each response has to be chosen afresh',
};

// Why the level is what it is, as one sentence for the trainee.
function levelReason({ level, baseLevel, basis, average, direction, lastLevel }) {
  if (direction === null) {
    return `Next session runs at level ${level}, the base level your instructor set.`;
  }
  const scored = `your last ${basis} sessions averaged ${Math.round(average)}`;
  if (level > lastLevel) {
    return `Next session moves up to level ${level}: ${scored}, and ${LEVEL_UP_AT} or more raises the level.`;
  }
  if (level < lastLevel) {
    return direction === 'lower'
      ? `Next session moves down to level ${level}: ${scored}, and ${LEVEL_DOWN_AT} or less lowers the level.`
      : `Next session moves to level ${level}, the base level your instructor set.`;
  }
  if (direction === 'raise') return `Next session stays at level ${level}, the highest: ${scored}.`;
  if (direction === 'lower') {
    return `Next session stays at level ${level}: ${scored}, which would lower it, but level ${baseLevel} is the floor your instructor set.`;
  }
  return `Next session stays at level ${level}: ${scored}, between ${LEVEL_DOWN_AT} and ${LEVEL_UP_AT}.`;
}

// trainee: { _id, baseLevel, lightingChoice }
//
// Returns what will run next (`level`, `lighting`, `focus`, `setBy`) together
// with how it was arrived at, so the dashboard and the trainee can both see
// the instructor's setting and the adaptive rule's reasoning:
//   baseLevel       what the instructor set — the floor
//   recommended     what the adaptive rule alone would choose, or null until
//                   there are two completed sessions to go on
//   average         the mean composite it was based on (last three completed)
//   direction       'raise' | 'lower' | 'hold'
//   weakness        one sentence naming the weak skill over those sessions
//   focus           that skill, which shapes what the next scenario contains
//   levelReason, focusReason   sentences addressed to the trainee
export async function nextAssignment(trainee) {
  // Ordered by when the server saved them, not by the client's clock.
  const recent = await Session.find({ traineeId: trainee._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('completed scores.composite difficulty.level conditions.lighting events')
    .lean();

  const baseLevel = trainee.baseLevel ?? DEFAULT_BASE_LEVEL;
  const lightingChoice = trainee.lightingChoice ?? 'alternate';
  const basis = recent.filter((s) => s.completed).slice(0, 3);
  const enough = basis.length >= 2;

  const average = enough ? basis.reduce((sum, s) => sum + s.scores.composite, 0) / basis.length : null;
  // With a floor of 1 the rule is unconstrained: this is its own opinion.
  const recommended = enough ? recommendDifficulty(recent, 1) : null;
  const level = recommendDifficulty(recent, baseLevel);

  let direction = null;
  if (enough) direction = average >= LEVEL_UP_AT ? 'raise' : average <= LEVEL_DOWN_AT ? 'lower' : 'hold';

  // The weak skill over the same sessions the level is based on. It decides
  // what the next scenario practises, independently of how hard it is.
  const profile = skillProfile(eventsWithLighting(basis));
  const focus = profile.weakest;
  const scope = basis.length === 1 ? 'In the last session' : `Across the last ${basis.length} sessions`;

  return {
    baseLevel,
    lightingChoice,
    recommended,
    average,
    basedOn: basis.length,
    direction,
    level,
    // The session is the adaptive rule's doing only when it has lifted the
    // level above the instructor's floor.
    setBy: level > baseLevel ? 'adaptive' : 'instructor',
    // The instructor's pick if there is one; otherwise day and night alternate.
    lighting:
      lightingChoice !== 'alternate'
        ? lightingChoice
        : recent[0]?.conditions?.lighting === 'day' ? 'night' : 'day',
    focus,
    weakness: basis.length ? weaknessSentence(profile, scope) : null,
    levelReason: levelReason({
      level, baseLevel, basis: basis.length, average, direction, lastLevel: basis[0]?.difficulty.level,
    }),
    focusReason: focus
      ? `${FOCUS_CHANGE[focus]}, because ${SKILL_NAMES[focus].toLowerCase()} is the weak link: ${weaknessEvidence(profile)}.`
      : null,
  };
}
