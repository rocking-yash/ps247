// Assigns a scripted scenario as the next session of one trainee or of every
// trainee in a unit, or clears it.
//
//   PUT { scenarioId, traineeId }   one trainee
//   PUT { scenarioId, unit }        everyone in the unit
//   scenarioId: null                clears the assignment instead

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Scenario, User } from '@/lib/models';

function badRequest(error) {
  return Response.json({ error }, { status: 400 });
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const { scenarioId = null, traineeId, unit } = body ?? {};
  const who = { role: 'trainee' };
  if (traineeId !== undefined) {
    if (!mongoose.isValidObjectId(traineeId)) return badRequest('No such trainee');
    who._id = traineeId;
  } else if (typeof unit === 'string' && unit) {
    who.unit = unit;
  } else {
    return badRequest('Name a trainee or a unit');
  }
  if (scenarioId !== null && !mongoose.isValidObjectId(scenarioId)) return badRequest('No such scenario');

  try {
    await connectDB();
    if (scenarioId !== null && !(await Scenario.exists({ _id: scenarioId }))) {
      return badRequest('No such scenario');
    }
    const { matchedCount } = await User.updateMany(who, { assignedScenario: scenarioId });
    if (matchedCount === 0) return badRequest(traineeId !== undefined ? 'No such trainee' : 'No trainees in that unit');
    return Response.json({ scenarioId, trainees: matchedCount });
  } catch (err) {
    console.error('PUT /api/assignments failed', err);
    return Response.json({ error: 'Could not save the assignment' }, { status: 500 });
  }
}
