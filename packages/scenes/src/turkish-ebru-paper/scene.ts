import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { LIQUID_PRESETS } from '@wbr/scene-runtime/vessel-liquid'
import { createNoise2D } from 'simplex-noise'
import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { completesDirectionalDrag } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '浮彩成笺', comb: '握住木梳柄，向右缓缓梳开彩纹；梳子移开后，白纸轻贴水面。',
  peel: '按住白纸任意位置，向上轻揭，让浮彩随纸慢慢显现。',
  quiet: '轻点彩纸静看，或写一句心意后点「写好了」。',
  returning: '轻点彩纸，回看水与颜色留下的纹路。', done: '把一片流动的颜色留在纸上。',
  combing: '梳齿离开水面，白纸缓缓贴合浮彩…', peeling: '从近处纸边轻揭，接触水面的彩纹随纸升起…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const ease = (t: number) => t * t * (3 - 2 * t)
const GRIP: XYZ = [0, 0, .09], QUIET: XYZ = [0, 1.6, .28]
const W = 2.94, D = 1.9, WATER_Y = .45

/** Original contemporary appreciation of pigment floating on liquid and transferring by contact. */
export function createTurkishEbruPaper(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null, lifecycleVersion = 0, callbackVersion = 0
  let motion: { step: 0 | 1; time: number; comb: number; peel: number } | null = null
  let dragging = false, maxTravel = 0, maxCross = 0, moved = 0, maxAlong = 0, minAlong = 0, backtrack = 0
  let combAmount = 0, contactAmount = 0, peelAmount = 0, patternAmount = -1
  const peelAnchor: XYZ = [0, WATER_Y, D * (.5 - .125)]
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向右梳开彩纹' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'turkish-ebru-paper', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xe8e4d5, ground: 0x877c68, key: 0xffe6bd, rim: 0xcae9ee, keyPosition: [-3, 6, 4], keyIntensity: 1.5, rimIntensity: .5 })
  const world = new THREE.Group(); world.name = 'ebru-subject'; scene.add(world)
  const mat = (color: number, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const copper = mat(0xb66d48, .4, .35), brightCopper = mat(0xe2a16c, .35, .28), timber = mat(0xad6838), steel = mat(0xc4cec9, .26, .64)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ = [0, 0, 0], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent: THREE.Object3D = world) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.045, ...size.map(n => n / 3))), material, p, parent)
  // A standalone shallow metal tray: there is no table or presentation board.
  box('ebru-tray-base', [3.34, .14, 2.28], [0, .29, 0], copper)
  for (const side of [-1, 1]) {
    box(`ebru-tray-side-${side}`, [.15, .23, 2.25], [side * 1.60, .42, 0], copper)
    box(`ebru-tray-end-${side}`, [3.25, .23, .15], [0, .42, side * 1.065], copper)
    box(`ebru-rim-side-${side}`, [.045, .035, 2.18], [side * 1.585, .54, 0], brightCopper)
    box(`ebru-rim-end-${side}`, [3.15, .035, .045], [0, .54, side * 1.065], brightCopper)
    for (const x of [-1.36, 1.36]) add(`ebru-rivet-${side}-${x}`, new THREE.SphereGeometry(.023, 8, 6), brightCopper, [x, .415, side * 1.144])
  }
  // Living rectangular tragacanth-gum marbling bath with 4-wall capillary meniscus,
  // comb-pin wake ripples, peel-line suction waves, and subtle viscous surface shimmer.
  const ebruSpec = LIQUID_PRESETS['ebru-bath']
  const BATH_W = 3.04, BATH_D = 1.98, BATH_NX = 36, BATH_NZ = 24, BATH_BASE_Y = .435, BATH_MENISCUS_H = .011
  const bathVertCount = (BATH_NX + 1) * (BATH_NZ + 1)
  const bathRestPos = new Float32Array(bathVertCount * 3)
  const bathRestNorm = new Float32Array(bathVertCount * 3)
  const bathPos = new Float32Array(bathVertCount * 3)
  const bathNorm = new Float32Array(bathVertCount * 3)
  const bathUv = new Float32Array(bathVertCount * 2)
  const bathWallT = new Float32Array(bathVertCount)
  const bathIndices: number[] = []
  const halfBathW = BATH_W * .5, halfBathD = BATH_D * .5
  const meniscusLift = (edgeT: number) => {
    if (edgeT <= .80) return 0
    const u = THREE.MathUtils.clamp((edgeT - .80) / .20, 0, 1)
    return BATH_MENISCUS_H * Math.pow(u, 2.15)
  }
  for (let iz = 0; iz <= BATH_NZ; iz++) {
    const vz = iz / BATH_NZ
    const z = (vz - .5) * BATH_D
    const az = Math.abs(z) / halfBathD
    for (let ix = 0; ix <= BATH_NX; ix++) {
      const ux = ix / BATH_NX
      const x = (ux - .5) * BATH_W
      const ax = Math.abs(x) / halfBathW
      const edgeT = Math.max(ax, az)
      const vi = iz * (BATH_NX + 1) + ix
      bathRestPos[vi * 3] = x
      bathRestPos[vi * 3 + 1] = meniscusLift(edgeT)
      bathRestPos[vi * 3 + 2] = z
      bathUv[vi * 2] = ux
      bathUv[vi * 2 + 1] = vz
      bathWallT[vi] = edgeT
    }
  }
  for (let iz = 0; iz < BATH_NZ; iz++) for (let ix = 0; ix < BATH_NX; ix++) {
    const a = iz * (BATH_NX + 1) + ix, b = a + 1, c = a + BATH_NX + 1, d = c + 1
    bathIndices.push(a, c, b, b, c, d)
  }
  bathPos.set(bathRestPos)
  const bathGeo = new THREE.BufferGeometry()
  const bathPosAttr = new THREE.BufferAttribute(bathPos, 3)
  const bathNormAttr = new THREE.BufferAttribute(bathNorm, 3)
  bathGeo.setAttribute('position', bathPosAttr)
  bathGeo.setAttribute('normal', bathNormAttr)
  bathGeo.setAttribute('uv', new THREE.BufferAttribute(bathUv, 2))
  bathGeo.setIndex(bathIndices)
  bathGeo.computeVertexNormals()
  bathRestNorm.set(bathNorm)

  const bathUniforms = {
    wbrEbruTime: { value: 0 },
    wbrEbruReduced: { value: 0 },
    wbrEbruEnergy: { value: 0 },
    wbrEbruEdgeColor: { value: new THREE.Color(0xedf6f2) },
    wbrEbruDeepColor: { value: new THREE.Color(0x8baaa2) },
    wbrEbruFoamColor: { value: new THREE.Color(ebruSpec.foamColor) },
  }
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xc2ddd4,
    roughness: ebruSpec.roughness,
    metalness: 0,
    ior: ebruSpec.ior,
    clearcoat: Math.max(ebruSpec.clearcoat, .76),
    clearcoatRoughness: ebruSpec.clearcoatRoughness,
    transparent: true,
    opacity: .84,
    depthWrite: false,
  })
  liquidMat.userData.waterRendering = false // Pigment-bearing size is not clear water.
  liquidMat.customProgramCacheKey = () => 'wbr-ebru-tragacanth-bath-v1'
  liquidMat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, bathUniforms)
    shader.vertexShader = `varying vec3 wbrEbruLocal;\n` + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrEbruLocal = position;
    `)
    shader.fragmentShader = `
varying vec3 wbrEbruLocal;
uniform float wbrEbruTime;
uniform float wbrEbruReduced;
uniform float wbrEbruEnergy;
uniform vec3 wbrEbruEdgeColor;
uniform vec3 wbrEbruDeepColor;
uniform vec3 wbrEbruFoamColor;
` + shader.fragmentShader
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float edgeX = abs(wbrEbruLocal.x) / ${halfBathW.toFixed(4)};
        float edgeZ = abs(wbrEbruLocal.z) / ${halfBathD.toFixed(4)};
        float wallEdge = max(edgeX, edgeZ);
        float centerDepth = 1.0 - smoothstep(0.18, 0.94, wallEdge);
        vec3 bathBody = mix(diffuseColor.rgb, wbrEbruDeepColor, centerDepth * 0.42);
        float meniscusRim = smoothstep(0.78, 0.995, wallEdge);
        float tLive = wbrEbruTime * (1.0 - wbrEbruReduced);
        float gumSheen = 0.5 + 0.5 * sin(wbrEbruLocal.x * 5.2 - tLive * 1.15 + sin(wbrEbruLocal.z * 4.4 + tLive * 0.72));
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), 2.8);
        diffuseColor.rgb = mix(bathBody, wbrEbruEdgeColor, meniscusRim * 0.58 + fresnel * 0.20);
        diffuseColor.rgb = mix(diffuseColor.rgb, wbrEbruFoamColor, clamp(gumSheen * (0.08 + wbrEbruEnergy * 0.16) + smoothstep(0.90, 0.995, wallEdge) * 0.24, 0.0, 0.48));
        diffuseColor.a = clamp(diffuseColor.a + meniscusRim * 0.12 + fresnel * 0.10, 0.0, 0.95);
      `)
      .replace('#include <opaque_fragment>', `
        float ebruPeak = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
        if (ebruPeak > 0.80) {
          float excess = ebruPeak - 0.80;
          outgoingLight *= (0.80 + 0.22 * (excess / (excess + 0.22))) / ebruPeak;
        }
        #include <opaque_fragment>
      `)
  }
  const liquid = add('ebru-liquid-meniscus', bathGeo, liquidMat, [0, BATH_BASE_Y, 0])
  liquid.castShadow = false
  liquid.renderOrder = 1
  liquid.userData.toonSurface = { outline: false, shading: 'smooth' }

  const makeSeededRng = (seed: number) => {
    let s = seed >>> 0
    return () => {
      s = (s + 0x6d2b79f5) >>> 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const bathNoise = createNoise2D(makeSeededRng(5039))
  const MAX_EBRU_RIPPLES = 8
  const bathRipples = Array.from({ length: MAX_EBRU_RIPPLES }, () => ({ x: 0, z: 0, birth: -100, strength: 0, active: false }))
  let bathRippleCursor = 0
  let bathTime = 0
  let bathSloshX = 0, bathSloshZ = 0, bathVelX = 0, bathVelZ = 0
  let lastCombSample = 0, lastContactSample = 0, lastPeelSample = 0
  let combPinCursor = 0, idleDropTimer = 1.6, idleDropCursor = 0
  const triggerBathRipple = (x: number, z: number, strength = .9) => {
    const slot = bathRipples[bathRippleCursor]!
    bathRippleCursor = (bathRippleCursor + 1) % MAX_EBRU_RIPPLES
    slot.x = THREE.MathUtils.clamp(x, -halfBathW * .90, halfBathW * .90)
    slot.z = THREE.MathUtils.clamp(z, -halfBathD * .90, halfBathD * .90)
    slot.birth = bathTime
    slot.strength = THREE.MathUtils.clamp(strength, .05, 1.8)
    slot.active = true
  }
  const addBathSlosh = (ax: number, az: number) => {
    bathVelX = THREE.MathUtils.clamp(bathVelX + ax, -4, 4)
    bathVelZ = THREE.MathUtils.clamp(bathVelZ + az, -4, 4)
  }
  // Both surfaces retain exactly the same UVs and original pixel field. The
  // inverse horizontal displacement is the comb's authored flow field.
  const textureWidth = 256, textureHeight = 192, pixels = new Uint8Array(textureWidth * textureHeight * 4)
  const pigment = new THREE.DataTexture(pixels, textureWidth, textureHeight, THREE.RGBAFormat)
  pigment.colorSpace = THREE.SRGBColorSpace; pigment.minFilter = pigment.magFilter = THREE.LinearFilter; pigment.generateMipmaps = false
  const palette = [[242, 222, 178], [32, 139, 143], [232, 105, 83], [245, 190, 86], [24, 95, 113], [255, 243, 216]] as const
  const updatePigment = (amount: number) => {
    if (amount === patternAmount) return
    patternAmount = amount
    for (let y = 0; y < textureHeight; y++) for (let x = 0; x < textureWidth; x++) {
      const v = y / (textureHeight - 1), u = x / (textureWidth - 1)
      const sweep = THREE.MathUtils.smoothstep(amount * 1.12 - u + .10, 0, .20)
      const a = u - sweep * amount * (.065 * Math.sin(v * 18) + .028 * Math.sin(v * 31 + .8))
      const b = v + .045 * Math.sin(a * 13) + .025 * Math.sin(a * 29 + v * 7)
      const phase = a * 18 + b * 7 + 1.8 * Math.sin(b * 10 + a * 5) + .8 * Math.sin(a * 12 - b * 9)
      const band = ((phase % 6) + 6) % 6, c = palette[Math.floor(band)]!, next = palette[(Math.floor(band) + 1) % palette.length]!
      const mix = THREE.MathUtils.smoothstep(band % 1, .88, 1), offset = (y * textureWidth + x) * 4
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(THREE.MathUtils.lerp(c[channel]!, next[channel]!, mix))
      pixels[offset + 3] = 255
    }
    pigment.needsUpdate = true
  }
  const COLS = 32, ROWS = 24
  const plane = () => new THREE.PlaneGeometry(W, D, COLS, ROWS)
  const waterGeometry = plane(); waterGeometry.rotateX(-Math.PI / 2)
  const waterPosAttr = waterGeometry.getAttribute('position') as THREE.BufferAttribute
  const waterRestPos = new Float32Array(waterPosAttr.array.length)
  waterRestPos.set(waterPosAttr.array)
  const waterMaterial = new THREE.MeshStandardMaterial({ map: pigment, roughness: .24, metalness: .03 })
  const water = add('ebru-floating-pattern', waterGeometry, waterMaterial, [0, WATER_Y, 0]); water.castShadow = false; water.userData.toonSurface = { outline: false, shading: 'smooth' }

  const evalBathHeight = (x: number, z: number, wallT: number, ampScale = 1) => {
    const wallFade = 1 - THREE.MathUtils.smoothstep(wallT, .76, 1.0)
    let h = (x * bathSloshX * .0045 + z * bathSloshZ * .0045) * wallFade
    const t = bathTime * ebruSpec.convectionSpeed
    const n1 = bathNoise(x * .85 + t * .42, z * .85 - t * .31)
    const n2 = bathNoise(x * 1.65 - t * .28 + 2.3, z * 1.65 + t * .37 - 1.4)
    h += (n1 * .65 + n2 * .35) * .0024 * wallFade
    const waveLen = .46, k = (Math.PI * 2) / waveLen, speed = .82
    for (let i = 0; i < MAX_EBRU_RIPPLES; i++) {
      const rp = bathRipples[i]!
      if (!rp.active) continue
      const age = bathTime - rp.birth
      if (age < 0 || age > 4.2) continue
      const dist = Math.hypot(x - rp.x, z - rp.z)
      const dr = dist - age * speed
      const packetW = .24 + age * .14
      const env = rp.strength * THREE.MathUtils.smoothstep(age, 0, .06) * Math.exp(-age * ebruSpec.rippleDamping * .62) * Math.exp(-.5 * (dr * dr) / (packetW * packetW)) * wallFade
      if (env <= .0004) continue
      h += env * .0062 * Math.cos(k * dr)
    }
    return THREE.MathUtils.clamp(h * ampScale, -.009, .009)
  }
  const resetBath = () => {
    bathTime = 0
    bathSloshX = bathSloshZ = bathVelX = bathVelZ = 0
    idleDropTimer = 1.6
    for (let i = 0; i < MAX_EBRU_RIPPLES; i++) {
      bathRipples[i]!.active = false
      bathRipples[i]!.strength = 0
      bathRipples[i]!.birth = -100
    }
    bathRippleCursor = 0
    bathUniforms.wbrEbruTime.value = 0
    bathUniforms.wbrEbruReduced.value = reduced() ? 1 : 0
    bathUniforms.wbrEbruEnergy.value = 0
    bathPos.set(bathRestPos)
    bathNorm.set(bathRestNorm)
    bathPosAttr.needsUpdate = true
    bathNormAttr.needsUpdate = true
    ;(waterPosAttr.array as Float32Array).set(waterRestPos)
    waterPosAttr.needsUpdate = true
    waterGeometry.computeVertexNormals()
  }
  const updateBath = (dt: number, isReduced: boolean) => {
    bathUniforms.wbrEbruReduced.value = isReduced ? 1 : 0
    if (isReduced) {
      bathPos.set(bathRestPos)
      bathNorm.set(bathRestNorm)
      bathPosAttr.needsUpdate = true
      bathNormAttr.needsUpdate = true
      if (water.visible) {
        ;(waterPosAttr.array as Float32Array).set(waterRestPos)
        waterPosAttr.needsUpdate = true
      }
      bathUniforms.wbrEbruEnergy.value = 0
      return
    }
    const stepDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, .05) : 0
    bathTime += stepDt
    bathUniforms.wbrEbruTime.value = bathTime

    // Viscous tragacanth spring-pendulum slosh decay.
    if (stepDt > 0) {
      const w0 = ebruSpec.sloshFreq * .62, kS = w0 * w0, cD = 2 * ebruSpec.sloshDamping * w0
      bathVelX += (-kS * bathSloshX - cD * bathVelX) * stepDt
      bathVelZ += (-kS * bathSloshZ - cD * bathVelZ) * stepDt
      bathSloshX = THREE.MathUtils.clamp(bathSloshX + bathVelX * stepDt, -.9, .9)
      bathSloshZ = THREE.MathUtils.clamp(bathSloshZ + bathVelZ * stepDt, -.9, .9)
      if (Math.abs(bathSloshX) < 1e-4 && Math.abs(bathVelX) < 1e-4) bathSloshX = bathVelX = 0
      if (Math.abs(bathSloshZ) < 1e-4 && Math.abs(bathVelZ) < 1e-4) bathSloshZ = bathVelZ = 0

      if (!motion && at === 0) {
        idleDropTimer -= stepDt
        if (idleDropTimer <= 0) {
          idleDropTimer = 2.4
          const pts = [[-.55, .28], [.48, -.32], [-.18, -.42], [.62, .25]] as const
          const [px, pz] = pts[idleDropCursor % pts.length]!
          idleDropCursor++
          triggerBathRipple(px, pz, .38)
        }
      }
    }

    let energy = Math.hypot(bathSloshX, bathSloshZ) * .5
    for (let i = 0; i < MAX_EBRU_RIPPLES; i++) {
      const rp = bathRipples[i]!
      if (!rp.active) continue
      const age = bathTime - rp.birth
      const decay = Math.exp(-age * ebruSpec.rippleDamping * .62) * rp.strength
      if (age < 0 || age > 4.2 || decay < .006) {
        rp.active = false
        rp.strength = 0
      } else {
        energy += decay * .45
      }
    }
    bathUniforms.wbrEbruEnergy.value = Math.min(1, energy)

    // Keep liquid displacement bounded strictly below y = 0.45 when paper lies flat on the bath.
    const maxLift = contactAmount > .5 && peelAmount < .05 ? .004 : .009
    for (let i = 0; i < bathVertCount; i++) {
      const x = bathRestPos[i * 3]!
      const baseY = bathRestPos[i * 3 + 1]!
      const z = bathRestPos[i * 3 + 2]!
      const dy = THREE.MathUtils.clamp(evalBathHeight(x, z, bathWallT[i]!, 1), -maxLift, maxLift)
      bathPos[i * 3 + 1] = Math.min(.448 - BATH_BASE_Y, baseY + dy)
    }
    bathPosAttr.needsUpdate = true
    bathGeo.computeVertexNormals()

    // Synchronize delicate elastic wave undulations onto the floating pigment layer during combing.
    if (water.visible) {
      for (let i = 0; i < waterPosAttr.count; i++) {
        const x = waterRestPos[i * 3]!
        const z = waterRestPos[i * 3 + 2]!
        const wallT = Math.max(Math.abs(x) / (W * .5), Math.abs(z) / (D * .5))
        const dy = evalBathHeight(x, z, wallT, .55)
        waterPosAttr.setY(i, dy)
      }
      waterPosAttr.needsUpdate = true
      waterGeometry.computeVertexNormals()
    }
  }
  const paperGeometry = plane(), paperPosition = paperGeometry.getAttribute('position'), paperUV = paperGeometry.getAttribute('uv')
  const paperColors = new Float32Array(paperPosition.count * 3)
  for (let i = 0; i < paperPosition.count; i++) {
    const u = paperUV.getX(i), v = paperUV.getY(i)
    const edgeDist = Math.min(Math.min(u, 1 - u) * (W / D), Math.min(v, 1 - v))
    const deckle = THREE.MathUtils.lerp(.928, 1, THREE.MathUtils.smoothstep(edgeDist, 0, .085))
    const cloud = 1 + .020 * Math.sin(u * 7.3 + v * 4.1) * Math.cos(v * 6.7 - u * 3.9) + .010 * Math.sin(u * 15.1 - v * 11.7)
    const tone = deckle * cloud
    paperColors[i * 3] = tone; paperColors[i * 3 + 1] = tone * .995; paperColors[i * 3 + 2] = tone * .984
  }
  paperGeometry.setAttribute('color', new THREE.BufferAttribute(paperColors, 3))
  const sheetOptics = (grain: number, fibers: number, edge: number, highlightGuard: number) => ({
    kind: 'paper' as const,
    strength: .24,
    fiber: 'paper' as const,
    paper: { layout: 'sheet' as const, aspect: W / D, grainScale: 2.05, grain, fibers, edge, highlightGuard },
  })
  const blankMaterial = createRitualMaterial({ color: 0xe8dbc0, roughness: .96, side: THREE.FrontSide, vertexColors: true }, sheetOptics(1, .44, .62, .86))
  const printMaterial = createRitualMaterial({ color: 0xecdfc6, roughness: .95, side: THREE.BackSide, vertexColors: true }, sheetOptics(1, .40, .56, .88))
  const transferredMaterial = createRitualMaterial({ color: 0xf1e5cc, map: pigment, roughness: .95, side: THREE.BackSide, vertexColors: true }, sheetOptics(.98, .30, .60, .88))
  const edgeMaterial = createRitualMaterial({ color: 0xede0c4, roughness: .97, vertexColors: true }, {
    kind: 'paper', strength: .20, fiber: 'paper',
    paper: { layout: 'sheet', aspect: 12, grainScale: 1.6, grain: .90, fibers: .22, edge: .24, highlightGuard: .90 },
  })
  const blank = add('ebru-paper-blank', paperGeometry, blankMaterial), print = add('ebru-paper-print', paperGeometry, printMaterial)
  for (const mesh of [blank, print]) mesh.userData.toonSurface = { outline: false, shading: 'smooth' }
  // Build a thin continuous 4-sided cut-paper rim wrapping the actual sheet perimeter
  // (blank-side deckle lip, cut paper core edge, and print-side lip) with split strip normals.
  const stride = COLS + 1
  const rimSides: number[][] = [
    Array.from({ length: COLS + 1 }, (_, ix) => ROWS * stride + ix), // front / top (v=0)
    Array.from({ length: ROWS + 1 }, (_, k) => (ROWS - k) * stride + COLS), // right (u=1)
    Array.from({ length: COLS + 1 }, (_, k) => COLS - k), // far / bottom (v=1)
    Array.from({ length: ROWS + 1 }, (_, iy) => iy * stride), // left (u=0)
  ]
  const edgeVertCount = rimSides.reduce((sum, side) => sum + side.length * 6, 0)
  const edgePositions = new Float32Array(edgeVertCount * 3), edgeUVs = new Float32Array(edgeVertCount * 2), edgeColors = new Float32Array(edgeVertCount * 3)
  const edgeIndices: number[] = []
  let edgeCursor = 0
  const stripTones: readonly [number, number, number][] = [[1, .98, .94], [.96, .93, .87], [1, .98, .94]]
  for (const side of rimSides) {
    const n = side.length
    for (let s = 0; s < 3; s++) {
      const base = edgeCursor, tone = stripTones[s]!
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1)
        for (let r = 0; r < 2; r++) {
          const vi = base + k * 2 + r
          edgeUVs[vi * 2] = u; edgeUVs[vi * 2 + 1] = (s + r) / 3
          edgeColors[vi * 3] = tone[0]; edgeColors[vi * 3 + 1] = tone[1]; edgeColors[vi * 3 + 2] = tone[2]
        }
        if (k < n - 1) {
          const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3
          edgeIndices.push(a, b, d, a, d, c)
        }
      }
      edgeCursor += n * 2
    }
  }
  const edgeGeometry = new THREE.BufferGeometry()
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
  edgeGeometry.setAttribute('uv', new THREE.BufferAttribute(edgeUVs, 2))
  edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3))
  edgeGeometry.setIndex(edgeIndices)
  const paperEdge = add('ebru-paper-edge', edgeGeometry, edgeMaterial)
  paperEdge.userData.toonSurface = { outline: false, shading: 'smooth' }
  const edgeAnchor = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpT = new THREE.Vector3(), tmpO = new THREE.Vector3(), tmpOAdj = new THREE.Vector3()
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3()
  const comb = new THREE.Group(); comb.name = 'ebru-comb'; world.add(comb)
  box('ebru-comb-spine', [.13, .12, 1.86], [0, .11, -.03], timber, comb)
  const grip = add('ebru-comb-grip', new THREE.CapsuleGeometry(.095, .31, 8, 16), timber, [0, .23, 1.02], comb); grip.rotation.x = Math.PI / 2
  // An oval wooden grip and a real row of thin metal pins contact the pigment.
  for (let i = 0; i < 9; i++) add(`ebru-comb-pin-${i}`, new THREE.CylinderGeometry(.012, .012, .22, 8), steel, [0, -.05, -.83 + i * .205], comb)
  box('ebru-grip-ferrule', [.14, .14, .15], [0, .17, .79], brightCopper, comb)
  comb.traverse(object => { object.userData.toonSurface = { outline: false, shading: 'smooth' } })
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const sheetPoint = (u: number, t: number) => {
    const sx = 2 * u - 1, uEdge = sx * sx, uncontact = 1 - contactAmount
    // Prepared blank sheet curls above the far rim, then lies fully in contact.
    const curlY = .66 + .78 * Math.sin(t * Math.PI * .88) + uncontact * (-.022 * uEdge * Math.sin(t * Math.PI * .95) + .008 * Math.sin(u * Math.PI * 3) * Math.sin(t * Math.PI))
    const curlZ = -1.02 - .14 * Math.sin(t * Math.PI * 1.3) + uncontact * .028 * uEdge * (t - .5)
    const flatZ = D / 2 - D * t
    // Peeling progresses from the held front edge. The far strip remains on
    // the bath during the first part of the pull instead of levitating whole.
    const peel = ease(THREE.MathUtils.clamp((peelAmount - .65 * t) / (1 - .65 * t), 0, 1))
    const topSag = -.042 * peel * uEdge * (1 - t) * (1 - t)
    const cornerCurlZ = peel * uEdge * (-.048 * (1 - t) * (1 - t) + .058 * t * t)
    const dampRippleZ = peel * .015 * Math.sin(u * Math.PI * 3 - .35) * Math.sin(t * Math.PI) * uEdge
    const x = (u - .5) * W * (1 - .008 * peel * uEdge * (1 - .5 * Math.sin(t * Math.PI)))
    const y = THREE.MathUtils.lerp(curlY, WATER_Y, contactAmount) + peel * (.2 + (1 - t) * D) + topSag
    const z = THREE.MathUtils.lerp(curlZ, flatZ, contactAmount) * (1 - peel) + peel * (.12 + .16 * Math.sin(t * Math.PI)) + cornerCurlZ + dampRippleZ
    return new THREE.Vector3(x, y, z)
  }
  const updatePaperEdge = () => {
    const paperNormal = paperGeometry.getAttribute('normal')
    const edgePosAttr = edgeGeometry.getAttribute('position') as THREE.BufferAttribute
    edgeAnchor.copy(sheetPoint(.5, 0))
    paperEdge.position.copy(edgeAnchor); paperEdge.rotation.set(0, 0, 0)
    const topN = THREE.MathUtils.lerp(0, .013, peelAmount)
    const botN = THREE.MathUtils.lerp(-.009, -.001, peelAmount)
    const lip = .008
    const sideTangent = (side: number[], k: number, out: THREE.Vector3) => {
      const i0 = side[Math.max(0, k - 1)]!, i1 = side[Math.min(side.length - 1, k + 1)]!
      out.set(
        paperPosition.getX(i1) - paperPosition.getX(i0),
        paperPosition.getY(i1) - paperPosition.getY(i0),
        paperPosition.getZ(i1) - paperPosition.getZ(i0),
      ).normalize()
    }
    let cursor = 0
    for (let sIdx = 0; sIdx < rimSides.length; sIdx++) {
      const side = rimSides[sIdx]!, n = side.length
      const prevSide = rimSides[(sIdx + 3) % 4]!, nextSide = rimSides[(sIdx + 1) % 4]!
      for (let k = 0; k < n; k++) {
        const pi = side[k]!
        tmpP.fromBufferAttribute(paperPosition, pi).sub(edgeAnchor)
        tmpN.fromBufferAttribute(paperNormal, pi).normalize()
        sideTangent(side, k, tmpT)
        tmpO.crossVectors(tmpT, tmpN).normalize()
        if (k === 0) {
          sideTangent(prevSide, prevSide.length - 1, tmpT)
          tmpOAdj.crossVectors(tmpT, tmpN).normalize()
          tmpO.add(tmpOAdj)
        } else if (k === n - 1) {
          sideTangent(nextSide, 0, tmpT)
          tmpOAdj.crossVectors(tmpT, tmpN).normalize()
          tmpO.add(tmpOAdj)
        }
        tmpA.copy(tmpP).addScaledVector(tmpN, topN)
        tmpB.copy(tmpA).addScaledVector(tmpO, lip)
        tmpC.copy(tmpP).addScaledVector(tmpN, botN).addScaledVector(tmpO, lip)
        tmpD.copy(tmpP).addScaledVector(tmpN, botN)
        const i0 = cursor + k * 2, i1 = cursor + n * 2 + k * 2, i2 = cursor + n * 4 + k * 2
        edgePosAttr.setXYZ(i0, tmpA.x, tmpA.y, tmpA.z); edgePosAttr.setXYZ(i0 + 1, tmpB.x, tmpB.y, tmpB.z)
        edgePosAttr.setXYZ(i1, tmpB.x, tmpB.y, tmpB.z); edgePosAttr.setXYZ(i1 + 1, tmpC.x, tmpC.y, tmpC.z)
        edgePosAttr.setXYZ(i2, tmpC.x, tmpC.y, tmpC.z); edgePosAttr.setXYZ(i2 + 1, tmpD.x, tmpD.y, tmpD.z)
      }
      cursor += n * 6
    }
    edgePosAttr.needsUpdate = true; edgeGeometry.computeVertexNormals(); edgeGeometry.computeBoundingBox(); edgeGeometry.computeBoundingSphere()
  }
  const setShape = () => {
    updatePigment(combAmount)
    comb.position.set(-1.12 + combAmount * 2.24 + contactAmount * .7, .59 + contactAmount * .17, -contactAmount * .1)
    comb.rotation.z = -contactAmount * .16
    for (let i = 0; i < paperPosition.count; i++) {
      const p = sheetPoint(paperUV.getX(i), paperUV.getY(i)); paperPosition.setXYZ(i, p.x, p.y, p.z)
    }
    paperPosition.needsUpdate = true; paperGeometry.computeVertexNormals(); paperGeometry.computeBoundingBox(); paperGeometry.computeBoundingSphere()
    sheetPoint(.5, .125).toArray(peelAnchor)
    updatePaperEdge()
    // The host caches styled maps by material identity. Switch the physical
    // underside only after contact instead of mutating a cached map in place.
    print.material = contactAmount === 1 ? transferredMaterial : printMaterial
    // At contact the sheet fully covers the pigment; omit the now-covered
    // coplanar layer. A pale wet bath remains when the transferred sheet lifts.
    water.visible = contactAmount < 1
    if (!reduced()) {
      const dComb = combAmount - lastCombSample
      if (Math.abs(dComb) >= .045) {
        const combX = -1.12 + combAmount * 2.24
        const pinZs = [-.62, -.21, .21, .62] as const
        triggerBathRipple(combX, pinZs[combPinCursor % pinZs.length]!, .88)
        triggerBathRipple(combX, pinZs[(combPinCursor + 2) % pinZs.length]!, .72)
        combPinCursor++
        addBathSlosh(Math.sign(dComb) * 1.1, .22 * Math.sin(combPinCursor))
        lastCombSample = combAmount
      }
      if (contactAmount >= .35 && lastContactSample < .35) {
        triggerBathRipple(0, .15, .82)
        addBathSlosh(0, .75)
      } else if (contactAmount >= .82 && lastContactSample < .82) {
        triggerBathRipple(-.55, -.25, .65)
        triggerBathRipple(.55, -.25, .65)
      }
      lastContactSample = contactAmount
      const dPeel = peelAmount - lastPeelSample
      if (Math.abs(dPeel) >= .055) {
        const peelZ = D * (.5 - peelAmount)
        triggerBathRipple(-.42, peelZ, .92)
        triggerBathRipple(.42, peelZ, .85)
        addBathSlosh(.18 * Math.sin(peelAmount * 9), -Math.sign(dPeel) * 1.05)
        lastPeelSample = peelAmount
      }
    }
    matrices()
  }
  const restore = (resetFluid = true) => {
    combAmount = at > 0 ? 1 : 0; contactAmount = at > 0 ? 1 : 0; peelAmount = at >= 2 ? 1 : 0
    lastCombSample = combAmount; lastContactSample = contactAmount; lastPeelSample = peelAmount
    if (resetFluid || reduced()) resetBath()
    setShape()
  }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', direction: [1, 0], label: '向右梳开彩纹', anchor: GRIP, priority: 3, enabled: enabled(0) }),
    addInteractionCue(blank, { kind: 'drag', direction: [0, -1], label: '按住白纸，向上轻揭', anchor: peelAnchor, priority: 3, enabled: enabled(1) }),
    addInteractionCue(print, { kind: 'tap', label: '轻点彩纸静看', anchor: QUIET, priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const touch = createTouchTarget(canvas, camera, scene)
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const target = () => at === 0 ? grip : at === 1 ? paperEdge : print
  const reset = () => { dragging = false; maxTravel = maxCross = moved = maxAlong = minAlong = backtrack = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) {
      if (motion || at === 3) return false
      matrices(); const hit = nearestHit(x, y)
      return at === 1 ? touch.hit(x, y, [blank, print, paperEdge]) : touch.hit(x, y, target())
    },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; maxTravel = maxCross = moved = maxAlong = minAlong = backtrack = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dy : dx)); moved = at === 0 ? dx : -dy
      maxAlong = Math.max(maxAlong, moved); minAlong = Math.min(minAlong, moved); backtrack = Math.max(backtrack, maxAlong - moved)
      if (dragging && at === 0) combAmount = THREE.MathUtils.clamp(moved / 60, 0, 1)
      else if (dragging && at === 1) peelAmount = THREE.MathUtils.clamp(moved / 60, 0, 1)
      setShape()
    },
    onRelease(x, y) {
      matrices(); const dx = x - down.x, dy = y - down.y, along = at === 0 ? dx : -dy, cross = at === 0 ? Math.abs(dy) : Math.abs(dx)
      const valid = at < 2 ? dragging && completesDirectionalDrag({ along: moved, end: along, maxAlong, minAlong, backtrack, maxCross, cross, travel: maxTravel })
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && nearestHit(x, y) === print
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: inputActive, duration: 3, motion: 'glow', targets: () => [print], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '向右梳开彩纹' : at === 1 ? '按住白纸，向上轻揭' : '轻点彩纸静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.combing : COPY.peeling : at === 0 ? COPY.comb : at === 1 ? COPY.peel : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const revision = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && revision === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    const finishedStep = motion.step
    at = (finishedStep + 1) as Checkpoint; motion = null; restore(reduced())
    if (!reduced()) {
      if (finishedStep === 0) triggerBathRipple(0, 0, .55)
      else {
        triggerBathRipple(0, -.35, .85)
        addBathSlosh(.25, -.75)
      }
    }
    withHostCallbacks(() => { ctx.onProgress?.(at); if (callbackActive()) feedback.impact({ freqs: [392, 523.25], duration: .12, gain: .007, type: 'sine' }) })
  }
  function begin() {
    if (!inputActive() || pointer.isBusy() || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, comb: combAmount, peel: peelAmount }; sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    withHostCallbacks(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!callbackActive()) return
      feedback.impact({ freqs: [392, 587.33], duration: .20, gain: .008 }); if (!callbackActive()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), targetPoint = new THREE.Vector3(.13, 1.12, 0), direction = new THREE.Vector3(.12, .75, 1.3).normalize()
    camera.position.copy(targetPoint).add(direction); camera.lookAt(targetPoint); camera.updateMatrixWorld(true)
    const inverseView = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3()
    const saved: XYZ = [combAmount, contactAmount, peelAmount]; let distance = 4
    // Fit all authored extreme and intermediate poses without changing framing
    // during manipulation. This also contains every vertex on portrait canvases.
    for (const pose of [[0, 0, 0], [1, 0, 0], [1, .5, 0], [1, 1, 0], [1, 1, .5], [1, 1, 1]]) {
      [combAmount, contactAmount, peelAmount] = pose as XYZ
      lastCombSample = combAmount; lastContactSample = contactAmount; lastPeelSample = peelAmount
      setShape()
      world.traverse(o => {
        const mesh = o as THREE.Mesh; if (!mesh.geometry) return
        const vertices = mesh.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) {
          p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).sub(targetPoint).applyQuaternion(inverseView)
          distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .89), p.z + Math.abs(p.y) / (tangent * .89))
        }
      })
    }
    [combAmount, contactAmount, peelAmount] = saved
    lastCombSample = combAmount; lastContactSample = contactAmount; lastPeelSample = peelAmount
    setShape()
    camera.position.copy(targetPoint).addScaledVector(direction, distance); camera.lookAt(targetPoint); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: text => { if (!inputActive() || pointer.isBusy() || motion || at !== 2 || !text.trim() || !prepareInput()) return; finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); writer?.setEnabled(false); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(delta)
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .88)
        if (motion.step === 0) {
          combAmount = THREE.MathUtils.lerp(motion.comb, 1, ease(Math.min(1, motion.time / .25)))
          contactAmount = ease(THREE.MathUtils.clamp((motion.time - .28) / .72, 0, 1))
        } else peelAmount = THREE.MathUtils.lerp(motion.peel, 1, ease(motion.time))
        setShape(); if (motion.time === 1) settle()
      }
      ending.update(dt)
      if (!disposed && active()) { updateBath(delta, reduced()); matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world)
      // Exactly one of the immutable underside materials is outside the tree.
      ;(print.material === printMaterial ? transferredMaterial : printMaterial).dispose()
      pigment.dispose(); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
