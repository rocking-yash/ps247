// What a trainee's next session should be: difficulty level and lighting.
// Server-only. Callers must have connected to the database.

import { DEFAULT_BASE_LEVEL } from './constants';
import { Session, User, recommendDifficulty } from './models';

// Stand-in until trainees are real accounts: every session without a
// traineeId is filed under one shared demo trainee.
export async function demoTrainee() {
  return User.findOneAndUpdate(
    { name: 'Demo Trainee', role: 'trainee' },
    { $setOnInsert: { unit: 'Demo' } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
}

export async function nextAssignment(trainee) {
  // Ordered by when the server saved them, not by the client's clock.
  const recent = await Session.find({ traineeId: trainee._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('completed scores.composite difficulty.level conditions.lighting')
    .lean();

  const baseLevel = trainee.baseLevel ?? DEFAULT_BASE_LEVEL;
  const completed = recent.filter((s) => s.completed);

  return {
    baseLevel,
    level: recommendDifficulty(recent, baseLevel),
    // Until there are two completed sessions the level is simply the
    // instructor's; after that it is the adaptive rule's.
    setBy: completed.length < 2 ? 'instructor' : 'adaptive',
    // Day and night alternate from one session to the next.
    lighting: recent[0]?.conditions?.lighting === 'day' ? 'night' : 'day',
  };
}
