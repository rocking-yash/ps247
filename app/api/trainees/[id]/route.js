// Instructor sets what a trainee's next sessions run under: the base
// difficulty level and the lighting.

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { LIGHTING_CHOICES } from '@/lib/constants';
import { User } from '@/lib/models';

function badRequest(error) {
  return Response.json({ error }, { status: 400 });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'No such trainee' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const update = {};
  if (body?.baseLevel !== undefined) {
    if (!Number.isInteger(body.baseLevel) || body.baseLevel < 1 || body.baseLevel > 5) {
      return badRequest('baseLevel must be a whole number from 1 to 5');
    }
    update.baseLevel = body.baseLevel;
  }
  if (body?.lightingChoice !== undefined) {
    if (!LIGHTING_CHOICES.includes(body.lightingChoice)) {
      return badRequest(`lightingChoice must be one of ${LIGHTING_CHOICES.join(', ')}`);
    }
    update.lightingChoice = body.lightingChoice;
  }
  if (Object.keys(update).length === 0) return badRequest('Nothing to change');

  try {
    await connectDB();
    const trainee = await User.findOneAndUpdate(
      { _id: id, role: 'trainee' },
      update,
      { returnDocument: 'after', runValidators: true },
    ).lean();
    if (!trainee) return Response.json({ error: 'No such trainee' }, { status: 404 });
    return Response.json({ id: trainee._id, baseLevel: trainee.baseLevel, lightingChoice: trainee.lightingChoice });
  } catch (err) {
    console.error('PATCH /api/trainees/[id] failed', err);
    return Response.json({ error: 'Could not save the settings' }, { status: 500 });
  }
}
