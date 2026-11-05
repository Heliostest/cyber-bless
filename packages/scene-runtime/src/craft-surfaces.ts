import * as THREE from 'three';

export type CraftSurfaceKind = 'wood' | 'ceramic' | 'metal' | 'fabric' | 'cord';
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
      float warp = sin(p.x * 2.6 + p.z * 2.0) * 1.6 + craftNoise(p * vec3(2.0, 8.0, 2.0)) * 1.4;
      float side = smoothstep(0.45, 0.88, ${wave}(p.y * 100.0 + p.z * 34.0 + warp));
      float end = smoothstep(0.45, 0.88, ${wave}(length(p.yz * vec2(0.8, 1.0)) * 100.0 + warp));
      float grain = mix(side, end, pow(abs(normalize(${normal}).x), 6.0));
      return -grain * 0.65 + (craftNoise(p * vec3(1.5, 6.0, 6.0)) - 0.5) * 0.35;
    `,
    ceramic: `return ${noise}(p * 95.0) * 0.60 + (craftNoise(p * 9.0) - 0.5) * 0.22;`,
    metal: `return ${noise}(p * 72.0) * 0.35 + (craftNoise(p * 15.0) - 0.5) * 0.45;`,
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
    const pigment = surface.kind === 'wood' ? .22 : surface.kind === 'fabric' || surface.kind === 'cord' ? .17 : .08;
    const relief = surface.kind === 'wood' ? .00015 : surface.kind === 'fabric' || surface.kind === 'cord' ? .00065 : .0005;
    const frequency = { wood: 100, ceramic: 95, metal: 72, fabric: 310, cord: 235 }[surface.kind];
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float craftGrain = craftPattern() * craftStrength;
      diffuseColor.rgb *= 1.0 + craftGrain * ${pigment};
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + craftGrain * 0.12, 0.16, 1.0);
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      // Differentiate an unfiltered height, then attenuate its gradient. Taking
      // derivatives of craftGrain would imply undefined higher derivatives.
      float craftHeight = craftHeightPattern() * craftStrength * ${relief};
      float craftFootprint = max(length(dFdx(craftLocalPosition)), length(dFdy(craftLocalPosition))) * craftScale * ${frequency.toFixed(1)};
      float craftVisibility = exp(-0.5 * craftFootprint * craftFootprint);
      normal = craftReliefNormal(normal, -vViewPosition, craftHeight, craftVisibility);
    `);
  };
  material.customProgramCacheKey = () => `${baseKey}|wbr-craft-v1:${surface.kind}:${surface.axis}`;
  material.needsUpdate = true;
}

/** Explicitly authored surface; pigment, maps and disposal stay with its scene. */
export function createCraftMaterial(parameters: THREE.MeshStandardMaterialParameters, options: CraftSurfaceOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: options.kind === 'metal' ? .42 : options.kind === 'ceramic' ? .55 : .9,
    metalness: options.kind === 'metal' ? .72 : 0, ...parameters });
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
