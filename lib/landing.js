// Live figures for the landing page, read from the same sessions the
// dashboard uses. Server-only. Never throws: the page must still render when
// the database is unreachable.

import { connectDB } from './db';
import { Session } from './models';
import { buildScenario, scenarioMatchesEvents } from './scenario';

const SAMPLE_SIZE = 6;
const SEED_ROWS = 3;

// The seed table shows generated sessions only: a seed drawn by the simulator
// (a UUID, not one typed in for a test) whose layout still regenerates
// exactly what was recorded. Scripted sessions have no seed to show.
const DRAWN_SEED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function showsRandomisation(session) {
  return session.scenario?.mode !== 'scripted'
    && DRAWN_SEED.test(session.scenarioSeed)
    && scenarioMatchesEvents(session.scenarioSeed, session.difficulty.level, session.events, session.difficulty.focus ?? null);
}

// Newest events first, but make sure each verdict that exists in the recent
// record is represented before filling the rest by recency.
function pickSample(events) {
  const chosen = new Set();
  for (const verdict of new Set(events.map((e) => e.verdict))) {
    chosen.add(events.find((e) => e.verdict === verdict));
  }
  for (const event of events) {
    if (chosen.size >= SAMPLE_SIZE) break;
    chosen.add(event);
  }
  return events.filter((e) => chosen.has(e)).slice(0, SAMPLE_SIZE);
}

// What a stored seed regenerates: how many contacts, when the swarm arrives
// and where the first contact appears.
function layoutFromSeed({ scenarioSeed: seed, difficulty }) {
  const { drones } = buildScenario(seed, difficulty.level, difficulty.focus ?? null);
  const wave = drones.filter((d) => d.wave !== null);
  const [x, , z] = drones[0].start;
  return {
    seed,
    level: difficulty.level,
    contacts: drones.length,
    swarmSize: wave.length,
    swarmAtMs: Math.min(...wave.map((d) => d.spawnTime)),
    firstBearingDeg: Math.round(Math.atan2(x, -z) * 180 / Math.PI),
    firstAtMs: drones[0].spawnTime,
  };
}

export async function getLandingData() {
  try {
    await connectDB();

    const [totals, recent] = await Promise.all([
      Session.aggregate([
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            avgComposite: { $avg: { $cond: ['$completed', '$scores.composite', null] } },
            falsePositives: { $sum: '$scores.falsePositives' },
          },
        },
      ]),
      Session.find().sort({ createdAt: -1 }).limit(80).select('scenarioSeed scenario.mode difficulty.level difficulty.focus events').lean(),
    ]);

    const seen = new Set();
    const latest = recent
      .filter(showsRandomisation)
      .filter((s) => !seen.has(s.scenarioSeed) && seen.add(s.scenarioSeed))
      .slice(0, SEED_ROWS);

    return {
      ok: true,
      readAt: new Date(),
      stats: totals[0] ?? { sessions: 0, avgComposite: null, falsePositives: 0 },
      sample: pickSample(recent.flatMap((s) => s.events)),
      layouts: latest.map(layoutFromSeed),
    };
  } catch (err) {
    console.error('Landing page could not read live figures', err);
    return { ok: false };
  }
}
