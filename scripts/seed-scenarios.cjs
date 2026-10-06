// Seeds three example scripted scenarios for the demo. Safe to run again —
// each is matched on its name and only created if missing, so nothing is
// duplicated and an existing scenario is never changed.
//
//   npm run seed      (after seed-trainees.cjs)
//
// Reads MONGODB_URI from .env.local. Fields match ScenarioSchema in
// lib/models.js; spawn times are milliseconds from session start.

const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const at = (seconds, droneType, approach) => ({ droneType, spawnTime: seconds * 1000, approach });

const SCENARIOS = [
  // The simplest assessment: one contact, one decision.
  {
    name: 'Single contact',
    level: 2,
    lighting: 'day',
    contacts: [at(3, 'quad_recon', 'ahead')],
  },
  // All three types arriving together from different sides.
  {
    name: 'Mixed swarm',
    level: 3,
    lighting: 'day',
    contacts: [
      at(3, 'quad_recon', 'left'),
      at(5, 'fixedwing_kamikaze', 'right'),
      at(6.5, 'decoy_civilian', 'left'),
      at(8, 'quad_recon', 'ahead'),
      at(10, 'fixedwing_kamikaze', 'ahead'),
    ],
  },
  // Mostly civilians, with two real threats among them: tests restraint.
  {
    name: 'Restraint check',
    level: 3,
    lighting: 'day',
    contacts: [
      at(3, 'decoy_civilian', 'left'),
      at(9, 'decoy_civilian', 'right'),
      at(14, 'quad_recon', 'ahead'),
      at(20, 'decoy_civilian', 'ahead'),
      at(26, 'fixedwing_kamikaze', 'right'),
      at(32, 'decoy_civilian', 'left'),
    ],
  },
];

function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const match = env.match(/^MONGODB_URI=(.*)$/m);
  if (!match) throw new Error('MONGODB_URI is not set — add it to .env.local');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

// Same workaround as lib/db.js: some Windows setups leave Node with only a
// loopback DNS server, which cannot resolve the mongodb+srv:// record.
function fixLoopbackDns() {
  for (const api of [dns, dns.promises]) {
    const servers = api.getServers();
    if (servers.length > 0 && servers.every((s) => s === '127.0.0.1' || s === '::1')) {
      api.setServers(['8.8.8.8', '1.1.1.1']);
    }
  }
}

async function main() {
  fixLoopbackDns();
  await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 8000 });
  const scenarios = mongoose.connection.db.collection('scenarios');

  for (const scenario of SCENARIOS) {
    const now = new Date();
    const result = await scenarios.updateOne(
      { name: scenario.name },
      { $setOnInsert: { ...scenario, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
    console.log(`${result.upsertedCount ? 'created' : 'exists '}  ${scenario.name}: ${scenario.contacts.length} contacts, level ${scenario.level}, ${scenario.lighting}`);
  }

  console.log(`scripted scenarios in the database: ${await scenarios.countDocuments()}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
