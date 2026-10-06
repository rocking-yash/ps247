import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { demoTrainee, findTrainee } from '@/lib/assignment';
import { Scenario, Session, User, judgeEvent, scoreSession } from '@/lib/models';
import {
  buildScenario, buildScriptedScenario, contactState, scenarioMatchesEvents, scriptMatchesEvents,
} from '@/lib/scenario';
import { firstSight } from '@/lib/terrain';
import { toScript } from '@/lib/scripted';
import { skillProfile, weaknessSentence } from '@/lib/weakness';

function badRequest(error) {
  return Response.json({ error }, { status: 400 });
}

// The events with `visibleFrom` filled in: when each contact first came into
// sight on this terrain. Worked out here from the scenario itself, so it does
// not depend on anything the client reports. If the scenario cannot be
// rebuilt to match the events, the contacts count as in sight from spawn.
function withFirstSight(events, { script, scenarioSeed, level, focus, terrain }) {
  // Whatever the client sent for visibleFrom is dropped here.
  const fromSpawn = events.map((event) => ({ ...event, visibleFrom: event.spawnTime }));
  if (terrain !== 'urban') return fromSpawn;
  let drones = null;
  if (script) drones = buildScriptedScenario(toScript(script)).drones;
  else if (scenarioMatchesEvents(scenarioSeed, level, events, focus)) drones = buildScenario(scenarioSeed, level, focus).drones;
  if (!drones) return fromSpawn;
  return fromSpawn.map((event, i) => ({
    ...event,
    // never in sight at all: leave the clock at spawn (it can only be a miss)
    visibleFrom: firstSight(drones[i], (ms) => contactState(drones[i], ms).position, terrain) ?? event.spawnTime,
  }));
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

    // A scripted session must be the script, contact for contact. Its level,
    // lighting and terrain are taken from the script, not from the client.
    let script = null;
    if (body.scenarioId) {
      script = mongoose.isValidObjectId(body.scenarioId) ? await Scenario.findById(body.scenarioId).lean() : null;
      if (!script) return badRequest('No such scripted scenario');
      if (!scriptMatchesEvents(script, events)) {
        return badRequest('The events do not match the scripted scenario');
      }
    }

    // Detection is scored against the limits for the conditions that were assigned.
    const conditions = {
      lighting: script ? script.lighting : body.conditions?.lighting === 'night' ? 'night' : 'day',
      terrain: script ? script.terrain ?? 'rural' : body.conditions?.terrain === 'urban' ? 'urban' : 'rural',
    };
    const judged = withFirstSight(events, {
      script,
      scenarioSeed,
      level: body.difficulty?.level ?? 1,
      focus: body.difficulty?.focus ?? null,
      terrain: conditions.terrain,
    }).map(judgeEvent);

    // A replay is validated, judged and scored like any session, then handed
    // straight back. Nothing is written, so the original record and every
    // average stay as they were.
    if (body.replay) {
      const draft = new Session({
        traineeId: new mongoose.Types.ObjectId(),
        difficulty: { level: body.difficulty?.level ?? 1 },
        conditions,
        scenarioSeed,
        events: judged,
      });
      await draft.validate();
      return Response.json({
        id: null,
        replay: true,
        scenarioSeed,
        events: judged,
        scores: scoreSession(judged, conditions),
        weakness: weaknessSentence(skillProfile(judged, conditions)),
      });
    }

    // Saved under the trainee who was picked; the shared demo trainee if none was.
    const trainee = body.traineeId ? await findTrainee(body.traineeId) : await demoTrainee();
    if (!trainee) return badRequest('No such trainee');
    const traineeId = trainee._id;


    const session = await Session.create({
      traineeId,
      startedAt: body.startedAt,
      endedAt: body.endedAt ?? new Date(),
      completed: body.completed ?? true,
      difficulty: script
        ? { level: script.level, setBy: 'instructor', focus: null }
        : {
            level: body.difficulty?.level ?? 1,
            setBy: body.difficulty?.setBy,
            focus: body.difficulty?.focus ?? null,
          },
      conditions,
      scenarioSeed,
      scenario: script
        ? { mode: 'scripted', scriptedId: script._id, name: script.name }
        : { mode: 'procedural' },
      events: judged,
      scores: scoreSession(judged, conditions),
    });
    // The assignment is for one session: completing it clears it.
    if (script && session.completed) {
      await User.updateOne({ _id: traineeId, assignedScenario: script._id }, { assignedScenario: null });
    }

    return Response.json({
      id: session._id,
      traineeId: session.traineeId,
      scenarioSeed: session.scenarioSeed,
      events: session.events,
      scores: session.scores,
      scenario: session.scenario,
      // Which skill let this session down, in one sentence.
      weakness: weaknessSentence(skillProfile(judged, conditions)),
    }, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return badRequest(err.message);
    }
    console.error('POST /api/sessions failed', err);
    return Response.json({ error: 'Could not save the session' }, { status: 500 });
  }
}
