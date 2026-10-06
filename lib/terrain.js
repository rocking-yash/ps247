// Terrain: what stands on the ground around the observer. It changes what
// can be seen, never what flies: the scenario is the same function of its
// seed on either terrain. Free of three.js and mongoose, so the scene, the
// scoring text and the checks can all read the same layout.
//
//   rural   the open airfield: nothing between the observer and the sky
//   urban   the observer stands on an open raised platform with a low
//           parapet, and a city skyline stands beyond it in the middle
//           distance. The sky above stays open; a contact that flies low
//           passes in front of the buildings, where its outline is harder to
//           hold, and one further out can be behind them for a while
//
// World units are metres. The observer stands at the origin looking down -Z.

// Height of the observer's eye, shared with the simulator's camera.
export const EYE_HEIGHT = 12;

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// The platform the urban observer stands on. Its top is the ground plane
// (y = 0); the streets of the city beyond are STREET_LEVEL below it.
//   halfWidth, near, far   its extent across and along the line of sight
//   wall                   the parapet round its edge: height and thickness
export const PLATFORM = { halfWidth: 220, near: 48, far: -112, wall: { height: 3, thickness: 1.6 } };
export const STREET_LEVEL = -18;

// The skyline, as plain boxes on a street grid, all square to it:
// { x, z } centre, { w, d } footprint, { h } height from the street,
// { top } the height of the roof above the platform, { shade } and { glass }
// 0..1 for variety of tone and of how much of the facade is window.
//
// Three rows of plots beyond the platform, with a street between every pair
// of plots and an avenue on the observer's line of sight. Most plots hold a
// mid-rise block, some a tall slab, and some are left empty, so the roofline
// steps up and down and sky shows through the gaps. Heights are fixed by
// position; nothing is random at run time.
const URBAN = { nearZ: -330, rows: 3, pitchZ: 66, pitchX: 62, columns: 7, avenue: 11, empty: 0.14, tallShare: 0.3, midTop: [16, 40], tallTop: [52, 88], rowGain: 5 };

function urbanBlocks() {
  const blocks = [];
  for (let row = 0; row < URBAN.rows; row++) {
    for (let column = 0; column < URBAN.columns; column++) {
      for (const side of [-1, 1]) {
        const key = (column + 1) * side + 40;
        const pick = (n) => hash(key, row * 7 + n);
        if (pick(1) < URBAN.empty) continue;
        const tall = pick(2) < URBAN.tallShare;
        // a slab is narrow and deep in plan; a block is broad
        const w = tall ? 26 + pick(3) * 10 : 34 + pick(3) * 14;
        const d = 30 + pick(4) * 16;
        const [low, high] = tall ? URBAN.tallTop : URBAN.midTop;
        const top = low + pick(5) * (high - low) + row * URBAN.rowGain;
        blocks.push({
          x: side * (URBAN.avenue + column * URBAN.pitchX + URBAN.pitchX / 2 - 7),
          z: URBAN.nearZ - row * URBAN.pitchZ - d / 2,
          w, d,
          h: top - STREET_LEVEL,
          top,
          shade: pick(6),
          glass: tall ? 0.55 + pick(7) * 0.4 : 0.25 + pick(7) * 0.45,
        });
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
    const low = [block.x - block.w / 2, STREET_LEVEL, block.z - block.d / 2];
    const high = [block.x + block.w / 2, block.top, block.z + block.d / 2];
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
