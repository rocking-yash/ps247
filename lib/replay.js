// What the simulator needs to replay a recorded session. Server-only.

import mongoose from 'mongoose';
import { connectDB } from './db';
import { formatDateTime } from './format';
import { Session } from './models';
import { scenarioMatchesEvents } from './scenario';

// Null if there is no such session. `exact` is false when the stored seed no
// longer regenerates the contacts that were recorded (the session predates
// the current scenario generator), in which case it cannot be replayed.
export async function getReplaySource(sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) return null;
  await connectDB();

  const session = await Session.findById(sessionId)
    .select('traineeId scenarioSeed difficulty.level difficulty.focus conditions.lighting scores.composite startedAt events')
    .lean();
  if (!session) return null;

  const level = session.difficulty.level;
  const focus = session.difficulty.focus ?? null;
  return {
    sessionId: String(session._id),
    traineeId: String(session.traineeId),
    seed: session.scenarioSeed,
    level,
    focus,
    lighting: session.conditions.lighting,
    recordedAt: formatDateTime(session.startedAt),
    originalComposite: session.scores.composite,
    exact: scenarioMatchesEvents(session.scenarioSeed, level, session.events, focus),
  };
}
