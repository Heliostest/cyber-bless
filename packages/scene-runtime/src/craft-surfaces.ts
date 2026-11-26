import * as THREE from 'three';

export type CraftSurfaceKind = 'wood' | 'ceramic' | 'metal' | 'fabric' | 'cord' | 'bamboo' | 'straw' | 'stone';
export type CraftStrawPattern = 'stalk' | 'woven' | 'reed';
export type CraftSurfaceOptions = {
  kind: CraftSurfaceKind;
  /** Pattern frequency in geometry-local units; never advances with time. */
  scale?: number;
  strength?: number;
  /** Longitudinal grain/fiber direction in the part's geometry coordinates. */
  axis?: 'x' | 'y' | 'z';
  /** Optional straw fiber mode: longitudinal stalks (default), woven cane/mat, or fine reed. */
  pattern?: CraftStrawPattern;
};
type Surface = {
  kind: CraftSurfaceKind;
  scale: number;
  strength: number;
  axis: 'x' | 'y' | 'z';
  pattern?: CraftStrawPattern;
};
const surfaces = new WeakMap<THREE.Material, Surface>();

function bounded(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback;
}

function strawPattern(value: CraftStrawPattern | undefined): CraftStrawPattern {
  return value === 'woven' || value === 'reed' ? value : 'stalk';
}

// Original art-directed patterns. No external textures, UV requirements,
// additional render targets or animation clock. Attenuate subpixel oscillations
// before both pigment and relief, so thin grain does not crawl at small sizes.
const HEADER = `
uniform float craftScale;
uniform float craftStrength;
float craftHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float craftNoise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(craftHash(cell), craftHash(cell + vec3(1,0,0)), f.x),
    mix(craftHash(cell + vec3(0,1,0)), craftHash(cell + vec3(1,1,0)), f.x), f.y),
    mix(mix(craftHash(cell + vec3(0,0,1)), craftHash(cell + vec3(1,0,1)), f.x),
    mix(craftHash(cell + vec3(0,1,1)), craftHash(cell + vec3(1,1,1)), f.x), f.y), f.z);
}
float craftWave(float phase) {
  float footprint = fwidth(phase);
  return sin(phase) * exp(-0.5 * footprint * footprint);
}
float craftFineNoise(vec3 p) {
  float footprint = max(length(dFdx(p)), length(dFdy(p)));
  return (craftNoise(p) - 0.5) * (1.0 - smoothstep(0.5, 1.7, footprint));
}
float craftRawNoise(vec3 p) { return craftNoise(p) - 0.5; }
float craftWeave(vec2 p) {
  float warp = craftWave(p.x * 310.0), weft = craftWave(p.y * 310.0);
  return (warp + weft) * 0.28 + warp * weft * 0.30;
}
float craftRawWeave(vec2 p) {
  float warp = sin(p.x * 310.0), weft = sin(p.y * 310.0);
  return (warp + weft) * 0.28 + warp * weft * 0.30;
}
float craftWoodKnotField(vec3 p, vec2 faceNormalYZ, out vec2 deflectYZ, out float knotCore, out float knotHalo, out float knotPhase) {
  deflectYZ = vec2(0.0);
  // 3D cell-jittered sparse branch-cylinder lattice (2x2x2 neighborhood = 8 cells).
  // Jitter in [0.24, 0.76]^3 guarantees >= 0.74 cell margin (0.66 in X, 0.329 in YZ)
  // to unchecked cells so compact C2 deflection and knot eyes stay mathematically seamless.
  vec3 knotScale = vec3(1.12, 2.25, 2.25);
  vec3 q = p * knotScale;
  vec3 baseCell = floor(q - 0.5);
  float minDist = 4.0;
  for (int ix = 0; ix < 2; ix++) {
    for (int iy = 0; iy < 2; iy++) {
      for (int iz = 0; iz < 2; iz++) {
        vec3 cell = baseCell + vec3(float(ix), float(iy), float(iz));
        // Sparse probability gate combined with branch-orientation alignment keeps knots occasional
        // and natural (1-2 per hero board/timber), never a polka-dot grid.
        if (craftHash(cell + vec3(17.1, 31.7, 53.3)) > 0.62) continue;
        float ang = craftHash(cell + vec3(29.1, 11.3, 41.7)) * 6.2831853;
        vec2 branchDir = vec2(cos(ang), sin(ang));
        // Smoothly suppress grazing/parallel spike cuts and end-grain faces; show clean almond eyes
        // where a radial branch naturally pierces the wood surface.
        float align = abs(dot(faceNormalYZ, branchDir));
        float faceGate = smoothstep(0.36, 0.72, align);
        if (faceGate <= 0.001) continue;
        vec3 jitter = vec3(
          craftHash(cell + vec3(1.7, 9.2, 4.3)),
          craftHash(cell + vec3(8.3, 2.8, 6.1)),
          craftHash(cell + vec3(5.1, 7.4, 3.9))
        );
        vec3 knotPos = (cell + mix(vec3(0.24), vec3(0.76), jitter)) / knotScale;
        vec3 d = p - knotPos;
        if (dot(d, d) > 0.30) continue;
        float sizeRand = mix(0.82, 1.22, craftHash(cell + vec3(13.4, 21.2, 7.8)));
        vec2 branchPerp = vec2(-branchDir.y, branchDir.x);
        float alongB = dot(d.yz, branchDir);
        float acrossB = dot(d.yz, branchPerp);
        float rx = 0.115 * sizeRand;
        float ry = 0.044 * sizeRand;
        float rBranch = 0.24 * sizeRand;
        // Smooth radial streamline deflection: surrounding grain fibers visibly part around the eye.
        vec3 defU = vec3(d.x / (rx * 2.80), acrossB / (ry * 3.40), alongB / (rBranch * 1.10));
        float defR2 = dot(defU, defU);
        if (defR2 < 1.0) {
          float e = 1.0 - defR2;
          float env = e * e * e * faceGate;
          deflectYZ -= d.yz * (0.78 * env);
        }
        // Real tree branches are cylinders piercing across the board: cross-section stays crisp
        // through thin plaques/planks and fades smoothly past the branch cap.
        float u = d.x / rx;
        float v = acrossB / ry;
        float almond = 1.0 + 0.24 * (u * u) / (1.0 + u * u);
        float wobble = (craftNoise(p * 13.5 + cell * 3.7) - 0.5) * 0.14;
        float capLift = 1.55 * smoothstep(0.64, 1.0, abs(alongB) / rBranch);
        float dist = sqrt(u * u + (v * almond) * (v * almond) + 0.0025) + wobble + capLift + (1.0 - faceGate) * 1.60;
        minDist = min(minDist, dist);
      }
    }
  }
  knotCore = 1.0 - smoothstep(0.0, 0.90, minDist);
  knotHalo = (1.0 - smoothstep(0.46, 1.52, minDist)) * 0.32;
  knotPhase = minDist * 16.5;
  return 1.0 - smoothstep(0.66, 1.12, minDist);
}
float craftWoodRingCoord(vec3 p, vec3 seed, vec2 deflectYZ, out vec2 flowYZ) {
  float px = p.x + seed.x * 2.35;
  // Per-mesh saw-cut angle creates gentle sweeping cathedral arches across flat boards.
  vec2 baseYZ = p.yz + vec2(p.x * (0.085 + seed.z * 0.085), p.x * (-0.065 + seed.y * 0.075));
  flowYZ = baseYZ + deflectYZ;
  vec2 pithYZ = vec2(0.14, -0.18) + seed.yz * vec2(0.26, 0.14);
  // Multi-scale organic longitudinal S-curves + 3D domain warp (breaks all mechanical straightness).
  vec3 warpA = vec3(px * 1.15, flowYZ.x * 1.85, flowYZ.y * 1.85);
  vec3 warpB = vec3(px * 2.55, flowYZ.x * 3.80, flowYZ.y * 3.80);
  vec2 sCurve = vec2(
    sin(px * 2.45 + 0.55) * 0.145 + sin(px * 1.15 - 1.15) * 0.115,
    cos(px * 2.05 + 1.30) * 0.155 + sin(px * 1.05 + 0.45) * 0.110
  );
  vec2 nWarp = vec2(
    (craftNoise(warpA + vec3(1.3, 4.7, 2.1)) - 0.5) * 0.38 + (craftNoise(warpB + vec3(3.5, 9.2, 5.1)) - 0.5) * 0.13,
    (craftNoise(warpA + vec3(7.9, 1.1, 6.4)) - 0.5) * 0.38 + (craftNoise(warpB + vec3(8.1, 3.8, 1.7)) - 0.5) * 0.13
  );
  vec2 radial = (flowYZ - pithYZ + sCurve + nWarp) * vec2(1.0, 0.88);
  float rBase = length(radial);
  // Organic ring-width variation so bands breathe wider and narrower naturally.
  float widthDrift = (craftNoise(vec3(px * 0.85, radial.x * 3.0, radial.y * 3.0) + vec3(4.2, 1.9, 7.3)) - 0.5) * 0.18
                   + sin(rBase * 15.0 + craftNoise(vec3(px * 1.20, radial * 2.4)) * 3.2) * 0.026;
  return rBase + widthDrift + (craftNoise(vec3(px * 2.6, flowYZ * 6.4)) - 0.5) * 0.018;
}
float craftWoodRing(float phase) {
  float f = fwidth(phase);
  // Analytic per-harmonic Gaussian AA fades toward the zero mean instead of
  // collapsing below a smoothstep floor at medium distance.
  float a1 = exp(-0.42 * f * f);
  float a2 = exp(-1.68 * f * f);
  // Asymmetric growth ring: broad warm earlywood rising into a narrower latewood band.
  return 0.68 * cos(phase) * a1 + 0.24 * cos(2.0 * phase - 0.55) * a2;
}
float craftRawWoodRing(float phase) {
  return 0.68 * cos(phase) + 0.24 * cos(2.0 * phase - 0.55);
}
float craftBambooWave(float phase) {
  float f = fwidth(phase);
  return sin(phase) * exp(-0.34 * f * f);
}
float craftBambooStriation(vec3 p) {
  float drift = sin(p.x * 2.0) * 0.20 + (craftNoise(p * vec3(1.6, 14.0, 14.0)) - 0.5) * 0.45;
  float f1 = craftBambooWave(p.y * 215.0 + p.z * 108.0 + drift);
  float f2 = craftBambooWave(p.z * 215.0 - p.y * 108.0 - drift);
  return (f1 + f2) * 0.5;
}
float craftRawBambooStriation(vec3 p) {
  float drift = sin(p.x * 2.0) * 0.20 + (craftNoise(p * vec3(1.6, 14.0, 14.0)) - 0.5) * 0.45;
  float f1 = sin(p.y * 215.0 + p.z * 108.0 + drift);
  float f2 = sin(p.z * 215.0 - p.y * 108.0 - drift);
  return (f1 + f2) * 0.5;
}
float craftStrawWave(float phase) {
  float f = fwidth(phase);
  // Gentler analytic Gaussian AA than craftWave so golden straw strands remain
  // legible on slender stalks while smoothly converging to zero mean at distance.
  return sin(phase) * exp(-0.30 * f * f);
}
float craftStrawCos(float phase) {
  float f = fwidth(phase);
  return cos(phase) * exp(-0.32 * f * f);
}
float craftStrawStalkField(vec3 p, vec3 nNorm, vec3 seed, float ribFreq, float nodeFreq, float nodeWeight, out float nodeRing, out float hueShift) {
  float px = p.x + seed.x * 0.42;
  vec2 crossYZ = p.yz + seed.yz * 0.14;
  float meander = sin(px * 2.6 + seed.y * 2.1) * 0.18 + (craftNoise(vec3(px * 1.4, crossYZ * 9.0)) - 0.5) * 0.36;
  // Dual orthogonal cross-sectional flutes keep split golden fibers legible around full stalk circumference.
  float f1 = craftStrawWave(crossYZ.x * ribFreq + crossYZ.y * (ribFreq * 0.5) + meander);
  float f2 = craftStrawWave(crossYZ.y * ribFreq - crossYZ.x * (ribFreq * 0.5) - meander * 0.85);
  float f3 = craftStrawWave(crossYZ.x * (ribFreq * 1.56) - crossYZ.y * (ribFreq * 0.78) + meander * 1.25 + 0.8);
  float strands = (craftNoise(vec3(px * 1.1, crossYZ * 26.0)) - 0.5) * 0.36;
  float fineSplit = craftFineNoise(vec3(px * 2.4, crossYZ * 86.0));
  float stalkFibers = (f1 + f2) * 0.44 + f3 * 0.18 + strands + fineSplit * 0.20;
  // Slim botanical culm nodes and soft internode tonal sweep staggered per stalk.
  float nodeJitter = (craftNoise(vec3(0.7, crossYZ * 4.2)) - 0.5) * 3.6;
  float nodePhase = px * nodeFreq + nodeJitter;
  float nodeWave = craftStrawCos(nodePhase);
  float rawNode = smoothstep(0.80, 0.995, nodeWave) * nodeWeight;
  float internode = craftStrawWave(nodePhase - 0.95) * 0.18;
  // Flat faces perpendicular to the stalk axis (e.g. horizontal bundled straw discs)
  // transition smoothly into packed planar straw strands with gentle cross-lashing.
  float capMask = pow(abs(nNorm.x), 4.0);
  float matWarp = (craftNoise(vec3(px * 1.3, crossYZ.x * 9.0, crossYZ.y * 4.2)) - 0.5) * 0.42;
  float matFibers = craftStrawWave(crossYZ.x * (ribFreq * 0.96) + matWarp) * 0.62
                  + craftStrawWave(crossYZ.x * (ribFreq * 1.56) - matWarp * 0.75 + 0.9) * 0.18
                  + (craftNoise(vec3(px * 1.1, crossYZ.x * 32.0, crossYZ.y * 4.5)) - 0.5) * 0.44;
  float matLash = craftStrawWave(crossYZ.y * 44.0 + sin(crossYZ.x * 8.0) * 0.22) * 0.22;
  float capField = matFibers + matLash;
  nodeRing = rawNode * (1.0 - capMask);
  float macroWarmth = (craftNoise(vec3(px * 1.2, crossYZ * 4.2)) - 0.5) * 1.15;
  hueShift = clamp(macroWarmth + seed.y * 0.46 + internode * 0.55 * (1.0 - capMask), -1.0, 1.0);
  return mix(stalkFibers + internode - rawNode * 0.12, capField, capMask);
}
float craftRawStrawStalkField(vec3 p, vec3 nNorm, vec3 seed, float ribFreq, float nodeFreq, float nodeWeight) {
  float px = p.x + seed.x * 0.42;
  vec2 crossYZ = p.yz + seed.yz * 0.14;
  float meander = sin(px * 2.6 + seed.y * 2.1) * 0.18 + (craftNoise(vec3(px * 1.4, crossYZ * 9.0)) - 0.5) * 0.36;
  float f1 = sin(crossYZ.x * ribFreq + crossYZ.y * (ribFreq * 0.5) + meander);
  float f2 = sin(crossYZ.y * ribFreq - crossYZ.x * (ribFreq * 0.5) - meander * 0.85);
  float f3 = sin(crossYZ.x * (ribFreq * 1.56) - crossYZ.y * (ribFreq * 0.78) + meander * 1.25 + 0.8);
  float strands = (craftNoise(vec3(px * 1.1, crossYZ * 26.0)) - 0.5) * 0.36;
  float fineSplit = craftRawNoise(vec3(px * 2.4, crossYZ * 86.0));
  float stalkFibers = (f1 + f2) * 0.44 + f3 * 0.18 + strands + fineSplit * 0.20;
  float nodeJitter = (craftNoise(vec3(0.7, crossYZ * 4.2)) - 0.5) * 3.6;
  float nodePhase = px * nodeFreq + nodeJitter;
  float rawNode = smoothstep(0.80, 0.995, cos(nodePhase)) * nodeWeight;
  float internode = sin(nodePhase - 0.95) * 0.18;
  float capMask = pow(abs(nNorm.x), 4.0);
  float matWarp = (craftNoise(vec3(px * 1.3, crossYZ.x * 9.0, crossYZ.y * 4.2)) - 0.5) * 0.42;
  float matFibers = sin(crossYZ.x * (ribFreq * 0.96) + matWarp) * 0.62
                  + sin(crossYZ.x * (ribFreq * 1.56) - matWarp * 0.75 + 0.9) * 0.18
                  + (craftNoise(vec3(px * 1.1, crossYZ.x * 32.0, crossYZ.y * 4.5)) - 0.5) * 0.44;
  float matLash = sin(crossYZ.y * 44.0 + sin(crossYZ.x * 8.0) * 0.22) * 0.22;
  return mix(stalkFibers + internode - rawNode * 0.12, matFibers + matLash, capMask);
}
float craftWovenReedPlane(vec2 uv, out float crevice, out float stripHue) {
  vec2 wuv = uv + vec2(sin(uv.y * 7.5), cos(uv.x * 7.5)) * 0.004;
  float uPhase = wuv.x * 44.0;
  float vPhase = wuv.y * 44.0;
  float checker = craftStrawWave(uPhase * 0.5) * craftStrawWave(vPhase * 0.5);
  float warpDom = smoothstep(-0.22, 0.22, checker);
  float warpCrown = -craftStrawCos(uPhase);
  float weftCrown = -craftStrawCos(vPhase);
  float crown = mix(weftCrown, warpCrown, warpDom);
  float warpFiber = craftStrawWave(wuv.x * 165.0 + sin(wuv.y * 4.0) * 0.25);
  float weftFiber = craftStrawWave(wuv.y * 165.0 + sin(wuv.x * 4.0) * 0.25);
  float stripGrain = mix(weftFiber, warpFiber, warpDom) * 0.26;
  float arch = abs(checker);
  crevice = clamp(0.48 - arch, 0.0, 0.48) * 1.85;
  stripHue = (warpDom - 0.5) * 0.9;
  return crown * 0.38 + (arch - 0.44) * 0.72 + stripGrain;
}
float craftRawWovenReedPlane(vec2 uv) {
  vec2 wuv = uv + vec2(sin(uv.y * 7.5), cos(uv.x * 7.5)) * 0.004;
  float uPhase = wuv.x * 44.0;
  float vPhase = wuv.y * 44.0;
  float checker = sin(uPhase * 0.5) * sin(vPhase * 0.5);
  float warpDom = smoothstep(-0.22, 0.22, checker);
  float crown = mix(-cos(vPhase), -cos(uPhase), warpDom);
  float warpFiber = sin(wuv.x * 165.0 + sin(wuv.y * 4.0) * 0.25);
  float weftFiber = sin(wuv.y * 165.0 + sin(wuv.x * 4.0) * 0.25);
  return crown * 0.38 + (abs(checker) - 0.44) * 0.72 + mix(weftFiber, warpFiber, warpDom) * 0.26;
}
float craftStrawWovenField(vec3 p, vec3 nNorm, vec3 seed, out float crevice, out float hueShift) {
  vec3 sp = p + seed * 0.18;
  vec3 w = pow(abs(nNorm), vec3(4.0));
  w /= max(dot(w, vec3(1.0)), 0.001);
  float c0, c1, c2, h0, h1, h2;
  float v0 = craftWovenReedPlane(sp.yz, c0, h0);
  float v1 = craftWovenReedPlane(sp.xz, c1, h1);
  float v2 = craftWovenReedPlane(sp.xy, c2, h2);
  crevice = dot(vec3(c0, c1, c2), w);
  float macroWarmth = (craftNoise(sp * 4.2) - 0.5) * 1.1;
  hueShift = clamp(dot(vec3(h0, h1, h2), w) * 0.55 + macroWarmth + seed.y * 0.35, -1.0, 1.0);
  return dot(vec3(v0, v1, v2), w) + (craftNoise(sp * 16.0) - 0.5) * 0.24;
}
float craftRawStrawWovenField(vec3 p, vec3 nNorm, vec3 seed) {
  vec3 sp = p + seed * 0.18;
  vec3 w = pow(abs(nNorm), vec3(4.0));
  w /= max(dot(w, vec3(1.0)), 0.001);
  return dot(vec3(
    craftRawWovenReedPlane(sp.yz),
    craftRawWovenReedPlane(sp.xz),
    craftRawWovenReedPlane(sp.xy)
  ), w) + (craftNoise(sp * 16.0) - 0.5) * 0.24;
}
vec3 craftReliefNormal(vec3 baseNormal, vec3 surfacePosition, float height, float visibility) {
  vec3 dx = dFdx(surfacePosition), dy = dFdy(surfacePosition);
  vec2 heightGradient = vec2(dFdx(height), dFdy(height));
  vec3 acrossX = cross(dy, baseNormal), acrossY = cross(baseNormal, dx);
  float determinant = dot(dx, acrossX);
  // Degenerate/subpixel triangles retain their authored geometry normal.
  if (abs(determinant) < 1e-10) return baseNormal;
  vec3 gradient = sign(determinant) * (heightGradient.x * acrossX + heightGradient.y * acrossY);
  return normalize(abs(determinant) * baseNormal - gradient * visibility);
}
`;

function pattern(surface: Surface, filtered = true) {
  const coordinate = surface.axis === 'y' ? 'craftLocalPosition.yxz' : surface.axis === 'z' ? 'craftLocalPosition.zyx' : 'craftLocalPosition';
  const normal = surface.axis === 'y' ? 'craftLocalNormal.yxz' : surface.axis === 'z' ? 'craftLocalNormal.zyx' : 'craftLocalNormal';
  const wave = filtered ? 'craftWave' : 'sin';
  const noise = filtered ? 'craftFineNoise' : 'craftRawNoise';
  const weave = filtered ? 'craftWeave' : 'craftRawWeave';
  if (surface.kind === 'wood') {
    const woodBody = `
      vec3 s = craftMeshSeed;
      float px = p.x + s.x * 2.35;
      vec2 baseYZ = p.yz + vec2(p.x * (0.085 + s.z * 0.085), p.x * (-0.065 + s.y * 0.075));
      vec3 pKnot = vec3(px, baseYZ + s.yz * 0.72);
      vec3 nNorm = normalize(${normal});
      vec2 deflectYZ;
      float knotCore, knotHalo, knotPhase;
      float knotMask = craftWoodKnotField(pKnot, nNorm.yz, deflectYZ, knotCore, knotHalo, knotPhase);
      float endMask = pow(abs(nNorm.x), 4.0);
      vec2 flowYZ;
      float r = craftWoodRingCoord(p, s, deflectYZ, flowYZ);
      float ringWeight = mix(0.62, 1.28, craftNoise(vec3(r * 9.5, px * 0.42, s.x * 2.5 + 3.1)));
      float ring = ${filtered ? 'craftWoodRing' : 'craftRawWoodRing'}(r * 74.0) * ringWeight;
      float knotRing = ${filtered ? 'craftWoodRing' : 'craftRawWoodRing'}(knotPhase);
      float combinedRing = mix(ring, knotRing * 0.94 + 0.42 * knotCore, knotMask);
      float fiber = ${noise}(vec3(px * 4.8, flowYZ * 38.0));
      float macro = craftNoise(vec3(px * 0.55, flowYZ * 2.4)) - 0.5;
      ${filtered ? 'craftKnotAmber = max(knotCore, knotHalo);' : ''}
      return -combinedRing * (0.72 + 0.14 * endMask) + fiber * (0.24 - 0.08 * endMask) * (1.0 - knotMask * 0.65) + macro * 0.38 - endMask * 0.14 - knotCore * 0.34;
    `;
    if (filtered) {
      return `float craftWoodPattern(out float craftKnotAmber) { vec3 p = ${coordinate} * craftScale; ${woodBody} }\nfloat craftPattern() { float craftUnusedAmber = 0.0; return craftWoodPattern(craftUnusedAmber); }`;
    }
    return `float craftHeightPattern() { vec3 p = ${coordinate} * craftScale; ${woodBody} }`;
  }
  if (surface.kind === 'straw') {
    const mode = strawPattern(surface.pattern);
    if (mode === 'woven') {
      if (filtered) {
        return `float craftStrawPattern(out float craftStrawAccent, out float craftStrawHue) {
      vec3 p = ${coordinate} * craftScale;
      vec3 nNorm = normalize(${normal});
      return craftStrawWovenField(p, nNorm, craftStrawSeed, craftStrawAccent, craftStrawHue);
    }
    float craftPattern() { float a = 0.0, h = 0.0; return craftStrawPattern(a, h); }`;
      }
      return `float craftHeightPattern() {
      vec3 p = ${coordinate} * craftScale;
      vec3 nNorm = normalize(${normal});
      return craftRawStrawWovenField(p, nNorm, craftStrawSeed);
    }`;
    }
    const ribFreq = mode === 'reed' ? '164.0' : '136.0';
    const nodeFreq = mode === 'reed' ? '13.5' : '21.0';
    const nodeWeight = mode === 'reed' ? '0.58' : '1.0';
    if (filtered) {
      return `float craftStrawPattern(out float craftStrawAccent, out float craftStrawHue) {
      vec3 p = ${coordinate} * craftScale;
      vec3 nNorm = normalize(${normal});
      return craftStrawStalkField(p, nNorm, craftStrawSeed, ${ribFreq}, ${nodeFreq}, ${nodeWeight}, craftStrawAccent, craftStrawHue);
    }
    float craftPattern() { float a = 0.0, h = 0.0; return craftStrawPattern(a, h); }`;
    }
    return `float craftHeightPattern() {
      vec3 p = ${coordinate} * craftScale;
      vec3 nNorm = normalize(${normal});
      return craftRawStrawStalkField(p, nNorm, craftStrawSeed, ${ribFreq}, ${nodeFreq}, ${nodeWeight});
    }`;
  }
  const body: Record<Exclude<CraftSurfaceKind, 'wood' | 'straw'>, string> = {
    ceramic: `return ${noise}(p * 95.0) * 0.60 + (craftNoise(p * 9.0) - 0.5) * 0.22;`,
    metal: `return ${noise}(p * 72.0) * 0.35 + (craftNoise(p * 15.0) - 0.5) * 0.45;`,
    bamboo: `
      float fibers = ${filtered ? 'craftBambooStriation' : 'craftRawBambooStriation'}(p);
      float microFiber = ${noise}(p * vec3(2.4, 130.0, 130.0));
      float bundle = craftNoise(p * vec3(1.5, 58.0, 58.0)) - 0.5;
      float internode = sin(p.x * 6.283 + 0.35) * 0.32 + (craftNoise(p * vec3(2.4, 7.0, 7.0)) - 0.5) * 0.38;
      return fibers * 0.56 + microFiber * 0.48 + bundle * 0.48 + internode;
    `,
    stone: `return ${noise}(p * 80.0) * 0.24 + (craftNoise(p * 12.0) - 0.5) * 0.42;`,
    fabric: `
      vec3 weights = pow(abs(normalize(craftLocalNormal)), vec3(4.0));
      weights /= max(dot(weights, vec3(1.0)), 0.001);
      return dot(vec3(${weave}(p.yz), ${weave}(p.xz), ${weave}(p.xy)), weights);
    `,
    cord: `
      vec3 weights = pow(abs(normalize(craftLocalNormal)), vec3(4.0));
      weights /= max(dot(weights, vec3(1.0)), 0.001);
      return dot(vec3(${wave}((p.y + p.z) * 235.0), ${wave}((p.x + p.z) * 235.0),
        ${wave}((p.x + p.y) * 235.0)), weights) * 0.55;
    `,
  };
  return `float ${filtered ? 'craftPattern' : 'craftHeightPattern'}() { vec3 p = ${coordinate} * craftScale; ${body[surface.kind]} }`;
}

function attach(material: THREE.Material, surface: Surface) {
  if (surfaces.has(material)) return;
  surfaces.set(material, surface);
  material.userData.craftSurface = { ...surface };
  const before = material.onBeforeCompile, baseKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    before.call(this, shader, renderer);
    if (shader.fragmentShader.includes('#define WBR_CRAFT_SURFACE')) return;
    shader.uniforms.craftScale = { value: surface.scale };
    shader.uniforms.craftStrength = { value: surface.strength };
    const isWood = surface.kind === 'wood';
    const isStraw = surface.kind === 'straw';
    const strawMode = isStraw ? strawPattern(surface.pattern) : undefined;
    const varying = `varying vec3 craftLocalPosition;\nvarying vec3 craftLocalNormal;\n${isWood ? 'varying vec3 craftMeshSeed;\n' : isStraw ? 'varying vec3 craftStrawSeed;\n' : ''}`;
    const seedVertex = isWood ? `
      vec3 craftOrigin = modelMatrix[3].xyz;
      #ifdef USE_INSTANCING
        craftOrigin += (modelMatrix * vec4(instanceMatrix[3].xyz, 0.0)).xyz;
      #endif
      // Smooth, asymmetric per-mesh phase/seed in [-1, 1]^3 from world translation:
      // adjacent boards/posts/planks get distinct grain phase and knots without motion strobing.
      craftMeshSeed = vec3(
        sin(dot(craftOrigin, vec3(4.17, 2.83, 5.13)) + 0.71) * 0.65 + sin(dot(craftOrigin, vec3(-2.41, 6.19, 3.37)) + 2.34) * 0.35,
        sin(dot(craftOrigin, vec3(3.29, -4.71, 4.61)) + 1.93) * 0.65 + sin(dot(craftOrigin, vec3(5.83, 2.11, -3.79)) + 0.47) * 0.35,
        sin(dot(craftOrigin, vec3(-5.03, 3.67, 2.93)) + 3.41) * 0.65 + sin(dot(craftOrigin, vec3(2.77, -4.39, 5.57)) + 4.89) * 0.35
      );
    ` : isStraw ? `
      vec3 craftOrigin = modelMatrix[3].xyz;
      vec3 craftBasisX = modelMatrix[0].xyz;
      vec3 craftBasisY = modelMatrix[1].xyz;
      #ifdef USE_INSTANCING
        craftOrigin += (modelMatrix * vec4(instanceMatrix[3].xyz, 0.0)).xyz;
        craftBasisX = (modelMatrix * vec4(instanceMatrix[0].xyz, 0.0)).xyz;
        craftBasisY = (modelMatrix * vec4(instanceMatrix[1].xyz, 0.0)).xyz;
      #endif
      // Smooth per-stalk phase/hue seed in [-1, 1]^3 from mesh orientation and gentle
      // world position so adjacent stalks vary organically without motion strobing.
      craftStrawSeed = vec3(
        sin(dot(craftOrigin, vec3(7.13, 4.37, 6.29)) + dot(craftBasisX, vec3(3.11, -2.47, 4.19)) + 0.53) * 0.65 + sin(dot(craftBasisY, vec3(-4.23, 5.17, 2.89)) + 1.87) * 0.35,
        sin(dot(craftOrigin, vec3(-5.71, 6.43, 3.89)) + dot(craftBasisY, vec3(2.93, 4.11, -3.67)) + 2.14) * 0.65 + sin(dot(craftBasisX, vec3(4.61, 1.97, -5.03)) + 0.91) * 0.35,
        sin(dot(craftOrigin, vec3(4.87, -3.91, 7.61)) + dot(craftBasisX + craftBasisY, vec3(-2.71, 3.83, 2.39)) + 3.41) * 0.65 + sin(dot(craftOrigin, vec3(-3.19, 5.29, -4.13)) + 4.72) * 0.35
      );
    ` : '';
    shader.vertexShader = varying + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      craftLocalPosition = transformed;
      craftLocalNormal = normal;
      ${seedVertex}
    `);
    shader.fragmentShader = '#define WBR_CRAFT_SURFACE\n' + varying + HEADER + pattern(surface) + '\n' + pattern(surface, false) + '\n' + shader.fragmentShader;
    const pigment = surface.kind === 'wood' ? .22 : surface.kind === 'bamboo' ? .22 : surface.kind === 'straw' ? .22 : surface.kind === 'fabric' || surface.kind === 'cord' ? .17 : .08;
    const relief = surface.kind === 'wood' ? .00080 : surface.kind === 'bamboo' ? .00062 : surface.kind === 'straw' ? (strawMode === 'woven' ? .00078 : .00072) : surface.kind === 'fabric' || surface.kind === 'cord' ? .00065 : .0005;
    const frequency = surface.kind === 'straw'
      ? (strawMode === 'woven' ? 96 : strawMode === 'reed' ? 164 : 136)
      : { wood: 74, ceramic: 95, metal: 72, fabric: 310, cord: 235, bamboo: 240, stone: 80 }[surface.kind];
    const colorPatch = surface.kind === 'wood' ? `
      float craftWoodAmp = mix(craftStrength, sqrt(max(craftStrength, 0.0)), 0.42);
      float craftKnotAmber = 0.0;
      float craftGrain = craftWoodPattern(craftKnotAmber) * craftWoodAmp;
      float craftLate = clamp(-craftGrain, 0.0, 1.0);
      float craftEarly = clamp(craftGrain, 0.0, 1.0);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.64, 0.51, 0.39), craftLate * 0.92);
      diffuseColor.rgb *= vec3(1.0) + craftEarly * vec3(0.18, 0.145, 0.105);
      // Soft warm dark-amber deepening inside sparse stylized wood knots (木眼).
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.54, 0.36, 0.22), clamp(craftKnotAmber * mix(craftWoodAmp, 1.0, 0.25), 0.0, 1.0) * 0.84);
      diffuseColor.rgb *= 1.0 + craftMeshSeed.y * 0.025 * craftStrength;
    ` : surface.kind === 'bamboo' ? `
      float craftBambooAmp = mix(craftStrength, sqrt(max(craftStrength, 0.0)), 0.44);
      float craftGrain = craftPattern() * craftBambooAmp;
      vec3 craftBambooTint = mix(vec3(0.84, 0.98, 0.91), vec3(1.14, 1.05, 0.83), clamp(craftGrain * 1.2 + 0.5, 0.0, 1.0));
      diffuseColor.rgb *= (1.0 + craftGrain * ${pigment}) * mix(vec3(1.0), craftBambooTint, 0.58);
    ` : surface.kind === 'straw' ? `
      float craftStrawAmp = mix(craftStrength, sqrt(max(craftStrength, 0.0)), 0.46);
      float craftStrawAccent = 0.0;
      float craftStrawHue = 0.0;
      float craftGrain = craftStrawPattern(craftStrawAccent, craftStrawHue) * craftStrawAmp;
      float craftStrawFurrow = clamp(-craftGrain, 0.0, 1.0);
      float craftStrawRidge = clamp(craftGrain, 0.0, 1.0);
      // Warm toasted wheat-ochre grooves and sunlit honey-cream ridges keep dry straw painterly and calm.
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.68, 0.57, 0.39), craftStrawFurrow * 0.86);
      diffuseColor.rgb *= vec3(1.0) + craftStrawRidge * vec3(0.24, 0.21, 0.125);
      // Botanical culm node collar (stalk/reed) or warm under-tuck recess (woven cane).
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.73, 0.59, 0.39), clamp(craftStrawAccent * craftStrawAmp * 1.15, 0.0, 1.0) * 0.56);
      // Gentle dry-olive to sun-ripened wheat-gold hue micro-shift across stalks and bundles.
      vec3 craftStrawTint = mix(vec3(0.96, 1.00, 0.88), vec3(1.08, 1.01, 0.83), clamp(craftStrawHue * 0.5 + 0.5, 0.0, 1.0));
      diffuseColor.rgb *= mix(vec3(1.0), craftStrawTint, clamp(craftStrawAmp * 0.72, 0.0, 0.68));
      diffuseColor.rgb *= 1.0 + craftStrawSeed.z * 0.042 * craftStrawAmp;
    ` : `
      float craftGrain = craftPattern() * craftStrength;
      diffuseColor.rgb *= 1.0 + craftGrain * ${pigment};
    `;
    const roughnessDelta = surface.kind === 'wood' ? 'craftGrain * 0.14' : surface.kind === 'bamboo' ? '-craftGrain * 0.14' : surface.kind === 'straw' ? '(-craftGrain * 0.20 + craftStrawAccent * craftStrawAmp * 0.20)' : 'craftGrain * 0.12';
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      ${colorPatch}
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + ${roughnessDelta}, 0.16, 1.0);
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      // Differentiate an unfiltered height, then attenuate its gradient. Taking
      // derivatives of craftGrain would imply undefined higher derivatives.
      float craftHeight = craftHeightPattern() * craftStrength * ${relief};
      float craftFootprint = max(length(dFdx(craftLocalPosition)), length(dFdy(craftLocalPosition))) * craftScale * ${frequency.toFixed(1)};
      float craftVisibility = exp(-0.5 * craftFootprint * craftFootprint);
      normal = craftReliefNormal(normal, -vViewPosition, craftHeight, craftVisibility);
    `);
    if (surface.kind === 'wood' || surface.kind === 'bamboo' || surface.kind === 'straw') {
      const knee = surface.kind === 'wood' ? '0.72' : surface.kind === 'bamboo' ? '0.78' : '0.70';
      const headroom = surface.kind === 'wood' ? '0.25' : surface.kind === 'bamboo' ? '0.20' : '0.26';
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 craftLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float craftPeak = max(craftLit.r, max(craftLit.g, craftLit.b));
        // Komorebi daylight skips ACES and clips linear > ~1.03; a C1 asymptotic
        // shoulder protects sunlit pale wood, waxy bamboo and pale dry straw without greying midtones.
        if (craftPeak > ${knee}) {
          float craftExcess = craftPeak - ${knee};
          float craftTarget = ${knee} + ${headroom} * (craftExcess / (craftExcess + ${headroom}));
          outgoingLight = craftLit * (craftTarget / craftPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `);
    }
  };
  const patternKey = surface.kind === 'straw' ? `:${strawPattern(surface.pattern)}` : '';
  material.customProgramCacheKey = () => `${baseKey}|wbr-craft-v4:${surface.kind}:${surface.axis}${patternKey}`;
  material.needsUpdate = true;
}

/** Explicitly authored surface; pigment, maps and disposal stay with its scene. */
export function createCraftMaterial(parameters: THREE.MeshStandardMaterialParameters, options: CraftSurfaceOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: options.kind === 'metal' ? .42 : options.kind === 'ceramic' ? .55 : options.kind === 'bamboo' ? .50 : options.kind === 'straw' ? .72 : .9,
    metalness: options.kind === 'metal' ? .72 : 0, ...parameters });
  return applyCraftSurface(material, options);
}

/** Add detail without replacing an authored material, its optics or animated references. */
export function applyCraftSurface<T extends THREE.MeshStandardMaterial>(material: T, options: CraftSurfaceOptions): T {
  const normalized: Surface = {
    kind: options.kind,
    scale: bounded(options.scale, 1, .1, 8),
    strength: bounded(options.strength, .65, 0, 1),
    axis: options.axis ?? 'x',
    ...(options.kind === 'straw' ? { pattern: strawPattern(options.pattern) } : {}),
  };
  attach(material, normalized);
  return material;
}

export function hasCraftFinish(material: THREE.Material): boolean {
  const kind = surfaces.get(material)?.kind;
  return kind === 'ceramic' || kind === 'metal';
}

/** Material.clone omits shader hooks; reconstruct the patch on styled materials. */
export function copyCraftSurface(source: THREE.Material, target: THREE.Material): void {
  const surface = surfaces.get(source);
  if (surface) attach(target, surface);
}
