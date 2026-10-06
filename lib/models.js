// SIH26247 — AI-Enabled Drone & Counter-Drone Threat Simulation Trainer
// Data contract between the 3D simulator (writes) and the instructor dashboard (reads).
// Stack: Next.js + MongoDB Atlas + Mongoose

import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Reference data — keep these in sync with the simulator's drone models
// ---------------------------------------------------------------------------

// The enums live in lib/constants.js so the browser can import them without
// mongoose; re-exported here so this file stays the single contract.
import {
  DRONE_TYPES, RESPONSES, LIGHTING, TERRAIN, LEVEL_UP_AT, LEVEL_DOWN_AT, SCORING,
  DEFAULT_BASE_LEVEL, LIGHTING_CHOICES, SCENARIO_MODES, APPROACHES, SCRIPT_LIMITS,
  detectionLimits, detectionScore,
} from './constants';
export { DRONE_TYPES, RESPONSES, LIGHTING, TERRAIN };

// The decision tree the PS asks for. Scoring compares the trainee's choice
// against this table — it is deliberately plain data, not a model, so it can
// be shown on a slide and defended to a judge.
export const CORRECT_RESPONSE = {
  quad_recon: 'jam',              // surveillance — deny the link, do not destroy
  fixedwing_kamikaze: 'intercept', // armed and committed — kinetic
  decoy_civilian: 'report_only',   // not a threat — engaging it is the failure
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rank: { type: String, default: '' },  // shown before the name, e.g. "Capt"
  role: { type: String, enum: ['trainee', 'instructor'], required: true },
  unit: { type: String, default: 'Unassigned' },  // enables unit-level AAR
  // Trainees only: the difficulty the instructor assigned. Adaptive difficulty
  // moves up from here and never drops below it.
  baseLevel: { type: Number, min: 1, max: 5, default: DEFAULT_BASE_LEVEL },
  // Trainees only: the lighting the instructor picked for their sessions, or
  // 'alternate' to switch between day and night each session.
  lightingChoice: { type: String, enum: LIGHTING_CHOICES, default: 'alternate' },
  // Trainees only: the terrain the instructor picked for their sessions.
  terrainChoice: { type: String, enum: TERRAIN, default: 'rural' },
  // Trainees only: the scripted scenario their next session must run, if an
  // instructor has assigned one. Cleared when they complete it.
  assignedScenario: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', default: null },
  createdAt: { type: Date, default: Date.now },
});

// ---------------------------------------------------------------------------
// Scripted scenarios — a fixed sequence of contacts written by an instructor.
// Everyone assigned one faces the identical exercise. A scenario is never
// edited once saved, so a session recorded against it can always be replayed
// while it exists.
// ---------------------------------------------------------------------------

const ScriptedContactSchema = new mongoose.Schema({
  droneType: { type: String, enum: DRONE_TYPES, required: true },
  spawnTime: { type: Number, min: 0, max: SCRIPT_LIMITS.maxSpawnSeconds * 1000, required: true },  // ms from session start
  approach: { type: String, enum: APPROACHES, required: true },
}, { _id: false });

const ScenarioSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: SCRIPT_LIMITS.nameLength },
  // Sets how fast the contacts fly (the speed column of DIFFICULTY in
  // lib/scenario.js). How many there are and when is the script itself.
  level: { type: Number, min: 1, max: 5, required: true },
  lighting: { type: String, enum: LIGHTING, required: true },
  terrain: { type: String, enum: TERRAIN, default: 'rural' },
  contacts: {
    type: [ScriptedContactSchema],
    validate: (list) => list.length >= 1 && list.length <= SCRIPT_LIMITS.maxContacts,
  },
}, { timestamps: true });

// ---------------------------------------------------------------------------
// Events — one per drone that appeared in a session
// ---------------------------------------------------------------------------

const EventSchema = new mongoose.Schema({
  droneType: { type: String, enum: DRONE_TYPES, required: true },

  // All times are milliseconds from session start, not wall clock.
  // Makes replay and comparison across sessions trivial.
  spawnTime: { type: Number, required: true },
  // When the contact first came into the observer's sight. Later than
  // spawnTime only in urban terrain, where it can spawn behind a building.
  // null on sessions saved before this field existed: read it as spawnTime.
  visibleFrom: { type: Number, default: null },
  detectedAt: { type: Number, default: null },   // null = never spotted
  resolvedAt: { type: Number, default: null },

  classifiedAs: { type: String, enum: DRONE_TYPES, default: null },
  responseChosen: { type: String, enum: RESPONSES, default: null },

  // Derived at save time so the dashboard never recomputes
  detectionLatency: { type: Number, default: null },  // detectedAt - visibleFrom
  classifiedCorrectly: { type: Boolean, default: false },
  respondedCorrectly: { type: Boolean, default: false },

  // The single field the dashboard filters on
  verdict: {
    type: String,
    enum: [
      'correct',          // spotted, classified right, responded right
      'misclassified',    // spotted, wrong type
      'wrong_response',   // right type, wrong counter-measure
      'false_positive',   // engaged a decoy_civilian
      'missed',           // never detected before it reached the target
    ],
    required: true,
  },
}, { _id: false });

// ---------------------------------------------------------------------------
// Sessions — the unit the simulator writes and the dashboard reads
// ---------------------------------------------------------------------------

const SessionSchema = new mongoose.Schema({
  traineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  completed: { type: Boolean, default: false },  // false = quit midway, exclude from averages

  // Difficulty: instructor sets the base, system adapts (option C)
  difficulty: {
    level: { type: Number, min: 1, max: 5, required: true },
    setBy: { type: String, enum: ['instructor', 'adaptive'], default: 'instructor' },
    // The skill this scenario was shaped to practise, if any. Part of what
    // regenerates the scenario, alongside the seed and level.
    focus: { type: String, enum: ['detect', 'classify', 'respond', null], default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },

  conditions: {
    lighting: { type: String, enum: LIGHTING, default: 'day' },
    terrain: { type: String, enum: TERRAIN, default: 'rural' },
  },

  // The randomisation seed. Storing it lets you replay the exact scenario —
  // this is what makes the after-action review genuinely useful, and it is
  // also your answer to "prevent rote learning": same seed never repeats.
  scenarioSeed: { type: String, required: true },

  // Which kind of scenario this was. Scripted sessions name the scenario they
  // ran, and keep the name even if the scenario is later deleted. Sessions
  // saved before this field existed have none and are procedural.
  scenario: {
    mode: { type: String, enum: SCENARIO_MODES, default: 'procedural' },
    scriptedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', default: null },
    name: { type: String, default: null },
  },

  events: [EventSchema],

  // The three metrics the PS names, computed once when the session ends
  scores: {
    detectionAvgMs: { type: Number, default: null },     // lower is better
    classificationAccuracy: { type: Number, default: 0 }, // 0..1
    responseAccuracy: { type: Number, default: 0 },       // 0..1
    falsePositives: { type: Number, default: 0 },
    missed: { type: Number, default: 0 },
    composite: { type: Number, default: 0 },              // 0..100, headline number
  },
}, { timestamps: true });

SessionSchema.index({ traineeId: 1, startedAt: -1 });

// ---------------------------------------------------------------------------
// Judging — turns the raw event the simulator recorded into a stored event.
// Runs on the server so the derived fields and the verdict cannot be supplied
// by the client.
// ---------------------------------------------------------------------------

// raw.visibleFrom, when given, must come from the server's own rebuild of the
// scenario (see firstSight in lib/terrain.js), never from the client.
export function judgeEvent(raw) {
  const { droneType, spawnTime } = raw;
  const visibleFrom = raw.visibleFrom ?? spawnTime;
  const detectedAt = raw.detectedAt ?? null;
  const classifiedAs = raw.classifiedAs ?? null;
  const responseChosen = raw.responseChosen ?? null;

  const classifiedCorrectly = detectedAt !== null && classifiedAs === droneType;
  const respondedCorrectly =
    detectedAt !== null && responseChosen === CORRECT_RESPONSE[droneType];
  const engaged = responseChosen === 'jam' || responseChosen === 'intercept';

  let verdict = 'correct';
  if (detectedAt === null) verdict = 'missed';
  else if (droneType === 'decoy_civilian' && engaged) verdict = 'false_positive';
  else if (!classifiedCorrectly) verdict = 'misclassified';
  else if (!respondedCorrectly) verdict = 'wrong_response';

  return {
    droneType,
    spawnTime,
    visibleFrom,
    detectedAt,
    resolvedAt: raw.resolvedAt ?? null,
    classifiedAs,
    responseChosen,
    // The clock runs from first sight: time behind cover is not the trainee's.
    detectionLatency: detectedAt === null ? null : Math.max(0, detectedAt - visibleFrom),
    classifiedCorrectly,
    respondedCorrectly,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Scoring — call this when the session ends, before saving
// ---------------------------------------------------------------------------

// The whole calculation for one session, step by step. scoreSession stores
// its result; the session detail page prints every line of it, so the two
// cannot disagree.
//
// conditions: the session's conditions ({ lighting, terrain }), or just its
// lighting. Detection is scored against the limits for those conditions (see
// detectionLimits in lib/constants.js).
export function scoreBreakdown(events, conditions = 'day') {
  const detected = events.filter(e => e.detectedAt !== null);
  const flagged = detected.length;

  const detectionAvgMs = flagged
    ? Math.round(detected.reduce((s, e) => s + e.detectionLatency, 0) / flagged)
    : null;
  const classified = detected.filter(e => e.classifiedCorrectly).length;
  const responded = detected.filter(e => e.respondedCorrectly).length;
  const classificationAccuracy = flagged ? classified / flagged : 0;
  const responseAccuracy = flagged ? responded / flagged : 0;

  const falsePositives = events.filter(e => e.verdict === 'false_positive').length;
  const missed = events.filter(e => e.verdict === 'missed').length;

  // Weights: responding correctly matters most, then classifying, then speed.
  // A missed threat or a false positive is penalised on top.
  const { weights } = SCORING;
  const detectionShare = detectionScore(detectionAvgMs, conditions);
  const points = {
    detection: detectionShare * weights.detection,
    classification: classificationAccuracy * weights.classification,
    response: responseAccuracy * weights.response,
  };
  const penalties = {
    falsePositives: falsePositives * SCORING.falsePositivePenalty,
    missed: missed * SCORING.missedPenalty,
  };
  const raw = points.detection + points.classification + points.response
    - penalties.falsePositives - penalties.missed;

  return {
    contacts: events.length, flagged,
    detectionAvgMs, limits: detectionLimits(conditions), detectionShare,
    classified, classificationAccuracy,
    responded, responseAccuracy,
    falsePositives, missed,
    weights, points, penalties, raw,
    composite: Math.max(0, Math.round(raw)),
  };
}

export function scoreSession(events, conditions = 'day') {
  const b = scoreBreakdown(events, conditions);
  return {
    detectionAvgMs: b.detectionAvgMs,
    classificationAccuracy: +b.classificationAccuracy.toFixed(3),
    responseAccuracy: +b.responseAccuracy.toFixed(3),
    falsePositives: b.falsePositives,
    missed: b.missed,
    composite: b.composite,
  };
}

// ---------------------------------------------------------------------------
// Adaptive difficulty — the "AI-Enabled" part of the title, in plain rules
// ---------------------------------------------------------------------------

// recentSessions must be newest first. The instructor's base level is the
// floor: a struggling trainee is eased back towards it, never below it.
export function recommendDifficulty(recentSessions, instructorBase = DEFAULT_BASE_LEVEL) {
  const completed = recentSessions.filter(s => s.completed).slice(0, 3);
  if (completed.length < 2) return instructorBase;

  const avg = completed.reduce((s, x) => s + x.scores.composite, 0) / completed.length;
  const last = completed[0].difficulty.level;

  let next = last;
  if (avg >= LEVEL_UP_AT) next = Math.min(5, last + 1);  // comfortable — push them
  else if (avg <= LEVEL_DOWN_AT) next = last - 1;        // struggling — back off
  return Math.max(instructorBase, next);
}

// ---------------------------------------------------------------------------

// Redefined on every load, so a schema edit takes effect on hot reload
// instead of the dev server keeping the model it compiled first.
function defineModel(name, schema) {
  if (mongoose.models[name]) mongoose.deleteModel(name);
  return mongoose.model(name, schema);
}

export const User = defineModel('User', UserSchema);
export const Session = defineModel('Session', SessionSchema);
export const Scenario = defineModel('Scenario', ScenarioSchema);