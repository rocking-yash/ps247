// Scenario generation. Everything about a session's layout is a pure function
// of its seed, difficulty level and practice focus. All three are stored on
// the Session, so any session can be regenerated exactly.
// A scripted scenario (written by an instructor) is built by the same flight
// code from its own list of contacts: see buildScriptedScenario.
// World units are metres. The observer stands at the origin looking down -Z.

// What each difficulty level changes. First-pass values — tune by playtest.
//   singles     single contacts in the session (there is always one swarm too)
//   swarm       [min, max] contacts in the swarm wave
//   speed       multiplier on every contact's speed
//   gap         [min, max] seconds between one single or wave and the next
//   stagger     [min, max] seconds between spawns inside the swarm
//   decoyShare  chance that any one contact is a civilian decoy
export const DIFFICULTY = {
  1: { singles: 2, swarm: [3, 3], speed: 0.85, gap: [14, 18], stagger: [2.5, 4], decoyShare: 0.2 },
  2: { singles: 2, swarm: [3, 4], speed: 1, gap: [12, 16], stagger: [2, 3.5], decoyShare: 0.3 },
  3: { singles: 3, swarm: [4, 4], speed: 1.1, gap: [10, 14], stagger: [1.5, 3], decoyShare: 0.35 },
  4: { singles: 3, swarm: [4, 5], speed: 1.2, gap: [8, 12], stagger: [1, 2.5], decoyShare: 0.45 },
  5: { singles: 4, swarm: [5, 5], speed: 1.3, gap: [7, 10], stagger: [0.8, 2], decoyShare: 0.5 },
};

// Where the threats are heading: the defended compound.
export const ASSET_POSITION = [0, 0, -60];

// Speeds in m/s. First-pass figures from open sources — confirm before they
// go on a slide.
//   quad_recon          small camera quadcopter (DJI Mavic class) at cruise
//   fixedwing_kamikaze  loitering munition on its terminal run (Lancet-class
//                       cruise is about 30 m/s, Shahed-class about 50 m/s)
//   decoy_civilian      delivery-type multirotor ambling across the area
const SPEED = { quad_recon: 15, fixedwing_kamikaze: 40, decoy_civilian: 9 };

const DEG = Math.PI / 180;

function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed() {
  return crypto.randomUUID();
}

// Bearing is measured from straight ahead, positive to the observer's right.
function polar(bearing, range, altitude) {
  return [Math.sin(bearing) * range, altitude, -Math.cos(bearing) * range];
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function lerp(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

// A generated contact may come from anywhere in view (`spread` degrees either
// side of straight ahead). A scripted one comes from the side its script
// names, within a few degrees. Either way this takes one draw.
const APPROACH_BEARING = { left: -18, ahead: 0, right: 18 };

function bearingFrom(rand, approach, spread) {
  const draw = rand() * 2 - 1;
  return (approach ? APPROACH_BEARING[approach] + draw * 5 : draw * spread) * DEG;
}

// ---------------------------------------------------------------------------
// One generator per type. Each returns the fixed facts of a contact; where it
// is at a given moment comes from contactState below. All bearings stay
// inside the fixed camera's field of view.
// ---------------------------------------------------------------------------

// Recon quad: flies in, then holds at a stand-off point watching the compound.
// It never overflies the asset. Its job is done when the loiter ends.
function makeQuadRecon(rand, { speed, range, approach }) {
  const bearing = bearingFrom(rand, approach, 26);
  const start = polar(bearing, (320 + rand() * 80) * range, 50 + rand() * 50);
  const hold = polar(bearing * 0.6 + (rand() * 2 - 1) * 6 * DEG, 150 + rand() * 50, 35 + rand() * 30);
  const approachMs = Math.round(distance(start, hold) / (SPEED.quad_recon * speed) * 1000);
  const loiterMs = Math.round((12000 + rand() * 6000) / speed);
  return { start, hold, approachMs, phase: rand() * 2 * Math.PI, durationMs: approachMs + loiterMs };
}

// Loitering munition: one straight, fast, descending run into the asset.
function makeFixedWing(rand, { speed, range, approach }) {
  const start = polar(bearingFrom(rand, approach, 24), (480 + rand() * 80) * range, 90 + rand() * 50);
  const end = [ASSET_POSITION[0], 6, ASSET_POSITION[2]];
  return { start, end, durationMs: Math.round(distance(start, end) / (SPEED.fixedwing_kamikaze * speed) * 1000) };
}

// Civilian: crosses the area well beyond the compound, wandering a little,
// and ends no closer to the compound than the far side of the apron.
// Scripted: it enters from the named side and crosses to the other; "ahead"
// has it come out of the distance in the middle and drift off to one side.
function makeDecoy(rand, { speed, range, approach }) {
  const drawn = rand() < 0.5 ? -1 : 1;
  const side = approach === 'left' ? 1 : approach === 'right' ? -1 : drawn;
  const depth = (220 + rand() * 100) * range;
  const halfWidth = Math.tan(24 * DEG) * depth;
  const altitude = 60 + rand() * 40;
  const start = approach === 'ahead' ? [0, altitude, -depth - 80] : [-side * halfWidth, altitude, -depth];
  const end = [side * halfWidth, altitude + (rand() - 0.5) * 20, -depth - rand() * 40];
  return {
    start,
    end,
    phase: rand() * 2 * Math.PI,
    durationMs: Math.round(distance(start, end) / (SPEED.decoy_civilian * speed) * 1000),
  };
}

const MAKERS = {
  quad_recon: makeQuadRecon,
  fixedwing_kamikaze: makeFixedWing,
  decoy_civilian: makeDecoy,
};

const THREATS = ['quad_recon', 'fixedwing_kamikaze'];
const ALL_TYPES = [...THREATS, 'decoy_civilian'];

// Practice focus: what the scenario leans towards when one skill is the
// trainee's weak link. It changes what comes, not how hard the level is.
//   detect    contacts first appear a quarter further out, so they are
//             smaller and hazier when the detection clock starts
//   classify  more look-alikes: the two multirotors (recon quad and civilian
//             hex) in near-equal numbers, and few of the unmistakable fixed-wing
//   respond   all three types in even numbers and all three in the swarm, so
//             no single habitual response is right twice running
export const FOCUS = {
  detect: { range: 1.25 },
  classify: { decoyShare: 0.5, quadShare: 0.85 },
  respond: { decoyShare: 1 / 3, everyTypeInSwarm: true },
};

// A session is a few single contacts and one swarm wave, in a seeded order.
// How many, how fast, how tightly spaced and how many are decoys come from
// the difficulty level; the focus, if any, adjusts the mix or the range.
// With no focus this draws exactly what it always has.
export function buildScenario(seed, level = 1, focus = null) {
  const cfg = DIFFICULTY[level] ?? DIFFICULTY[1];
  const lean = FOCUS[focus] ?? {};
  const decoyShare = lean.decoyShare ? Math.max(cfg.decoyShare, lean.decoyShare) : cfg.decoyShare;
  const flight = { speed: cfg.speed, range: lean.range ?? 1 };

  const rand = mulberry32(hashSeed(seed));
  const between = ([min, max]) => min + rand() * (max - min);
  const threat = lean.quadShare
    ? () => (rand() < lean.quadShare ? 'quad_recon' : 'fixedwing_kamikaze')
    : () => THREATS[Math.floor(rand() * THREATS.length)];
  const anyType = () => (rand() < decoyShare ? 'decoy_civilian' : threat());

  // The wave is always mixed: if the draw came out all one type, one member
  // is swapped for a different one.
  const swarmSize = cfg.swarm[0] + Math.floor(rand() * (cfg.swarm[1] - cfg.swarm[0] + 1));
  const swarmTypes = Array.from({ length: swarmSize }, anyType);
  if (swarmTypes.every((type) => type === swarmTypes[0])) {
    const swap = Math.floor(rand() * swarmSize);
    swarmTypes[swap] = swarmTypes[0] === 'decoy_civilian' ? threat() : 'decoy_civilian';
  }
  if (lean.everyTypeInSwarm) {
    // Overwrite a type that appears more than once with each one that is absent.
    for (const type of ALL_TYPES) {
      if (swarmTypes.includes(type)) continue;
      const spare = swarmTypes.findIndex((t, i) => swarmTypes.indexOf(t) !== i);
      swarmTypes[spare === -1 ? Math.floor(rand() * swarmSize) : spare] = type;
    }
  }
  const swarmSlot = Math.floor(rand() * (cfg.singles + 1));

  const drones = [];
  const add = (droneType, spawnTime, wave) => {
    drones.push({ droneType, spawnTime: Math.round(spawnTime), wave, ...MAKERS[droneType](rand, flight) });
  };

  let t = 2000 + rand() * 2000;
  for (let slot = 0; slot <= cfg.singles; slot++) {
    if (slot === swarmSlot) {
      for (const droneType of swarmTypes) {
        add(droneType, t, 1);
        t += between(cfg.stagger) * 1000;  // staggered, not simultaneous
      }
    } else {
      add(anyType(), t, null);
    }
    t += between(cfg.gap) * 1000;
  }

  return { seed, level, focus, drones };
}

// What a scripted session records as its seed. Nothing is drawn from it: the
// contacts come from the script.
export function scriptedSeed(id) {
  return `scripted:${id}`;
}

// The scenario an instructor wrote, as the simulator runs it.
// script: { id, level, contacts: [{ droneType, spawnTime, approach }] }
//
// It is a pure function of the script, so every trainee assigned it faces the
// same contacts at the same moments on the same paths. Type, spawn time and
// side are the instructor's; the level sets the speed; the remaining detail
// of each path (exact bearing, range, height) is drawn from the script's id
// and the contact's place in the list, so it too is the same every time.
export function buildScriptedScenario(script) {
  const cfg = DIFFICULTY[script.level] ?? DIFFICULTY[1];
  const drones = script.contacts.map((contact, i) => ({
    droneType: contact.droneType,
    spawnTime: contact.spawnTime,
    wave: null,
    ...MAKERS[contact.droneType](mulberry32(hashSeed(`${script.id}:${i}`)), {
      speed: cfg.speed,
      range: 1,
      approach: contact.approach,
    }),
  }));
  return { seed: scriptedSeed(script.id), level: script.level, focus: null, drones };
}

// True when a script lists exactly the contacts a session recorded.
export function scriptMatchesEvents(script, events) {
  return (
    script.contacts.length === events.length &&
    script.contacts.every((c, i) => c.droneType === events[i].droneType && c.spawnTime === events[i].spawnTime)
  );
}

// Can this recorded session be rerun exactly? A scripted one needs its script
// to still exist (pass it, or null); a generated one needs its seed to still
// produce what was recorded.
export function sessionReplayable(session, script = null) {
  if (session.scenario?.mode === 'scripted') {
    return Boolean(script) && script.level === session.difficulty.level && scriptMatchesEvents(script, session.events);
  }
  return scenarioMatchesEvents(
    session.scenarioSeed, session.difficulty.level, session.events, session.difficulty.focus ?? null,
  );
}

// Where a contact is at `elapsedMs` from session start, or null before it
// spawns. Once its run is over (`ended`) it holds its final behaviour, so a
// flagged contact stays put while the trainee decides.
export function contactState(drone, elapsedMs) {
  if (elapsedMs === null || elapsedMs < drone.spawnTime) return null;
  const age = elapsedMs - drone.spawnTime;
  const ended = age >= drone.durationMs;
  const seconds = age / 1000;

  if (drone.droneType === 'quad_recon') {
    if (age < drone.approachMs) {
      return { position: lerp(drone.start, drone.hold, age / drone.approachMs), ended };
    }
    // Hover: a slow few-metre wander around the stand-off point.
    const a = drone.phase + seconds * 0.7;
    return {
      position: [
        drone.hold[0] + Math.cos(a) * 4,
        drone.hold[1] + Math.sin(a * 1.7) * 1.2,
        drone.hold[2] + Math.sin(a) * 4,
      ],
      ended,
    };
  }

  const t = Math.min(1, age / drone.durationMs);
  const position = lerp(drone.start, drone.end, t);

  if (drone.droneType === 'decoy_civilian') {
    const a = drone.phase + Math.min(seconds, drone.durationMs / 1000) * 0.9;
    position[1] += Math.sin(a) * 5;
    position[2] += Math.cos(a * 0.6) * 8;
  }

  return { position, ended };
}

// True when the stored seed, level and focus regenerate exactly the contacts
// a session recorded: same count, same types in the same order, same spawn
// times. This is the test for whether a session can be replayed.
export function scenarioMatchesEvents(seed, level, events, focus = null) {
  const { drones } = buildScenario(seed, level, focus);
  return (
    drones.length === events.length &&
    drones.every((drone, i) => drone.droneType === events[i].droneType && drone.spawnTime === events[i].spawnTime)
  );
}
