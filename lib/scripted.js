// Scripted scenarios: checking what an instructor wrote, and describing one
// in words. Free of mongoose, so the browser can use it too.

import { APPROACHES, DRONE_TYPES, LIGHTING, SCRIPT_LIMITS, TERRAIN } from './constants';

// Returns { value } with a clean { name, level, lighting, terrain, contacts } ready to
// save, or { error } with one sentence saying what is wrong.
// Contacts are given with spawnTime in milliseconds and come back sorted by it.
export function checkScript(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name) return { error: 'Give the scenario a name.' };
  if (name.length > SCRIPT_LIMITS.nameLength) {
    return { error: `The name can be at most ${SCRIPT_LIMITS.nameLength} characters.` };
  }
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 5) {
    return { error: 'Difficulty must be a level from 1 to 5.' };
  }
  if (!LIGHTING.includes(input.lighting)) return { error: 'Conditions must be day or night.' };
  const terrain = input.terrain ?? 'rural';
  if (!TERRAIN.includes(terrain)) return { error: 'Terrain must be the open airfield or urban.' };

  const list = Array.isArray(input.contacts) ? input.contacts : [];
  if (list.length < 1) return { error: 'Add at least one contact.' };
  if (list.length > SCRIPT_LIMITS.maxContacts) {
    return { error: `A scenario can have at most ${SCRIPT_LIMITS.maxContacts} contacts.` };
  }

  const contacts = [];
  for (const [i, contact] of list.entries()) {
    const spawnTime = Math.round(Number(contact?.spawnTime));
    if (!DRONE_TYPES.includes(contact?.droneType)) return { error: `Contact ${i + 1} needs a type.` };
    if (!APPROACHES.includes(contact?.approach)) return { error: `Contact ${i + 1} needs an approach direction.` };
    if (!Number.isFinite(spawnTime) || spawnTime < 0 || spawnTime > SCRIPT_LIMITS.maxSpawnSeconds * 1000) {
      return { error: `Contact ${i + 1} must appear between 0 and ${SCRIPT_LIMITS.maxSpawnSeconds} seconds in.` };
    }
    contacts.push({ droneType: contact.droneType, spawnTime, approach: contact.approach });
  }
  contacts.sort((a, b) => a.spawnTime - b.spawnTime);

  return { value: { name, level: input.level, lighting: input.lighting, terrain, contacts } };
}

// A stored scenario as the plain object the simulator and the pages pass about.
export function toScript(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    level: doc.level,
    lighting: doc.lighting,
    terrain: doc.terrain ?? 'rural',
    contacts: doc.contacts.map(({ droneType, spawnTime, approach }) => ({ droneType, spawnTime, approach })),
  };
}

const SHORT = { quad_recon: 'quadcopter', fixedwing_kamikaze: 'fixed-wing', decoy_civilian: 'civilian' };
const SHORT_PLURAL = { quad_recon: 'quadcopters', fixedwing_kamikaze: 'fixed-wing', decoy_civilian: 'civilian' };

// "5 contacts over 24 s: 2 quadcopters, 2 fixed-wing, 1 civilian"
export function describeScript(script) {
  const n = script.contacts.length;
  const mix = DRONE_TYPES
    .map((type) => [type, script.contacts.filter((c) => c.droneType === type).length])
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${count === 1 ? SHORT[type] : SHORT_PLURAL[type]}`)
    .join(', ');
  const last = Math.max(...script.contacts.map((c) => c.spawnTime));
  if (n === 1) return `1 contact: ${SHORT[script.contacts[0].droneType]}`;
  return `${n} contacts, the last appearing ${+(last / 1000).toFixed(1)} s in: ${mix}`;
}
