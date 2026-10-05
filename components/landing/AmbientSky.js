'use client';

// Hero background: the simulator's own scene at night, with a few contacts
// drifting on slow loops. Nothing here is interactive and nothing is scored.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MODELS, ObserverCamera } from '@/components/simulator/Scene';

const NIGHT = '#0b121a';

// The observer looks further up than in an exercise, so the hero is mostly
// sky and the horizon sits below the headline.
const PITCH = 0.42;

// Slow elliptical loops in front of the observer. Metres and seconds.
const PATHS = [
  { type: 'quad_recon', centre: [0, -75], radius: [55, 22], altitude: 34, period: 70, phase: 0.4, direction: 1 },
  { type: 'fixedwing_kamikaze', centre: [-25, -120], radius: [90, 30], altitude: 85, period: 95, phase: 2.6, direction: -1 },
  { type: 'decoy_civilian', centre: [35, -55], radius: [30, 12], altitude: 14, period: 55, phase: 4.4, direction: 1 },
];

// With reduced motion the scene is drawn once, frozen at this moment.
const STILL_AT = 14;

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToMotion(onChange) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}

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
    <group ref={group} scale={1.5}>
      <Model color="#c9d2db" rotorColor="#9aa6b2" />
    </group>
  );
}

export default function AmbientSky() {
  const wrapper = useRef(null);
  const [onScreen, setOnScreen] = useState(true);
  const still = usePrefersReducedMotion();

  // Stop rendering once the hero has scrolled out of view.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapper} aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Canvas dpr={[1, 1.5]} frameloop={still ? 'demand' : onScreen ? 'always' : 'never'}>
        <ObserverCamera pitch={PITCH} height={2} />
        <color attach="background" args={[NIGHT]} />
        <fog attach="fog" args={[NIGHT, 120, 500]} />
        <hemisphereLight args={['#b8c6d6', '#8f9aa6', 1.5]} />
        <directionalLight position={[-80, 160, 60]} intensity={1.2} color="#dbe6f2" />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3000, 3000]} />
          <meshStandardMaterial color="#10161d" />
        </mesh>
        {PATHS.map((path) => (
          <Drifter key={path.phase} path={path} still={still} />
        ))}
      </Canvas>
    </div>
  );
}
