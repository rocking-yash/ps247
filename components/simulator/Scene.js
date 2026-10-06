'use client';

import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, PerspectiveCamera } from '@react-three/drei';
import Environment, { CONDITIONS, useBlobTexture } from './Environment';
import { contactState } from '@/lib/scenario';
import { EYE_HEIGHT, PLATFORM } from '@/lib/terrain';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { usePhone } from '@/lib/usePhone';

// Fixed observation post, 12 m up and pitched ~11° above level, so the whole
// approach from horizon to the asset stays in frame and enough ground is
// visible for shadows and range rings to mean something. No camera controls.
// Contacts spawn within ±28° of centre, so on a narrow view the field of view
// widens until at least ±33° is visible.
const BASE_FOV = 60;
const MIN_HALF_WIDTH = 33 * Math.PI / 180;

// halfWidth: how far either side of centre must stay in view, in radians.
export function ObserverCamera({ pitch = 0.2, height = EYE_HEIGHT, halfWidth = MIN_HALF_WIDTH }) {
  const aspect = useThree((state) => state.size.width / state.size.height);
  const needed = 2 * Math.atan(Math.tan(halfWidth) / aspect) * 180 / Math.PI;
  return (
    <PerspectiveCamera
      makeDefault
      position={[0, height, 0]}
      rotation={[pitch, 0, 0]}
      fov={Math.min(110, Math.max(BASE_FOV, needed))}
      near={0.5}
      far={1500}
    />
  );
}

// ---------------------------------------------------------------------------
// Silhouettes. Drawn roughly 10x life size so a contact is a findable speck
// at several hundred metres on an ordinary monitor. Shape and movement are
// the only cues to type — nothing is labelled or colour-coded.
// ---------------------------------------------------------------------------

const BODY = '#1c1f24';
const DETAIL = '#2b3038';
// Glow added regardless of light. Black by day; at night a tone just under the
// sky's, which is what takes the edge off the silhouette.
const UNLIT = '#000000';

// Four rotors on an X frame.
export function QuadRecon({ color = BODY, rotorColor = DETAIL, emissive = UNLIT }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 0.4, 1.2]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
      {[Math.PI / 4, -Math.PI / 4].map((angle) => (
        <mesh key={angle} rotation={[0, angle, 0]}>
          <boxGeometry args={[4, 0.12, 0.25]} />
          <meshStandardMaterial color={color} emissive={emissive} />
        </mesh>
      ))}
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * 1.41, 0.15, z * 1.41]}>
          <cylinderGeometry args={[0.8, 0.8, 0.05, 20]} />
          <meshStandardMaterial color={rotorColor} emissive={emissive} />
        </mesh>
      ))}
    </group>
  );
}

// Long fuselage, straight wing, tail fin. Nose points along +Z so the group
// can be aimed down its line of flight.
export function FixedWing({ color = BODY, emissive = UNLIT }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.6, 0.55, 4.6]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
      <mesh position={[0, 0.1, 0.3]}>
        <boxGeometry args={[7.2, 0.14, 1.3]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
      <mesh position={[0, 0.1, -2]}>
        <boxGeometry args={[2.6, 0.1, 0.7]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
      <mesh position={[0, 0.65, -2]}>
        <boxGeometry args={[0.12, 1.1, 0.8]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
    </group>
  );
}

// Six rotors in a ring with a parcel slung underneath.
export function CivilianHex({ color = BODY, rotorColor = DETAIL, emissive = UNLIT }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.7, 0.7, 0.4, 12]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[0, (i * Math.PI) / 3, 0]}>
          <boxGeometry args={[4.6, 0.1, 0.2]} />
          <meshStandardMaterial color={color} emissive={emissive} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          position={[Math.cos((i * Math.PI) / 3) * 2.3, 0.15, -Math.sin((i * Math.PI) / 3) * 2.3]}
        >
          <cylinderGeometry args={[0.65, 0.65, 0.05, 16]} />
          <meshStandardMaterial color={rotorColor} emissive={emissive} />
        </mesh>
      ))}
      <mesh position={[0, -0.75, 0]}>
        <boxGeometry args={[0.12, 1.1, 0.12]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
      <mesh position={[0, -1.7, 0]}>
        <boxGeometry args={[1.5, 1.1, 1.5]} />
        <meshStandardMaterial color={color} emissive={emissive} />
      </mesh>
    </group>
  );
}

export const MODELS = {
  quad_recon: QuadRecon,
  fixedwing_kamikaze: FixedWing,
  decoy_civilian: CivilianHex,
};

// status: pending (not yet flagged) | flagged | resolved | missed
// The flag ring never looks smaller than it does at this range, so a flag on
// a distant speck is as visible as one on a close contact.
const RING_FULL_SIZE_WITHIN = 200;
const RING_SNAP_MS = 220;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// On a phone a contact is flagged with a thumb, so its hit area is never
// smaller on screen than this radius, however far away the contact is.
const HIT_RADIUS = 7;         // metres: the hit sphere as built
const MIN_TAP_RADIUS_PX = 26;

// platform: in urban terrain, the only ground there is to cast a shadow on.
function Contact({ contact, status, active, silhouette, shadowOpacity, thumb, platform, getElapsed, onDetect, onEnd }) {
  const group = useRef();
  const hit = useRef();
  const body = useRef();
  const shadow = useRef();
  const ring = useRef();
  const ringMaterial = useRef();
  const flaggedAt = useRef(null);
  const ended = useRef(false);
  const blob = useBlobTexture();
  const Model = MODELS[contact.droneType];
  const live = status === 'pending' || status === 'flagged';

  useFrame(({ camera, size }) => {
    const state = contactState(contact, getElapsed());
    group.current.visible = state !== null && live;
    if (!state) {
      shadow.current.visible = false;
      return;
    }

    const [x, y, z] = state.position;
    shadow.current.visible = group.current.visible
      && (!platform || (Math.abs(x) < platform.halfWidth && z < platform.near && z > platform.far));
    group.current.position.set(x, y, z);
    // Straight below on the ground: where it is over, and so how far out.
    shadow.current.position.set(x, 0.06, z);

    if (thumb) {
      const range = camera.position.distanceTo(group.current.position);
      const metresPerPixel = (2 * range * Math.tan((camera.fov * Math.PI) / 360)) / size.height;
      hit.current.scale.setScalar(Math.max(1, (MIN_TAP_RADIUS_PX * metresPerPixel) / HIT_RADIUS));
    }

    // Confirmation at the contact itself: the ring appears at once at full
    // strength and closes onto it. With reduced motion it simply appears.
    if (ring.current) {
      if (flaggedAt.current === null) {
        flaggedAt.current = { time: performance.now(), still: prefersReducedMotion() };
      }
      const since = performance.now() - flaggedAt.current.time;
      const closing = flaggedAt.current.still ? 0 : Math.max(0, 1 - since / RING_SNAP_MS) ** 3;
      const range = camera.position.distanceTo(group.current.position);
      ring.current.scale.setScalar(Math.max(1, range / RING_FULL_SIZE_WITHIN) * (1 + 1.2 * closing));
      ringMaterial.current.opacity = active || since < 450 ? 1 : 0.4;
    }

    // Only the fixed-wing has a nose to point; it flies one straight line.
    if (contact.droneType === 'fixedwing_kamikaze') {
      body.current.lookAt(
        x + contact.end[0] - contact.start[0],
        y + contact.end[1] - contact.start[1],
        z + contact.end[2] - contact.start[2],
      );
    }

    if (!ended.current && state.ended) {
      ended.current = true;
      onEnd();
    }
  });

  // The raycaster ignores `visible`, so a contact that has not spawned or is
  // already dealt with must be rejected here — without stopping the event, so
  // a live contact behind it can still be flagged. The cursor deliberately
  // does not change on hover: that would let a trainee find contacts by
  // sweeping the mouse instead of looking.
  function handleClick(e) {
    if (status !== 'pending' || contactState(contact, getElapsed()) === null) return;
    e.stopPropagation();
    onDetect();
  }

  return (
    <>
      <mesh ref={shadow} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial map={blob} color="#0c1420" transparent opacity={shadowOpacity} depthWrite={false} />
      </mesh>
      <group ref={group} visible={false} position={[0, -1000, 0]}>
        <group ref={body}>
          <Model {...silhouette} />
        </group>
        {/* Generous invisible click target so flagging tests eyes, not aim */}
        <mesh ref={hit} onClick={handleClick}>
          <sphereGeometry args={[HIT_RADIUS, 12, 12]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* Flag ring: solid on the contact being decided, faint on those waiting */}
        {status === 'flagged' && (
          <Billboard>
            <mesh ref={ring}>
              <ringGeometry args={[5.6, 6.1, 48]} />
              <meshBasicMaterial ref={ringMaterial} color="#e8b341" fog={false} depthTest={false} transparent />
            </mesh>
          </Billboard>
        )}
      </group>
    </>
  );
}

// statuses: one per contact, same order as scenario.drones
export default function Scene({ scenario, lighting = 'day', terrain = 'rural', statuses, activeIndex, getElapsed, onDetect, onEnd }) {
  const light = CONDITIONS[lighting] ?? CONDITIONS.day;
  const still = useReducedMotion();
  const phone = usePhone();
  return (
    <Canvas dpr={[1, 1.5]}>
      <ObserverCamera />
      <Environment lighting={lighting} terrain={terrain} still={still} light={phone} />
      {scenario?.drones.map((contact, i) => (
        <Contact
          key={`${scenario.seed}-${i}`}
          contact={contact}
          status={statuses[i]}
          active={i === activeIndex}
          silhouette={light.silhouette}
          shadowOpacity={light.shadow}
          thumb={phone}
          platform={terrain === 'urban' ? PLATFORM : null}
          getElapsed={getElapsed}
          onDetect={() => onDetect(i)}
          onEnd={() => onEnd(i)}
        />
      ))}
    </Canvas>
  );
}
