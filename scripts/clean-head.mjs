/**
 * Prepares public/models/head.glb from the original Lee Perry-Smith scan
 * (three.js examples/models/gltf/LeePerrySmith/LeePerrySmith.glb, CC BY 3.0, Infinite Realities).
 *
 *  - welds the UV-seam duplicates into one closed surface
 *  - removes interior geometry (mouth bag, eye pockets) that would show through a
 *    transparent material: a triangle is kept only if it is visible from at least MIN_VIEWS of
 *    ~240 outside viewpoints (software z-buffer, ignoring views from below the open bust)
 *  - drops UVs/normals/material (normals are recomputed at load time)
 *
 * usage: node scripts/clean-head.mjs <LeePerrySmith.glb> public/models/head.glb
 */
import fs from 'node:fs';

const [src, dst] = process.argv.slice(2);
const buf = fs.readFileSync(src);
const jlen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jlen).toString());
const bin = buf.subarray(20 + jlen + 8);
const read = (ai, T, comps) => {
  const a = gltf.accessors[ai];
  const bv = gltf.bufferViews[a.bufferView];
  const off = bin.byteOffset + bv.byteOffset + (a.byteOffset || 0);
  return new T(bin.buffer.slice(off, off + a.count * comps * T.BYTES_PER_ELEMENT));
};
const prim = gltf.meshes[0].primitives[0];
const P0 = read(prim.attributes.POSITION, Float32Array, 3);
const I0 = read(prim.indices, gltf.accessors[prim.indices].componentType === 5125 ? Uint32Array : Uint16Array, 1);

// ---- weld ----
const map = new Map();
const remap = new Uint32Array(P0.length / 3);
const P = [];
for (let i = 0; i < P0.length / 3; i++) {
  const k = `${Math.round(P0[i * 3] * 1e4)},${Math.round(P0[i * 3 + 1] * 1e4)},${Math.round(P0[i * 3 + 2] * 1e4)}`;
  if (!map.has(k)) {
    map.set(k, P.length / 3);
    P.push(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]);
  }
  remap[i] = map.get(k);
}
const I = Array.from(I0, (i) => remap[i]);
const nt = I.length / 3;

// ---- visibility ----
const RES = 640;
let ext = 0;
for (const v of P) ext = Math.max(ext, Math.abs(v));
const hits = new Uint16Array(nt);
const MIN_VIEWS = 3; // must be seen from several directions: rejects surfaces glimpsed only through the lip line
const depth = new Float32Array(RES * RES);
const ids = new Int32Array(RES * RES);
const N = 600;
let views = 0;
for (let s = 0; s < N; s++) {
  // fibonacci sphere
  const y = 1 - (2 * (s + 0.5)) / N;
  if (y < -0.35) continue; // the bust is open underneath
  const r = Math.sqrt(1 - y * y);
  const phi = s * Math.PI * (3 - Math.sqrt(5));
  const d = [Math.cos(phi) * r, y, Math.sin(phi) * r];
  const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = [up[1] * d[2] - up[2] * d[1], up[2] * d[0] - up[0] * d[2], up[0] * d[1] - up[1] * d[0]];
  const ul = Math.hypot(...u);
  u.forEach((_, k) => (u[k] /= ul));
  const w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  depth.fill(-Infinity);
  ids.fill(-1);
  const proj = (i) => {
    const x = P[i * 3], yy = P[i * 3 + 1], z = P[i * 3 + 2];
    return [
      ((x * u[0] + yy * u[1] + z * u[2]) / ext * 0.5 + 0.5) * (RES - 1),
      ((x * w[0] + yy * w[1] + z * w[2]) / ext * 0.5 + 0.5) * (RES - 1),
      x * d[0] + yy * d[1] + z * d[2],
    ];
  };
  for (let t = 0; t < nt; t++) {
    const [a, b, c] = [proj(I[t * 3]), proj(I[t * 3 + 1]), proj(I[t * 3 + 2])];
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(RES - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(RES - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const l1 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
        const l2 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
        const l3 = 1 - l1 - l2;
        if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
        const z = l1 * a[2] + l2 * b[2] + l3 * c[2];
        const k = py * RES + px;
        if (z > depth[k]) {
          depth[k] = z;
          ids[k] = t;
        }
      }
  }
  const seen = new Set();
  for (const t of ids) if (t >= 0) seen.add(t);
  for (const t of seen) hits[t]++;
  views++;
}

const visible = Uint8Array.from(hits, (h) => (h >= MIN_VIEWS ? 1 : 0));

// keep visible triangles, then close pin-holes: a hidden triangle whose 3 neighbours are kept is kept too
const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const edges = new Map();
for (let t = 0; t < nt; t++)
  for (let e = 0; e < 3; e++) {
    const k = edgeKey(I[t * 3 + e], I[t * 3 + ((e + 1) % 3)]);
    (edges.get(k) ?? edges.set(k, []).get(k)).push(t);
  }
for (let pass = 0; pass < 3; pass++) {
  const add = [];
  for (let t = 0; t < nt; t++) {
    if (visible[t]) continue;
    let kept = 0;
    for (let e = 0; e < 3; e++)
      if (edges.get(edgeKey(I[t * 3 + e], I[t * 3 + ((e + 1) % 3)])).some((o) => o !== t && visible[o])) kept++;
    if (kept >= 2) add.push(t);
  }
  for (const t of add) visible[t] = 1;
}

const keepIdx = [];
for (let t = 0; t < nt; t++) if (visible[t]) keepIdx.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
// compact vertices
const vmap = new Map();
const outP = [];
const outI = keepIdx.map((i) => {
  if (!vmap.has(i)) {
    vmap.set(i, outP.length / 3);
    outP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  }
  return vmap.get(i);
});
console.log(`views ${views}; triangles ${nt} → ${outI.length / 3}; vertices ${P.length / 3} → ${outP.length / 3}`);

// ---- write GLB ----
const pos = Float32Array.from(outP);
const idx = outP.length / 3 > 65535 ? Uint32Array.from(outI) : Uint16Array.from(outI);
const pad4 = (n) => (n + 3) & ~3;
const posBytes = pos.byteLength, idxBytes = idx.byteLength;
const binOut = Buffer.alloc(pad4(posBytes) + pad4(idxBytes));
Buffer.from(pos.buffer).copy(binOut, 0);
Buffer.from(idx.buffer).copy(binOut, pad4(posBytes));
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i++) {
  min[i % 3] = Math.min(min[i % 3], pos[i]);
  max[i % 3] = Math.max(max[i % 3], pos[i]);
}
const json = {
  asset: { version: '2.0', generator: 'clean-head.mjs', copyright: 'Infinite, 3D Head Scan by Lee Perry-Smith (CC BY 3.0), www.triplegangers.com / ir-ltd.net' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Head' }],
  meshes: [{ name: 'Head', primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  buffers: [{ byteLength: binOut.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: pad4(posBytes), byteLength: idxBytes, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max },
    { bufferView: 1, componentType: idx instanceof Uint32Array ? 5125 : 5123, count: idx.length, type: 'SCALAR' },
  ],
};
let jsonBuf = Buffer.from(JSON.stringify(json));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binOut.length, 8);
const chunk = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
fs.writeFileSync(dst, Buffer.concat([header, chunk(jsonBuf.length, 0x4e4f534a), jsonBuf, chunk(binOut.length, 0x004e4942), binOut]));
console.log(`wrote ${dst} (${fs.statSync(dst).size} bytes)`);
