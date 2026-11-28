import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'

const MAX_RIPPLES = 8

export type StylizedWaterOptions<G extends THREE.BufferGeometry> = {
  /** Owned by this effect; the authored surface remains the interaction geometry. */
  geometry: G
  /** CircleGeometry faces +Z; a horizontal, already-rotated plane faces +Y. */
  normal?: 'z' | 'y'
  depth?: number
  color?: THREE.ColorRepresentation
  bedColor?: THREE.ColorRepresentation
  /** Optional shallow-edge tint for shoreline translucency. */
  shallowColor?: THREE.ColorRepresentation
  /** Optional deeper center tint for soft water-column absorption. */
  deepColor?: THREE.ColorRepresentation
  /** Warm Komorebi crest shimmer and shoreline foam tint. */
  foamColor?: THREE.ColorRepresentation
  opacity?: number
  waveScale?: number
  /** Subtle GPU vertex undulation amplitude (meters); CPU raycast geometry is never mutated. */
  waveAmplitude?: number
  causticScale?: number
  /** A sparse, narrow shoreline highlight for a circular pool. */
  radius?: number
  /** Ambient flow direction in world XZ (normalized internally). */
  flowDirection?: readonly [number, number]
  /** Ambient flow advection speed. */
  flowSpeed?: number
  /** Default radial propagation speed of interactive ripples (m/s). */
  rippleSpeed?: number
  /** Default exponential decay rate of interactive ripples (1/s). */
  rippleDamping?: number
  /** Default wavelength of interactive dispersive ripple rings (m). */
  rippleWavelength?: number
  /** Global interactive ripple intensity multiplier. */
  rippleStrength?: number
  /** Deterministic seed for CPU simplex surface sampling. */
  seed?: number
}

export type StylizedWaterSurfaceSample = {
  height: number
  slopeX: number
  slopeZ: number
  normal: THREE.Vector3
}

type RippleSlot = {
  x: number
  z: number
  birth: number
  strength: number
  maxRadius: number
  speed: number
  wavelength: number
  damping: number
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

function normalizeDir(dx: number, dz: number): [number, number] {
  const len = Math.hypot(dx, dz)
  if (!Number.isFinite(len) || len < 1e-6) return [0.924, 0.382]
  return [dx / len, dz / len]
}

const SHARED_WAVE_GLSL = /* glsl */ `
#define WBR_MAX_RIPPLES 8
uniform float wbrWaterTime;
uniform float wbrWaveScale;
uniform float wbrWaveAmp;
uniform float wbrWaterRadius;
uniform vec2 wbrFlowDir;
uniform float wbrFlowSpeed;
uniform float wbrRippleGain;
uniform float wbrWaterReduced;
uniform vec4 wbrRipples[WBR_MAX_RIPPLES];
uniform vec4 wbrRippleMeta[WBR_MAX_RIPPLES];

// Compact 2D Ashima-style simplex noise for organic flow advection without textures.
vec3 wbrMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 wbrMod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 wbrPermute(vec3 x) { return wbrMod289(((x * 34.0) + 1.0) * x); }

float wbrSimplex2D(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = wbrMod289(i);
  vec3 p = wbrPermute(wbrPermute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
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

// Evaluates ambient counter-drifting flow waves + simplex warp + 8 dispersive ripple packets.
// Returns vec4(slopeX, slopeZ, height, crestShimmer).
vec4 wbrWaterField(vec2 worldXZ) {
  vec2 fDir = wbrFlowDir;
  vec2 fPerp = vec2(-fDir.y, fDir.x);
  float t = wbrWaterTime;
  float flow = wbrFlowSpeed;
  vec2 p = worldXZ * wbrWaveScale;

  // Dual counter-drifting flow wave trains aligned to current + subtle cross-swell.
  vec2 kA = fDir * 2.55 + fPerp * 1.12;
  vec2 kB = fDir * -1.42 + fPerp * 3.05;
  vec2 kC = fDir * 5.20 - fPerp * 3.80;

  // Soft simplex curl-like phase warp breaks synthetic sine regularity.
  vec2 warpUv = p * 0.42 - fDir * (t * flow * 0.45);
  float nA = wbrSimplex2D(warpUv);
  float nB = wbrSimplex2D(p * 0.88 + fPerp * (t * flow * 0.32) + vec2(4.7, -2.3));
  float phaseWarp = nA * 0.58 + nB * 0.24;

  float a = dot(p, kA) - t * (0.42 + flow * 1.05) + phaseWarp * 0.65;
  float b = dot(p, kB) + t * (0.31 + flow * 0.62) - phaseWarp * 0.45;
  float c = dot(p, kC) - t * (0.68 + flow * 1.35) + nB * 0.55;

  float hAmbient = (sin(a) * 0.48 + sin(b) * 0.34 + sin(c) * 0.11 + nA * 0.26 + nB * 0.12) * wbrWaveAmp;

  vec2 slope = kA * (cos(a) * 0.020 * wbrWaveScale)
    + kB * (cos(b) * 0.014 * wbrWaveScale)
    + kC * (cos(c) * 0.0038 * wbrWaveScale);

  // Finite-difference simplex micro-slope for soft organic shimmer.
  float eps = 0.08;
  float nAx = wbrSimplex2D(warpUv + vec2(eps, 0.0)) - nA;
  float nAz = wbrSimplex2D(warpUv + vec2(0.0, eps)) - nA;
  slope += vec2(nAx, nAz) * (0.018 * wbrWaveScale / eps);

  float height = hAmbient;
  float crest = max(0.0, sin(a) * 0.5 + sin(c) * 0.35 + nB * 0.35) * 0.12;

  // Multi-source interactive dispersive ripple wave packets.
  for (int i = 0; i < WBR_MAX_RIPPLES; i++) {
    vec4 rp = wbrRipples[i];
    float strength = rp.w;
    if (strength <= 0.001) continue;
    float age = t - rp.z;
    if (age < 0.0 || age > 7.5) continue;

    vec4 meta = wbrRippleMeta[i];
    float maxRadius = meta.x;
    float speed = meta.y;
    float wavelength = meta.z;
    float damping = meta.w;

    vec2 delta = worldXZ - rp.xy;
    float dist = length(delta);
    if (dist > maxRadius) continue;

    float front = age * speed;
    float dr = dist - front;
    // Group packet broadens gently with travel time (realistic water dispersion).
    float packetW = max(wavelength * 0.88, 0.13 + age * 0.11);
    float invW2 = 1.0 / (packetW * packetW);
    float radialEnv = exp(-0.5 * dr * dr * invW2);
    float birthRamp = smoothstep(0.0, 0.075, age);
    float radiusFade = 1.0 - smoothstep(maxRadius * 0.55, maxRadius, dist);
    float spread = inversesqrt(1.0 + dist * 2.3);
    float env = strength * wbrRippleGain * birthRamp * exp(-age * damping) * radialEnv * radiusFade * spread;

    if (env <= 0.0005) continue;
    float k = 6.2831853 / max(wavelength, 0.08);
    float ph = k * dr;
    float cs = cos(ph);
    float sn = sin(ph);

    float amp = 0.020;
    height += env * amp * cs;
    float dhdR = env * amp * (-k * sn - dr * invW2 * cs);
    vec2 dir = dist > 0.0005 ? delta / dist : vec2(0.0);
    // Amplified normal slope gives crisp Komorebi specular wave rings even on flat pools.
    slope += dir * (dhdR * 2.85);
    crest += env * pow(max(0.0, cs), 2.4) * smoothstep(0.015, 0.11, dist) * 0.92;
  }

  float calm = 1.0 - wbrWaterReduced;
  return vec4(slope * mix(0.28, 1.0, calm), height * calm, crest * calm);
}
`

const WORLD_VERTEX = (normalAxis: 'y' | 'z') => /* glsl */ `
varying vec3 wbrWaterWorld;
varying vec3 wbrWaterLocal;
varying float wbrWaterCrestV;
${SHARED_WAVE_GLSL}
float wbrEdgePin(vec3 localPos) {
  if (wbrWaterRadius <= 0.0) return 1.0;
  float r = ${normalAxis === 'y' ? 'length(localPos.xz)' : 'length(localPos.xy)'} / wbrWaterRadius;
  return 1.0 - smoothstep(0.80, 0.985, r);
}
`

const WORLD_FRAGMENT = /* glsl */ `
varying vec3 wbrWaterWorld;
varying vec3 wbrWaterLocal;
varying float wbrWaterCrestV;
uniform float wbrCausticScale;
uniform vec3 wbrShallowColor;
uniform vec3 wbrDeepColor;
uniform vec3 wbrFoamColor;
${SHARED_WAVE_GLSL}
`

const CAUSTIC_FRAGMENT = /* glsl */ `
// Two warped cellular fields make the light network breathe, rather than slide
// a rigid polygon grid across the bed. This remains an artistic approximation.
vec2 wbrCellRandom(vec2 cell) {
  return fract(sin(vec2(dot(cell, vec2(123.4, 253.7)),
    dot(cell, vec2(371.9, 147.3)))) * 43713.73);
}
float wbrCellEdge(vec2 p, float phase) {
  vec2 cell = floor(p), local = fract(p);
  float nearest = 8.0, second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 seed = wbrCellRandom(cell + offset);
      vec2 site = 0.5 + 0.34 * sin(seed * 6.283185 + phase * (0.7 + seed.yx * 0.3));
      vec2 delta = offset + site - local;
      float d = dot(delta, delta);
      second = min(second, max(nearest, d));
      nearest = min(nearest, d);
    }
  }
  return sqrt(second) - sqrt(nearest);
}
float wbrLightFilament(float edge, float width) {
  float aa = max(fwidth(edge), 0.001);
  float core = 1.0 - smoothstep(max(0.0, width - aa), width + aa, edge);
  float halo = exp(-edge * edge / (width * width * 16.0));
  return core * 0.72 + halo * 0.28;
}
float wbrCaustic(vec2 world, vec2 refractedSlope) {
  vec2 p = (world + refractedSlope * 0.38) * wbrCausticScale * 0.70;
  float t = wbrWaterTime * 0.32;
  vec2 drift = wbrFlowDir * (t * wbrFlowSpeed * 0.52);
  p -= drift;
  vec2 warp = vec2(sin(p.y * 1.13 + p.x * 0.37 + t),
    sin(p.x * 1.27 - p.y * 0.29 - t * 0.83));
  p += warp * 0.72;
  p += 0.24 * vec2(sin(p.y * 2.41 - t * 0.71), sin(p.x * 2.17 + t * 0.62));
  float edgeA = wbrCellEdge(p + vec2(t * 0.15, -t * 0.11), t);
  vec2 crossed = mat2(0.8, -0.6, 0.6, 0.8) * p * 1.29 + vec2(7.2, 13.4);
  float edgeB = wbrCellEdge(crossed + vec2(-t * 0.12, t * 0.09), -t * 0.79);
  float focus = 0.5 + 0.5 * sin(p.x * 0.83 + p.y * 1.17 + sin(p.y * 0.71 - t) + t);
  float first = wbrLightFilament(edgeA, mix(0.015, 0.035, focus));
  float second = wbrLightFilament(edgeB, 0.018);
  float light = first * mix(0.08, 1.05, focus * focus)
    + second * (0.04 + smoothstep(0.6, 0.95, focus) * 0.13);
  // Fade subpixel cells toward the horizon instead of making a busy white mesh.
  float footprint = max(length(dFdx(p)), length(dFdy(p)));
  float distanceFade = 1.0 - smoothstep(9.0, 24.0, length(cameraPosition - wbrWaterWorld));
  return light * distanceFade * (1.0 - smoothstep(0.12, 0.42, footprint));
}
`

/**
 * A local WebGL water surface and its shallow sandy receiver. Uses the existing
 * Three lighting/fog pipeline; no textures, render targets or independent RAF.
 * Subtle vertex undulation and multi-source dispersive ripples run on the GPU
 * without ever mutating the authored CPU raycast geometry.
 */
export function createStylizedWater<G extends THREE.BufferGeometry>(options: StylizedWaterOptions<G>) {
  const normalAxis: 'y' | 'z' = options.normal === 'y' ? 'y' : 'z'
  const depth = options.depth ?? 0.22
  const baseColor = new THREE.Color(options.color ?? 0x67c5c2)
  const shallowColor = options.shallowColor !== undefined
    ? new THREE.Color(options.shallowColor)
    : baseColor.clone().lerp(new THREE.Color(0xcff3e5), 0.38)
  const deepColor = options.deepColor !== undefined
    ? new THREE.Color(options.deepColor)
    : baseColor.clone().multiplyScalar(0.64)
  const foamColor = new THREE.Color(options.foamColor ?? 0xf7f2e2)

  const [initFx, initFz] = normalizeDir(
    options.flowDirection?.[0] ?? 0.924,
    options.flowDirection?.[1] ?? 0.382,
  )
  const defaultFlowSpeed = Math.max(0, finiteOr(options.flowSpeed, 0.42))
  const defaultRippleSpeed = Math.max(0.1, finiteOr(options.rippleSpeed, 0.95))
  const defaultRippleDamping = Math.max(0.15, finiteOr(options.rippleDamping, 1.25))
  const defaultRippleWavelength = Math.max(0.08, finiteOr(options.rippleWavelength, 0.25))
  const defaultWaveScale = Math.max(0.05, finiteOr(options.waveScale, 1))
  const defaultWaveAmp = Math.max(0, finiteOr(options.waveAmplitude, 0.009))
  const defaultRippleGain = Math.max(0, finiteOr(options.rippleStrength, 1))
  const poolRadius = Math.max(0, finiteOr(options.radius, 0))

  const noise2D = createNoise2D(createSeededRandom(options.seed ?? 20261128))
  const clock = { value: 0 }
  const rippleVecs = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0))
  const rippleMetaVecs = Array.from(
    { length: MAX_RIPPLES },
    () => new THREE.Vector4(1.4, defaultRippleSpeed, defaultRippleWavelength, defaultRippleDamping),
  )
  const slots: RippleSlot[] = Array.from({ length: MAX_RIPPLES }, () => ({
    x: 0,
    z: 0,
    birth: -100,
    strength: 0,
    maxRadius: 1.4,
    speed: defaultRippleSpeed,
    wavelength: defaultRippleWavelength,
    damping: defaultRippleDamping,
    active: false,
  }))
  let rippleCursor = 0

  const uniforms = {
    wbrWaterTime: clock,
    wbrWaveScale: { value: defaultWaveScale },
    wbrWaveAmp: { value: defaultWaveAmp },
    wbrCausticScale: { value: finiteOr(options.causticScale, 3.6) },
    wbrWaterRadius: { value: poolRadius },
    wbrFlowDir: { value: new THREE.Vector2(initFx, initFz) },
    wbrFlowSpeed: { value: defaultFlowSpeed },
    wbrRippleGain: { value: defaultRippleGain },
    wbrWaterReduced: { value: 0 },
    wbrShallowColor: { value: shallowColor },
    wbrDeepColor: { value: deepColor },
    wbrFoamColor: { value: foamColor },
    wbrRipples: { value: rippleVecs },
    wbrRippleMeta: { value: rippleMetaVecs },
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: 0.20,
    metalness: 0,
    ior: 1.333,
    clearcoat: 0.48,
    clearcoatRoughness: 0.16,
    transparent: true,
    opacity: options.opacity ?? 0.48,
    depthWrite: false,
  })
  material.userData.waterRendering = true
  const bedMaterial = new THREE.MeshStandardMaterial({
    color: options.bedColor ?? 0xa9b28b,
    roughness: 0.93,
    // Keep the shader when the shared toon pass adapts opaque materials.
    transparent: true,
    opacity: 1,
    depthWrite: true,
  })

  const vertexHeader = WORLD_VERTEX(normalAxis)
  const displacementExpr = normalAxis === 'y'
    ? 'transformed.y += wbrVertField.z * wbrPin;'
    : 'transformed.z += wbrVertField.z * wbrPin;'

  for (const [target, bed] of [[material, false], [bedMaterial, true]] as const) {
    target.customProgramCacheKey = () =>
      bed
        ? `wbr-voronoi-water-bed-v3-${normalAxis}`
        : `wbr-shallow-water-v2-${normalAxis}`
    target.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = vertexHeader + shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        wbrWaterLocal = position;
        vec3 wbrPreWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        ${bed
          ? 'wbrWaterCrestV = 0.0; wbrWaterWorld = wbrPreWorld;'
          : `vec4 wbrVertField = wbrWaterField(wbrPreWorld.xz);
             float wbrPin = wbrEdgePin(position);
             ${displacementExpr}
             wbrWaterCrestV = wbrVertField.w * wbrPin;
             wbrWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`}
      `)
      shader.fragmentShader = WORLD_FRAGMENT + (bed ? CAUSTIC_FRAGMENT : '') + shader.fragmentShader
      if (bed) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          vec4 wbrBedField = wbrWaterField(wbrWaterWorld.xz);
          float waterCaustic = wbrCaustic(wbrWaterWorld.xz, wbrBedField.xy);
          float sand = sin(wbrWaterWorld.x * 19.0 + sin(wbrWaterWorld.z * 13.0))
            * sin(wbrWaterWorld.z * 17.0 + sin(wbrWaterWorld.x * 9.0));
          diffuseColor.rgb *= vec3(0.68, 0.87, 0.84) * (0.94 + sand * 0.045);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.96, 0.78), waterCaustic * 0.50);
          float rippleGlow = wbrBedField.w / (wbrBedField.w + 1.2);
          diffuseColor.rgb = mix(diffuseColor.rgb, wbrFoamColor, rippleGlow * 0.14);
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.38, 0.48, 0.32) * waterCaustic * 0.12;
        `)
      } else {
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
          #include <normal_fragment_maps>
          vec4 wbrSurfField = wbrWaterField(wbrWaterWorld.xz);
          vec2 waterSlope = wbrSurfField.xy;
          normal = normalize((viewMatrix * vec4(normalize(vec3(-waterSlope.x, 1.0, -waterSlope.y)), 0.0)).xyz);
        `).replace('#include <clearcoat_normal_fragment_maps>', `
          #include <clearcoat_normal_fragment_maps>
          #ifdef USE_CLEARCOAT
            clearcoatNormal = normal;
          #endif
        `).replace('#include <color_fragment>', `
          #include <color_fragment>
          vec4 wbrColorField = wbrWaterField(wbrWaterWorld.xz);
          float broadWave = sin(dot(wbrWaterWorld.xz, wbrFlowDir * 2.55) * wbrWaveScale - wbrWaterTime * (0.42 + wbrFlowSpeed * 1.05));
          // Soft depth absorption gradient + sunlit shallow edges.
          float depthBlend = 0.5 + 0.5 * clamp(broadWave * 0.5 + wbrColorField.z * 18.0, -1.0, 1.0);
          vec3 wbrBody = mix(wbrDeepColor, diffuseColor.rgb, mix(0.45, 1.0, depthBlend));
          float shore = 0.0;
          float shallow = 0.0;
          if (wbrWaterRadius > 0.0) {
            float edge = ${normalAxis === 'y' ? 'length(wbrWaterLocal.xz)' : 'length(wbrWaterLocal.xy)'} / wbrWaterRadius;
            shallow = smoothstep(0.62, 0.99, edge);
            float ang = ${normalAxis === 'y' ? 'atan(wbrWaterLocal.z, wbrWaterLocal.x)' : 'atan(wbrWaterLocal.y, wbrWaterLocal.x)'};
            float broken = smoothstep(0.15, 0.72, sin(ang * 9.0 + wbrWaterTime * 0.22) * 0.65 + cos(ang * 5.0 - wbrWaterTime * 0.16) * 0.35);
            shore = smoothstep(0.945, 0.992, edge) * broken * 0.38;
          } else {
            // Natural slow flow luminance variation on open streams and rivers.
            shallow = smoothstep(0.25, 0.95, 0.5 + 0.5 * wbrSimplex2D(wbrWaterWorld.xz * 0.35 - wbrFlowDir * (wbrWaterTime * wbrFlowSpeed * 0.3))) * 0.28;
          }
          diffuseColor.rgb = mix(wbrBody, wbrShallowColor, shallow * 0.52);
          // Warm Komorebi sky Fresnel + soft-knee crest shimmer (never harsh clipped white).
          vec3 wbrViewDir = normalize(vViewPosition);
          vec3 wbrWaveViewN = normalize((viewMatrix * vec4(normalize(vec3(-wbrColorField.x, 1.0, -wbrColorField.y)), 0.0)).xyz);
          float wbrFresnel = pow(clamp(1.0 - abs(dot(wbrWaveViewN, wbrViewDir)), 0.0, 1.0), 3.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(wbrShallowColor, wbrFoamColor, 0.65), wbrFresnel * 0.24);
          float rawCrest = max(wbrColorField.w, wbrWaterCrestV);
          float softCrest = rawCrest / (rawCrest + 0.85);
          float foamMix = clamp(shore + softCrest * 0.58, 0.0, 0.72);
          diffuseColor.rgb = mix(diffuseColor.rgb, wbrFoamColor, foamMix);
          diffuseColor.a = clamp(diffuseColor.a + shore * 0.24 + softCrest * 0.26 + wbrFresnel * 0.14, 0.0, 0.96);
        `).replace('#include <opaque_fragment>', `
          // Komorebi daylight soft-knee highlight shoulder keeps water sparkles warm and luminous.
          float wbrWaterPeak = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
          if (wbrWaterPeak > 0.82) {
            float wbrExcess = wbrWaterPeak - 0.82;
            float wbrTarget = 0.82 + 0.20 * (wbrExcess / (wbrExcess + 0.20));
            outgoingLight *= wbrTarget / wbrWaterPeak;
          }
          #include <opaque_fragment>
        `)
      }
    }
  }

  const surface = new THREE.Mesh(options.geometry, material)
  surface.name = 'stylized-water-surface'
  surface.receiveShadow = true
  surface.renderOrder = 1
  surface.userData.toonSurface = { outline: false }
  const bedGeometry = options.geometry.clone()
  const bed = new THREE.Mesh(bedGeometry, bedMaterial)
  bed.name = 'stylized-water-caustic-bed'
  bed.position[normalAxis] = -depth
  bed.receiveShadow = true
  bed.renderOrder = -1
  bed.userData.toonSurface = { outline: false }
  bed.raycast = () => {} // Decoration never adds a gesture target.
  surface.add(bed)

  let disposed = false

  function syncSlotUniform(index: number) {
    const slot = slots[index]!
    rippleVecs[index]!.set(slot.x, slot.z, slot.birth, slot.active ? slot.strength : 0)
    rippleMetaVecs[index]!.set(slot.maxRadius, slot.speed, slot.wavelength, slot.damping)
  }

  function expireRipples() {
    const t = clock.value
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const slot = slots[i]!
      if (!slot.active) continue
      const age = t - slot.birth
      if (age < 0 || age > 7.5 || Math.exp(-age * slot.damping) * slot.strength < 0.004 || age * slot.speed > slot.maxRadius + slot.wavelength * 2.5) {
        slot.active = false
        slot.strength = 0
        syncSlotUniform(i)
      }
    }
  }

  function sampleSurface(x: number, z: number): StylizedWaterSurfaceSample {
    const normal = new THREE.Vector3(0, 1, 0)
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return { height: 0, slopeX: 0, slopeZ: 0, normal }
    }
    const calm = 1 - uniforms.wbrWaterReduced.value
    if (calm <= 0.001) {
      return { height: 0, slopeX: 0, slopeZ: 0, normal }
    }

    const fx = uniforms.wbrFlowDir.value.x
    const fz = uniforms.wbrFlowDir.value.y
    const px = -fz
    const pz = fx
    const t = clock.value
    const flow = uniforms.wbrFlowSpeed.value
    const ws = uniforms.wbrWaveScale.value
    const amp = uniforms.wbrWaveAmp.value
    const sx = x * ws
    const sz = z * ws

    const kAx = fx * 2.55 + px * 1.12
    const kAz = fz * 2.55 + pz * 1.12
    const kBx = fx * -1.42 + px * 3.05
    const kBz = fz * -1.42 + pz * 3.05
    const kCx = fx * 5.20 - px * 3.80
    const kCz = fz * 5.20 - pz * 3.80

    const warpX = sx * 0.42 - fx * (t * flow * 0.45)
    const warpZ = sz * 0.42 - fz * (t * flow * 0.45)
    const nA = noise2D(warpX, warpZ)
    const nB = noise2D(sx * 0.88 + px * (t * flow * 0.32) + 4.7, sz * 0.88 + pz * (t * flow * 0.32) - 2.3)
    const phaseWarp = nA * 0.58 + nB * 0.24

    const a = sx * kAx + sz * kAz - t * (0.42 + flow * 1.05) + phaseWarp * 0.65
    const b = sx * kBx + sz * kBz + t * (0.31 + flow * 0.62) - phaseWarp * 0.45
    const c = sx * kCx + sz * kCz - t * (0.68 + flow * 1.35) + nB * 0.55

    let height = (Math.sin(a) * 0.48 + Math.sin(b) * 0.34 + Math.sin(c) * 0.11 + nA * 0.26 + nB * 0.12) * amp
    let slopeX = (kAx * Math.cos(a) * 0.020 + kBx * Math.cos(b) * 0.014 + kCx * Math.cos(c) * 0.0038) * ws
    let slopeZ = (kAz * Math.cos(a) * 0.020 + kBz * Math.cos(b) * 0.014 + kCz * Math.cos(c) * 0.0038) * ws

    const eps = 0.08
    const nAx = noise2D(warpX + eps, warpZ) - nA
    const nAz = noise2D(warpX, warpZ + eps) - nA
    slopeX += (nAx * 0.018 * ws) / eps
    slopeZ += (nAz * 0.018 * ws) / eps

    const gain = uniforms.wbrRippleGain.value
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const slot = slots[i]!
      if (!slot.active || slot.strength <= 0.001) continue
      const age = t - slot.birth
      if (age < 0 || age > 7.5) continue
      const dx = x - slot.x
      const dz = z - slot.z
      const dist = Math.hypot(dx, dz)
      if (dist > slot.maxRadius) continue

      const front = age * slot.speed
      const dr = dist - front
      const packetW = Math.max(slot.wavelength * 0.88, 0.13 + age * 0.11)
      const invW2 = 1 / (packetW * packetW)
      const radialEnv = Math.exp(-0.5 * dr * dr * invW2)
      const birthRamp = THREE.MathUtils.smoothstep(age, 0, 0.075)
      const radiusFade = 1 - THREE.MathUtils.smoothstep(dist, slot.maxRadius * 0.55, slot.maxRadius)
      const spread = 1 / Math.sqrt(1 + dist * 2.3)
      const env = slot.strength * gain * birthRamp * Math.exp(-age * slot.damping) * radialEnv * radiusFade * spread
      if (env <= 0.0005) continue

      const k = (Math.PI * 2) / Math.max(slot.wavelength, 0.08)
      const ph = k * dr
      const cs = Math.cos(ph)
      const sn = Math.sin(ph)
      const rippleAmp = 0.020
      height += env * rippleAmp * cs
      const dhdR = env * rippleAmp * (-k * sn - dr * invW2 * cs)
      if (dist > 0.0005) {
        slopeX += (dx / dist) * dhdR * 2.85
        slopeZ += (dz / dist) * dhdR * 2.85
      }
    }

    height *= calm
    slopeX *= calm
    slopeZ *= calm
    normal.set(-slopeX, 1, -slopeZ).normalize()
    return { height, slopeX, slopeZ, normal }
  }

  return {
    surface,
    bed,
    /** Seconds of animated time; reduced motion and inactive scenes hold this phase. */
    get time() { return clock.value },
    /** Count of live interactive ripple wave packets in the ring buffer. */
    get activeRippleCount() {
      let count = 0
      for (let i = 0; i < MAX_RIPPLES; i++) if (slots[i]!.active) count++
      return count
    },
    /** Queue a dispersive concentric ripple wave packet at world XZ coordinates. */
    triggerRipple(x: number, z: number, strength = 1, radius?: number) {
      if (disposed || !Number.isFinite(x) || !Number.isFinite(z)) return
      const clampedStrength = THREE.MathUtils.clamp(finiteOr(strength, 1), 0.05, 3.0)
      const fallbackRadius = poolRadius > 0 ? Math.max(poolRadius * 1.15, 0.65) : 1.8
      const clampedRadius = THREE.MathUtils.clamp(finiteOr(radius, fallbackRadius), 0.15, 6.0)

      let slotIndex = -1
      for (let i = 0; i < MAX_RIPPLES; i++) {
        if (!slots[i]!.active) {
          slotIndex = i
          break
        }
      }
      if (slotIndex === -1) {
        slotIndex = rippleCursor
        rippleCursor = (rippleCursor + 1) % MAX_RIPPLES
      }

      const slot = slots[slotIndex]!
      slot.x = x
      slot.z = z
      slot.birth = clock.value
      slot.strength = clampedStrength
      slot.maxRadius = clampedRadius
      slot.speed = defaultRippleSpeed
      slot.wavelength = defaultRippleWavelength
      slot.damping = defaultRippleDamping
      slot.active = true
      syncSlotUniform(slotIndex)
    },
    /** Adjust ambient current direction in world XZ and optional advection speed. */
    setFlowDirection(dx: number, dz: number, speed?: number) {
      if (disposed) return
      const [nx, nz] = normalizeDir(dx, dz)
      uniforms.wbrFlowDir.value.set(nx, nz)
      if (speed !== undefined && Number.isFinite(speed) && speed >= 0) {
        uniforms.wbrFlowSpeed.value = speed
      }
    },
    /** Sample live wave + active ripple height at world XZ for buoyant props. */
    sampleHeight(x: number, z: number) {
      return sampleSurface(x, z).height
    },
    /** Sample live wave + active ripple height, slope and surface normal at world XZ. */
    sampleSurface,
    /** Remove all active ripple pulses without altering water clock. */
    clearRipples() {
      for (let i = 0; i < MAX_RIPPLES; i++) {
        slots[i]!.active = false
        slots[i]!.strength = 0
        slots[i]!.birth = -100
        syncSlotUniform(i)
      }
      rippleCursor = 0
    },
    /** Reset clock and ripples cleanly to deterministic initial state. */
    reset() {
      if (disposed) return
      clock.value = 0
      uniforms.wbrWaterReduced.value = 0
      for (let i = 0; i < MAX_RIPPLES; i++) {
        slots[i]!.active = false
        slots[i]!.strength = 0
        slots[i]!.birth = -100
        syncSlotUniform(i)
      }
      rippleCursor = 0
    },
    update(dt: number, reducedMotion = false) {
      if (disposed) return
      uniforms.wbrWaterReduced.value = reducedMotion ? 1 : 0
      if (reducedMotion || !Number.isFinite(dt) || dt <= 0) return
      clock.value += Math.min(dt, 0.1)
      expireRipples()
    },
    dispose() {
      if (disposed) return
      disposed = true
      surface.removeFromParent()
      surface.remove(bed)
      options.geometry.dispose()
      bedGeometry.dispose()
      material.dispose()
      bedMaterial.dispose()
    },
  }
}
