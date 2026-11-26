import * as THREE from 'three';

export type CraftSurfaceKind = 'wood' | 'ceramic' | 'metal' | 'fabric' | 'cord' | 'bamboo' | 'straw' | 'stone';
export type CraftSurfaceOptions = {
  kind: CraftSurfaceKind;
  /** Pattern frequency in geometry-local units; never advances with time. */
  scale?: number;
  strength?: number;
  /** Longitudinal wood direction in the part's geometry coordinates. */
  axis?: 'x' | 'y' | 'z';
};
type Surface = Required<CraftSurfaceOptions>;
const surfaces = new WeakMap<THREE.Material, Surface>();

function bounded(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback;
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
float craftWoodRingCoord(vec3 p) {
  vec3 w = p * vec3(0.85, 2.5, 2.5);
  vec2 wander = vec2(
    sin(p.x * 1.15 + 0.45) * 0.032 + (craftNoise(w) - 0.5) * 0.062,
    cos(p.x * 0.92 - 0.35) * 0.042 + (craftNoise(w + vec3(5.7, 2.3, 8.1)) - 0.5) * 0.062
  );
  vec2 radial = (p.yz - vec2(0.24, -0.13) + wander) * vec2(1.0, 0.92);
  return length(radial) + (craftNoise(p * vec3(2.2, 6.2, 6.2)) - 0.5) * 0.022;
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
  const body: Record<CraftSurfaceKind, string> = {
    wood: `
      float r = craftWoodRingCoord(p);
      float endMask = pow(abs(normalize(${normal}).x), 4.0);
      float ring = ${filtered ? 'craftWoodRing' : 'craftRawWoodRing'}(r * 102.0);
      float fiber = ${noise}(p * vec3(5.5, 42.0, 42.0));
      float macro = craftNoise(p * vec3(0.65, 3.0, 3.0)) - 0.5;
      return -ring * (0.68 + 0.14 * endMask) + fiber * (0.28 - 0.08 * endMask) + macro * 0.34 - endMask * 0.14;
    `,
    ceramic: `return ${noise}(p * 95.0) * 0.60 + (craftNoise(p * 9.0) - 0.5) * 0.22;`,
    metal: `return ${noise}(p * 72.0) * 0.35 + (craftNoise(p * 15.0) - 0.5) * 0.45;`,
    bamboo: `
      float fibers = ${filtered ? 'craftBambooStriation' : 'craftRawBambooStriation'}(p);
      float microFiber = ${noise}(p * vec3(2.4, 130.0, 130.0));
      float bundle = craftNoise(p * vec3(1.5, 58.0, 58.0)) - 0.5;
      float internode = sin(p.x * 6.283 + 0.35) * 0.32 + (craftNoise(p * vec3(2.4, 7.0, 7.0)) - 0.5) * 0.38;
      return fibers * 0.56 + microFiber * 0.48 + bundle * 0.48 + internode;
    `,
    straw: `return ${wave}(p.y * 205.0 + p.z * 75.0 + sin(p.x * 2.5) * 0.3) * 0.26
      + (craftNoise(p * vec3(3.0, 32.0, 12.0)) - 0.5) * 0.24;`,
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
    const varying = 'varying vec3 craftLocalPosition;\nvarying vec3 craftLocalNormal;\n';
    shader.vertexShader = varying + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      craftLocalPosition = transformed;
      craftLocalNormal = normal;
    `);
    shader.fragmentShader = '#define WBR_CRAFT_SURFACE\n' + varying + HEADER + pattern(surface) + '\n' + pattern(surface, false) + '\n' + shader.fragmentShader;
    const pigment = surface.kind === 'wood' ? .22 : surface.kind === 'bamboo' ? .22 : surface.kind === 'fabric' || surface.kind === 'cord' ? .17 : .08;
    const relief = surface.kind === 'wood' ? .00080 : surface.kind === 'bamboo' ? .00062 : surface.kind === 'fabric' || surface.kind === 'cord' ? .00065 : .0005;
    const frequency = { wood: 102, ceramic: 95, metal: 72, fabric: 310, cord: 235, bamboo: 240, straw: 205, stone: 80 }[surface.kind];
    const colorPatch = surface.kind === 'wood' ? `
      float craftWoodAmp = mix(craftStrength, sqrt(max(craftStrength, 0.0)), 0.42);
      float craftGrain = craftPattern() * craftWoodAmp;
      float craftLate = clamp(-craftGrain, 0.0, 1.0);
      float craftEarly = clamp(craftGrain, 0.0, 1.0);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.64, 0.51, 0.39), craftLate * 0.92);
      diffuseColor.rgb *= vec3(1.0) + craftEarly * vec3(0.18, 0.145, 0.105);
    ` : surface.kind === 'bamboo' ? `
      float craftBambooAmp = mix(craftStrength, sqrt(max(craftStrength, 0.0)), 0.44);
      float craftGrain = craftPattern() * craftBambooAmp;
      vec3 craftBambooTint = mix(vec3(0.84, 0.98, 0.91), vec3(1.14, 1.05, 0.83), clamp(craftGrain * 1.2 + 0.5, 0.0, 1.0));
      diffuseColor.rgb *= (1.0 + craftGrain * ${pigment}) * mix(vec3(1.0), craftBambooTint, 0.58);
    ` : `
      float craftGrain = craftPattern() * craftStrength;
      diffuseColor.rgb *= 1.0 + craftGrain * ${pigment};
    `;
    const roughnessDelta = surface.kind === 'wood' ? 'craftGrain * 0.14' : surface.kind === 'bamboo' ? '-craftGrain * 0.14' : 'craftGrain * 0.12';
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
    if (surface.kind === 'wood' || surface.kind === 'bamboo') {
      const knee = surface.kind === 'wood' ? '0.72' : '0.78';
      const headroom = surface.kind === 'wood' ? '0.25' : '0.20';
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 craftLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float craftPeak = max(craftLit.r, max(craftLit.g, craftLit.b));
        // Komorebi daylight skips ACES and clips linear > ~1.03; a C1 asymptotic
        // shoulder protects sunlit pale wood and waxy bamboo without greying or dulling midtones.
        if (craftPeak > ${knee}) {
          float craftExcess = craftPeak - ${knee};
          float craftTarget = ${knee} + ${headroom} * (craftExcess / (craftExcess + ${headroom}));
          outgoingLight = craftLit * (craftTarget / craftPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `);
    }
  };
  material.customProgramCacheKey = () => `${baseKey}|wbr-craft-v2:${surface.kind}:${surface.axis}`;
  material.needsUpdate = true;
}

/** Explicitly authored surface; pigment, maps and disposal stay with its scene. */
export function createCraftMaterial(parameters: THREE.MeshStandardMaterialParameters, options: CraftSurfaceOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: options.kind === 'metal' ? .42 : options.kind === 'ceramic' ? .55 : options.kind === 'bamboo' ? .50 : .9,
    metalness: options.kind === 'metal' ? .72 : 0, ...parameters });
  return applyCraftSurface(material, options);
}

/** Add detail without replacing an authored material, its optics or animated references. */
export function applyCraftSurface<T extends THREE.MeshStandardMaterial>(material: T, options: CraftSurfaceOptions): T {
  attach(material, { kind: options.kind, scale: bounded(options.scale, 1, .1, 8),
    strength: bounded(options.strength, .65, 0, 1), axis: options.axis ?? 'x' });
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
