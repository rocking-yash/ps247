// Which of the three graded skills is the weak link, worked out from stored
// events and said in plain words. Pure functions — no database access — so
// the same reading is used for one session, a trainee's recent record, a
// unit, and for deciding what the next scenario should practise.

import { conditionsOf, detectionScore } from './constants.js';

export const SKILLS = ['detect', 'classify', 'respond'];
export const SKILL_NAMES = { detect: 'Detection', classify: 'Classification', respond: 'Response' };

// A skill scoring this or better (out of 100) is not called a weakness.
export const STRONG_AT = 90;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

// Events from several sessions, each tagged with the conditions it was flown
// in (lighting and terrain), so a mixed record is scored fairly.
export function eventsWithConditions(sessions) {
  return sessions.flatMap((s) => s.events.map((e) => ({ ...e, conditions: conditionsOf(s.conditions) })));
}

// events: stored session events (see EventSchema). Returns the counts the
// sentences are built from, each skill out of 100, and the weakest skill —
// or null for `weakest` when there is nothing to judge or nothing weak.
//
//   detect    share of contacts flagged at all, scaled by how fast
//   classify  share of flagged contacts identified correctly
//   respond   share of flagged contacts given the correct response
//
// Speed is judged against the limits for the conditions each contact was
// flown in: an event's own `conditions` if it has them, otherwise the ones
// passed in ({ lighting, terrain }, or just the lighting).
export function skillProfile(events, conditions = 'day') {
  const contacts = events.length;
  const flagged = events.filter((e) => e.detectedAt !== null && e.detectedAt !== undefined);
  const detected = flagged.length;
  const missed = contacts - detected;
  const avgDetectMs = detected
    ? flagged.reduce((sum, e) => sum + e.detectionLatency, 0) / detected
    : null;
  const misclassified = flagged.filter((e) => !e.classifiedCorrectly).length;
  const wrongResponse = flagged.filter((e) => !e.respondedCorrectly).length;
  const falsePositives = events.filter((e) => e.verdict === 'false_positive').length;

  const counts = { contacts, detected, missed, avgDetectMs, misclassified, wrongResponse, falsePositives };
  if (contacts === 0) return { ...counts, scores: null, weakest: null };

  const scores = {
    detect: detected
      ? (detected / contacts) * (flagged.reduce((sum, e) => sum + detectionScore(e.detectionLatency, e.conditions ?? conditions), 0) / detected) * 100
      : 0,
    // Nothing flagged means nothing was classified or answered either.
    classify: detected ? (1 - misclassified / detected) * 100 : 0,
    respond: detected ? (1 - wrongResponse / detected) * 100 : 0,
  };
  const lowest = SKILLS.reduce((low, skill) => (scores[skill] < scores[low] ? skill : low));

  return { ...counts, scores, weakest: scores[lowest] >= STRONG_AT ? null : lowest };
}

// The evidence for the weak skill, as a clause: "2 of 5 flagged contacts were
// misidentified". Built only from the counts in the profile.
export function weaknessEvidence(profile) {
  const { contacts, detected, missed, avgDetectMs, misclassified, wrongResponse, falsePositives } = profile;

  if (profile.weakest === 'detect') {
    if (missed === 0) return `contacts took ${seconds(avgDetectMs)} on average to flag`;
    const rest = detected ? `, and the rest took ${seconds(avgDetectMs)} on average` : '';
    return `${missed} of ${plural(contacts, 'contact')} ${missed === 1 ? 'was' : 'were'} never flagged${rest}`;
  }
  if (profile.weakest === 'classify') {
    return `${misclassified} of ${plural(detected, 'flagged contact')} ${misclassified === 1 ? 'was' : 'were'} misidentified`;
  }
  if (profile.weakest === 'respond') {
    const engaged = falsePositives ? `, including ${plural(falsePositives, 'civilian')} engaged` : '';
    return `${wrongResponse} of ${plural(detected, 'flagged contact')} got the wrong counter-measure${engaged}`;
  }
  return null;
}

// One sentence. `scope` is how the sentence opens when it is about more than
// one session, e.g. "Across the last 3 sessions".
export function weaknessSentence(profile, scope = null) {
  if (profile.contacts === 0) return null;
  const open = (text) => (scope ? `${scope}, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text);

  if (profile.weakest === null) {
    return open(`No weak link: ${plural(profile.contacts, 'contact')}, each of the three skills at ${STRONG_AT} or better out of 100.`);
  }
  return open(`${SKILL_NAMES[profile.weakest]} is the weak link: ${weaknessEvidence(profile)}.`);
}
