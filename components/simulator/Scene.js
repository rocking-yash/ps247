'use client';

import { useMemo, useRef } from 'react';
import { BackSide, Color } from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, PerspectiveCamera } from '@react-three/drei';
import { ASSET_POSITION, contactState } from '@/lib/scenario';

// The two conditions. The sky runs from a hazy horizon up to a clearer
// zenith, and fog pulls distant things towards the haze, so range reads.
//
// Night is harder, not just darker: the silhouettes glow faintly at close to
// the sky tone at the heights contacts fly, and the fog colour is that tone,
// so a distant contact has almost no outline and only separates from the sky
// as it closes or drops against the paler horizon.
const LIGHTING = {
  day: {
    zenith: '#7f9db8',
    horizon: '#d6dde2',
    fog: ['#d6dde2', 250, 1100],
    hemisphere: ['#dfe9f2', '#4b5238', 1.1],
    sun: { position: [120, 200, 80], intensity: 1.4, color: '#ffffff' },
    silhouette: { color: '#1c1f24', rotorColor: '#2b3038' },
    shadow: 0.3,
  },
  night: {
    zenith: '#0a1017',
    horizon: '#1f2b37',
    fog: ['#16202a', 150, 800],
    hemisphere: ['#4a5868', '#1c232b', 1.3],
    sun: { position: [-80, 160, 60], intensity: 0.25, color: '#9fb3c8' },
    silhouette: { color: '#1c1f24', rotorColor: '#2b3038', emissive: '#0a1016' },
    shadow: 0.3,
  },
};

const SKY_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Haze sits in the first few degrees above the horizon and clears with height.
const SKY_FRAGMENT = `
  uniform vec3 zenith;
  uniform vec3 horizon;
  varying vec3 vDirection;
  void main() {
    float height = clamp(normalize(vDirection).y, 0.0, 1.0);
    gl_FragColor = vec4(mix(horizon, zenith, 1.0 - exp(-height * 4.0)), 1.0);
    #include <colorspace_fragment>
  }
`;

function Sky({ zenith, horizon }) {
  const uniforms = useMemo(
    () => ({ zenith: { value: new Color(zenith) }, horizon: { value: new Color(horizon) } }),
    [zenith, horizon],
  );
  return (
    <mesh scale={1400}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        key={zenith + horizon}
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={SKY_VERTEX}
        fragmentShader={SKY_FRAGMENT}
      />
    </mesh>
  );
}

// Fixed observation post, 12 m up and pitched ~11° above level, so the whole
// approach from horizon to the asset stays in frame and enough ground is
// visible for shadows and range rings to mean something. No camera controls.
// Contacts spawn within ±28° of centre, so on a narrow view the field of view
// widens until at least ±33° is visible.
const BASE_FOV = 60;
const MIN_HALF_WIDTH = 33 * Math.PI / 180;

export function ObserverCamera({ pitch = 0.2, height = 12 }) {
  const aspect = useThree((state) => state.size.width / state.size.height);
  const needed = 2 * Math.atan(Math.tan(MIN_HALF_WIDTH) / aspect) * 180 / Math.PI;
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
const RING_SNAP_MS = 180;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function Contact({ contact, status, active, silhouette, shadowOpacity, getElapsed, onDetect, onEnd }) {
  const group = useRef();
  const body = useRef();
  const shadow = useRef();
  const ring = useRef();
  const ringMaterial = useRef();
  const flaggedAt = useRef(null);
  const ended = useRef(false);
  const Model = MODELS[contact.droneType];
  const live = status === 'pending' || status === 'flagged';

  useFrame(({ camera }) => {
    const state = contactState(contact, getElapsed());
    group.current.visible = state !== null && live;
    shadow.current.visible = group.current.visible;
    if (!state) return;

    const [x, y, z] = state.position;
    group.current.position.set(x, y, z);
    // Straight below on the ground: where it is over, and so how far out.
    shadow.current.position.set(x, 0.06, z);

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
        <circleGeometry args={[4.5, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={shadowOpacity} depthWrite={false} />
      </mesh>
      <group ref={group} visible={false} position={[0, -1000, 0]}>
        <group ref={body}>
          <Model {...silhouette} />
        </group>
        {/* Generous invisible click target so flagging tests eyes, not aim */}
        <mesh onClick={handleClick}>
          <sphereGeometry args={[7, 12, 12]} />
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

// Range rings every 100 m from the observation post. Each is wider than the
// last so that, seen at a shallow angle, they all stay about as thick on screen.
const RANGE_RINGS = [100, 200, 300, 400, 500].map((range) => [range, (range * range) / 6000]);

export function Terrain() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#5f6b4c" />
      </mesh>
      {RANGE_RINGS.map(([range, width]) => (
        <mesh key={range} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[range - width / 2, range + width / 2, 160]} />
          <meshStandardMaterial color="#525d41" />
        </mesh>
      ))}
      {/* Defended compound */}
      <group position={ASSET_POSITION}>
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[14, 5, 9]} />
          <meshStandardMaterial color="#8d8a7f" />
        </mesh>
        <mesh position={[-12, 1.75, 4]}>
          <boxGeometry args={[6, 3.5, 6]} />
          <meshStandardMaterial color="#7d7a70" />
        </mesh>
        <mesh position={[11, 4, -3]}>
          <cylinderGeometry args={[0.25, 0.25, 8, 8]} />
          <meshStandardMaterial color="#4a4a48" />
        </mesh>
      </group>
    </>
  );
}

// statuses: one per contact, same order as scenario.drones
export default function Scene({ scenario, lighting = 'day', statuses, activeIndex, getElapsed, onDetect, onEnd }) {
  const light = LIGHTING[lighting] ?? LIGHTING.day;
  return (
    <Canvas dpr={[1, 1.5]}>
      <ObserverCamera />
      <Sky zenith={light.zenith} horizon={light.horizon} />
      <fog attach="fog" args={light.fog} />
      <hemisphereLight args={light.hemisphere} />
      <directionalLight {...light.sun} />
      <Terrain />
      {scenario?.drones.map((contact, i) => (
        <Contact
          key={`${scenario.seed}-${i}`}
          contact={contact}
          status={statuses[i]}
          active={i === activeIndex}
          silhouette={light.silhouette}
          shadowOpacity={light.shadow}
          getElapsed={getElapsed}
          onDetect={() => onDetect(i)}
          onEnd={() => onEnd(i)}
        />
      ))}
    </Canvas>
  );
}
