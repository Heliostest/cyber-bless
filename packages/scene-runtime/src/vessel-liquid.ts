import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'

const MAX_VESSEL_RIPPLES = 6

export type LiquidPreset =
  | 'clear-water'
  | 'amber-tea'
  | 'sake'
  | 'herbal-porridge'
  | 'sumalak'
  | 'spiced-cocoa'
  | 'churned-cream'
  | 'viscous-honey'
  | 'lamp-oil'
  | 'pigment-dye'
  | 'sumi-ink'
  | 'ebru-bath'

export type LiquidPresetSpec = {
  color: number
  edgeColor: number
  deepColor: number
  foamColor: number
  foamStrength: number
  opacity: number
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  ior: number
  sloshFreq: number
  sloshDamping: number
  maxTiltRad: number
  meniscusRatio: number
  rippleSpeed: number
  rippleDamping: number
  rippleAmplitude: number
  swirlDamping: number
  convectionAmp: number
  convectionSpeed: number
  viscosity: number
  causticShimmer: number
}

export const LIQUID_PRESETS: Readonly<Record<LiquidPreset, Readonly<LiquidPresetSpec>>> = {
  'clear-water': {
    color: 0x78cbc8,
    edgeColor: 0xcaf5ee,
    deepColor: 0x3b8b94,
    foamColor: 0xf7f4e8,
    foamStrength: 0.08,
    opacity: 0.62,
    roughness: 0.14,
    clearcoat: 0.78,
    clearcoatRoughness: 0.10,
    ior: 1.333,
    sloshFreq: 11.4,
    sloshDamping: 0.22,
    maxTiltRad: 0.30,
    meniscusRatio: 0.034,
    rippleSpeed: 2.2,
    rippleDamping: 1.45,
    rippleAmplitude: 0.040,
    swirlDamping: 0.55,
    convectionAmp: 0.002,
    convectionSpeed: 0.35,
    viscosity: 0.12,
    causticShimmer: 0.32,
  },
  'amber-tea': {
    color: 0xb66824,
    edgeColor: 0xeab66a,
    deepColor: 0x5c280a,
    foamColor: 0xf6dfba,
    foamStrength: 0.16,
    opacity: 0.78,
    roughness: 0.15,
    clearcoat: 0.80,
    clearcoatRoughness: 0.10,
    ior: 1.336,
    sloshFreq: 11.0,
    sloshDamping: 0.24,
    maxTiltRad: 0.28,
    meniscusRatio: 0.036,
    rippleSpeed: 2.05,
    rippleDamping: 1.55,
    rippleAmplitude: 0.036,
    swirlDamping: 0.62,
    convectionAmp: 0.007,
    convectionSpeed: 0.45,
    viscosity: 0.16,
    causticShimmer: 0.16,
  },
  sake: {
    color: 0xece6cf,
    edgeColor: 0xfbf8ec,
    deepColor: 0xc2bea4,
    foamColor: 0xfffdf6,
    foamStrength: 0.06,
    opacity: 0.58,
    roughness: 0.10,
    clearcoat: 0.88,
    clearcoatRoughness: 0.08,
    ior: 1.338,
    sloshFreq: 11.6,
    sloshDamping: 0.20,
    maxTiltRad: 0.30,
    meniscusRatio: 0.035,
    rippleSpeed: 2.25,
    rippleDamping: 1.35,
    rippleAmplitude: 0.038,
    swirlDamping: 0.50,
    convectionAmp: 0.003,
    convectionSpeed: 0.38,
    viscosity: 0.11,
    causticShimmer: 0.26,
  },
  'herbal-porridge': {
    color: 0xe8dec2,
    edgeColor: 0xf5efdc,
    deepColor: 0xc9b994,
    foamColor: 0xfaf5e6,
    foamStrength: 0.28,
    opacity: 1.0,
    roughness: 0.34,
    clearcoat: 0.40,
    clearcoatRoughness: 0.24,
    ior: 1.35,
    sloshFreq: 6.8,
    sloshDamping: 0.52,
    maxTiltRad: 0.22,
    meniscusRatio: 0.044,
    rippleSpeed: 1.25,
    rippleDamping: 2.4,
    rippleAmplitude: 0.026,
    swirlDamping: 1.15,
    convectionAmp: 0.024,
    convectionSpeed: 0.62,
    viscosity: 0.62,
    causticShimmer: 0.0,
  },
  sumalak: {
    color: 0x9b6226,
    edgeColor: 0xc98f4d,
    deepColor: 0x5c3510,
    foamColor: 0xe4b87c,
    foamStrength: 0.30,
    opacity: 1.0,
    roughness: 0.26,
    clearcoat: 0.54,
    clearcoatRoughness: 0.18,
    ior: 1.38,
    sloshFreq: 5.4,
    sloshDamping: 0.68,
    maxTiltRad: 0.20,
    meniscusRatio: 0.048,
    rippleSpeed: 1.05,
    rippleDamping: 2.8,
    rippleAmplitude: 0.024,
    swirlDamping: 1.35,
    convectionAmp: 0.026,
    convectionSpeed: 0.55,
    viscosity: 0.74,
    causticShimmer: 0.0,
  },
  'spiced-cocoa': {
    color: 0x5c331c,
    edgeColor: 0xbe895f,
    deepColor: 0x2f160a,
    foamColor: 0xe4c6a0,
    foamStrength: 0.68,
    opacity: 1.0,
    roughness: 0.28,
    clearcoat: 0.44,
    clearcoatRoughness: 0.22,
    ior: 1.36,
    sloshFreq: 7.4,
    sloshDamping: 0.48,
    maxTiltRad: 0.24,
    meniscusRatio: 0.042,
    rippleSpeed: 1.4,
    rippleDamping: 2.1,
    rippleAmplitude: 0.028,
    swirlDamping: 0.92,
    convectionAmp: 0.015,
    convectionSpeed: 0.50,
    viscosity: 0.54,
    causticShimmer: 0.0,
  },
  'churned-cream': {
    color: 0xf2e8d2,
    edgeColor: 0xfbf6e9,
    deepColor: 0xdccca9,
    foamColor: 0xfffcf2,
    foamStrength: 0.62,
    opacity: 1.0,
    roughness: 0.34,
    clearcoat: 0.38,
    clearcoatRoughness: 0.26,
    ior: 1.37,
    sloshFreq: 5.2,
    sloshDamping: 0.72,
    maxTiltRad: 0.19,
    meniscusRatio: 0.050,
    rippleSpeed: 1.0,
    rippleDamping: 2.9,
    rippleAmplitude: 0.022,
    swirlDamping: 1.25,
    convectionAmp: 0.012,
    convectionSpeed: 0.36,
    viscosity: 0.80,
    causticShimmer: 0.0,
  },
  'viscous-honey': {
    color: 0xd48a18,
    edgeColor: 0xf6cb5e,
    deepColor: 0x7c4006,
    foamColor: 0xfae198,
    foamStrength: 0.12,
    opacity: 0.86,
    roughness: 0.10,
    clearcoat: 0.92,
    clearcoatRoughness: 0.07,
    ior: 1.47,
    sloshFreq: 4.5,
    sloshDamping: 0.82,
    maxTiltRad: 0.18,
    meniscusRatio: 0.056,
    rippleSpeed: 0.85,
    rippleDamping: 3.1,
    rippleAmplitude: 0.022,
    swirlDamping: 1.65,
    convectionAmp: 0.004,
    convectionSpeed: 0.22,
    viscosity: 0.92,
    causticShimmer: 0.14,
  },
  'lamp-oil': {
    color: 0xd8a43b,
    edgeColor: 0xf5db8a,
    deepColor: 0x895812,
    foamColor: 0xfbf0be,
    foamStrength: 0.08,
    opacity: 0.82,
    roughness: 0.09,
    clearcoat: 0.90,
    clearcoatRoughness: 0.07,
    ior: 1.46,
    sloshFreq: 5.2,
    sloshDamping: 0.68,
    maxTiltRad: 0.22,
    meniscusRatio: 0.048,
    rippleSpeed: 1.15,
    rippleDamping: 2.35,
    rippleAmplitude: 0.026,
    swirlDamping: 1.20,
    convectionAmp: 0.004,
    convectionSpeed: 0.28,
    viscosity: 0.72,
    causticShimmer: 0.18,
  },
  'pigment-dye': {
    color: 0x274b76,
    edgeColor: 0x5285b0,
    deepColor: 0x132642,
    foamColor: 0xa4c6e0,
    foamStrength: 0.22,
    opacity: 0.94,
    roughness: 0.15,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
    ior: 1.34,
    sloshFreq: 10.2,
    sloshDamping: 0.28,
    maxTiltRad: 0.28,
    meniscusRatio: 0.036,
    rippleSpeed: 1.95,
    rippleDamping: 1.65,
    rippleAmplitude: 0.034,
    swirlDamping: 0.68,
    convectionAmp: 0.005,
    convectionSpeed: 0.35,
    viscosity: 0.24,
    causticShimmer: 0.06,
  },
  'sumi-ink': {
    color: 0x1b1e24,
    edgeColor: 0x505a68,
    deepColor: 0x0b0d11,
    foamColor: 0x6f7987,
    foamStrength: 0.08,
    opacity: 1.0,
    roughness: 0.08,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
    ior: 1.36,
    sloshFreq: 9.2,
    sloshDamping: 0.36,
    maxTiltRad: 0.24,
    meniscusRatio: 0.038,
    rippleSpeed: 1.75,
    rippleDamping: 1.9,
    rippleAmplitude: 0.030,
    swirlDamping: 0.85,
    convectionAmp: 0.002,
    convectionSpeed: 0.24,
    viscosity: 0.34,
    causticShimmer: 0.0,
  },
  'ebru-bath': {
    color: 0xd4dfdb,
    edgeColor: 0xedf4f1,
    deepColor: 0xa0b1ad,
    foamColor: 0xf7faf8,
    foamStrength: 0.18,
    opacity: 0.88,
    roughness: 0.16,
    clearcoat: 0.72,
    clearcoatRoughness: 0.11,
    ior: 1.345,
    sloshFreq: 7.8,
    sloshDamping: 0.44,
    maxTiltRad: 0.24,
    meniscusRatio: 0.040,
    rippleSpeed: 1.5,
    rippleDamping: 2.0,
    rippleAmplitude: 0.030,
    swirlDamping: 0.88,
    convectionAmp: 0.005,
    convectionSpeed: 0.30,
    viscosity: 0.44,
    causticShimmer: 0.08,
  },
}

export type VesselLiquidOptions = {
  preset?: LiquidPreset
  /** Surface radius along local X (meters). */
  radius: number
  /** Optional surface radius along local Z for elliptical basins/inkstones (defaults to radius). */
  radiusZ?: number
  /** Concentric radial subdivisions (default 14, clamped 4..32). */
  radialSegments?: number
  /** Angular ring subdivisions (default 36, clamped 12..72). */
  angularSegments?: number
  /**
   * 'cpu' (default): writes live slosh/ripple/dip/convection heights directly into geometry vertices
   * and restores exact baseline meniscus on reset().
   * 'gpu': keeps CPU geometry buffer strictly immutable after creation while applying the same
   * spring-pendulum slosh, ripples, dip and convection in the vertex/fragment shader.
   */
  deformMode?: 'cpu' | 'gpu'
  color?: THREE.ColorRepresentation
  edgeColor?: THREE.ColorRepresentation
  deepColor?: THREE.ColorRepresentation
  foamColor?: THREE.ColorRepresentation
  foamStrength?: number
  opacity?: number
  roughness?: number
  /** Capillary meniscus wall-climb height in meters (defaults to radius * preset.meniscusRatio). */
  meniscusHeight?: number
  /** Hard vertical displacement safety cap in meters so liquid never escapes vessel walls. */
  maxAmplitude?: number
  /** Initial fill level in [0, 1] (default 1). */
  fillLevel?: number
  /** Optional local Y range [emptyY, fullY] moved automatically by setFillLevel(). */
  heightRange?: readonly [number, number]
  /** Hide mesh automatically when fillLevel <= 0.001 (default false). */
  hideWhenEmpty?: boolean
  /** Deterministic seed for simplex noise (default 1337). */
  seed?: number
  /** Mesh name (default 'vessel-liquid'). */
  name?: string
  /** Opt in to debug toon-water override (default false for vessel liquids). */
  waterRendering?: boolean
  receiveShadow?: boolean
  renderOrder?: number
}

export type VesselLiquidState = {
  readonly sloshX: number
  readonly sloshZ: number
  readonly velX: number
  readonly velZ: number
  readonly swirlVelocity: number
  readonly swirlPhase: number
  readonly fillLevel: number
  readonly activeRipples: number
  readonly dipDepth: number
  readonly time: number
}

export type VesselLiquidHandle = {
  readonly mesh: THREE.Mesh
  readonly material: THREE.MeshPhysicalMaterial
  readonly geometry: THREE.BufferGeometry
  readonly preset: LiquidPreset
  readonly state: VesselLiquidState
  addTiltImpulse(ax: number, az: number): void
  trackContainer(object3D: THREE.Object3D | null): void
  addSwirlImpulse(omega: number): void
  triggerRipple(localX: number, localZ: number, strength?: number): void
  addDipDepression(localX: number, localZ: number, depth?: number, radius?: number): void
  setFillLevel(level01: number, radiusAtLevel?: number): void
  sampleHeight(localX: number, localZ: number): number
  update(dt: number, elapsed?: number, reducedMotion?: boolean): void
  reset(): void
  dispose(): void
}

type VesselRipple = {
  x: number
  z: number
  birth: number
  strength: number
  active: boolean
}

function createSeededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback
}

function meniscusCurve(rho: number, meniscusHeight: number, startRho: number): number {
  if (meniscusHeight === 0 || rho <= startRho) return 0
  const u = THREE.MathUtils.clamp((rho - startRho) / Math.max(1e-4, 1 - startRho), 0, 1)
  return meniscusHeight * Math.pow(u, 2.35)
}

function meniscusSlope(rho: number, meniscusHeight: number, startRho: number): number {
  if (meniscusHeight === 0 || rho <= startRho) return 0
  const span = Math.max(1e-4, 1 - startRho)
  const u = THREE.MathUtils.clamp((rho - startRho) / span, 0, 1)
  return (meniscusHeight * 2.35 * Math.pow(u, 1.35)) / span
}

const VESSEL_SHADER_SHARED = /* glsl */ `
#define WBR_VESSEL_RIPPLES 6
uniform float wbrVTime;
uniform vec2 wbrVRadii;
uniform vec2 wbrVSlosh;
uniform float wbrVSwirlPhase;
uniform float wbrVSwirlSpeed;
uniform float wbrVConvAmp;
uniform float wbrVConvSpeed;
uniform float wbrVRippleSpeed;
uniform float wbrVRippleDamp;
uniform float wbrVRippleAmp;
uniform float wbrVMaxAmp;
uniform float wbrVReduced;
uniform vec4 wbrVDip; // (x, z, depth, radius)
uniform vec4 wbrVRipples[WBR_VESSEL_RIPPLES]; // (x, z, birth, strength)

vec3 wbrVMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 wbrVMod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 wbrVPermute(vec3 x) { return wbrVMod289(((x * 34.0) + 1.0) * x); }

float wbrVSimplex(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = wbrVMod289(i);
  vec3 p = wbrVPermute(wbrVPermute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Returns vec4(slopeX, slopeZ, dynamicHeight, crestEnergy).
vec4 wbrVesselField(vec2 localXZ) {
  float rx = max(wbrVRadii.x, 0.001);
  float rz = max(wbrVRadii.y, 0.001);
  float rMean = 0.5 * (rx + rz);
  vec2 u = vec2(localXZ.x / rx, localXZ.y / rz);
  float rho = length(u);
  float wallFade = 1.0 - smoothstep(0.84, 1.0, rho);

  // 2D spring-pendulum slosh plane (dominant fundamental mode).
  float h = localXZ.x * wbrVSlosh.x + localXZ.y * wbrVSlosh.y;
  vec2 slope = wbrVSlosh;
  float crest = length(wbrVSlosh) * smoothstep(0.55, 0.96, rho) * 0.45;

  // Swirl parabolic vortex depression (centrifugal core dip + spiral ripples).
  float swirlMag = abs(wbrVSwirlSpeed);
  if (swirlMag > 0.01) {
    float vortexDepth = min(0.14 * rMean, swirlMag * swirlMag * 0.0032 * rMean);
    float vShape = (rho * rho - 0.5) * vortexDepth;
    h += vShape;
    slope += vec2(2.0 * localXZ.x / (rx * rx), 2.0 * localXZ.y / (rz * rz)) * vortexDepth;
  }

  // Viscous dip / honey-pull Gaussian dimple.
  if (abs(wbrVDip.z) > 0.0001) {
    vec2 dd = localXZ - wbrVDip.xy;
    float dipR = max(wbrVDip.w, 0.01);
    float invR2 = 1.0 / (dipR * dipR);
    float g = exp(-dot(dd, dd) * invR2) * wallFade;
    h -= wbrVDip.z * g;
    slope += dd * (2.0 * wbrVDip.z * invR2 * g);
    crest += abs(wbrVDip.z) * g * 6.0;
  }

  // Simplex slow thermal convection / simmer (porridge, sumalak, cocoa, warm tea).
  if (wbrVConvAmp > 0.0001) {
    float ct = wbrVTime * wbrVConvSpeed;
    float cs = cos(wbrVSwirlPhase * 0.55);
    float sn = sin(wbrVSwirlPhase * 0.55);
    vec2 su = mat2(cs, -sn, sn, cs) * u * 2.6;
    float n1 = wbrVSimplex(su + vec2(ct * 0.42, -ct * 0.31));
    float n2 = wbrVSimplex(su * 1.85 + vec2(-ct * 0.35 + 3.1, ct * 0.48 - 1.7));
    float ch = (n1 * 0.65 + n2 * 0.35) * wbrVConvAmp * rMean * wallFade;
    h += ch;
    float eps = 0.09;
    float nx = wbrVSimplex(su + vec2(ct * 0.42 + eps, -ct * 0.31)) - n1;
    float nz = wbrVSimplex(su + vec2(ct * 0.42, -ct * 0.31 + eps)) - n1;
    slope += vec2(nx, nz) * (wbrVConvAmp * 0.85 * wallFade / eps);
    crest += max(0.0, n2) * wbrVConvAmp * 8.0;
  }

  // Concentric dispersive ripples inside vessel.
  float waveLen = max(rMean * 0.34, 0.025);
  float k = 6.2831853 / waveLen;
  float rSpeed = wbrVRippleSpeed * rMean;
  for (int i = 0; i < WBR_VESSEL_RIPPLES; i++) {
    vec4 rp = wbrVRipples[i];
    if (rp.w <= 0.001) continue;
    float age = wbrVTime - rp.z;
    if (age < 0.0 || age > 4.5) continue;
    vec2 delta = localXZ - rp.xy;
    float dist = length(delta);
    float front = age * rSpeed;
    float dr = dist - front;
    float packetW = max(waveLen * 0.72, rMean * (0.18 + age * 0.14));
    float invW2 = 1.0 / (packetW * packetW);
    float env = rp.w * smoothstep(0.0, 0.055, age) * exp(-age * wbrVRippleDamp) * exp(-0.5 * dr * dr * invW2) * wallFade;
    if (env <= 0.0005) continue;
    float ph = k * dr;
    float cs = cos(ph);
    float sn = sin(ph);
    float amp = wbrVRippleAmp * rMean;
    h += env * amp * cs;
    float dhdR = env * amp * (-k * sn - dr * invW2 * cs);
    vec2 dir = dist > 0.0005 ? delta / dist : vec2(0.0);
    slope += dir * (dhdR * 2.1);
    crest += env * pow(max(0.0, cs), 2.2) * 0.65;
  }

  float calm = 1.0 - wbrVReduced;
  h = clamp(h * calm, -wbrVMaxAmp, wbrVMaxAmp);
  return vec4(slope * calm, h, crest * calm);
}
`

/**
 * Interactive, mobile-budget fluid surface for bowls, cups, pots, ladles, inkstones,
 * dye vats, and offering basins. Combines a high-subdivision polar disc with capillary
 * meniscus, 2D spring-pendulum slosh dynamics, swirl crema, viscous dip rebound,
 * multi-source ripples, and simplex thermal convection.
 */
export function createVesselLiquid(options: VesselLiquidOptions): VesselLiquidHandle {
  const preset: LiquidPreset = options.preset ?? 'clear-water'
  const spec = LIQUID_PRESETS[preset]
  const radiusX = Math.max(0.01, finiteOr(options.radius, 0.12))
  const radiusZ = Math.max(0.01, finiteOr(options.radiusZ, radiusX))
  const meanRadius = 0.5 * (radiusX + radiusZ)
  const radialSegments = THREE.MathUtils.clamp(Math.round(finiteOr(options.radialSegments, 14)), 4, 32)
  const angularSegments = THREE.MathUtils.clamp(Math.round(finiteOr(options.angularSegments, 36)), 12, 72)
  const deformMode: 'cpu' | 'gpu' = options.deformMode === 'gpu' ? 'gpu' : 'cpu'
  const meniscusHeight = Math.max(0, finiteOr(options.meniscusHeight, meanRadius * spec.meniscusRatio))
  const meniscusStartRho = spec.viscosity > 0.65 ? 0.66 : 0.74
  const maxAmplitude = Math.max(0.003, finiteOr(options.maxAmplitude, meanRadius * 0.28))
  const hideWhenEmpty = options.hideWhenEmpty === true

  const baseColor = new THREE.Color(options.color ?? spec.color)
  const edgeColor = new THREE.Color(options.edgeColor ?? spec.edgeColor)
  const deepColor = new THREE.Color(options.deepColor ?? spec.deepColor)
  const foamColor = new THREE.Color(options.foamColor ?? spec.foamColor)
  const foamStrength = THREE.MathUtils.clamp(finiteOr(options.foamStrength, spec.foamStrength), 0, 1)
  const opacity = THREE.MathUtils.clamp(finiteOr(options.opacity, spec.opacity), 0.05, 1)
  const roughness = THREE.MathUtils.clamp(finiteOr(options.roughness, spec.roughness), 0.04, 0.95)
  const isOpaque = opacity >= 0.99

  // Build high-subdivision polar disc with slightly denser rings toward the capillary meniscus edge.
  const vertexCount = 1 + radialSegments * angularSegments
  const restPos = new Float32Array(vertexCount * 3)
  const restNorm = new Float32Array(vertexCount * 3)
  const posArr = new Float32Array(vertexCount * 3)
  const normArr = new Float32Array(vertexCount * 3)
  const uvArr = new Float32Array(vertexCount * 2)
  const vRho = new Float32Array(vertexCount)
  const vCos = new Float32Array(vertexCount)
  const vSin = new Float32Array(vertexCount)
  const indices: number[] = []

  // Center vertex (index 0)
  restPos[0] = 0
  restPos[1] = 0
  restPos[2] = 0
  restNorm[0] = 0
  restNorm[1] = 1
  restNorm[2] = 0
  uvArr[0] = 0.5
  uvArr[1] = 0.5
  vRho[0] = 0
  vCos[0] = 1
  vSin[0] = 0

  let vi = 1
  for (let j = 1; j <= radialSegments; j++) {
    const u = j / radialSegments
    // Smoothly cluster rings slightly closer to r -> R so meniscus curvature reads crisp.
    const rho = 1 - Math.pow(1 - u, 1.22)
    const mY = meniscusCurve(rho, meniscusHeight, meniscusStartRho)
    const mSlopeR = meniscusSlope(rho, meniscusHeight, meniscusStartRho)
    for (let k = 0; k < angularSegments; k++) {
      const ang = (k / angularSegments) * Math.PI * 2
      const cs = Math.cos(ang)
      const sn = Math.sin(ang)
      const x = radiusX * rho * cs
      const z = radiusZ * rho * sn
      restPos[vi * 3] = x
      restPos[vi * 3 + 1] = mY
      restPos[vi * 3 + 2] = z

      // Analytic outward normal of the baseline meniscus surface: y = m(rho).
      const dhdX = mSlopeR * (cs / radiusX)
      const dhdZ = mSlopeR * (sn / radiusZ)
      const invLen = 1 / Math.hypot(dhdX, 1, dhdZ)
      restNorm[vi * 3] = -dhdX * invLen
      restNorm[vi * 3 + 1] = invLen
      restNorm[vi * 3 + 2] = -dhdZ * invLen

      uvArr[vi * 2] = 0.5 + 0.5 * rho * cs
      uvArr[vi * 2 + 1] = 0.5 + 0.5 * rho * sn
      vRho[vi] = rho
      vCos[vi] = cs
      vSin[vi] = sn
      vi++
    }
  }

  // Upward-facing (+Y) triangle winding
  for (let k = 0; k < angularSegments; k++) {
    const next = (k + 1) % angularSegments
    indices.push(0, 1 + next, 1 + k)
  }
  for (let j = 1; j < radialSegments; j++) {
    const ringA = 1 + (j - 1) * angularSegments
    const ringB = 1 + j * angularSegments
    for (let k = 0; k < angularSegments; k++) {
      const next = (k + 1) % angularSegments
      const a = ringA + k
      const b = ringA + next
      const c = ringB + k
      const d = ringB + next
      indices.push(a, d, c)
      indices.push(a, b, d)
    }
  }

  posArr.set(restPos)
  normArr.set(restNorm)

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(posArr, 3)
  const normAttr = new THREE.BufferAttribute(normArr, 3)
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('normal', normAttr)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()

  const noise2D = createNoise2D(createSeededRandom(options.seed ?? 1337))
  const rippleVecs = Array.from({ length: MAX_VESSEL_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0))
  const ripples: VesselRipple[] = Array.from({ length: MAX_VESSEL_RIPPLES }, () => ({
    x: 0,
    z: 0,
    birth: -100,
    strength: 0,
    active: false,
  }))
  let rippleCursor = 0

  const uniforms = {
    wbrVTime: { value: 0 },
    wbrVRadii: { value: new THREE.Vector2(radiusX, radiusZ) },
    wbrVSlosh: { value: new THREE.Vector2(0, 0) },
    wbrVSwirlPhase: { value: 0 },
    wbrVSwirlSpeed: { value: 0 },
    wbrVConvAmp: { value: spec.convectionAmp },
    wbrVConvSpeed: { value: spec.convectionSpeed },
    wbrVRippleSpeed: { value: spec.rippleSpeed },
    wbrVRippleDamp: { value: spec.rippleDamping },
    wbrVRippleAmp: { value: spec.rippleAmplitude },
    wbrVMaxAmp: { value: maxAmplitude },
    wbrVReduced: { value: 0 },
    wbrVDip: { value: new THREE.Vector4(0, 0, 0, meanRadius * 0.35) },
    wbrVRipples: { value: rippleVecs },
    wbrVEdgeColor: { value: edgeColor },
    wbrVDeepColor: { value: deepColor },
    wbrVFoamColor: { value: foamColor },
    wbrVFoamStrength: { value: foamStrength },
    wbrVCausticShimmer: { value: spec.causticShimmer },
  }

  // Keep transparent: true even for opaque liquids (with opacity=1, depthWrite=true)
  // so toon-surfaces preserves our custom meniscus, swirl & convection shader.
  const material = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness,
    metalness: 0,
    ior: spec.ior,
    clearcoat: spec.clearcoat,
    clearcoatRoughness: spec.clearcoatRoughness,
    transparent: true,
    opacity,
    depthWrite: isOpaque,
  })
  material.userData.waterRendering = options.waterRendering ?? false
  material.customProgramCacheKey = () => `wbr-vessel-liquid-v2:${preset}:${deformMode}:${isOpaque ? 'op' : 'tr'}`
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `
varying vec3 wbrVLocal;
varying float wbrVRho;
varying float wbrVCrest;
varying vec3 wbrVAxisX;
varying vec3 wbrVAxisY;
varying vec3 wbrVAxisZ;
${deformMode === 'gpu' ? VESSEL_SHADER_SHARED : 'uniform vec2 wbrVRadii;'}
` + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrVLocal = position;
      wbrVRho = length(vec2(position.x / max(wbrVRadii.x, 0.001), position.z / max(wbrVRadii.y, 0.001)));
      wbrVAxisX = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
      wbrVAxisY = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      wbrVAxisZ = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
      ${deformMode === 'gpu'
        ? `vec4 wbrVGpuF = wbrVesselField(position.xz);
           transformed.y += wbrVGpuF.z;
           wbrVCrest = wbrVGpuF.w;`
        : 'wbrVCrest = 0.0;'}
    `)

    shader.fragmentShader = `
varying vec3 wbrVLocal;
varying float wbrVRho;
varying float wbrVCrest;
varying vec3 wbrVAxisX;
varying vec3 wbrVAxisY;
varying vec3 wbrVAxisZ;
uniform vec3 wbrVEdgeColor;
uniform vec3 wbrVDeepColor;
uniform vec3 wbrVFoamColor;
uniform float wbrVFoamStrength;
uniform float wbrVCausticShimmer;
${VESSEL_SHADER_SHARED}
` + shader.fragmentShader
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        // Subtle animated surface-normal shimmer for crisp liquid reflections even in CPU mode.
        vec2 wbrVSlope = wbrVFragField.xy * ${deformMode === 'gpu' ? '1.35' : '0.45'};
        vec3 wbrVViewN = normalize(-wbrVSlope.x * wbrVAxisX + wbrVAxisY - wbrVSlope.y * wbrVAxisZ);
        normal = normalize(mix(normal, wbrVViewN, ${deformMode === 'gpu' ? '0.82' : '0.42'}));
      `)
      .replace('#include <clearcoat_normal_fragment_maps>', `
        #include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          clearcoatNormal = normal;
        #endif
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec4 wbrVFragField = wbrVesselField(wbrVLocal.xz);
        float rho = clamp(wbrVRho, 0.0, 1.0);
        float ang = atan(wbrVLocal.z, wbrVLocal.x);

        // Beer-Lambert-inspired radial depth absorption + luminous shallow rim.
        vec3 wbrBody = mix(wbrVDeepColor, diffuseColor.rgb, smoothstep(0.10, 0.88, rho));
        float meniscusBand = smoothstep(0.76, 0.995, rho);
        diffuseColor.rgb = mix(wbrBody, wbrVEdgeColor, meniscusBand * 0.62);

        // Swirl logarithmic spiral crema / foam ribbons (spiced-cocoa, churned-cream, porridge, tea).
        if (wbrVFoamStrength > 0.01) {
          float twist = 2.6 + min(abs(wbrVSwirlSpeed) * 0.42, 3.5);
          float spiralA = sin(ang * 3.0 - rho * twist + wbrVSwirlPhase * 1.4);
          float spiralB = cos(ang * 2.0 + rho * (twist * 0.7) - wbrVSwirlPhase * 0.9);
          float organic = wbrVSimplex(vec2(cos(ang + wbrVSwirlPhase * 0.35), sin(ang + wbrVSwirlPhase * 0.35)) * (rho * 2.4) + vec2(wbrVTime * 0.14, -wbrVTime * 0.11));
          float cremaRing = smoothstep(0.58, 0.94, rho) * (0.55 + 0.45 * smoothstep(-0.3, 0.6, organic));
          float swirlRibbon = smoothstep(0.15, 0.85, 0.5 + 0.35 * spiralA + 0.25 * spiralB + 0.30 * organic) * smoothstep(0.08, 0.72, rho);
          float swirlBoost = clamp(0.45 + abs(wbrVSwirlSpeed) * 0.18, 0.45, 1.0);
          float foamMask = clamp((cremaRing * 0.58 + swirlRibbon * 0.52) * wbrVFoamStrength * swirlBoost, 0.0, 0.78);
          diffuseColor.rgb = mix(diffuseColor.rgb, wbrVFoamColor, foamMask);
        }

        // Delicate underwater caustic micro-shimmer for clear water / sake / honey.
        if (wbrVCausticShimmer > 0.01) {
          float cPhase = wbrVTime * 0.65 * (1.0 - wbrVReduced);
          float ca = wbrVSimplex(wbrVLocal.xz * (4.2 / max(wbrVRadii.x, 0.04)) + vec2(cPhase * 0.45, -cPhase * 0.32));
          float cb = wbrVSimplex(wbrVLocal.xz * (7.1 / max(wbrVRadii.x, 0.04)) + vec2(-cPhase * 0.35 + 2.4, cPhase * 0.41));
          float glint = pow(clamp(0.5 + 0.5 * (ca * 0.6 + cb * 0.4), 0.0, 1.0), 3.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, wbrVEdgeColor, glint * wbrVCausticShimmer * 0.42 * (1.0 - meniscusBand * 0.5));
        }

        // Wet inner-wall capillary meniscus sheen + ripple crest highlight + warm Fresnel.
        vec3 wbrVViewDir = normalize(vViewPosition);
        vec3 wbrVColorN = normalize(-wbrVFragField.x * wbrVAxisX + wbrVAxisY - wbrVFragField.y * wbrVAxisZ);
        float wbrVFresnel = pow(clamp(1.0 - abs(dot(wbrVColorN, wbrVViewDir)), 0.0, 1.0), 3.0);
        float wbrVCrestRaw = max(wbrVCrest, wbrVFragField.w);
        float wbrVCrestSoft = wbrVCrestRaw / (wbrVCrestRaw + 0.90);
        float wetRim = smoothstep(0.87, 0.995, rho) * 0.24;
        diffuseColor.rgb = mix(diffuseColor.rgb, wbrVFoamColor, clamp(wetRim + wbrVCrestSoft * 0.38 + wbrVFresnel * 0.18, 0.0, 0.62));
        ${isOpaque ? '' : 'diffuseColor.a = clamp(diffuseColor.a + meniscusBand * 0.18 + wbrVFresnel * 0.16 + wbrVCrestSoft * 0.14, 0.0, 0.96);'}
      `)
      .replace('#include <opaque_fragment>', `
        // Soft-knee highlight shoulder preserves warm liquid tone in sunlit Komorebi scenes.
        float wbrVPeak = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        if (wbrVPeak > 0.80) {
          float wbrVExcess = wbrVPeak - 0.80;
          float wbrVTarget = 0.80 + 0.22 * (wbrVExcess / (wbrVExcess + 0.22));
          outgoingLight *= wbrVTarget / wbrVPeak;
        }
        #include <opaque_fragment>
      `)
  }

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = options.name ?? 'vessel-liquid'
  mesh.castShadow = false
  mesh.receiveShadow = options.receiveShadow ?? true
  mesh.renderOrder = options.renderOrder ?? (isOpaque ? 0 : 1)
  mesh.userData.toonSurface = { outline: false }

  // Physics state (zero allocations during update)
  let sloshX = 0
  let sloshZ = 0
  let velX = 0
  let velZ = 0
  let eqX = 0
  let eqZ = 0
  let swirlVelocity = 0
  let swirlPhase = 0
  let dipX = 0
  let dipZ = 0
  let dipDepth = 0
  let dipVel = 0
  let dipRadius = meanRadius * 0.35
  let fillLevel = THREE.MathUtils.clamp(finiteOr(options.fillLevel, 1), 0, 1)
  let internalTime = 0
  let disposed = false
  let trackedContainer: THREE.Object3D | null = null
  let hasPrevTrack = false

  // Pre-allocated scratch math objects for container tracking
  const _curPos = new THREE.Vector3()
  const _prevPos = new THREE.Vector3()
  const _curVel = new THREE.Vector3()
  const _prevVel = new THREE.Vector3()
  const _accel = new THREE.Vector3()
  const _localAccel = new THREE.Vector3()
  const _localUp = new THREE.Vector3()
  const _worldQuat = new THREE.Quaternion()
  const _invQuat = new THREE.Quaternion()
  const _worldUp = new THREE.Vector3(0, 1, 0)

  function applyFillTransform(radiusAtLevel?: number) {
    if (options.heightRange) {
      mesh.position.y = THREE.MathUtils.lerp(options.heightRange[0], options.heightRange[1], fillLevel)
    }
    if (radiusAtLevel !== undefined && Number.isFinite(radiusAtLevel) && radiusAtLevel > 0.001) {
      const scaleRatio = radiusAtLevel / radiusX
      mesh.scale.set(scaleRatio, 1, scaleRatio)
    }
    if (hideWhenEmpty) {
      mesh.visible = fillLevel > 0.001
    }
  }
  applyFillTransform()

  function syncRippleUniform(index: number) {
    const r = ripples[index]!
    rippleVecs[index]!.set(r.x, r.z, r.birth, r.active ? r.strength : 0)
  }

  function syncUniforms(reducedMotion: boolean) {
    uniforms.wbrVTime.value = internalTime
    uniforms.wbrVSlosh.value.set(sloshX, sloshZ)
    uniforms.wbrVSwirlPhase.value = swirlPhase
    uniforms.wbrVSwirlSpeed.value = swirlVelocity
    uniforms.wbrVReduced.value = reducedMotion ? 1 : 0
    uniforms.wbrVDip.value.set(dipX, dipZ, dipDepth, dipRadius)
  }

  function evalDynamic(localX: number, localZ: number, rho: number, outGrad?: [number, number]): number {
    const wallFade = 1 - THREE.MathUtils.smoothstep(rho, 0.84, 1.0)
    let h = localX * sloshX + localZ * sloshZ
    let gx = sloshX
    let gz = sloshZ

    const swirlMag = Math.abs(swirlVelocity)
    if (swirlMag > 0.01) {
      const vortexDepth = Math.min(0.14 * meanRadius, swirlMag * swirlMag * 0.0032 * meanRadius)
      h += (rho * rho - 0.5) * vortexDepth
      gx += (2 * localX / (radiusX * radiusX)) * vortexDepth
      gz += (2 * localZ / (radiusZ * radiusZ)) * vortexDepth
    }

    if (Math.abs(dipDepth) > 0.00005) {
      const dx = localX - dipX
      const dz = localZ - dipZ
      const invR2 = 1 / Math.max(dipRadius * dipRadius, 1e-4)
      const g = Math.exp(-(dx * dx + dz * dz) * invR2) * wallFade
      h -= dipDepth * g
      gx += dx * (2 * dipDepth * invR2 * g)
      gz += dz * (2 * dipDepth * invR2 * g)
    }

    if (spec.convectionAmp > 0.0001) {
      const ct = internalTime * spec.convectionSpeed
      const cs = Math.cos(swirlPhase * 0.55)
      const sn = Math.sin(swirlPhase * 0.55)
      const ux = localX / radiusX
      const uz = localZ / radiusZ
      const sx = (cs * ux - sn * uz) * 2.6
      const sz = (sn * ux + cs * uz) * 2.6
      const n1 = noise2D(sx + ct * 0.42, sz - ct * 0.31)
      const n2 = noise2D(sx * 1.85 - ct * 0.35 + 3.1, sz * 1.85 + ct * 0.48 - 1.7)
      h += (n1 * 0.65 + n2 * 0.35) * spec.convectionAmp * meanRadius * wallFade
      if (outGrad) {
        const eps = 0.09
        const nx = noise2D(sx + ct * 0.42 + eps, sz - ct * 0.31) - n1
        const nz = noise2D(sx + ct * 0.42, sz - ct * 0.31 + eps) - n1
        gx += (nx * spec.convectionAmp * 0.85 * wallFade) / eps
        gz += (nz * spec.convectionAmp * 0.85 * wallFade) / eps
      }
    }

    const waveLen = Math.max(meanRadius * 0.34, 0.025)
    const k = (Math.PI * 2) / waveLen
    const rSpeed = spec.rippleSpeed * meanRadius
    const amp = spec.rippleAmplitude * meanRadius
    for (let i = 0; i < MAX_VESSEL_RIPPLES; i++) {
      const rp = ripples[i]!
      if (!rp.active || rp.strength <= 0.001) continue
      const age = internalTime - rp.birth
      if (age < 0 || age > 4.5) continue
      const dx = localX - rp.x
      const dz = localZ - rp.z
      const dist = Math.hypot(dx, dz)
      const front = age * rSpeed
      const dr = dist - front
      const packetW = Math.max(waveLen * 0.72, meanRadius * (0.18 + age * 0.14))
      const invW2 = 1 / (packetW * packetW)
      const env = rp.strength
        * THREE.MathUtils.smoothstep(age, 0, 0.055)
        * Math.exp(-age * spec.rippleDamping)
        * Math.exp(-0.5 * dr * dr * invW2)
        * wallFade
      if (env <= 0.0004) continue
      const ph = k * dr
      const cs = Math.cos(ph)
      const sn = Math.sin(ph)
      h += env * amp * cs
      if (outGrad && dist > 0.0005) {
        const dhdR = env * amp * (-k * sn - dr * invW2 * cs)
        gx += (dx / dist) * dhdR * 1.8
        gz += (dz / dist) * dhdR * 1.8
      }
    }

    if (outGrad) {
      outGrad[0] = gx
      outGrad[1] = gz
    }
    return THREE.MathUtils.clamp(h, -maxAmplitude, maxAmplitude)
  }

  const _gradScratch: [number, number] = [0, 0]

  function writeCpuVertices(reducedMotion: boolean) {
    if (deformMode !== 'cpu') return
    if (reducedMotion) {
      posArr.set(restPos)
      normArr.set(restNorm)
      posAttr.needsUpdate = true
      normAttr.needsUpdate = true
      return
    }
    for (let i = 0; i < vertexCount; i++) {
      const x = restPos[i * 3]!
      const baseY = restPos[i * 3 + 1]!
      const z = restPos[i * 3 + 2]!
      const rho = vRho[i]!
      const dynH = evalDynamic(x, z, rho, _gradScratch)
      posArr[i * 3 + 1] = baseY + dynH

      const mSlopeR = meniscusSlope(rho, meniscusHeight, meniscusStartRho)
      const dhdX = _gradScratch[0] + mSlopeR * (vCos[i]! / radiusX)
      const dhdZ = _gradScratch[1] + mSlopeR * (vSin[i]! / radiusZ)
      const invLen = 1 / Math.hypot(dhdX, 1, dhdZ)
      normArr[i * 3] = -dhdX * invLen
      normArr[i * 3 + 1] = invLen
      normArr[i * 3 + 2] = -dhdZ * invLen
    }
    posAttr.needsUpdate = true
    normAttr.needsUpdate = true
  }

  function stepPhysics(dt: number) {
    // Track container motion & gravity-relative tilt when attached.
    let accelX = 0
    let accelZ = 0
    if (trackedContainer) {
      trackedContainer.updateWorldMatrix(true, false)
      trackedContainer.getWorldPosition(_curPos)
      trackedContainer.getWorldQuaternion(_worldQuat)
      _invQuat.copy(_worldQuat).invert()

      // Gravity equilibrium: liquid surface tries to remain world-horizontal inside tilted vessel.
      _localUp.copy(_worldUp).applyQuaternion(_invQuat)
      const upY = Math.max(_localUp.y, 0.35)
      eqX = THREE.MathUtils.clamp(-_localUp.x / upY, -spec.maxTiltRad, spec.maxTiltRad)
      eqZ = THREE.MathUtils.clamp(-_localUp.z / upY, -spec.maxTiltRad, spec.maxTiltRad)

      if (hasPrevTrack) {
        _curVel.copy(_curPos).sub(_prevPos).divideScalar(dt)
        _accel.copy(_curVel).sub(_prevVel).divideScalar(dt)
        // Clamp violent teleportation spikes (e.g. instant checkpoint jumps).
        const mag = _accel.length()
        if (mag > 14) _accel.multiplyScalar(14 / mag)
        _localAccel.copy(_accel).applyQuaternion(_invQuat)
        const coupling = (1 - spec.viscosity * 0.55) * 0.14
        accelX = -_localAccel.x * coupling
        accelZ = -_localAccel.z * coupling
        _prevVel.copy(_curVel)
      } else {
        _prevVel.set(0, 0, 0)
        hasPrevTrack = true
      }
      _prevPos.copy(_curPos)
    } else {
      eqX = 0
      eqZ = 0
    }

    // Substepped 2D damped harmonic oscillator for slosh (unconditionally stable on mobile dt).
    const subSteps = dt > 0.02 ? 2 : 1
    const hDt = dt / subSteps
    const w0 = spec.sloshFreq
    const kSpring = w0 * w0
    const cDamp = 2 * spec.sloshDamping * w0
    const maxSlope = Math.tan(spec.maxTiltRad)

    for (let s = 0; s < subSteps; s++) {
      const fX = -kSpring * (sloshX - eqX) - cDamp * velX + accelX
      const fZ = -kSpring * (sloshZ - eqZ) - cDamp * velZ + accelZ
      velX += fX * hDt
      velZ += fZ * hDt
      sloshX += velX * hDt
      sloshZ += velZ * hDt

      // Soft radial slope limit prevents liquid from bursting through vessel rim.
      const slopeLen = Math.hypot(sloshX, sloshZ)
      if (slopeLen > maxSlope) {
        const scale = maxSlope / slopeLen
        sloshX *= scale
        sloshZ *= scale
        velX *= 0.65
        velZ *= 0.65
      }

      // Viscous dip rebound (spring-damper tuned by viscosity).
      if (Math.abs(dipDepth) > 1e-5 || Math.abs(dipVel) > 1e-5) {
        const dipOmega = THREE.MathUtils.lerp(13.0, 3.6, spec.viscosity)
        const dipZeta = THREE.MathUtils.lerp(0.32, 0.92, spec.viscosity)
        const fDip = -(dipOmega * dipOmega) * dipDepth - 2 * dipZeta * dipOmega * dipVel
        dipVel += fDip * hDt
        dipDepth += dipVel * hDt
      } else {
        dipDepth = 0
        dipVel = 0
      }
    }

    // Clamp negligible tail energy cleanly to zero so resting liquids settle silently.
    if (Math.abs(sloshX - eqX) < 1e-5 && Math.abs(velX) < 1e-4) { sloshX = eqX; velX = 0 }
    if (Math.abs(sloshZ - eqZ) < 1e-5 && Math.abs(velZ) < 1e-4) { sloshZ = eqZ; velZ = 0 }

    // Swirl angular momentum exponential decay.
    if (Math.abs(swirlVelocity) > 1e-4) {
      swirlPhase += swirlVelocity * dt
      swirlVelocity *= Math.exp(-spec.swirlDamping * dt)
    } else {
      swirlVelocity = 0
    }

    // Expire completed vessel ripples.
    for (let i = 0; i < MAX_VESSEL_RIPPLES; i++) {
      const rp = ripples[i]!
      if (!rp.active) continue
      const age = internalTime - rp.birth
      if (age < 0 || age > 4.5 || Math.exp(-age * spec.rippleDamping) * rp.strength < 0.005) {
        rp.active = false
        rp.strength = 0
        syncRippleUniform(i)
      }
    }
  }

  function reset() {
    if (disposed) return
    sloshX = 0
    sloshZ = 0
    velX = 0
    velZ = 0
    eqX = 0
    eqZ = 0
    swirlVelocity = 0
    swirlPhase = 0
    dipX = 0
    dipZ = 0
    dipDepth = 0
    dipVel = 0
    internalTime = 0
    hasPrevTrack = false
    for (let i = 0; i < MAX_VESSEL_RIPPLES; i++) {
      ripples[i]!.active = false
      ripples[i]!.strength = 0
      ripples[i]!.birth = -100
      syncRippleUniform(i)
    }
    rippleCursor = 0
    syncUniforms(false)
    if (deformMode === 'cpu') {
      posArr.set(restPos)
      normArr.set(restNorm)
      posAttr.needsUpdate = true
      normAttr.needsUpdate = true
    }
  }

  return {
    mesh,
    material,
    geometry,
    preset,
    get state(): VesselLiquidState {
      let activeRipples = 0
      for (let i = 0; i < MAX_VESSEL_RIPPLES; i++) if (ripples[i]!.active) activeRipples++
      return {
        sloshX,
        sloshZ,
        velX,
        velZ,
        swirlVelocity,
        swirlPhase,
        fillLevel,
        activeRipples,
        dipDepth,
        time: internalTime,
      }
    },
    addTiltImpulse(ax: number, az: number) {
      if (disposed || !Number.isFinite(ax) || !Number.isFinite(az)) return
      const dampingScale = 1 - spec.viscosity * 0.45
      velX = THREE.MathUtils.clamp(velX + ax * dampingScale, -12, 12)
      velZ = THREE.MathUtils.clamp(velZ + az * dampingScale, -12, 12)
    },
    trackContainer(object3D: THREE.Object3D | null) {
      trackedContainer = object3D
      hasPrevTrack = false
    },
    addSwirlImpulse(omega: number) {
      if (disposed || !Number.isFinite(omega)) return
      swirlVelocity = THREE.MathUtils.clamp(swirlVelocity + omega, -18, 18)
    },
    triggerRipple(localX: number, localZ: number, strength = 1) {
      if (disposed || !Number.isFinite(localX) || !Number.isFinite(localZ)) return
      const clampedX = THREE.MathUtils.clamp(localX, -radiusX * 0.92, radiusX * 0.92)
      const clampedZ = THREE.MathUtils.clamp(localZ, -radiusZ * 0.92, radiusZ * 0.92)
      const clampedStrength = THREE.MathUtils.clamp(finiteOr(strength, 1), 0.05, 2.5)
      let slotIndex = -1
      for (let i = 0; i < MAX_VESSEL_RIPPLES; i++) {
        if (!ripples[i]!.active) {
          slotIndex = i
          break
        }
      }
      if (slotIndex === -1) {
        slotIndex = rippleCursor
        rippleCursor = (rippleCursor + 1) % MAX_VESSEL_RIPPLES
      }
      const slot = ripples[slotIndex]!
      slot.x = clampedX
      slot.z = clampedZ
      slot.birth = internalTime
      slot.strength = clampedStrength
      slot.active = true
      syncRippleUniform(slotIndex)
    },
    addDipDepression(localX: number, localZ: number, depth?: number, radius?: number) {
      if (disposed || !Number.isFinite(localX) || !Number.isFinite(localZ)) return
      dipX = THREE.MathUtils.clamp(localX, -radiusX * 0.85, radiusX * 0.85)
      dipZ = THREE.MathUtils.clamp(localZ, -radiusZ * 0.85, radiusZ * 0.85)
      const targetDepth = finiteOr(depth, meanRadius * 0.14)
      dipDepth = THREE.MathUtils.clamp(dipDepth + targetDepth, -maxAmplitude * 0.85, maxAmplitude * 0.85)
      dipRadius = THREE.MathUtils.clamp(finiteOr(radius, meanRadius * 0.36), meanRadius * 0.12, meanRadius * 0.85)
      // Also emit a subtle outward meniscus wave around the dip point.
      if (Math.abs(targetDepth) > 0.001) {
        this.triggerRipple(dipX, dipZ, Math.min(1.1, Math.abs(targetDepth) / Math.max(meanRadius * 0.12, 0.005)))
      }
    },
    setFillLevel(level01: number, radiusAtLevel?: number) {
      if (disposed || !Number.isFinite(level01)) return
      fillLevel = THREE.MathUtils.clamp(level01, 0, 1)
      applyFillTransform(radiusAtLevel)
    },
    sampleHeight(localX: number, localZ: number) {
      if (!Number.isFinite(localX) || !Number.isFinite(localZ)) return 0
      const rho = Math.min(1, Math.hypot(localX / radiusX, localZ / radiusZ))
      const baseM = meniscusCurve(rho, meniscusHeight, meniscusStartRho)
      if (uniforms.wbrVReduced.value > 0.5) return baseM
      return baseM + evalDynamic(localX, localZ, rho)
    },
    update(dt: number, elapsed?: number, reducedMotion = false) {
      if (disposed) return
      if (reducedMotion) {
        syncUniforms(true)
        writeCpuVertices(true)
        return
      }
      const clampedDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0
      if (elapsed !== undefined && Number.isFinite(elapsed) && elapsed >= 0) {
        internalTime = elapsed
      } else {
        internalTime += clampedDt
      }
      if (clampedDt > 0) {
        stepPhysics(clampedDt)
      }
      syncUniforms(false)
      writeCpuVertices(false)
    },
    reset,
    dispose() {
      if (disposed) return
      disposed = true
      trackedContainer = null
      mesh.removeFromParent()
      geometry.dispose()
      material.dispose()
    },
  }
}

export type LivingPourStreamOptions = {
  preset?: LiquidPreset
  color?: THREE.ColorRepresentation
  opacity?: number
  roughness?: number
  /** Stream radius leaving the spout/lip (meters, default 0.018). */
  topRadius?: number
  /** Gravity-accelerated tapered radius near landing point (meters, default 0.0095). */
  bottomRadius?: number
  /** Axial tube subdivisions along the arc (default 18, clamped 6..36). */
  segments?: number
  /** Circumferential tube subdivisions (default 10, clamped 6..20). */
  radialSegments?: number
  /**
   * Parabolic gravity-launch curvature factor in [0, 1] (default 0.34).
   * Set to 0 for a strictly straight gravity-aligned tapered column.
   */
  arcForward?: number
  /** Show a delicate animated splash crown ring at the landing point (default true). */
  showSplashCrown?: boolean
  /** Splash crown outer radius at full flow (meters, default topRadius * 2.8). */
  splashRadius?: number
  /** Simplex surface-tension pulsation amplitude fraction (default 0.14). */
  pulseAmplitude?: number
  /** Deterministic simplex seed (default 4201). */
  seed?: number
  /** Mesh name for the pour column (default 'living-pour-stream'). */
  name?: string
  /** Opt in to debug toon-water override (default false). */
  waterRendering?: boolean
}

export type LivingPourStreamHandle = {
  readonly root: THREE.Group
  readonly mesh: THREE.Mesh
  readonly splashCrown: THREE.Mesh
  readonly material: THREE.MeshPhysicalMaterial
  readonly flow: number
  updateArc(
    start: THREE.Vector3,
    end: THREE.Vector3,
    flow01: number,
    elapsed?: number,
    reducedMotion?: boolean,
  ): void
  reset(): void
  dispose(): void
}

/**
 * Gravity-accelerated, surface-tension-tapered liquid pour column with simplex
 * Rayleigh-Plateau micro-pulsation, downward specular flow shader bands, and an
 * optional delicate splash crown at the landing point.
 */
export function createLivingPourStream(options: LivingPourStreamOptions = {}): LivingPourStreamHandle {
  const preset: LiquidPreset = options.preset ?? 'clear-water'
  const spec = LIQUID_PRESETS[preset]
  const topRadius = Math.max(0.002, finiteOr(options.topRadius, 0.018))
  const bottomRadius = Math.max(0.001, finiteOr(options.bottomRadius, topRadius * 0.54))
  const segments = THREE.MathUtils.clamp(Math.round(finiteOr(options.segments, 18)), 6, 36)
  const radialSegments = THREE.MathUtils.clamp(Math.round(finiteOr(options.radialSegments, 10)), 6, 20)
  const arcForward = THREE.MathUtils.clamp(finiteOr(options.arcForward, 0.34), 0, 1)
  const showSplashCrown = options.showSplashCrown ?? true
  const splashRadius = Math.max(topRadius * 1.4, finiteOr(options.splashRadius, topRadius * 2.8))
  const pulseAmplitude = THREE.MathUtils.clamp(finiteOr(options.pulseAmplitude, 0.14), 0, 0.35)
  const noise2D = createNoise2D(createSeededRandom(options.seed ?? 4201))

  const baseColor = new THREE.Color(options.color ?? spec.color)
  const edgeColor = new THREE.Color(spec.edgeColor)
  const opacity = THREE.MathUtils.clamp(finiteOr(options.opacity, Math.max(spec.opacity, 0.62)), 0.15, 1)
  const roughness = THREE.MathUtils.clamp(finiteOr(options.roughness, Math.min(spec.roughness, 0.18)), 0.05, 0.6)

  // Pre-allocate tubular stream geometry (zero allocation during updateArc).
  const ringStride = radialSegments + 1
  const vertCount = (segments + 1) * ringStride
  const posArr = new Float32Array(vertCount * 3)
  const normArr = new Float32Array(vertCount * 3)
  const uvArr = new Float32Array(vertCount * 2)
  const indices: number[] = []
  const unitCos = new Float32Array(ringStride)
  const unitSin = new Float32Array(ringStride)

  for (let k = 0; k <= radialSegments; k++) {
    const u = k / radialSegments
    const ang = u * Math.PI * 2
    unitCos[k] = Math.cos(ang)
    unitSin[k] = Math.sin(ang)
  }
  for (let i = 0; i <= segments; i++) {
    const v = i / segments
    for (let k = 0; k <= radialSegments; k++) {
      const idx = i * ringStride + k
      uvArr[idx * 2] = k / radialSegments
      uvArr[idx * 2 + 1] = v
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < radialSegments; k++) {
      const a = i * ringStride + k
      const b = a + 1
      const c = a + ringStride
      const d = c + 1
      // Outward-facing winding for descending curve tangent (verified in unit tests).
      indices.push(a, c, b)
      indices.push(b, c, d)
    }
  }

  const streamGeo = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(posArr, 3)
  const normAttr = new THREE.BufferAttribute(normArr, 3)
  streamGeo.setAttribute('position', posAttr)
  streamGeo.setAttribute('normal', normAttr)
  streamGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))
  streamGeo.setIndex(indices)

  const streamUniforms = {
    wbrStreamTime: { value: 0 },
    wbrStreamFlow: { value: 0 },
    wbrStreamReduced: { value: 0 },
    wbrStreamHighlight: { value: edgeColor },
    wbrStreamSpeed: { value: THREE.MathUtils.lerp(13.5, 4.2, spec.viscosity) },
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness,
    metalness: 0,
    ior: spec.ior,
    clearcoat: Math.max(spec.clearcoat, 0.55),
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity,
    depthWrite: false,
  })
  material.userData.waterRendering = options.waterRendering ?? false
  material.customProgramCacheKey = () => `wbr-living-pour-stream-v1:${preset}`
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, streamUniforms)
    shader.vertexShader = `varying vec2 wbrStreamUv;\n` + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrStreamUv = uv;
    `)
    shader.fragmentShader = `
varying vec2 wbrStreamUv;
uniform float wbrStreamTime;
uniform float wbrStreamFlow;
uniform float wbrStreamReduced;
uniform vec3 wbrStreamHighlight;
uniform float wbrStreamSpeed;
` + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float st = wbrStreamTime * (1.0 - wbrStreamReduced);
      // Downward-traveling capillary shimmer bands + glistening Fresnel core.
      float bandA = 0.5 + 0.5 * sin(wbrStreamUv.y * 22.0 - st * wbrStreamSpeed + sin(wbrStreamUv.x * 12.566) * 0.9);
      float bandB = 0.5 + 0.5 * sin(wbrStreamUv.y * 37.0 - st * (wbrStreamSpeed * 1.35) - wbrStreamUv.x * 6.283);
      float streak = pow(bandA * 0.62 + bandB * 0.38, 2.2);
      vec3 wbrSView = normalize(vViewPosition);
      float wbrSFresnel = pow(clamp(1.0 - abs(dot(normalize(vNormal), wbrSView)), 0.0, 1.0), 2.2);
      float shimmer = clamp(streak * 0.44 + wbrSFresnel * 0.36, 0.0, 0.72);
      diffuseColor.rgb = mix(diffuseColor.rgb, wbrStreamHighlight, shimmer);
      float tipFade = smoothstep(0.0, 0.06, wbrStreamUv.y) * (1.0 - smoothstep(0.95, 1.0, wbrStreamUv.y) * 0.25);
      diffuseColor.a = clamp(diffuseColor.a * mix(0.75, 1.0, tipFade) * (0.85 + shimmer * 0.25), 0.0, 0.96);
    `)
  }

  // Delicate fluted splash crown at impact point (single lightweight open cup ring).
  const crownSides = 24
  const crownPos: number[] = []
  const crownIdx: number[] = []
  for (let i = 0; i <= crownSides; i++) {
    const a = (i / crownSides) * Math.PI * 2
    const cs = Math.cos(a)
    const sn = Math.sin(a)
    const flute = 0.5 + 0.5 * Math.sin(a * 6)
    const innerR = splashRadius * 0.34
    const outerR = splashRadius * (0.86 + flute * 0.22)
    const rimH = splashRadius * (0.28 + flute * 0.36)
    crownPos.push(innerR * cs, 0, innerR * sn)
    crownPos.push(outerR * cs, rimH, outerR * sn)
  }
  for (let i = 0; i < crownSides; i++) {
    const b0 = i * 2
    const t0 = b0 + 1
    const b1 = b0 + 2
    const t1 = b0 + 3
    crownIdx.push(b0, b1, t1, b0, t1, t0)
  }
  const crownGeo = new THREE.BufferGeometry()
  crownGeo.setAttribute('position', new THREE.Float32BufferAttribute(crownPos, 3))
  crownGeo.setIndex(crownIdx)
  crownGeo.computeVertexNormals()
  const crownMat = new THREE.MeshPhysicalMaterial({
    color: edgeColor,
    roughness: 0.14,
    metalness: 0,
    clearcoat: 0.7,
    transparent: true,
    opacity: Math.min(opacity * 0.72, 0.56),
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  crownMat.userData.waterRendering = options.waterRendering ?? false

  const root = new THREE.Group()
  root.name = `${options.name ?? 'living-pour-stream'}-root`

  const mesh = new THREE.Mesh(streamGeo, material)
  mesh.name = options.name ?? 'living-pour-stream'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.visible = false
  mesh.userData.toonSurface = { outline: false }

  const splashCrown = new THREE.Mesh(crownGeo, crownMat)
  splashCrown.name = `${options.name ?? 'living-pour-stream'}-splash`
  splashCrown.castShadow = false
  splashCrown.receiveShadow = false
  splashCrown.visible = false
  splashCrown.userData.toonSurface = { outline: false }

  root.add(mesh, splashCrown)

  // Scratch vectors for zero-allocation updateArc
  const _pt = new THREE.Vector3()
  const _ptNext = new THREE.Vector3()
  const _tan = new THREE.Vector3()
  const _ref = new THREE.Vector3()
  const _binorm = new THREE.Vector3()
  const _norm = new THREE.Vector3()
  const _centerPts: THREE.Vector3[] = Array.from({ length: segments + 1 }, () => new THREE.Vector3())

  let currentFlow = 0
  let disposed = false

  function evalArcPoint(start: THREE.Vector3, end: THREE.Vector3, v: number, target: THREE.Vector3) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const dz = end.z - start.z
    if (arcForward <= 1e-4) {
      return target.set(start.x + dx * v, start.y + dy * v, start.z + dz * v)
    }
    // Physical ballistic trajectory: horizontal velocity decelerates softly while gravity accelerates Y.
    const hPow = 1 + arcForward * 0.72
    const yPow = 1 + arcForward * 0.85
    const hT = 1 - Math.pow(1 - v, hPow)
    const yT = Math.pow(v, yPow)
    return target.set(start.x + dx * hT, start.y + dy * yT, start.z + dz * hT)
  }

  function updateArc(
    start: THREE.Vector3,
    end: THREE.Vector3,
    flow01: number,
    elapsed = 0,
    reducedMotion = false,
  ) {
    if (disposed) return
    const flow = Number.isFinite(flow01) ? THREE.MathUtils.clamp(flow01, 0, 1) : 0
    currentFlow = flow
    const dist = start.distanceTo(end)
    const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
    streamUniforms.wbrStreamTime.value = t
    streamUniforms.wbrStreamFlow.value = flow
    streamUniforms.wbrStreamReduced.value = reducedMotion ? 1 : 0

    if (flow <= 0.005 || !Number.isFinite(dist) || dist < 1e-4) {
      mesh.visible = false
      splashCrown.visible = false
      return
    }

    mesh.visible = true
    const radiusScale = Math.sqrt(flow)
    const pulseRate = THREE.MathUtils.lerp(6.8, 2.2, spec.viscosity)
    const livePulse = reducedMotion || t === 0 ? 0 : pulseAmplitude

    for (let i = 0; i <= segments; i++) {
      evalArcPoint(start, end, i / segments, _centerPts[i]!)
    }

    for (let i = 0; i <= segments; i++) {
      const v = i / segments
      const cur = _centerPts[i]!
      if (i === 0) {
        _tan.copy(_centerPts[1]!).sub(cur)
      } else if (i === segments) {
        _tan.copy(cur).sub(_centerPts[segments - 1]!)
      } else {
        _tan.copy(_centerPts[i + 1]!).sub(_centerPts[i - 1]!)
      }
      if (_tan.lengthSq() < 1e-10) _tan.set(0, -1, 0)
      else _tan.normalize()

      // Stable orthonormal frame with no vertical pole singularity.
      if (Math.abs(_tan.x) < 0.9) _ref.set(1, 0, 0)
      else _ref.set(0, 0, 1)
      _binorm.crossVectors(_tan, _ref).normalize()
      _norm.crossVectors(_binorm, _tan).normalize()

      // Gravity vena-contracta taper (wider at spout, smoothly narrower as speed increases).
      const taper = Math.pow(v, 0.62)
      let baseR = THREE.MathUtils.lerp(topRadius, bottomRadius, taper) * radiusScale
      // Soft necking & Rayleigh-Plateau traveling wave beads along the stream.
      if (livePulse > 0) {
        const wave = noise2D(v * 3.6 - t * pulseRate, 0.4)
        const pinch = Math.sin(v * 14.0 - t * pulseRate * 2.1) * 0.35
        const envelope = 0.25 + 0.75 * v
        baseR *= Math.max(0.55, 1 + (wave * 0.7 + pinch) * livePulse * envelope)
      }

      const rowOffset = i * ringStride
      for (let k = 0; k <= radialSegments; k++) {
        const cs = unitCos[k]!
        const sn = unitSin[k]!
        const nx = _norm.x * cs + _binorm.x * sn
        const ny = _norm.y * cs + _binorm.y * sn
        const nz = _norm.z * cs + _binorm.z * sn
        const idx = (rowOffset + k) * 3
        posArr[idx] = cur.x + nx * baseR
        posArr[idx + 1] = cur.y + ny * baseR
        posArr[idx + 2] = cur.z + nz * baseR
        normArr[idx] = nx
        normArr[idx + 1] = ny
        normArr[idx + 2] = nz
      }
    }

    posAttr.needsUpdate = true
    normAttr.needsUpdate = true
    streamGeo.computeBoundingSphere()

    if (showSplashCrown && flow > 0.04) {
      splashCrown.visible = true
      splashCrown.position.set(end.x, end.y + 0.002, end.z)
      const breath = reducedMotion ? 1 : 0.88 + 0.18 * (0.5 + 0.5 * noise2D(t * 5.2, 1.7))
      const sXZ = (0.55 + 0.55 * flow) * breath
      const sY = (0.45 + 0.65 * flow) * (reducedMotion ? 1 : 0.82 + 0.30 * Math.abs(Math.sin(t * 9.5)))
      splashCrown.scale.set(sXZ, sY, sXZ)
      splashCrown.rotation.y = reducedMotion ? 0 : t * 1.4
      crownMat.opacity = Math.min(opacity * 0.68, 0.52) * flow
    } else {
      splashCrown.visible = false
    }
    // Keep _pt / _ptNext referenced cleanly for strict unused checks.
    _pt.copy(start)
    _ptNext.copy(end)
  }

  function reset() {
    if (disposed) return
    currentFlow = 0
    streamUniforms.wbrStreamTime.value = 0
    streamUniforms.wbrStreamFlow.value = 0
    streamUniforms.wbrStreamReduced.value = 0
    mesh.visible = false
    splashCrown.visible = false
    splashCrown.scale.set(1, 1, 1)
    splashCrown.rotation.set(0, 0, 0)
  }

  return {
    root,
    mesh,
    splashCrown,
    material,
    get flow() { return currentFlow },
    updateArc,
    reset,
    dispose() {
      if (disposed) return
      disposed = true
      mesh.removeFromParent()
      splashCrown.removeFromParent()
      root.removeFromParent()
      streamGeo.dispose()
      material.dispose()
      crownGeo.dispose()
      crownMat.dispose()
    },
  }
}
