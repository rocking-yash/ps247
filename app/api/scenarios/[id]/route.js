// Removes a scripted scenario. Anyone still assigned it goes back to a
// generated session. Sessions already recorded against it keep its name.

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Scenario, User } from '@/lib/models';

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'No such scenario' }, { status: 404 });
  }

  try {
    await connectDB();
    const scenario = await Scenario.findByIdAndDelete(id).lean();
    if (!scenario) return Response.json({ error: 'No such scenario' }, { status: 404 });
    const { modifiedCount } = await User.updateMany({ assignedScenario: id }, { assignedScenario: null });
    return Response.json({ id, unassigned: modifiedCount });
  } catch (err) {
    console.error('DELETE /api/scenarios/[id] failed', err);
    return Response.json({ error: 'Could not delete the scenario' }, { status: 500 });
  }
}
