// Seeds the demo trainees: six people across two units. Safe to run again —
// each is matched on rank, name and unit and only created if missing, so
// nothing is duplicated and no existing record or session is touched.
//
//   npm run seed      (also runs seed-scenarios.cjs)
//
// The names are invented. Reads MONGODB_URI from .env.local.

const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const TRAINEES = [
  { rank: 'Maj', name: 'Arjun Rathore', unit: 'Alpha Battery' },
  { rank: 'Capt', name: 'Meera Nair', unit: 'Alpha Battery' },
  { rank: 'Lt', name: 'Vikram Sandhu', unit: 'Alpha Battery' },
  { rank: 'Maj', name: 'Kavita Deshmukh', unit: 'Bravo Battery' },
  { rank: 'Capt', name: 'Imran Qureshi', unit: 'Bravo Battery' },
  { rank: 'Lt', name: 'Rohan Bhatia', unit: 'Bravo Battery' },
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
  const users = mongoose.connection.db.collection('users');

  for (const trainee of TRAINEES) {
    const result = await users.updateOne(
      { role: 'trainee', ...trainee },
      // Field defaults match UserSchema in lib/models.js.
      { $setOnInsert: { baseLevel: 2, lightingChoice: 'alternate', terrainChoice: 'rural', createdAt: new Date() } },
      { upsert: true },
    );
    console.log(`${result.upsertedCount ? 'created' : 'exists '}  ${trainee.rank} ${trainee.name}, ${trainee.unit}`);
  }

  console.log(`trainees in the database: ${await users.countDocuments({ role: 'trainee' })}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
