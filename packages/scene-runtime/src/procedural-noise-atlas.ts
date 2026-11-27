import * as THREE from 'three';

export const PROCEDURAL_NOISE_ATLAS_SIZE = 256;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic 32-bit integer lattice hash in [0, 1). Zero Math.random(). */
function latticeHash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Smooth C1 periodic value noise with integer tile frequencies (fx, fy). */
function tileValueNoise(u: number, v: number, fx: number, fy: number, seed: number): number {
  const x = u * fx;
  const y = v * fy;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let tx = x - xi;
  let ty = y - yi;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const x0 = ((xi % fx) + fx) % fx;
  const x1 = (x0 + 1) % fx;
  const y0 = ((yi % fy) + fy) % fy;
  const y1 = (y0 + 1) % fy;
  const v00 = latticeHash(x0, y0, seed);
  const v10 = latticeHash(x1, y0, seed);
  const v01 = latticeHash(x0, y1, seed);
  const v11 = latticeHash(x1, y1, seed);
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}

/**
 * Generates deterministic, seamlessly tileable RGBA noise data:
 * - R: 4-octave tileable fBm (organic macro/mid mottling)
 * - G: high-frequency tileable mineral/clay grain
 * - B: wrapped Worley/Voronoi cellular edge distance (sqrt(d2) - sqrt(d1))
 * - A: tileable anisotropic streaks (fine along U, elongated along V)
 */
export function createProceduralNoiseAtlasData(
  size = PROCEDURAL_NOISE_ATLAS_SIZE,
  seed = 5,
): Uint8Array<ArrayBuffer> {
  const n = Math.max(8, Math.round(size));
  const data = new Uint8Array(new ArrayBuffer(n * n * 4));

  // 10x10 jittered toroidal feature grid for fast, even-coverage Worley cells.
  const grid = 10;
  const cellX = new Float32Array(grid * grid);
  const cellY = new Float32Array(grid * grid);
  for (let cy = 0; cy < grid; cy++) {
    for (let cx = 0; cx < grid; cx++) {
      const idx = cy * grid + cx;
      cellX[idx] = (cx + 0.14 + 0.72 * latticeHash(cx, cy, seed * 31 + 101)) / grid;
      cellY[idx] = (cy + 0.14 + 0.72 * latticeHash(cx, cy, seed * 31 + 211)) / grid;
    }
  }

  for (let j = 0; j < n; j++) {
    const v = j / n;
    const gcy = Math.floor(v * grid);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const gcx = Math.floor(u * grid);
      const offset = (j * n + i) * 4;

      // R: 4-octave periodic fBm
      const fbm =
        0.50 * tileValueNoise(u, v, 4, 4, seed + 1) +
        0.26 * tileValueNoise(u, v, 9, 9, seed + 2) +
        0.14 * tileValueNoise(u, v, 19, 19, seed + 3) +
        0.10 * tileValueNoise(u, v, 41, 41, seed + 4);

      // G: fine mineral/clay grain
      const grain =
        0.60 * tileValueNoise(u, v, 64, 64, seed + 5) +
        0.40 * tileValueNoise(u, v, 127, 127, seed + 6);

      // B: wrapped Worley cellular edge field sqrt(d2) - sqrt(d1)
      let d1 = 9;
      let d2 = 9;
      for (let oy = -1; oy <= 1; oy++) {
        const ny = (gcy + oy + grid) % grid;
        const rowOffset = ny * grid;
        for (let ox = -1; ox <= 1; ox++) {
          const nx = (gcx + ox + grid) % grid;
          const idx = rowOffset + nx;
          let dx = Math.abs(u - cellX[idx]);
          let dy = Math.abs(v - cellY[idx]);
          if (dx > 0.5) dx = 1 - dx;
          if (dy > 0.5) dy = 1 - dy;
          const distSq = dx * dx + dy * dy;
          if (distSq < d1) {
            d2 = d1;
            d1 = distSq;
          } else if (distSq < d2) {
            d2 = distSq;
          }
        }
      }
      const cells = clamp01((Math.sqrt(d2) - Math.sqrt(d1)) * 14);

      // A: anisotropic streaks (fine across U, elongated along V)
      const streaks =
        0.55 * tileValueNoise(u, v, 48, 3, seed + 7) +
        0.30 * tileValueNoise(u, v, 97, 5, seed + 8) +
        0.15 * tileValueNoise(u, v, 23, 2, seed + 9);

      data[offset] = Math.round(clamp01(fbm) * 255);
      data[offset + 1] = Math.round(clamp01(grain) * 255);
      data[offset + 2] = Math.round(cells * 255);
      data[offset + 3] = Math.round(clamp01(streaks) * 255);
    }
  }

  return data;
}

let cachedAtlas: THREE.DataTexture | null = null;

/**
 * Shared lazy singleton 256x256 seamless RGBA DataTexture for procedural craft
 * surfaces, plumes, and ripples. Never depends on DOM/Canvas2D.
 */
export function getProceduralNoiseAtlas(): THREE.DataTexture {
  if (cachedAtlas) return cachedAtlas;
  const data = createProceduralNoiseAtlasData(PROCEDURAL_NOISE_ATLAS_SIZE, 5);
  const texture = new THREE.DataTexture(
    data,
    PROCEDURAL_NOISE_ATLAS_SIZE,
    PROCEDURAL_NOISE_ATLAS_SIZE,
    THREE.RGBAFormat,
  );
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cachedAtlas = texture;
  return texture;
}

/**
 * Derivative-free GLSL triplanar sampler for the shared procedural noise atlas.
 * Safe to call inside unfiltered relief height functions as well as pigment shaders.
 */
export const NOISE_ATLAS_PARS = `
vec4 wbrAtlasTriplanar(sampler2D map, vec3 p, vec3 n) {
  vec3 an = abs(n);
  vec3 w = an * an;
  w *= w;
  w /= max(w.x + w.y + w.z, 1e-4);
  return texture2D(map, p.zy) * w.x
       + texture2D(map, p.xz) * w.y
       + texture2D(map, p.xy) * w.z;
}
`;
