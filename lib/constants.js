// Reference data shared by the simulator, the dashboard and the schema.
// Kept free of mongoose so client components can import it without pulling
// the database driver into the browser bundle. lib/models.js re-exports the
// enums, so the contract still reads from one place.

export const DRONE_TYPES = ['quad_recon', 'fixedwing_kamikaze', 'decoy_civilian'];
export const RESPONSES = ['jam', 'intercept', 'report_only', 'no_action'];
export const LIGHTING = ['day', 'night'];
export const TERRAIN = ['urban', 'rural'];

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
export function detectionScore(detectionAvgMs) {
  if (detectionAvgMs === null || detectionAvgMs === undefined) return 0;
  const { detectFullMs, detectZeroMs } = SCORING;
  return Math.max(0, Math.min(1, (detectZeroMs - detectionAvgMs) / (detectZeroMs - detectFullMs)));
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
