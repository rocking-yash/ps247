// Instructor sets a trainee's base difficulty level.

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';

export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'No such trainee' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const baseLevel = body?.baseLevel;
  if (!Number.isInteger(baseLevel) || baseLevel < 1 || baseLevel > 5) {
    return Response.json({ error: 'baseLevel must be a whole number from 1 to 5' }, { status: 400 });
  }

  try {
    await connectDB();
    const trainee = await User.findOneAndUpdate(
      { _id: id, role: 'trainee' },
      { baseLevel },
      { returnDocument: 'after', runValidators: true },
    ).lean();
    if (!trainee) return Response.json({ error: 'No such trainee' }, { status: 404 });
    return Response.json({ id: trainee._id, baseLevel: trainee.baseLevel });
  } catch (err) {
    console.error('PATCH /api/trainees/[id] failed', err);
    return Response.json({ error: 'Could not save the base level' }, { status: 500 });
  }
}
