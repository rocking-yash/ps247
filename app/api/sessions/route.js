import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { demoTrainee, findTrainee } from '@/lib/assignment';
import { Session, judgeEvent, scoreSession } from '@/lib/models';
import { skillProfile, weaknessSentence } from '@/lib/weakness';

function badRequest(error) {
  return Response.json({ error }, { status: 400 });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const { scenarioSeed, events } = body ?? {};
  if (typeof scenarioSeed !== 'string' || !scenarioSeed) {
    return badRequest('scenarioSeed is required');
  }
  if (!Array.isArray(events) || events.length === 0) {
    return badRequest('events must be a non-empty array');
  }

  try {
    const judged = events.map(judgeEvent);
    // Detection is scored against the limits for the condition that was assigned.
    const lighting = body.conditions?.lighting === 'night' ? 'night' : 'day';

    // A replay is validated, judged and scored like any session, then handed
    // straight back. Nothing is written, so the original record and every
    // average stay as they were.
    if (body.replay) {
      const draft = new Session({
        traineeId: new mongoose.Types.ObjectId(),
        difficulty: { level: body.difficulty?.level ?? 1 },
        conditions: body.conditions,
        scenarioSeed,
        events: judged,
      });
      await draft.validate();
      return Response.json({
        id: null,
        replay: true,
        scenarioSeed,
        events: judged,
        scores: scoreSession(judged, lighting),
        weakness: weaknessSentence(skillProfile(judged, lighting)),
      });
    }

    await connectDB();
    // Saved under the trainee who was picked; the shared demo trainee if none was.
    const trainee = body.traineeId ? await findTrainee(body.traineeId) : await demoTrainee();
    if (!trainee) return badRequest('No such trainee');
    const traineeId = trainee._id;

    const session = await Session.create({
      traineeId,
      startedAt: body.startedAt,
      endedAt: body.endedAt ?? new Date(),
      completed: body.completed ?? true,
      difficulty: {
        level: body.difficulty?.level ?? 1,
        setBy: body.difficulty?.setBy,
        focus: body.difficulty?.focus ?? null,
      },
      conditions: body.conditions,
      scenarioSeed,
      events: judged,
      scores: scoreSession(judged, lighting),
    });

    return Response.json({
      id: session._id,
      traineeId: session.traineeId,
      scenarioSeed: session.scenarioSeed,
      events: session.events,
      scores: session.scores,
      // Which skill let this session down, in one sentence.
      weakness: weaknessSentence(skillProfile(judged, lighting)),
    }, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return badRequest(err.message);
    }
    console.error('POST /api/sessions failed', err);
    return Response.json({ error: 'Could not save the session' }, { status: 500 });
  }
}
