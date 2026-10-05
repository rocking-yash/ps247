// Read side of the data contract: queries the instructor dashboard runs
// against the sessions the simulator saved. Server-only.

import mongoose from 'mongoose';
import { connectDB } from './db';
import { Session, User } from './models';
import { summariseUnits } from './units';

// Every trainee with their session count and average composite score.
// Sessions quit midway (completed: false) are counted but kept out of the
// average, as the schema intends.
export async function listTrainees() {
  await connectDB();

  const [users, stats] = await Promise.all([
    User.find({ role: 'trainee' }).sort({ unit: 1, name: 1 }).lean(),
    Session.aggregate([
      {
        $group: {
          _id: '$traineeId',
          sessionCount: { $sum: 1 },
          avgComposite: { $avg: { $cond: ['$completed', '$scores.composite', null] } },
          lastSessionAt: { $max: '$startedAt' },
        },
      },
    ]),
  ]);

  const byTrainee = new Map(stats.map((s) => [String(s._id), s]));

  return users.map((user) => {
    const s = byTrainee.get(String(user._id));
    return {
      id: String(user._id),
      name: user.name,
      unit: user.unit,
      sessionCount: s?.sessionCount ?? 0,
      avgComposite: s?.avgComposite ?? null,
      lastSessionAt: s?.lastSessionAt ?? null,
    };
  });
}

// Every unit with its combined record, for the unit-level review.
export async function listUnits() {
  await connectDB();

  const [users, sessions] = await Promise.all([
    User.find({ role: 'trainee' }).select('unit').lean(),
    Session.find().select('traineeId completed scores').lean(),
  ]);

  return summariseUnits(
    users.map((user) => ({ id: String(user._id), unit: user.unit })),
    sessions.map((session) => ({ ...session, traineeId: String(session.traineeId) })),
  );
}

// One trainee and all their sessions, oldest first. Null if there is no such
// trainee.
export async function getTraineeDetail(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();

  const trainee = await User.findOne({ _id: id, role: 'trainee' }).lean();
  if (!trainee) return null;

  const sessions = await Session.find({ traineeId: id }).sort({ startedAt: 1 }).lean();
  return { trainee, sessions };
}
