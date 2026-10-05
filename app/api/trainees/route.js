// The trainee picker's list: every trainee, by unit then name.

import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';

export async function GET() {
  try {
    await connectDB();
    const trainees = await User.find({ role: 'trainee' }).sort({ unit: 1, name: 1 }).select('name rank unit').lean();
    return Response.json(
      trainees.map((t) => ({ id: String(t._id), name: t.name, rank: t.rank ?? '', unit: t.unit })),
    );
  } catch (err) {
    console.error('GET /api/trainees failed', err);
    return Response.json({ error: 'Could not load the trainees' }, { status: 500 });
  }
}
