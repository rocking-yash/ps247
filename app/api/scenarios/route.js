// Scripted scenarios: an instructor writes a fixed sequence of contacts.

import { connectDB } from '@/lib/db';
import { Scenario } from '@/lib/models';
import { checkScript, toScript } from '@/lib/scripted';

function badRequest(error) {
  return Response.json({ error }, { status: 400 });
}

export async function GET() {
  try {
    await connectDB();
    const scenarios = await Scenario.find().sort({ createdAt: 1 }).lean();
    return Response.json(scenarios.map(toScript));
  } catch (err) {
    console.error('GET /api/scenarios failed', err);
    return Response.json({ error: 'Could not load the scenarios' }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const { value, error } = checkScript(body);
  if (error) return badRequest(error);

  try {
    await connectDB();
    if (await Scenario.exists({ name: value.name })) {
      return badRequest('There is already a scenario with that name.');
    }
    const scenario = await Scenario.create(value);
    return Response.json(toScript(scenario), { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError') return badRequest(err.message);
    console.error('POST /api/scenarios failed', err);
    return Response.json({ error: 'Could not save the scenario' }, { status: 500 });
  }
}
