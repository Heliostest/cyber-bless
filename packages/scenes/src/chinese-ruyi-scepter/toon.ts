import * as THREE from 'three'

// Scene-local cel shading for the ruyi and its stand. These are ShaderMaterials
// on purpose: the shared toon-soft adapter leaves non-standard materials as they
// are, so the authored three-tone bands, the inner light band and the outline
// shells survive every render style without touching the global look.

/** Fixed key direction, matching this scene's key light at (-3, 5, 4). */
const KEY = new THREE.Vector3(-3, 5, 4).normalize()

export type RuyiTone = { lit: THREE.ColorRepresentation; base: THREE.ColorRepresentation; shade: THREE.ColorRepresentation }

const vertex = /* glsl */`
#ifdef RUYI_JADE
attribute vec4 ruyiMask;
varying vec4 vMask;
#endif
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
#ifdef RUYI_JADE
  vMask = ruyiMask;
#endif
  gl_Position = projectionMatrix * viewMatrix * world;
}`

const fragment = /* glsl */`
uniform vec3 uLit;
uniform vec3 uBase;
uniform vec3 uShade;
uniform vec3 uKey;
uniform vec2 uBands;
#ifdef RUYI_JADE
uniform vec3 uGlow;
uniform float uSweep;
uniform float uSweepGain;
varying vec4 vMask;
#endif
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  float light = dot(n, uKey) * 0.5 + 0.5;
  // Three flat tones with short joins rather than continuous falloff.
  vec3 color = mix(uShade, uBase, smoothstep(uBands.x - 0.03, uBands.x + 0.03, light));
  color = mix(color, uLit, smoothstep(uBands.y - 0.025, uBands.y + 0.025, light));
#ifdef RUYI_JADE
  float facing = max(dot(n, v), 0.0);
  float rim = 1.0 - facing;
  // A narrow inner light band on edges turned from the key light: cloud-lobe
  // rims and the handle end only (vMask.z). Computed from the view, no lamp.
  float away = smoothstep(0.62, 0.30, light);
  float band = smoothstep(0.52, 0.62, rim) * (1.0 - smoothstep(0.80, 0.92, rim));
  color = mix(color, uGlow, band * mix(0.35, 0.9, away) * vMask.z);
  vec3 h = normalize(uKey + v);
  float spec = dot(n, h);
  // One hard-edged long highlight along the handle ridge (vMask.y) and one
  // small spot on the highest cloud lobe (vMask.w). Both follow the view.
  color = mix(color, vec3(0.97, 1.0, 0.98), smoothstep(0.962, 0.968, spec) * vMask.y * 0.85);
  color = mix(color, vec3(0.98, 1.0, 0.99), smoothstep(0.986, 0.990, spec) * vMask.w * 0.9);
  // Optional travelling light along the length (0 tail .. 1 cloud tip).
  float sweep = exp(-pow((vMask.x - uSweep) / 0.05, 2.0)) * uSweepGain * smoothstep(0.30, 0.65, facing);
  color = mix(color, uGlow, clamp(sweep, 0.0, 1.0));
#endif
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function createRuyiToonMaterial(name: string, tone: RuyiTone, options: { jade?: boolean; bands?: [number, number] } = {}) {
  const uniforms: Record<string, THREE.IUniform> = {
    uLit: { value: new THREE.Color(tone.lit) }, uBase: { value: new THREE.Color(tone.base) }, uShade: { value: new THREE.Color(tone.shade) },
    uKey: { value: KEY.clone() }, uBands: { value: new THREE.Vector2(...(options.bands ?? [.42, .80])) },
  }
  if (options.jade) Object.assign(uniforms, { uGlow: { value: new THREE.Color(0xf2fff8) }, uSweep: { value: -1 }, uSweepGain: { value: 0 } })
  const material = new THREE.ShaderMaterial({ name, uniforms, vertexShader: vertex, fragmentShader: fragment, defines: options.jade ? { RUYI_JADE: '' } : {} })
  material.userData.ruyiToon = options.jade ? 'jade' : 'solid'
  return material
}

const shellVertex = /* glsl */`
uniform vec2 uResolution;
uniform float uWidth;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

/** CSS-pixel width of every ruyi and stand outline. */
export const RUYI_LINE_WIDTH = 1.75
const size = new THREE.Vector2()

/** An inverted-hull outline in the same hue family as its surface. It never
 * casts shadows and never takes part in picking. */
export function createOutlineShell(name: string, geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const material = new THREE.ShaderMaterial({ name: name + '-material', side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uWidth: { value: RUYI_LINE_WIDTH }, uResolution: { value: new THREE.Vector2(1, 1) } },
    vertexShader: shellVertex, fragmentShader: shellFragment })
  material.userData.ruyiToon = 'outline'
  const shell = new THREE.Mesh(geometry, material)
  shell.name = name; shell.castShadow = shell.receiveShadow = false
  shell.userData.toonSurface = { outline: false }
  shell.raycast = () => {}
  shell.onBeforeRender = renderer => {
    renderer.getDrawingBufferSize(size)
    const target = renderer.getRenderTarget()
    if (target) size.set(target.width, target.height)
    material.uniforms.uResolution!.value.copy(size)
    material.uniforms.uWidth!.value = RUYI_LINE_WIDTH * renderer.getPixelRatio()
  }
  return shell
}

const shadowFragment = /* glsl */`
varying vec2 vUv;
uniform vec3 uColor;
uniform float uStrength;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * uStrength;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`

/** A soft elliptical contact shadow drawn just above its supporting surface. */
export function createContactShadow(name: string, width: number, depth: number, strength = .42) {
  const material = new THREE.ShaderMaterial({ name: name + '-material', transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0x2f2a22) }, uStrength: { value: strength } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: shadowFragment })
  material.userData.ruyiToon = 'contact-shadow'
  const geometry = new THREE.PlaneGeometry(width, depth); geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name; mesh.renderOrder = -1; mesh.castShadow = mesh.receiveShadow = false
  mesh.userData.toonSurface = { outline: false }
  mesh.raycast = () => {}
  return mesh
}
