'use client';

// The world around the contacts: sky, sun, haze, ground, a distant treeline
// and the defended compound. Shared by the simulator and the landing page's
// live view, so both show the same place.
//
// There are two terrains under the same sky, haze and light: the open
// airfield, and an urban district whose blocks hide parts of the sky (the
// layout is URBAN_BLOCKS in lib/terrain.js). Only the ground and what stands
// on it differ.
//
// Everything is procedural — no image files. It is also built to be cheap,
// because the landing page runs it on every load:
//   - no shadow maps: shadows are soft blobs laid on the ground
//   - the sky, clouds and sun glow are one shader on one dome
//   - grass is a single instanced mesh, capped, near the observer only
//   - textures are small canvases generated once and reused

import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide, CanvasTexture, Color, DoubleSide, Matrix4, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { ASSET_POSITION } from '@/lib/scenario';
import { URBAN_BLOCKS } from '@/lib/terrain';

// Low sun, ahead and to the left. Everything is lit from here.
const SUN_DIRECTION = new Vector3(-0.72, 0.24, -0.65).normalize();
// Shadows fall the other way along the ground.
const SHADOW_DRIFT = [-SUN_DIRECTION.x, -SUN_DIRECTION.z].map((v) => v / Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.z));

// The two conditions. By day: deep blue overhead paling almost to white at
// the horizon, warm sunlight, cool fill, and haze that takes the colour of
// the horizon so distant things fade and desaturate — which is what makes
// range readable.
//
// Night is harder, not just darker: the silhouettes glow faintly at close to
// the sky tone at the heights contacts fly, and the haze is that same tone,
// so a distant contact has almost no outline and only separates from the sky
// as it closes or drops against the paler horizon.
export const CONDITIONS = {
  day: {
    zenith: '#4f7fb5',
    horizon: '#eef2f4',
    sunGlow: '#ffd9a8',
    cloud: '#f6f4ef',
    cloudAmount: 0.85,
    fog: ['#e3e9ec', 140, 1500],
    hemisphere: ['#d6e6f7', '#8d8873', 2.2],
    sun: { intensity: 1.9, color: '#ffe1b8' },
    silhouette: { color: '#1c1f24', rotorColor: '#2b3038' },
    shadow: 0.34,
    tuft: '#ffffff',
  },
  night: {
    zenith: '#070c12',
    horizon: '#1f2b37',
    sunGlow: '#2a3644',
    cloud: '#1b2530',
    cloudAmount: 0.6,
    fog: ['#16202a', 150, 800],
    hemisphere: ['#4a5868', '#1c232b', 1.3],
    sun: { intensity: 0.25, color: '#9fb3c8' },
    silhouette: { color: '#1c1f24', rotorColor: '#2b3038', emissive: '#0a1016' },
    shadow: 0.3,
    tuft: '#1b2227',
  },
};

// ---------------------------------------------------------------------------
// Procedural textures. Small canvases, drawn once per page and cached.
// ---------------------------------------------------------------------------

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Smooth value noise, 0..1.
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const cache = {};
const cached = (key, make) => (cache[key] ??= make());

// The stretch of ground the observer actually looks at: a concrete apron with
// slab joints around the compound, dry grass beyond it, both mottled so
// neither is one flat colour. Metres per texel is about 1.25.
const GROUND = { size: 640, centre: [0, -200], texels: 512 };
const APRON = { halfWidth: 80, near: 30, far: -105 };  // x extent, z range
const GRASS_AWAY = [119, 117, 76];   // what the texture fades to at its edges; the far ground's colour
const GRASS_COLOUR = '#77754c';
const PAVING_AWAY = [124, 124, 120];  // the same for the urban ground
const PAVING_COLOUR = '#7c7c78';

// urban: paving and asphalt in place of grass; the apron is the same concrete.
function groundTexture(urban = false) {
  const { size, centre, texels } = GROUND;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = texels;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(texels, texels);

  for (let py = 0; py < texels; py++) {
    for (let px = 0; px < texels; px++) {
      const x = centre[0] + (px / texels - 0.5) * size;
      const z = centre[1] + (py / texels - 0.5) * size;
      const onApron = Math.abs(x) < APRON.halfWidth && z < APRON.near && z > APRON.far;

      let rgb;
      if (onApron) {
        // Concrete: pale grey and blotchy. The slab joints are separate geometry.
        const blotch = noise(x * 0.09, z * 0.09) * 0.6 + noise(x * 0.5, z * 0.5) * 0.4;
        rgb = [172, 170, 160].map((v) => v * (0.88 + blotch * 0.22));
      } else if (urban) {
        // Asphalt and paving: mid grey, patched, darker along the avenue.
        const patch = noise(x * 0.03 + 3, z * 0.03 + 7);
        const fine = noise(x * 0.6, z * 0.6);
        const road = Math.abs(x) < 14 ? 0.82 : 1;
        rgb = mix([112, 112, 110], [140, 139, 133], patch * 0.7 + fine * 0.3).map((v) => v * road * (0.94 + fine * 0.12));
      } else {
        // Dry grass: straw to dull green in broad patches, speckled finer.
        const patch = noise(x * 0.022 + 9, z * 0.022 + 4);
        const fine = noise(x * 0.35, z * 0.35);
        rgb = mix([150, 140, 86], [92, 104, 60], patch * 0.75 + fine * 0.25).map((v) => v * (0.9 + fine * 0.2));
      }

      // Melt into the plain far ground towards the edges, so there is no seam.
      const edge = Math.max(Math.abs(px / texels - 0.5), Math.abs(py / texels - 0.5)) * 2;
      const away = Math.min(1, Math.max(0, (edge - 0.8) / 0.2));
      rgb = mix(rgb, urban ? PAVING_AWAY : GRASS_AWAY, away);

      const i = (py * texels + px) * 4;
      image.data[i] = rgb[0];
      image.data[i + 1] = rgb[1];
      image.data[i + 2] = rgb[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// A soft round shadow: dark in the middle, gone at the rim.
function blobTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const fade = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

// A ragged line of treetops, opaque below the line and clear above it.
function treelineTexture() {
  const width = 1024, height = 48;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3d4a3c';
  for (let x = 0; x < width; x++) {
    // wraps cleanly: the noise is sampled round a circle
    const a = (x / width) * Math.PI * 2;
    const cx = Math.cos(a) * 20, cy = Math.sin(a) * 20;
    const top = 12 + noise(cx + 50, cy + 50) * 16 + noise(cx * 5 + 9, cy * 5 + 9) * 10 + hash(x, 7) * 4;
    ctx.fillRect(x, height - top, 1, top);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

export function useBlobTexture() {
  return useMemo(() => cached('blob', blobTexture), []);
}

// ---------------------------------------------------------------------------
// Sky: gradient, sun glow and two layers of slow cloud, in one shader.
// ---------------------------------------------------------------------------

const LIGHT_SKY = { ONE_CLOUD_LAYER: 1 };

const SKY_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 sunGlow;
  uniform vec3 cloud;
  uniform vec3 sunDirection;
  uniform float cloudAmount;
  uniform float time;
  varying vec3 vDirection;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + vec2(11.0, 7.0); a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDirection);
    float height = clamp(d.y, 0.0, 1.0);

    // Pale and hazy at the horizon, clearing to deeper colour overhead.
    vec3 colour = mix(horizon, zenith, 1.0 - exp(-height * 3.2));

    float towardSun = max(dot(d, sunDirection), 0.0);
    colour += sunGlow * (pow(towardSun, 28.0) * 0.55 + pow(towardSun, 4.0) * 0.14);

    // Cloud on a flat layer far overhead: a broad layer and a finer one,
    // drifting. It thins to nothing low in the sky, where contacts fly, so a
    // silhouette is never set against it at close range.
    vec2 over = d.xz / max(d.y, 0.06) * 0.55 + vec2(time * 0.006, time * 0.002);
    #ifdef ONE_CLOUD_LAYER
      float density = fbm(over);
    #else
      float density = fbm(over) * 0.65 + fbm(over * 2.7 + 5.0) * 0.35;
    #endif
    float cover = smoothstep(0.46, 0.76, density) * cloudAmount * smoothstep(0.2, 0.45, height);
    colour = mix(colour, cloud + sunGlow * pow(towardSun, 3.0) * 0.2, cover);

    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

// light: one cloud layer instead of two (phones).
function Sky({ look, still, light }) {
  const material = useRef();
  const uniforms = useMemo(
    () => ({
      zenith: { value: new Color(look.zenith) },
      horizon: { value: new Color(look.horizon) },
      sunGlow: { value: new Color(look.sunGlow) },
      cloud: { value: new Color(look.cloud) },
      cloudAmount: { value: look.cloudAmount },
      sunDirection: { value: SUN_DIRECTION },
      time: { value: 40 },
    }),
    [look],
  );

  // Clouds drift unless the reader has asked for less motion.
  useFrame((_, delta) => {
    if (!still) material.current.uniforms.time.value += delta;
  });

  return (
    <mesh scale={1400}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        ref={material}
        key={light ? `${look.zenith}-light` : look.zenith}
        {...(light ? { defines: LIGHT_SKY } : {})}
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={SKY_VERTEX}
        fragmentShader={SKY_FRAGMENT}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

const FLAT = [-Math.PI / 2, 0, 0];

// Range rings every 100 m from the observation post. Each is wider than the
// last so that, seen at a shallow angle, they all stay about as thick on screen.
const RANGE_RINGS = [100, 200, 300, 400, 500].map((range) => [range, (range * range) / 6000]);

// Grass tufts in the grass nearest the observer. One instanced mesh, capped
// at this many; they shrink to nothing with distance instead of popping out.
const TUFT_COUNT = 320;
const TUFT_REACH = [110, 250];  // full size within the first, gone by the second (metres from the post)

function tuftLayout() {
  const tufts = [];
  for (let i = 0; tufts.length < TUFT_COUNT && i < TUFT_COUNT * 6; i++) {
    const x = (hash(i, 1) * 2 - 1) * 170;
    const z = -15 - hash(i, 2) * 245;
    const onApron = Math.abs(x) < APRON.halfWidth + 2 && z > APRON.far - 2;
    if (onApron) continue;
    const range = Math.hypot(x, z);
    const fade = 1 - Math.min(1, Math.max(0, (range - TUFT_REACH[0]) / (TUFT_REACH[1] - TUFT_REACH[0])));
    if (fade <= 0.05) continue;
    tufts.push({
      x, z,
      turn: hash(i, 3) * Math.PI,
      width: (0.9 + hash(i, 4) * 1.3) * fade,
      height: (0.35 + hash(i, 5) * 0.5) * fade,
      colour: mix([176, 164, 104], [122, 128, 78], hash(i, 6)).map((v) => v / 255),
    });
  }
  return tufts;
}

// light: a third as many (phones). The nearest are generated first, so the
// ones kept are the ones that show.
const LIGHT_TUFT_COUNT = 110;

function GrassTufts({ tint, light }) {
  const mesh = useRef();
  const all = useMemo(() => cached('tufts', tuftLayout), []);
  const tufts = useMemo(() => (light ? all.slice(0, LIGHT_TUFT_COUNT) : all), [all, light]);

  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const colour = new Color();
    tufts.forEach((tuft, i) => {
      // the cone is 1.3 m tall about its middle, so lift it by half its scaled height
      matrix.compose(
        new Vector3(tuft.x, 0.65 * tuft.height, tuft.z),
        turn.setFromAxisAngle(up, tuft.turn),
        new Vector3(tuft.width, tuft.height, tuft.width),
      );
      mesh.current.setMatrixAt(i, matrix);
      mesh.current.setColorAt(i, colour.setRGB(tuft.colour[0], tuft.colour[1], tuft.colour[2], SRGBColorSpace));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;
  }, [tufts]);

  return (
    <instancedMesh key={tufts.length} ref={mesh} args={[undefined, undefined, tufts.length]} frustumCulled={false}>
      <coneGeometry args={[0.45, 1.3, 5]} />
      <meshBasicMaterial color={tint} />
    </instancedMesh>
  );
}

// A soft shadow lying on the ground beside something of this footprint and
// height, pushed away from the sun.
function GroundShadow({ at, footprint, height, opacity }) {
  const blob = useBlobTexture();
  const reach = height * 1.4;
  return (
    <mesh
      rotation={FLAT}
      position={[at[0] + SHADOW_DRIFT[0] * reach * 0.6, 0.05, at[1] + SHADOW_DRIFT[1] * reach * 0.6]}
      scale={[footprint[0] + reach * 1.6, footprint[1] + reach * 1.6, 1]}
    >
      <planeGeometry />
      <meshBasicMaterial map={blob} color="#0c1420" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// The defended compound: plain concrete blocks and a mast, on the apron.
const STRUCTURES = [
  { at: [0, 0], size: [14, 5, 9], colour: '#c2bfb5' },
  { at: [-12, 4], size: [6, 3.5, 6], colour: '#b8b5ab' },
];
const MAST = { at: [11, -3], height: 8 };

// Slab joints on the apron, every 12 m both ways: thin dark strips in one
// instanced mesh.
const JOINT_SPACING = 12;
const JOINT_WIDTH = 0.22;

function jointLayout() {
  const strips = [];
  const depth = APRON.near - APRON.far;
  const middle = (APRON.near + APRON.far) / 2;
  for (let x = -APRON.halfWidth; x <= APRON.halfWidth + 0.01; x += JOINT_SPACING) {
    strips.push({ at: [x, middle], size: [JOINT_WIDTH, depth] });
  }
  for (let z = APRON.far; z <= APRON.near + 0.01; z += JOINT_SPACING) {
    strips.push({ at: [0, z], size: [APRON.halfWidth * 2, JOINT_WIDTH] });
  }
  return strips;
}

function ApronJoints() {
  const mesh = useRef();
  const strips = useMemo(() => cached('joints', jointLayout), []);

  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    strips.forEach((strip, i) => {
      matrix.compose(new Vector3(strip.at[0], 0.02, strip.at[1]), flat, new Vector3(strip.size[0], strip.size[1], 1));
      mesh.current.setMatrixAt(i, matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [strips]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, strips.length]} frustumCulled={false}>
      <planeGeometry />
      <meshStandardMaterial color="#6f6e68" roughness={1} />
    </instancedMesh>
  );
}

// The urban district: every block is a plain box, all in one instanced mesh,
// with one more instanced mesh for their soft shadows. The boxes take clicks
// and stop them, so a contact behind a building cannot be flagged through it.
const BLOCK_TONES = [[166, 160, 150], [128, 130, 134]];

function UrbanBlocks({ shadowOpacity }) {
  const boxes = useRef();
  const shadows = useRef();
  const blob = useBlobTexture();

  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const upright = new Quaternion();
    const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    const colour = new Color();
    URBAN_BLOCKS.forEach((block, i) => {
      matrix.compose(new Vector3(block.x, block.h / 2, block.z), upright, new Vector3(block.w, block.h, block.d));
      boxes.current.setMatrixAt(i, matrix);
      const tone = mix(BLOCK_TONES[0], BLOCK_TONES[1], block.shade).map((v) => v / 255);
      boxes.current.setColorAt(i, colour.setRGB(tone[0], tone[1], tone[2], SRGBColorSpace));

      const reach = Math.min(block.h, 40) * 1.4;
      matrix.compose(
        new Vector3(block.x + SHADOW_DRIFT[0] * reach * 0.6, 0.05 + i * 0.0005, block.z + SHADOW_DRIFT[1] * reach * 0.6),
        flat,
        new Vector3(block.w + reach * 1.6, block.d + reach * 1.6, 1),
      );
      shadows.current.setMatrixAt(i, matrix);
    });
    boxes.current.instanceMatrix.needsUpdate = true;
    boxes.current.instanceColor.needsUpdate = true;
    boxes.current.computeBoundingSphere();
    shadows.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={shadows} args={[undefined, undefined, URBAN_BLOCKS.length]} frustumCulled={false}>
        <planeGeometry />
        <meshBasicMaterial map={blob} color="#0c1420" transparent opacity={shadowOpacity} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={boxes}
        args={[undefined, undefined, URBAN_BLOCKS.length]}
        frustumCulled={false}
        onClick={(e) => e.stopPropagation()}
      >
        <boxGeometry />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
    </>
  );
}

function Ground({ shadowOpacity, tuftTint, urban, light }) {
  const map = useMemo(() => cached(urban ? 'ground-urban' : 'ground', () => groundTexture(urban)), [urban]);
  const [ax, , az] = ASSET_POSITION;

  return (
    <>
      {/* Plain far ground, and the detailed stretch laid just over it */}
      <mesh rotation={FLAT} position={[0, -0.05, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color={urban ? PAVING_COLOUR : GRASS_COLOUR} roughness={1} />
      </mesh>
      <mesh rotation={FLAT} position={[GROUND.centre[0], 0, GROUND.centre[1]]}>
        <planeGeometry args={[GROUND.size, GROUND.size]} />
        <meshStandardMaterial key={urban ? 'urban' : 'rural'} map={map} roughness={1} />
      </mesh>

      {RANGE_RINGS.map(([range, width]) => (
        <mesh key={range} rotation={FLAT} position={[0, 0.03, 0]}>
          <ringGeometry args={[range - width / 2, range + width / 2, 160]} />
          <meshStandardMaterial color={urban ? '#55565a' : '#5d5f45'} transparent opacity={0.55} roughness={1} />
        </mesh>
      ))}

      {urban ? <UrbanBlocks shadowOpacity={shadowOpacity} /> : <GrassTufts tint={tuftTint} light={light} />}
      <ApronJoints />

      <group position={[ax, 0, az]}>
        {STRUCTURES.map(({ at, size, colour }) => (
          <group key={colour}>
            <GroundShadow at={at} footprint={[size[0], size[2]]} height={size[1]} opacity={shadowOpacity} />
            <mesh position={[at[0], size[1] / 2, at[1]]}>
              <boxGeometry args={size} />
              <meshStandardMaterial color={colour} roughness={0.95} />
            </mesh>
          </group>
        ))}
        <GroundShadow at={MAST.at} footprint={[1, 1]} height={MAST.height * 0.5} opacity={shadowOpacity} />
        <mesh position={[MAST.at[0], MAST.height / 2, MAST.at[1]]}>
          <cylinderGeometry args={[0.25, 0.25, MAST.height, 8]} />
          <meshStandardMaterial color="#3d3f40" />
        </mesh>
      </group>
    </>
  );
}

// A band of trees a kilometre out, in front of the observer. At that range
// the haze has nearly taken it, which is the point: it is only a backdrop.
function Treeline() {
  const map = useMemo(() => cached('treeline', treelineTexture), []);
  return (
    <mesh position={[0, 20, 0]}>
      <cylinderGeometry args={[1000, 1000, 46, 48, 1, true, Math.PI - 1.25, 2.5]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.5} side={DoubleSide} />
    </mesh>
  );
}

// lighting: 'day' | 'night'.  terrain: 'rural' | 'urban'.
// still: freeze the clouds (reduced motion).
// light: a cheaper version for phones (fewer grass tufts, one cloud layer).
export default function Environment({ lighting = 'day', terrain = 'rural', still = false, light = false }) {
  const urban = terrain === 'urban';
  const look = CONDITIONS[lighting] ?? CONDITIONS.day;
  return (
    <>
      <Sky look={look} still={still} light={light} />
      <fog attach="fog" args={look.fog} />
      <hemisphereLight args={look.hemisphere} />
      <directionalLight position={SUN_DIRECTION.clone().multiplyScalar(300)} {...look.sun} />
      <Ground shadowOpacity={look.shadow} tuftTint={look.tuft} urban={urban} light={light} />
      {!urban && <Treeline />}
    </>
  );
}
