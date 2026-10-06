'use client';

// The landing page's hero background: the simulator's own scene, edge to
// edge, with one contact of each type drifting on a slow loop. Nothing here
// is interactive and nothing is scored. It renders only while it is on screen
// and the tab is showing, and it drops its resolution if frames run slow.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
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
// narrowAltitude: height flown on a narrow screen, where one is needed to
// keep the contact in the band of sky above the text.
const PATHS = [
  { type: 'quad_recon', centre: [2, -112], radius: [16, 58], altitude: 36, period: 52, phase: 0.4, direction: 1, light: '#ff4a3d' },
  { type: 'fixedwing_kamikaze', centre: [-8, -195], radius: [30, 105], altitude: 66, period: 68, phase: 2.6, direction: -1, light: '#3ddc84' },
  { type: 'decoy_civilian', centre: [10, -88], radius: [10, 38], altitude: 17, narrowAltitude: 28, period: 44, phase: 4.4, direction: 1, light: '#ff4a3d' },
];

// The camera drifts a few metres from side to side, always looking at a
// point this far ahead, so near contacts slide across far ones and the
// ground. That parallax is most of what makes the view read as deep.
const DRIFT = { metres: 5, seconds: 46, lookAhead: 110 };

// The text sits over the scene, so the scene keeps out of its way.
//   wide    the text holds the left of the frame: the camera looks off-axis,
//           which slides the whole scene right of centre and lifts it without
//           distorting it. The loops are wider and lean right (slide: metres
//           across per metre of depth), so the structures can sit close to
//           the text while the contacts fill the frame from the text's edge
//           to the right edge without crossing the text.
//   narrow  the text holds the bottom, and only a band of sky above it is
//           free. The loops are pulled in (less sideways, much less depth) so
//           the contacts keep to a thin band of elevation, and the camera is
//           pitched so that band sits just under the nav.
const DEG = Math.PI / 180;
const FRAMING = {
  wide: { pitch: PITCH, shift: 0.12, lift: 0.1, halfWidth: 40 * DEG, spread: 1.25, depth: 1, slide: 0.13 },
  narrow: { shift: 0, lift: 0, halfWidth: 20 * DEG, spread: 0.6, depth: 0.3, slide: 0, bandTop: { elevation: 24.5 * DEG, at: 0.1 } },
};

// The loop a contact flies under this framing.
function framed(path, framing) {
  const { spread, depth, slide } = FRAMING[framing];
  return {
    ...path,
    slide,
    centre: [path.centre[0] * spread, path.centre[1]],
    radius: [path.radius[0] * spread, path.radius[1] * depth],
    altitude: framing === 'narrow' ? path.narrowAltitude ?? path.altitude : path.altitude,
  };
}

function HeroCamera({ framing, still }) {
  const { shift, lift, halfWidth, bandTop } = FRAMING[framing];

  useFrame(({ camera, clock, size }) => {
    const x = still ? 0 : Math.sin((clock.elapsedTime / DRIFT.seconds) * Math.PI * 2) * DRIFT.metres;
    // narrow: whatever the field of view, put the top of the contacts' band a tenth of the way down
    const pitch = bandTop
      ? bandTop.elevation - Math.atan((1 - 2 * bandTop.at) * Math.tan((camera.fov * DEG) / 2))
      : FRAMING[framing].pitch;
    camera.position.x = x;
    camera.rotation.order = 'YXZ';  // turn about the vertical first, then pitch
    camera.rotation.set(pitch, Math.atan2(x, DRIFT.lookAhead), 0);

    // Off-axis view: only touched when the frame or the framing changes.
    const offsetX = -Math.round(size.width * shift);
    const offsetY = Math.round(size.height * lift);
    const view = camera.view;
    const on = Boolean(view && view.enabled);
    if ((on ? view.offsetX : 0) !== offsetX || (on ? view.offsetY : 0) !== offsetY
      || (on && (view.fullWidth !== size.width || view.fullHeight !== size.height))) {
      if (offsetX === 0 && offsetY === 0) camera.clearViewOffset();
      else camera.setViewOffset(size.width, size.height, offsetX, offsetY, size.width, size.height);
    }
  });

  return <ObserverCamera pitch={PITCH} height={2} halfWidth={halfWidth} />;
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
    const depth = path.centre[1] + path.radius[1] * Math.sin(angle);
    group.current.position.set(
      path.centre[0] + path.radius[0] * Math.cos(angle) - path.slide * depth,
      path.altitude + Math.sin(t / 3 + path.phase) * 0.8,
      depth,
    );
    // Point the nose along the loop; it only shows on the fixed-wing.
    const { x, y, z } = group.current.position;
    const ahead = path.direction * path.radius[1] * Math.cos(angle);
    group.current.lookAt(x - path.direction * path.radius[0] * Math.sin(angle) - path.slide * ahead, y, z + ahead);
  });

  return (
    <group ref={group} scale={2}>
      <Model />
      <NavLight colour={path.light} offset={path.phase} still={still} />
    </group>
  );
}

// The page lays the text out on the left from this width up, and along the
// bottom below it; the camera framing follows the same switch.
const WIDE_LAYOUT = '(min-width: 64rem)';

function subscribeToLayout(onChange) {
  const query = window.matchMedia(WIDE_LAYOUT);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

// Render scale: up to 2 device pixels per CSS pixel, stepping down if the
// frame rate falls rather than dropping anything from the scene.
const DPR_STEPS = [2, 1.5, 1];

export default function AmbientSky() {
  const wrapper = useRef(null);
  const wide = useSyncExternalStore(subscribeToLayout, () => window.matchMedia(WIDE_LAYOUT).matches, () => true);
  const [dprStep, setDprStep] = useState(0);
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
      <Canvas dpr={[1, DPR_STEPS[dprStep]]} frameloop={still ? 'demand' : onScreen && tabShowing ? 'always' : 'never'}>
        <PerformanceMonitor onDecline={() => setDprStep((step) => Math.min(step + 1, DPR_STEPS.length - 1))} />
        <HeroCamera framing={wide ? 'wide' : 'narrow'} still={still} />
        <Environment lighting="day" still={still} />
        {PATHS.map((path) => (
          <Drifter key={path.phase} path={framed(path, wide ? 'wide' : 'narrow')} still={still} />
        ))}
      </Canvas>
    </div>
  );
}
