// Terrain: what stands on the ground around the observer. It changes what
// can be seen, never what flies: the scenario is the same function of its
// seed on either terrain. Free of three.js and mongoose, so the scene, the
// scoring text and the checks can all read the same layout.
//
//   rural   the open airfield: nothing between the observer and the sky
//   urban   a built-up district: blocks of varying height either side of an
//           avenue, so the sky is broken up and a contact passes in and out
//           of sight behind them
//
// World units are metres. The observer stands at the origin looking down -Z.

// Height of the observer's eye, shared with the simulator's camera.
export const EYE_HEIGHT = 12;

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// The urban district, as plain boxes: { x, z } centre, { w, d } footprint,
// { h } height, { shade } 0..1 for a little variety of tone.
//
// Two zones, because of where contacts fly (they come in from 300 m or more
// and the recon quad then holds 150 to 200 m out):
//   the near district   low blocks either side of an avenue, out to about
//                       200 m. Each is capped below the lowest sight line to
//                       anything inside that range, so nothing that has come
//                       in close can sit hidden behind one.
//   the far skyline     tall blocks of very different heights beyond that,
//                       with streets between them. A contact approaching from
//                       further out is behind them until it crosses, shows in
//                       the gaps and over the low ones, and one crossing at
//                       that depth passes in and out of sight.
// Heights are fixed by position; nothing is random at run time.
const URBAN = { avenue: 30, empty: 0.18, nearRows: 3, nearBase: 8, nearVary: 8, farZ: -245, farRows: 2, farPitchZ: 62, farBase: 40, farVary: 35, farStreet: 20, slot: 14 };

// Lowest elevation of anything flying inside the near district, as a slope.
const NEAR_SIGHT_SLOPE = 0.09;

function urbanBlocks() {
  const blocks = [];
  const add = (x, z, w, d, h, shade) => blocks.push({ x, z: z - d / 2, w, d, h, shade });

  for (let row = 0; row < URBAN.nearRows; row++) {
    const z = -48 - row * 50;
    for (let column = 0; column < 5; column++) {
      for (const side of [-1, 1]) {
        const key = (column + 1) * side + 20;
        // some plots are left empty: squares and yards
        if (hash(key, row * 5 + 1) < URBAN.empty) continue;
        const w = 26 + hash(key, row * 5 + 2) * 12;
        const d = 24 + hash(key, row * 5 + 3) * 16;
        const h = Math.min(URBAN.nearBase + hash(key, row * 5 + 4) * URBAN.nearVary + row * 2, EYE_HEIGHT - 2 + NEAR_SIGHT_SLOPE * -z);
        add(side * (URBAN.avenue + column * 46 + w / 2), z, w, d, h, hash(key, row * 5 + 5));
      }
    }
  }

  for (let row = 0; row < URBAN.farRows; row++) {
    const z = URBAN.farZ - row * URBAN.farPitchZ;
    for (const side of [-1, 1]) {
      // from a narrow slot on the avenue's line outwards, block then street
      let edge = URBAN.slot / 2;
      for (let i = 0; edge < 300; i++) {
        const key = (i + 1) * side + 60;
        const w = 22 + hash(key, row * 5 + 31) * 26;
        const d = 26 + hash(key, row * 5 + 32) * 14;
        const h = URBAN.farBase + hash(key, row * 5 + 33) * URBAN.farVary;
        add(side * (edge + w / 2), z, w, d, h, hash(key, row * 5 + 34));
        edge += w + URBAN.farStreet * (0.6 + hash(key, row * 5 + 35) * 0.8);
      }
    }
  }
  return blocks;
}

export const URBAN_BLOCKS = urbanBlocks();

export function terrainBlocks(terrain) {
  return terrain === 'urban' ? URBAN_BLOCKS : [];
}

// Can the observer see this point, or is a block in the way? A straight line
// from the eye to the point, tested against every block as a box standing on
// the ground.
export function inSight(point, terrain) {
  const eye = [0, EYE_HEIGHT, 0];
  const direction = [point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]];
  for (const block of terrainBlocks(terrain)) {
    const low = [block.x - block.w / 2, 0, block.z - block.d / 2];
    const high = [block.x + block.w / 2, block.h, block.z + block.d / 2];
    let enter = 0, leave = 1;
    for (let axis = 0; axis < 3 && enter <= leave; axis++) {
      if (direction[axis] === 0) {
        if (eye[axis] < low[axis] || eye[axis] > high[axis]) enter = 2;
        continue;
      }
      const a = (low[axis] - eye[axis]) / direction[axis];
      const b = (high[axis] - eye[axis]) / direction[axis];
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
    }
    if (enter <= leave) return false;
  }
  return true;
}

// When a contact first comes into the observer's sight, in milliseconds from
// session start, or null if it never does. On open terrain that is the moment
// it spawns. It is worked out from the contact's own path, so the server can
// recompute it and need not take the simulator's word.
// positionAt(ms from session start) -> [x, y, z]
const SIGHT_STEP_MS = 100;

export function firstSight({ spawnTime, durationMs }, positionAt, terrain) {
  if (terrain !== 'urban') return spawnTime;
  for (let t = spawnTime; t <= spawnTime + durationMs; t += SIGHT_STEP_MS) {
    if (inSight(positionAt(t), terrain)) return t;
  }
  return null;
}
