// The simulator asks this before each session: which level, lighting and
// practice focus to run for the trainee who was picked.

import { connectDB } from '@/lib/db';
import { demoTrainee, findTrainee, nextAssignment } from '@/lib/assignment';

export async function GET(request) {
  const traineeId = new URL(request.url).searchParams.get('traineeId');

  try {
    await connectDB();
    // With no trainee named, fall back to the shared demo trainee.
    const trainee = traineeId ? await findTrainee(traineeId) : await demoTrainee();
    if (!trainee) return Response.json({ error: 'No such trainee' }, { status: 404 });
    return Response.json({ traineeId: trainee._id, ...(await nextAssignment(trainee)) });
  } catch (err) {
    console.error('GET /api/sessions/next failed', err);
    return Response.json({ error: 'Could not load the next assignment' }, { status: 500 });
  }
}
