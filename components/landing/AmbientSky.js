'use client';

// The landing page's live view: the simulator's own scene, with one contact
// of each type drifting on a slow loop. Nothing here is interactive and
// nothing is scored. It renders only while it is on screen and the tab is
// showing.

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import Environment from '@/components/simulator/Environment';
import { MODELS, ObserverCamera } from '@/components/simulator/Scene';
import { useReducedMotion } from '@/lib/useReducedMotion';

// The observer looks further up than in an exercise, so the hero is mostly
// sky and the horizon sits below the headline.
const PITCH = 0.42;

// Slow elliptical loops in front of the observer. Metres and seconds.
// Each is long in depth and narrow across, so a contact comes towards the
// observer and goes away again and its size visibly changes. They stay well
// inside the view at every window shape, with room for the camera's drift.
// light: the colour of the contact's navigation light.
const PATHS = [
  { type: 'quad_recon', centre: [2, -112], radius: [20, 58], altitude: 36, period: 52, phase: 0.4, direction: 1, light: '#ff4a3d' },
  { type: 'fixedwing_kamikaze', centre: [-16, -195], radius: [36, 105], altitude: 72, period: 68, phase: 2.6, direction: -1, light: '#3ddc84' },
  { type: 'decoy_civilian', centre: [15, -88], radius: [11, 38], altitude: 17, period: 44, phase: 4.4, direction: 1, light: '#ff4a3d' },
];

// The camera drifts a few metres from side to side, always looking at a
// point this far ahead, so near contacts slide across far ones and the
// ground. That parallax is most of what makes the view read as deep.
const DRIFT = { metres: 5, seconds: 46, lookAhead: 110 };

function CameraDrift({ still }) {
  useFrame(({ camera, clock }) => {
    const x = still ? 0 : Math.sin((clock.elapsedTime / DRIFT.seconds) * Math.PI * 2) * DRIFT.metres;
    camera.position.x = x;
    camera.rotation.order = 'YXZ';  // turn about the vertical first, then pitch
    camera.rotation.set(PITCH, Math.atan2(x, DRIFT.lookAhead), 0);
  });
  return null;
}

// A navigation light: a small soft point that pulses about once a second.
// Hero only — in the simulator it would give a contact away.
const BLINK_SECONDS = 1.1;

function NavLight({ colour, offset, still }) {
  const core = useRef();
  const halo = useRef();

  useFrame(({ clock }) => {
    // on for roughly a third of each cycle, easing in and out; steady with reduced motion
    const wave = Math.sin((clock.elapsedTime / BLINK_SECONDS + offset) * Math.PI * 2);
    const lit = still ? 0.7 : Math.min(1, Math.max(0, (wave - 0.35) / 0.4));
    core.current.opacity = lit;
    halo.current.opacity = lit * 0.22;
  });

  return (
    <group position={[0, 0.45, 0]}>
      <mesh>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshBasicMaterial ref={core} color={colour} transparent opacity={0} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshBasicMaterial ref={halo} color={colour} transparent opacity={0} fog={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

// With reduced motion the scene is drawn once, frozen at this moment.
const STILL_AT = 14;

function Drifter({ path, still }) {
  const group = useRef();
  const Model = MODELS[path.type];

  useFrame(({ clock }) => {
    const t = still ? STILL_AT : STILL_AT + clock.elapsedTime;
    const angle = path.phase + path.direction * (2 * Math.PI * t) / path.period;
    group.current.position.set(
      path.centre[0] + path.radius[0] * Math.cos(angle),
      path.altitude + Math.sin(t / 3 + path.phase) * 0.8,
      path.centre[1] + path.radius[1] * Math.sin(angle),
    );
    // Point the nose along the loop; it only shows on the fixed-wing.
    const { x, y, z } = group.current.position;
    group.current.lookAt(
      x - path.direction * path.radius[0] * Math.sin(angle),
      y,
      z + path.direction * path.radius[1] * Math.cos(angle),
    );
  });

  return (
    <group ref={group} scale={2}>
      <Model />
      <NavLight colour={path.light} offset={path.phase} still={still} />
    </group>
  );
}

export default function AmbientSky() {
  const wrapper = useRef(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabShowing, setTabShowing] = useState(true);
  const still = useReducedMotion();

  // Stop rendering once the view has scrolled out of sight, or the tab is hidden.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(wrapper.current);
    const onVisibility = () => setTabShowing(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div ref={wrapper} aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Canvas dpr={[1, 1.5]} frameloop={still ? 'demand' : onScreen && tabShowing ? 'always' : 'never'}>
        <ObserverCamera pitch={PITCH} height={2} />
        <CameraDrift still={still} />
        <Environment lighting="day" still={still} />
        {PATHS.map((path) => (
          <Drifter key={path.phase} path={path} still={still} />
        ))}
      </Canvas>
    </div>
  );
}
