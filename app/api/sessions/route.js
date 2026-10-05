import { connectDB } from '@/lib/db';
import { demoTrainee } from '@/lib/assignment';
import { Session, judgeEvent, scoreSession } from '@/lib/models';

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
    await connectDB();

    const traineeId = body.traineeId ?? (await demoTrainee())._id;
    const judged = events.map(judgeEvent);

    const session = await Session.create({
      traineeId,
      startedAt: body.startedAt,
      endedAt: body.endedAt ?? new Date(),
      completed: body.completed ?? true,
      difficulty: { level: body.difficulty?.level ?? 1, setBy: body.difficulty?.setBy },
      conditions: body.conditions,
      scenarioSeed,
      events: judged,
      scores: scoreSession(judged),
    });

    return Response.json({
      id: session._id,
      traineeId: session.traineeId,
      scenarioSeed: session.scenarioSeed,
      events: session.events,
      scores: session.scores,
    }, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return badRequest(err.message);
    }
    console.error('POST /api/sessions failed', err);
    return Response.json({ error: 'Could not save the session' }, { status: 500 });
  }
}
