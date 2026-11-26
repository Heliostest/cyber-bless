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
#ifdef RUYI_WOOD
varying vec3 vLocal;
varying vec3 vWoodSeed;
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
#ifdef RUYI_WOOD
  vLocal = position;
  vec3 origin = modelMatrix[3].xyz;
  vWoodSeed = vec3(
    sin(dot(origin, vec3(4.17, 2.83, 5.13)) + 0.71) * 0.65 + sin(dot(origin, vec3(-2.41, 6.19, 3.37)) + 2.34) * 0.35,
    sin(dot(origin, vec3(3.29, -4.71, 4.61)) + 1.93) * 0.65 + sin(dot(origin, vec3(5.83, 2.11, -3.79)) + 0.47) * 0.35,
    sin(dot(origin, vec3(-5.03, 3.67, 2.93)) + 3.41) * 0.65 + sin(dot(origin, vec3(2.77, -4.39, 5.57)) + 4.89) * 0.35
  );
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
#ifdef RUYI_WOOD
uniform float uWoodVertical;
varying vec3 vLocal;
varying vec3 vWoodSeed;
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
#ifdef RUYI_WOOD
  // Soft, analytically anti-aliased stylized rosewood grain along the plank (X) or turned post (Y).
  float along = mix(vLocal.x, vLocal.y, uWoodVertical);
  vec2 across = mix(vLocal.zy, vLocal.xz, uWoodVertical);
  float sX = vWoodSeed.x;
  vec2 pith = mix(vec2(0.18, -0.09), vec2(0.025, -0.020), uWoodVertical)
            + vWoodSeed.yz * mix(vec2(0.05, 0.03), vec2(0.015, 0.015), uWoodVertical);
  float driftA = sin(along * mix(3.4, 7.8, uWoodVertical) + sX * 3.1 + 0.6);
  float driftB = cos(along * mix(6.8, 15.2, uWoodVertical) - vWoodSeed.y * 2.7 + across.x * 4.5);
  vec2 warp = vec2(driftA * 0.028 + driftB * 0.010, driftA * 0.017 - driftB * 0.007)
            * mix(1.0, 0.45, uWoodVertical);
  vec2 radial = (across - pith + warp) * vec2(1.0, 0.88);
  float r = length(radial) + 0.009 * sin(along * 2.3 + radial.x * 11.0 + vWoodSeed.z * 2.9);
  float freq = mix(88.0, 126.0, uWoodVertical);
  float phase = r * freq;
  float fw = fwidth(phase);
  float ring = 0.68 * cos(phase) * exp(-0.42 * fw * fw)
             + 0.24 * cos(2.0 * phase - 0.55) * exp(-1.68 * fw * fw);
  float wash = sin(along * mix(2.4, 5.5, uWoodVertical) + across.x * 6.0 + vWoodSeed.z * 3.0) * 0.5
             + cos(along * mix(4.9, 10.4, uWoodVertical) - across.y * 5.2 + sX * 2.1) * 0.5;
  // Calm modulation inside deep cel shadows while keeping rosewood ribbons warm and legible.
  float litMask = mix(0.62, 1.0, smoothstep(uBands.x - 0.05, uBands.x + 0.12, light));
  float grain = (-ring * mix(0.84, 0.96, uWoodVertical) + wash * 0.24) * litMask;
  float late = clamp(-grain, 0.0, 1.0);
  float early = clamp(grain, 0.0, 1.0);
  color *= mix(vec3(1.0), vec3(0.68, 0.56, 0.48), late * mix(0.84, 0.92, uWoodVertical));
  color *= vec3(1.0) + early * vec3(0.26, 0.20, 0.12) * mix(1.0, 1.14, uWoodVertical);
#endif
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

export function createRuyiToonMaterial(name: string, tone: RuyiTone, options: { jade?: boolean; wood?: 'x' | 'y'; bands?: [number, number] } = {}) {
  const uniforms: Record<string, THREE.IUniform> = {
    uLit: { value: new THREE.Color(tone.lit) }, uBase: { value: new THREE.Color(tone.base) }, uShade: { value: new THREE.Color(tone.shade) },
    uKey: { value: KEY.clone() }, uBands: { value: new THREE.Vector2(...(options.bands ?? [.42, .80])) },
  }
  const defines: Record<string, string> = {}
  if (options.jade) {
    defines.RUYI_JADE = ''
    Object.assign(uniforms, { uGlow: { value: new THREE.Color(0xf2fff8) }, uSweep: { value: -1 }, uSweepGain: { value: 0 } })
  } else if (options.wood) {
    defines.RUYI_WOOD = ''
    uniforms.uWoodVertical = { value: options.wood === 'y' ? 1 : 0 }
  }
  const material = new THREE.ShaderMaterial({ name, uniforms, vertexShader: vertex, fragmentShader: fragment, defines })
  material.userData.ruyiToon = options.jade ? 'jade' : options.wood ? 'wood' : 'solid'
  if (options.wood) material.userData.ruyiWoodAxis = options.wood
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
