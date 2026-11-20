import * as THREE from 'three'

// Scene-local cel shading for the silver lock necklace, its velvet carrier, the
// gift case and the preparation stand. These are ShaderMaterials on purpose:
// the shared toon-soft adapter leaves non-standard materials as they are, so the
// authored three-tone bands, the view-dependent silver highlights and the
// outline shells survive every render style without touching the global look.
// They still receive the scene key light's real shadow map.

/** Fixed key direction, matching this scene's key light at (-3, 5, 4). */
const KEY = new THREE.Vector3(-3, 5, 4).normalize()

export type LockTone = { lit: THREE.ColorRepresentation; base: THREE.ColorRepresentation; shade: THREE.ColorRepresentation }
export type LockSurface = 'silver' | 'relief' | 'cord' | 'velvet' | 'wood'
export type SweepUniforms = { uSweep: THREE.IUniform<number>; uSweepGain: THREE.IUniform<number> }

const vertex = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vLocal;
#ifdef LOCK_CORD
varying vec2 vUv;
#endif
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vLocal = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
#ifdef LOCK_CORD
  vUv = uv;
#endif
}`

const fragment = /* glsl */`
uniform vec3 uLit;
uniform vec3 uBase;
uniform vec3 uShade;
uniform vec3 uKey;
uniform vec2 uBands;
#ifdef LOCK_METAL
uniform vec3 uHorizon;
uniform float uBend;
uniform float uHorizonGain;
uniform float uSide;
uniform vec3 uStreakBand;
uniform float uStreak;
uniform float uSpot;
uniform float uSweep;
uniform float uSweepGain;
#endif
#ifdef LOCK_CORD
uniform float uTwist;
varying vec2 vUv;
#endif
#ifdef LOCK_VELVET
uniform vec3 uSheen;
#endif
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vLocal;
#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  float facing = max(dot(n, v), 0.0);
  vec3 ns = n;
#ifdef LOCK_METAL
  // Gentle domes shade as if a little fuller, so the bands cross the face.
  ns = normalize(vec3(n.x * uBend, n.y, n.z * uBend));
#endif
  // Half-Lambert key light, clamped into the shade band by the real cast shadow.
  float light = dot(ns, uKey) * 0.5 + 0.5;
  float shadow = getShadowMask();
  light = min(light, mix(uBands.x - 0.08, 1.0, shadow));
  // Three flat tones with short joins rather than continuous falloff.
  vec3 color = mix(uShade, uBase, smoothstep(uBands.x - 0.03, uBands.x + 0.03, light));
  color = mix(color, uLit, smoothstep(uBands.y - 0.025, uBands.y + 0.025, light));
#ifdef LOCK_METAL
  // Stylized polished silver, read from view-space normals so it slides with the
  // view: viewer-facing lower slopes take a soft cool band, and one hard-edged
  // streak runs across the upper face. Small hard key spots sit on the edges.
  vec3 nv = normalize((viewMatrix * vec4(ns, 0.0)).xyz);
  float horizon = 1.0 - smoothstep(uStreakBand.z - 0.03, uStreakBand.z + 0.03, nv.y);
  color = mix(color, uHorizon, horizon * uHorizonGain);
  // Thickness reads as a darker side wall under the lit face.
  color = mix(color, uShade, (1.0 - smoothstep(0.3, 0.62, n.y)) * uSide);
  float streak = smoothstep(uStreakBand.x - 0.01, uStreakBand.x + 0.01, nv.y) * (1.0 - smoothstep(uStreakBand.y - 0.01, uStreakBand.y + 0.01, nv.y)) * (1.0 - smoothstep(0.42, 0.58, abs(nv.x)));
  color = mix(color, vec3(1.0), streak * uStreak * mix(0.35, 1.0, shadow));
  float spec = dot(ns, normalize(uKey + v));
  color = mix(color, vec3(1.0), smoothstep(0.972, 0.978, spec) * uSpot * shadow);
  // Optional faint light travelling across the lock frame (idle / settle).
  float coord = (vLocal.x * 0.86 - vLocal.z * 0.5) * 0.62 + 0.5;
  float sweep = exp(-pow((coord - uSweep) / 0.07, 2.0)) * uSweepGain * smoothstep(0.2, 0.6, facing);
  color = mix(color, vec3(1.0), clamp(sweep, 0.0, 1.0));
#endif
#ifdef LOCK_CORD
  // A quiet two-ply twist that fades out before it can shimmer at phone size.
  float twist = vUv.x * uTwist + vUv.y * 2.0;
  float w = fwidth(twist);
  float ply = smoothstep(0.32, 0.5, abs(fract(twist) - 0.5));
  color *= 1.0 - 0.13 * ply * (1.0 - smoothstep(0.18, 0.4, w));
#endif
#ifdef LOCK_VELVET
  // Velvet brightens toward grazing edges instead of showing a specular spot.
  color += uSheen * smoothstep(0.5, 0.95, 1.0 - facing);
#endif
#ifdef LOCK_WOOD
  float grain = sin(vLocal.z * 31.0 + sin(vLocal.x * 4.1 + vLocal.z * 1.7) * 2.3 + vLocal.y * 9.0);
  float gw = fwidth(vLocal.z * 31.0);
  color *= 1.0 + 0.045 * grain * (1.0 - smoothstep(0.6, 1.4, gw));
#endif
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function createLockToonFactory() {
  const sweep: SweepUniforms = { uSweep: { value: -1 }, uSweepGain: { value: 0 } }
  type Options = { bands?: [number, number]; bend?: number; horizonGain?: number; side?: number; streak?: number; spot?: number; streakBand?: [number, number, number]; horizon?: THREE.ColorRepresentation; sheen?: THREE.ColorRepresentation; twist?: number; sweep?: boolean }
  const create = (name: string, surface: LockSurface, tone: LockTone, options: Options = {}) => {
    const uniforms: Record<string, THREE.IUniform> = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      uLit: { value: new THREE.Color(tone.lit) }, uBase: { value: new THREE.Color(tone.base) }, uShade: { value: new THREE.Color(tone.shade) },
      uKey: { value: KEY.clone() }, uBands: { value: new THREE.Vector2(...(options.bands ?? [.42, .80])) },
    }])
    const defines: Record<string, string> = {}
    if (surface === 'silver' || surface === 'relief') {
      defines.LOCK_METAL = ''
      Object.assign(uniforms, {
        uHorizon: { value: new THREE.Color(options.horizon ?? tone.base) }, uBend: { value: options.bend ?? 1 }, uHorizonGain: { value: options.horizonGain ?? .4 }, uSide: { value: options.side ?? 0 },
        uStreakBand: { value: new THREE.Vector3(...(options.streakBand ?? [.86, .90, .61])) },
        uStreak: { value: options.streak ?? 0 }, uSpot: { value: options.spot ?? 0 },
      })
      // The plate shares one travelling light; other parts keep theirs switched off.
      if (options.sweep) { uniforms.uSweep = sweep.uSweep; uniforms.uSweepGain = sweep.uSweepGain }
      else Object.assign(uniforms, { uSweep: { value: -1 }, uSweepGain: { value: 0 } })
    } else if (surface === 'cord') { defines.LOCK_CORD = ''; uniforms.uTwist = { value: options.twist ?? 60 } }
    else if (surface === 'velvet') { defines.LOCK_VELVET = ''; uniforms.uSheen = { value: new THREE.Color(options.sheen ?? 0x000000) } }
    else defines.LOCK_WOOD = ''
    const material = new THREE.ShaderMaterial({ name, uniforms, defines, vertexShader: vertex, fragmentShader: fragment, lights: true })
    material.userData.longevityToon = surface
    return material
  }
  return { create, sweep }
}

const shellVertex = /* glsl */`
uniform vec2 uResolution;
uniform float uWidth;
void main() {
  // A hair behind the surface, so concave notches do not show the hull through the face.
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  view.xyz += normalize(view.xyz) * 0.003;
  vec4 clip = projectionMatrix * view;
  vec3 viewNormal = normalize(normalMatrix * normal);
  vec2 direction = (projectionMatrix * vec4(viewNormal, 0.0)).xy;
  float size = length(direction);
  direction = size > 1e-5 ? direction / size : vec2(0.0);
  // Push the back-facing hull out by a fixed number of device pixels, so the
  // line keeps its width when the camera comes close.
  clip.xy += direction * uWidth * 2.0 / max(uResolution, vec2(1.0)) * clip.w;
  gl_Position = clip;
}`
const shellFragment = /* glsl */`
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/** CSS-pixel width of every lock, carrier and case outline. */
export const LOCK_LINE_WIDTH = 1.75
const size = new THREE.Vector2()

/** An inverted-hull outline in the same hue family as its surface. It never
 * casts shadows and never takes part in picking. */
export function createOutlineShell(name: string, geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, width = LOCK_LINE_WIDTH) {
  const material = new THREE.ShaderMaterial({ name: name + '-material', side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uWidth: { value: width }, uResolution: { value: new THREE.Vector2(1, 1) } },
    vertexShader: shellVertex, fragmentShader: shellFragment })
  material.userData.longevityToon = 'outline'
  const shell = new THREE.Mesh(geometry, material)
  shell.name = name; shell.castShadow = shell.receiveShadow = false
  shell.userData.toonSurface = { outline: false }
  shell.userData.longevityOutline = true
  shell.raycast = () => {}
  shell.onBeforeRender = renderer => {
    renderer.getDrawingBufferSize(size)
    const target = renderer.getRenderTarget()
    if (target) size.set(target.width, target.height)
    material.uniforms.uResolution!.value.copy(size)
    material.uniforms.uWidth!.value = width * renderer.getPixelRatio()
  }
  return shell
}
