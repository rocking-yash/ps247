// Read side of the data contract: queries the instructor dashboard runs
// against the sessions the simulator saved. Server-only.

import mongoose from 'mongoose';
import { connectDB } from './db';
import { Scenario, Session, User } from './models';
import { toScript } from './scripted';
import { summariseUnits } from './units';
import { skillProfile } from './weakness';
import { fullName } from './format';

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
      rank: user.rank ?? '',
      unit: user.unit,
      baseLevel: user.baseLevel,
      lightingChoice: user.lightingChoice,
      terrainChoice: user.terrainChoice ?? 'rural',
      assignedScenario: user.assignedScenario ? String(user.assignedScenario) : null,
      sessionCount: s?.sessionCount ?? 0,
      avgComposite: s?.avgComposite ?? null,
      lastSessionAt: s?.lastSessionAt ?? null,
    };
  });
}

// Every scripted scenario, oldest first, as plain scripts.
export async function listScripts() {
  await connectDB();
  return (await Scenario.find().sort({ createdAt: 1 }).lean()).map(toScript);
}

// Every unit with its combined record, for the unit-level review.
export async function listUnits() {
  await connectDB();

  const [users, sessions] = await Promise.all([
    User.find({ role: 'trainee' }).select('unit').lean(),
    Session.find().select('traineeId completed scores events conditions').lean(),
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

// Every session of every trainee, newest first, one row each, with the three
// skills as 0–100 figures (the same reading as the unit table).
export async function listSessions() {
  await connectDB();

  const [users, sessions] = await Promise.all([
    User.find({ role: 'trainee' }).select('name rank unit').lean(),
    Session.find().sort({ startedAt: -1 }).select('traineeId startedAt completed difficulty conditions scenario scores events').lean(),
  ]);
  const people = new Map(users.map((u) => [String(u._id), u]));

  return sessions.map((session) => {
    const who = people.get(String(session.traineeId));
    const lighting = session.conditions?.lighting ?? 'day';
    const terrain = session.conditions?.terrain ?? 'rural';
    const skills = skillProfile(session.events, { lighting, terrain }).scores;
    return {
      id: String(session._id),
      startedAt: session.startedAt,
      traineeId: String(session.traineeId),
      trainee: who ? fullName(who) : 'Unknown trainee',
      unit: who?.unit ?? '—',
      lighting,
      terrain,
      level: session.difficulty.level,
      mode: session.scenario?.mode ?? 'procedural',
      scenarioName: session.scenario?.name ?? null,
      completed: session.completed,
      detect: skills ? Math.round(skills.detect) : null,
      classify: skills ? Math.round(skills.classify) : null,
      respond: skills ? Math.round(skills.respond) : null,
      composite: session.scores.composite,
      falsePositives: session.scores.falsePositives,
      missed: session.scores.missed,
    };
  });
}

// One session with the trainee it belongs to, and the script it ran if it
// was scripted and that script still exists. Null if there is no such session.
export async function getSessionDetail(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();

  const session = await Session.findById(id).lean();
  if (!session) return null;
  const trainee = await User.findById(session.traineeId).select('name rank unit').lean();
  const stored = session.scenario?.scriptedId ? await Scenario.findById(session.scenario.scriptedId).lean() : null;
  return { session, trainee, script: stored ? toScript(stored) : null };
}
