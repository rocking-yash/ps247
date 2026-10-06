// Reference data shared by the simulator, the dashboard and the schema.
// Kept free of mongoose so client components can import it without pulling
// the database driver into the browser bundle. lib/models.js re-exports the
// enums, so the contract still reads from one place.

export const DRONE_TYPES = ['quad_recon', 'fixedwing_kamikaze', 'decoy_civilian'];
export const RESPONSES = ['jam', 'intercept', 'report_only', 'no_action'];
export const LIGHTING = ['day', 'night'];
export const TERRAIN = ['urban', 'rural'];

// How a session's contacts were decided: generated from a seed, or written
// out by an instructor so that everyone assigned it faces the same exercise.
export const SCENARIO_MODES = ['procedural', 'scripted'];
export const MODE_LABELS = { procedural: 'Procedural', scripted: 'Scripted' };

// Where a scripted contact comes from, as the observer sees it.
export const APPROACHES = ['left', 'ahead', 'right'];
export const APPROACH_LABELS = { left: 'From the left', ahead: 'From ahead', right: 'From the right' };

// What an instructor may write into one scripted scenario.
export const SCRIPT_LIMITS = { nameLength: 60, maxContacts: 12, maxSpawnSeconds: 180 };

export const TERRAIN_LABELS = { rural: 'Open airfield', urban: 'Urban' };

// Conditions as { lighting, terrain }. A bare lighting string is accepted
// too and means open terrain.
export function conditionsOf(conditions) {
  if (typeof conditions === 'string') return { lighting: conditions, terrain: 'rural' };
  return { lighting: conditions?.lighting ?? 'day', terrain: conditions?.terrain ?? 'rural' };
}

// "day", "night, urban": the open airfield is the unmarked case.
export function describeConditions(conditions) {
  const { lighting, terrain } = conditionsOf(conditions);
  return terrain === 'urban' ? `${lighting}, urban` : lighting;
}

export const DRONE_LABELS = {
  quad_recon: 'Quadcopter — reconnaissance',
  fixedwing_kamikaze: 'Fixed-wing — loitering munition',
  decoy_civilian: 'Civilian / decoy',
};

export const RESPONSE_LABELS = {
  jam: 'Jam (RF)',
  intercept: 'Intercept (kinetic)',
  report_only: 'Report only',
  no_action: 'No action',
};

export const VERDICT_LABELS = {
  correct: 'Correct',
  misclassified: 'Misclassified',
  wrong_response: 'Wrong response',
  false_positive: 'False positive',
  missed: 'Missed',
};

// Detection as a 0..1 score from an average detection time: full marks at
// detectFullMs or faster, zero at detectZeroMs or slower, zero if nothing was
// detected at all.
// At night, and in urban terrain, the limits are looser, because the contact
// is harder to see: the instructor assigns the conditions, so they must not
// cost the trainee marks.
// conditions: { lighting, terrain }, or just the lighting.
export function detectionScore(detectionAvgMs, conditions = 'day') {
  if (detectionAvgMs === null || detectionAvgMs === undefined) return 0;
  const { fullMs, zeroMs } = detectionLimits(conditions);
  return Math.max(0, Math.min(1, (zeroMs - detectionAvgMs) / (zeroMs - fullMs)));
}

// The detection time that earns full marks, and the one that earns none.
// Urban terrain adds its allowance on top of the day or night limits.
export function detectionLimits(conditions = 'day') {
  const { lighting, terrain } = conditionsOf(conditions);
  const base = lighting === 'night'
    ? { fullMs: SCORING.nightDetectFullMs, zeroMs: SCORING.nightDetectZeroMs }
    : { fullMs: SCORING.detectFullMs, zeroMs: SCORING.detectZeroMs };
  if (terrain !== 'urban') return base;
  return { fullMs: base.fullMs + SCORING.urbanDetectExtraFullMs, zeroMs: base.zeroMs + SCORING.urbanDetectExtraZeroMs };
}

// Adaptive difficulty thresholds on the average composite of the last three
// completed sessions. Used by recommendDifficulty and drawn on the dashboard.
export const LEVEL_UP_AT = 80;
export const LEVEL_DOWN_AT = 45;

// Composite score (0–100). First-pass values — recalibrate after playtesting.
// scoreSession applies these and the landing page prints them, so the
// published rules cannot drift from the ones in force.
export const SCORING = {
  detectFullMs: 2000,   // average detection this fast or faster earns the full detection weight
  detectZeroMs: 10000,  // this slow or slower earns none
  nightDetectFullMs: 3000,   // the same two limits for a night session
  nightDetectZeroMs: 13000,
  // Urban terrain: added to both limits. In urban terrain the clock also
  // starts when the contact first comes into sight, not when it spawns (see
  // firstSight in lib/terrain.js), so time spent behind a building is never
  // counted. This allowance is for what remains: a contact that emerges close
  // and without warning, against a cluttered skyline.
  urbanDetectExtraFullMs: 1000,
  urbanDetectExtraZeroMs: 2000,
  weights: { detection: 25, classification: 35, response: 40 },
  falsePositivePenalty: 10,
  missedPenalty: 15,
};

// Difficulty level a trainee starts from, and never drops below, until an
// instructor sets their own.
export const DEFAULT_BASE_LEVEL = 2;

// What an instructor can pick for a trainee's lighting: a fixed condition, or
// let day and night alternate from one session to the next.
export const LIGHTING_CHOICES = ['alternate', ...LIGHTING];
