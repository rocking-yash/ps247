// What the simulator needs to replay a recorded session. Server-only.

import mongoose from 'mongoose';
import { connectDB } from './db';
import { formatDateTime } from './format';
import { Scenario, Session } from './models';
import { sessionReplayable } from './scenario';
import { toScript } from './scripted';

// Null if there is no such session. `exact` is false when the session can no
// longer be rebuilt as it was recorded: its seed predates the current
// scenario generator, or it was scripted and that script has been deleted.
// `script` is the scripted scenario to rerun, or null for a generated one.
export async function getReplaySource(sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) return null;
  await connectDB();

  const session = await Session.findById(sessionId)
    .select('traineeId scenarioSeed scenario difficulty.level difficulty.focus conditions scores.composite startedAt events')
    .lean();
  if (!session) return null;

  const level = session.difficulty.level;
  const focus = session.difficulty.focus ?? null;
  const scripted = session.scenario?.mode === 'scripted';
  const stored = scripted && session.scenario.scriptedId ? await Scenario.findById(session.scenario.scriptedId).lean() : null;
  const script = stored ? toScript(stored) : null;
  return {
    sessionId: String(session._id),
    traineeId: String(session.traineeId),
    seed: session.scenarioSeed,
    level,
    focus,
    lighting: session.conditions.lighting,
    terrain: session.conditions.terrain ?? 'rural',
    recordedAt: formatDateTime(session.startedAt),
    originalComposite: session.scores.composite,
    scripted,
    script,
    exact: sessionReplayable(session, script),
  };
}
