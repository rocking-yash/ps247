// The simulator asks this before each session: which level and lighting to run.

import { connectDB } from '@/lib/db';
import { demoTrainee, nextAssignment } from '@/lib/assignment';

export async function GET() {
  try {
    await connectDB();
    const trainee = await demoTrainee();
    return Response.json({ traineeId: trainee._id, ...(await nextAssignment(trainee)) });
  } catch (err) {
    console.error('GET /api/sessions/next failed', err);
    return Response.json({ error: 'Could not load the next assignment' }, { status: 500 });
  }
}
