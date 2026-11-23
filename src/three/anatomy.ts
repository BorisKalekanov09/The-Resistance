/**
 * Anatomical geometry.
 *
 * Generated in code:
 *  - cerebral hemispheres: shaped ellipsoids with lobes, a Sylvian fissure and
 *    a flat medial wall, folded with domain-warped noise into gyri and sulci
 *  - cerebellum with horizontal folia, brainstem
 *
 * Loaded asset:
 *  - the head is a real 3D scan (public/models/head.glb, CC BY 3.0), welded, scaled
 *    to life size and seated so the cranial vault encloses the brain
 *
 * Coordinates: +x = subject's left, +y = up, +z = face direction. Units ≈ 10 cm.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNoise3D } from './noise';

const noise = createNoise3D(11);
const noiseB = createNoise3D(29);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const GYRUS = new THREE.Color('#ead7cb');
const SULCUS = new THREE.Color('#a77f73');

/* ------------------------------------------------------------------ */
/* Cerebral hemisphere                                                 */
/* ------------------------------------------------------------------ */

function hemisphereShape(d: THREE.Vector3, out: THREE.Vector3) {
  // d is a unit direction; lateral side is +x (mirrored later for the other side)
  const lateral = d.x;
  let px: number;
  if (lateral >= 0) px = 0.57 * Math.pow(lateral, 0.92);
  else px = -0.075 * Math.pow(-lateral, 0.3); // flat medial wall

  const front = smoothstep(0.2, 1, d.z);
  const back = smoothstep(0.35, 1, -d.z);

  // vertical profile
  let py: number;
  if (d.y >= 0) {
    py = d.y * (0.53 - 0.06 * front - 0.08 * back);
  } else {
    // flatter underside, but temporal lobe hangs lower laterally
    const temporal =
      smoothstep(0.15, 0.6, d.x) * smoothstep(-0.55, -0.1, d.z) * (1 - smoothstep(0.35, 0.7, d.z));
    py = d.y * (0.3 + 0.16 * temporal - 0.06 * front);
  }

  let pz = d.z * (d.z >= 0 ? 0.76 : 0.84);
  // occipital pole slightly pointed and lowered
  pz -= 0.04 * back * (1 - Math.abs(d.y));
  py -= 0.05 * back;
  // narrow frontal & occipital poles
  px *= 1 - 0.22 * front * front - 0.28 * back * back;

  out.set(px + 0.085, py, pz);
}

function sylvianDepth(p: THREE.Vector3) {
  // groove on the lateral surface separating frontal/parietal from temporal lobe
  if (p.x < 0.25) return 0;
  const ax = 0.5, ay = -0.17; // anterior point (z, y)
  const bx = -0.18, by = 0.06; // posterior point
  const vx = bx - ax, vy = by - ay;
  const t = Math.min(1, Math.max(0, ((p.z - ax) * vx + (p.y - ay) * vy) / (vx * vx + vy * vy)));
  const dz = p.z - (ax + vx * t);
  const dy = p.y - (ay + vy * t);
  const dist = Math.sqrt(dz * dz + dy * dy);
  return Math.exp(-(dist * dist) / 0.0011) * smoothstep(0.25, 0.42, p.x) * (0.6 + 0.4 * (1 - t));
}

function centralSulcus(p: THREE.Vector3) {
  // runs from the top midline obliquely forward/down
  const zLine = -0.02 + (0.52 - p.y) * 0.32;
  const dist = Math.abs(p.z - zLine + 0.02 * noise(p.y * 6, p.x * 6, 3));
  return Math.exp(-(dist * dist) / 0.0006) * smoothstep(0.0, 0.25, p.y);
}

function foldField(p: THREE.Vector3) {
  const f = 5.2;
  const wx = noiseB(p.x * 2.1, p.y * 2.1, p.z * 2.1) * 0.32;
  const wy = noiseB(p.x * 2.1 + 31, p.y * 2.1, p.z * 2.1) * 0.32;
  const wz = noiseB(p.x * 2.1, p.y * 2.1 + 57, p.z * 2.1) * 0.32;
  const n1 = noise(p.x * f + wx * f, p.y * f + wy * f, p.z * f + wz * f);
  const n2 = noise(p.x * f * 2.2 + 19, p.y * f * 2.2 + wx * 4, p.z * f * 2.2);
  const major = 1 - Math.exp(-n1 * n1 * 22);
  const minor = 1 - Math.exp(-n2 * n2 * 30);
  return major * (0.78 + 0.22 * minor); // 0 at sulcus floor → 1 on gyral crown
}

function buildHemisphere(side: 1 | -1): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 360, 240);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const d = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    hemisphereShape(d, p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();

  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    // fold field evaluated in mirrored space so hemispheres differ slightly
    const fold = foldField(new THREE.Vector3(p.x * side + (side < 0 ? 3.1 : 0), p.y, p.z));
    const medial = p.x < 0.04 ? smoothstep(0.04, 0.0, p.x) : 0;
    const depthScale = 1 - 0.55 * medial;
    let disp = (fold - 1) * 0.04 * depthScale;
    const syl = sylvianDepth(p);
    const cen = centralSulcus(p);
    disp -= syl * 0.055 + cen * 0.022 * (1 - medial);
    const shade = Math.min(1, Math.max(0, fold * (1 - syl * 0.9) * (1 - cen * 0.6)));
    pos.setXYZ(i, p.x + n.x * disp, p.y + n.y * disp, p.z + n.z * disp);
    c.copy(SULCUS).lerp(GYRUS, Math.pow(shade, 0.7));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  if (side === -1) {
    for (let i = 0; i < pos.count; i++) pos.setX(i, -pos.getX(i));
    // flip winding so normals point outward
    const idx = geo.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Cerebellum + brainstem                                              */
/* ------------------------------------------------------------------ */

function buildCerebellum(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 220, 140);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const d = new THREE.Vector3();
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    let x = d.x * 0.5;
    let y = d.y * (d.y > 0 ? 0.2 : 0.25);
    const z = d.z * 0.3;
    // vermis notch at the back midline
    const notch = Math.exp(-(d.x * d.x) / 0.01) * smoothstep(0, 0.8, -d.z);
    const r = 1 - 0.1 * notch;
    // folia: fine horizontal lamellae
    const s = Math.sin((d.y * 0.25 + 0.03 * noise(d.x * 4, d.y * 4, d.z * 4)) * 150 + d.z * 3);
    const fol = 1 - Math.exp(-s * s * 3);
    const disp = 1 + (fol - 1) * 0.04;
    x *= r * disp;
    y *= disp;
    pos.setXYZ(i, x, y, z * r * disp);
    c.copy(SULCUS).lerp(GYRUS, 0.35 + 0.65 * fol);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildBrainstem(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40; // 0 bottom → 1 top
    const pons = Math.exp(-((t - 0.62) ** 2) / 0.012) * 0.05;
    const r = 0.075 + 0.035 * t + pons;
    pts.push(new THREE.Vector2(r, -0.75 + t * 0.75));
  }
  const geo = new THREE.LatheGeometry(pts, 64);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const c = new THREE.Color('#dcc3b6');
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* ------------------------------------------------------------------ */
/* Medial landmarks: corpus callosum + aMCC                             */
/* ------------------------------------------------------------------ */

const v = (z: number, y: number) => new THREE.Vector3(0, y, z);

export const CC_PATH = new THREE.CatmullRomCurve3([
  v(0.36, -0.06), v(0.47, 0.02), v(0.42, 0.1), v(0.28, 0.13), v(0.05, 0.14),
  v(-0.18, 0.12), v(-0.32, 0.07), v(-0.35, -0.01),
]);

/** Approximate location of the anterior midcingulate cortex (bilateral, medial wall). */
export const AMCC_PATH = new THREE.CatmullRomCurve3([
  v(0.43, 0.16), v(0.34, 0.215), v(0.22, 0.24), v(0.1, 0.245),
]);
export const AMCC_ANCHOR = new THREE.Vector3(0, 0.27, 0.27);

/* ------------------------------------------------------------------ */
/* Head: a 3D scan (Lee Perry-Smith by Infinite Realities, CC BY 3.0)   */
/* ------------------------------------------------------------------ */

export const HEAD_URL = `${import.meta.env.BASE_URL}models/head.glb`;

/**
 * Scan units → scene units. The scan is ~4.8 units from vertex to chin; a real head is ~23 cm,
 * i.e. 2.3 scene units, so s ≈ 0.48. The offset seats the cranial vault around the brain
 * (≈1.2–1.5 cm of skull + scalp above and behind the cortex; orbital roof under the frontal lobe).
 */
const HEAD_SCALE = 0.47;
const HEAD_OFFSET = new THREE.Vector3(0, -0.97, -0.16);

/**
 * Per-vertex cavity term (0 flat/convex → 1 deep concave), used as a cheap ambient-occlusion
 * stand-in: eye sockets, alar creases, lip corners and ear folds darken naturally.
 */
function bakeCavity(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const idx = geo.index!;
  const n = pos.count;
  const sum = new Float32Array(n * 3);
  const cnt = new Uint16Array(n);
  let edge = 0;
  for (let t = 0; t < idx.count; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = idx.getX(t + e), b = idx.getX(t + ((e + 1) % 3));
      for (const [u, w] of [[a, b], [b, a]]) {
        sum[u * 3] += pos.getX(w);
        sum[u * 3 + 1] += pos.getY(w);
        sum[u * 3 + 2] += pos.getZ(w);
        cnt[u]++;
      }
      edge += Math.hypot(pos.getX(a) - pos.getX(b), pos.getY(a) - pos.getY(b), pos.getZ(a) - pos.getZ(b));
    }
  }
  edge /= idx.count;
  let cav = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = cnt[i] || 1;
    const dx = sum[i * 3] / c - pos.getX(i);
    const dy = sum[i * 3 + 1] / c - pos.getY(i);
    const dz = sum[i * 3 + 2] / c - pos.getZ(i);
    // neighbours in front of the normal → the vertex sits in a hollow
    cav[i] = (dx * nrm.getX(i) + dy * nrm.getY(i) + dz * nrm.getZ(i)) / edge;
  }
  // diffuse it over the surface so it reads as soft occlusion, not noise
  for (let it = 0; it < 6; it++) {
    const next = new Float32Array(n);
    const k = new Uint16Array(n);
    for (let t = 0; t < idx.count; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = idx.getX(t + e), b = idx.getX(t + ((e + 1) % 3));
        next[a] += cav[b]; k[a]++;
        next[b] += cav[a]; k[b]++;
      }
    }
    for (let i = 0; i < n; i++) next[i] = 0.5 * cav[i] + 0.5 * (k[i] ? next[i] / k[i] : cav[i]);
    cav = next;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = smoothstep(0.02, 0.22, cav[i]);
  geo.setAttribute('cavity', new THREE.BufferAttribute(out, 1));
}

function prepareHead(src: THREE.BufferGeometry) {
  // drop UVs/normals so the UV-seam duplicates weld into one closed, smoothly shaded surface
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  geo.setIndex(src.getIndex()!.clone());
  geo = mergeVertices(geo, 1e-4);
  geo.scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE);
  geo.translate(HEAD_OFFSET.x, HEAD_OFFSET.y, HEAD_OFFSET.z);
  geo.computeVertexNormals();
  bakeCavity(geo);
  geo.computeBoundingSphere();
  return geo;
}

let headPromise: Promise<THREE.BufferGeometry> | null = null;
let headGeometry: THREE.BufferGeometry | null = null;

/** Loads (once) and prepares the head scan. */
export function loadHead(): Promise<THREE.BufferGeometry> {
  if (!headPromise) {
    headPromise = new GLTFLoader().loadAsync(HEAD_URL).then((gltf) => {
      let mesh: THREE.Mesh | undefined;
      gltf.scene.traverse((o) => {
        if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
      });
      if (!mesh) throw new Error('head.glb contains no mesh');
      headGeometry = prepareHead(mesh.geometry);
      return headGeometry;
    });
    headPromise.catch(() => {
      headPromise = null; // allow a retry on the next mount
    });
  }
  return headPromise;
}

/** The prepared head, if it has finished loading. */
export const getLoadedHead = () => headGeometry;

/* ------------------------------------------------------------------ */
/* Cached builders                                                     */
/* ------------------------------------------------------------------ */

export interface Anatomy {
  left: THREE.BufferGeometry;
  right: THREE.BufferGeometry;
  cerebellum: THREE.BufferGeometry;
  brainstem: THREE.BufferGeometry;
  cc: THREE.BufferGeometry;
  amcc: THREE.BufferGeometry;
}

type Part = keyof Anatomy;

const BUILDERS: Record<Part, () => THREE.BufferGeometry> = {
  left: () => buildHemisphere(1),
  right: () => buildHemisphere(-1),
  cerebellum: buildCerebellum,
  brainstem: buildBrainstem,
  cc: () => new THREE.TubeGeometry(CC_PATH, 80, 0.032, 16, false),
  amcc: () => new THREE.TubeGeometry(AMCC_PATH, 60, 0.043, 20, false),
};

const parts: Partial<Anatomy> = {};

function ensure(p: Part) {
  if (!parts[p]) parts[p] = BUILDERS[p]();
  return parts[p]!;
}

export function getAnatomy(): Anatomy {
  for (const p of Object.keys(BUILDERS) as Part[]) ensure(p);
  return parts as Anatomy;
}

/**
 * Build geometry ahead of time (while the user answers the questions), one part
 * per idle callback, so the main thread never blocks for long and the reveal is instant.
 * The head scan is fetched in parallel.
 */
export function prewarmAnatomy() {
  void loadHead().catch(() => undefined);
  const queue = (Object.keys(BUILDERS) as Part[]).filter((p) => !parts[p]);
  const ric =
    (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 60));
  const step = () => {
    const p = queue.shift();
    if (!p) return;
    ensure(p);
    ric(step, { timeout: 800 });
  };
  ric(step, { timeout: 800 });
}
