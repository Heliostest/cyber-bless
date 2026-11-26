import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import {
  addStageLights,
  CEL_STYLE,
  createLampHalo,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
  disposeTree,
  setSafeText,
} from '../procedural-kit'

type Step = 'ready' | 'rise' | 'rest' | 'done'

const STEP_ORDER: Step[] = ['ready', 'rise', 'rest']

const COPY = {
  title: '燃灯上浮',
  hintReady: '带着燃灯会的祝愿静看莲灯。点按莲灯，或向上轻推。',
  hintRise: '画面中的莲灯缓缓移向高处…',
  hintRest: '莲灯移到高处，静看灯光；点按莲灯结束。',
  pushTap: '轻推莲灯',
  restTap: '静看片刻',
  done: '莲灯静静亮着。',
  stepsAria: '步骤',
} as const

const RISE_SECONDS = 3.2
const LOW_Y = 0.45
const HIGH_Y = 2.3
/** The lanterns' paper glow; on the night stage they glow brighter. */
const SHELL_GLOW = 0.42
const SHELL_GLOW_NIGHT = 0.72

type Lantern = {
  group: THREE.Group
  light: THREE.PointLight
  shellMat: THREE.MeshStandardMaterial
  tipMat: THREE.MeshStandardMaterial
  /** Night stage only: the warm glow round the lantern. */
  halo: ReturnType<typeof createLampHalo> | null
}

/** Deterministic 2D hash for procedural backlit hanji fiber transmission. */
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function valueNoise2(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy), b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1)
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
}

/**
 * Procedural backlit hanji emissive transmission texture (works in WebGL & jsdom):
 * bright warm amber near the candle core (v = 0), fading through fibrous crinkled
 * pink-peach mid-petals with subtle radiating veins to deeper rose-tinted tips (v = 1)
 * and slightly shaded overlapping margins so layered petals never fuse into white mush.
 */
function createHanjiEmissiveMap(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  for (let iy = 0; iy < size; iy++) {
    const v = iy / (size - 1) // 0 = base near flame, 1 = pointed tip
    for (let ix = 0; ix < size; ix++) {
      const u = ix / (size - 1)
      const ux = u * 2 - 1 // -1..1 across petal width

      // Warm core-to-tip candlelight falloff + soft margin darkening for petal separation.
      const baseGlow = Math.pow(1 - v, 1.35) * 0.88 + 0.12 * (1 - v * 0.65)
      const marginShade = 1 - Math.pow(Math.abs(ux), 2.4) * 0.62

      // Five fine radiating crinkled hanji veins converging toward the petal base.
      const fanU = ux / (0.42 + 0.58 * Math.pow(v, 0.7))
      const veinWave = Math.abs(Math.sin(fanU * Math.PI * 2.5))
      const vein = 0.80 + 0.20 * Math.pow(veinWave, 0.45)

      // Multi-scale organic mulberry fiber mottling illuminated from behind.
      const pulp = valueNoise2(u * 14, v * 22) * 0.55 + valueNoise2(u * 34 + 3.1, v * 48 + 1.7) * 0.45
      const fiberStreak = valueNoise2(u * 42 + v * 10, v * 12) * 0.5 + valueNoise2(u * 18 - v * 14, v * 36) * 0.5
      const paperTrans = 0.76 + pulp * 0.28 + (fiberStreak - 0.5) * 0.18

      const lum = THREE.MathUtils.clamp(baseGlow * marginShade * vein * paperTrans, 0.04, 1.0)
      // Golden-amber core glow shifting into soft lotus rose-pink toward the tips.
      const r = THREE.MathUtils.clamp(lum * (1.02 - 0.04 * v), 0, 1)
      const g = THREE.MathUtils.clamp(lum * (0.76 - 0.42 * v), 0, 1)
      const b = THREE.MathUtils.clamp(lum * (0.44 + 0.24 * v), 0, 1)

      const off = (iy * size + ix) * 4
      data[off] = Math.round(r * 255)
      data[off + 1] = Math.round(g * 255)
      data[off + 2] = Math.round(b * 255)
      data[off + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

/**
 * Sculpted crinkled-hanji lotus petal: cupped inward around the lantern core,
 * gently pointed and outward-curled at the tip, with fine longitudinal paper pleats
 * and dip-dyed base-to-tip vertex color graduation.
 */
function createLotusPetalGeometry(
  maxWidth: number,
  height: number,
  cupDepth: number,
  tipCurl: number,
  tipDeepen: number,
): THREE.BufferGeometry {
  const segU = 10
  const segV = 14
  const cols = segU + 1
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV // 0 = base, 1 = pointed tip
    const widthFactor = 0.24 * (1 - v) + Math.pow(Math.sin(Math.PI * Math.pow(v, 0.72)), 0.85)
    const halfW = maxWidth * 0.5 * Math.max(0.03, widthFactor)
    const y = height * v
    const tipPhase = Math.max(0, (v - 0.55) / 0.45)

    for (let iu = 0; iu <= segU; iu++) {
      const uUv = iu / segU
      const u = uUv * 2 - 1 // -1..1
      const x = u * halfW

      // Concave lotus cup curving around the inner glow + outward belly & curled petal tip.
      const cupZ = -cupDepth * (1 - u * u) * Math.sin(Math.PI * Math.pow(v, 0.78))
      const bellyZ = 0.032 * Math.sin(Math.PI * v) + tipCurl * tipPhase * tipPhase
      // Fine crinkled handmade hanji pleats and central midrib fold.
      const crinkle = (Math.cos(u * Math.PI * 4.0) * 0.0042 - Math.exp(-u * u * 18) * 0.005)
        * Math.sin(Math.PI * v)
      const z = cupZ + bellyZ + crinkle

      positions.push(x, y, z)
      uvs.push(uUv, v)

      // Dip-dyed hanji petal gradient: warm luminous cream-gold base -> rose-pink tips.
      const baseWarm = Math.pow(1 - v, 1.8)
      const tipTint = Math.pow(v, 1.45) * tipDeepen
      const edgeTint = Math.pow(Math.abs(u), 2.0) * 0.10
      const ribShade = (1 - Math.abs(Math.sin(u * Math.PI * 2.5))) * 0.045 * Math.sin(Math.PI * v)
      const r = THREE.MathUtils.clamp(1.0 + baseWarm * 0.08 - edgeTint * 0.4 - ribShade, 0.72, 1.1)
      const g = THREE.MathUtils.clamp(1.0 + baseWarm * 0.04 - tipTint * 0.34 - edgeTint * 0.9 - ribShade, 0.48, 1.08)
      const b = THREE.MathUtils.clamp(0.98 - baseWarm * 0.14 - tipTint * 0.24 - edgeTint * 0.7 - ribShade, 0.50, 1.05)
      colors.push(r, g, b)
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu
      indices.push(a, a + 1, a + cols + 1, a, a + cols + 1, a + cols)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Layered hanji lotus paper lantern: three blooming tiers of crinkled petals around a glowing core. */
function buildLantern(
  outerPetalGeo: THREE.BufferGeometry,
  innerPetalGeo: THREE.BufferGeometry,
  coreGeo: THREE.BufferGeometry,
  baseCupGeo: THREE.BufferGeometry,
  ribRingGeo: THREE.BufferGeometry,
  emissiveMap: THREE.DataTexture,
  color: number,
  lightIntensity: number,
  night: boolean,
): Lantern {
  const group = new THREE.Group()
  const shellMat = createRitualMaterial({
    color,
    emissive: 0xff8e8a,
    emissiveMap,
    emissiveIntensity: night ? SHELL_GLOW_NIGHT : SHELL_GLOW,
    roughness: 0.95,
    vertexColors: true,
    side: THREE.DoubleSide,
  }, {
    kind: 'paper',
    strength: 0.42,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: 0.62,
      grainScale: 4.2,
      grain: 0.88,
      fibers: 0.22,
      edge: 0.42,
      highlightGuard: 0.62,
    },
  })
  const tipMat = createRitualMaterial({
    color: 0xfbe6d4,
    emissive: 0xffb07e,
    emissiveMap,
    emissiveIntensity: night ? SHELL_GLOW_NIGHT * 0.82 : SHELL_GLOW * 0.72,
    roughness: 0.95,
    vertexColors: true,
    side: THREE.DoubleSide,
  }, {
    kind: 'paper',
    strength: 0.36,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: 0.58,
      grainScale: 4.4,
      grain: 0.80,
      fibers: 0.16,
      edge: 0.38,
      highlightGuard: 0.64,
    },
  })

  // Three overlapping blooming lotus tiers: outer flared ring (8), mid cupped ring (8), inner crown (6).
  const tiers = [
    { count: 8, radius: 0.095, y: 0.025, tilt: 0.92, offset: 0, geo: outerPetalGeo, mat: shellMat },
    { count: 8, radius: 0.082, y: 0.045, tilt: 0.54, offset: Math.PI / 8, geo: outerPetalGeo, mat: shellMat },
    { count: 6, radius: 0.064, y: 0.068, tilt: 0.24, offset: Math.PI / 6, geo: innerPetalGeo, mat: tipMat },
  ] as const
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      const a = (i / tier.count) * Math.PI * 2 + tier.offset
      const petal = new THREE.Mesh(tier.geo, tier.mat)
      petal.position.set(Math.cos(a) * tier.radius, tier.y, Math.sin(a) * tier.radius)
      petal.rotation.set(0, -a + Math.PI / 2, 0)
      // Positive rotateX tilts the upright petal (+Y) outward toward +Z (blooming lotus cup).
      petal.rotateX(tier.tilt)
      petal.userData.toonSurface = { shading: 'smooth' }
      group.add(petal)
    }
  }

  // Opaque matte lotus calyx base cup & inner ring frame (tucked inside outer petal roots; avoids PointLight blowout).
  const baseCupMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.76),
    emissive: 0xb8565a,
    emissiveIntensity: night ? 0.34 : 0.12,
    roughness: 0.96,
  })
  const baseCup = new THREE.Mesh(baseCupGeo, baseCupMat)
  baseCup.position.y = 0.018
  baseCup.userData.toonSurface = { shading: 'smooth' }
  group.add(baseCup)

  const ribMat = new THREE.MeshStandardMaterial({ color: 0x7b563c, roughness: 0.9 })
  const ribRing = new THREE.Mesh(ribRingGeo, ribMat)
  ribRing.rotation.x = Math.PI / 2
  ribRing.position.y = 0.062
  group.add(ribRing)

  const core = new THREE.Mesh(
    coreGeo,
    new THREE.MeshStandardMaterial({
      color: 0xfff1c8,
      emissive: 0xffc070,
      emissiveIntensity: 1.05,
      roughness: 0.4,
    }),
  )
  core.position.y = 0.13
  group.add(core)
  const light = new THREE.PointLight(0xffb070, lightIntensity, 3.5, 2)
  light.position.y = 0.16
  group.add(light)
  const halo = night ? createLampHalo(0xffa860, 1.25) : null
  if (halo) {
    halo.sprite.position.y = 0.14
    group.add(halo.sprite)
  }
  return { group, light, shellMat, tipMat, halo }
}

export function createYeondeunghoe(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'ready'
  let disposed = false
  let started = false
  let restoring = true
  let riseT = 0

  const handles: GestureHandle[] = []
  let pushHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null
  let objectPointer: ReturnType<typeof createObjectPointer> | null = null
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.pushTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const ending = createQuietEnding(ctx, { ui: ui, isActive: () => started && !disposed && canAct(),
    duration: 3, motion: 'bob', targets: () => [main.group], cancelInput: () => { objectPointer?.cancel() }, complete: () => completeScene(),
  })
  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = step === 'rise' || step === 'done'
    hitLayer.style.pointerEvents = step === 'ready' || step === 'rest' ? 'auto' : 'none'
    if (step === 'ready') {
      setHint(COPY.hintReady)
      setSafeText(actionBtn, COPY.pushTap, assertSafeCopy)
    } else if (step === 'rise') setHint(COPY.hintRise)
    else if (step === 'rest') {
      setHint(COPY.hintRest)
      setSafeText(actionBtn, COPY.restTap, assertSafeCopy)
    } else setHint(COPY.done)
    ending.sync(step === 'rest')
  }

  // Transparent over the host's stage; lotus-pink accents on the lanterns.
  // The App shows this scene on its night stage, where it takes the moonlit
  // rig and the lanterns' own glow, lights and halos carry the warmth: lit
  // lamps on a dark sky, not pale paper cut-outs.
  const night = ctx.stage === 'night'
  const glowScale = night ? 1.5 : 1
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.5, 4.6)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.2, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'yeondeunghoe', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  // By day, a dusk rig: amber key from the upper left, rose-lilac rim behind
  // the lanterns.
  addStageLights(scene, ctx.stage, {
    sky: 0xffeadb,
    ground: 0xd4b4a4,
    key: 0xffcf9e,
    rim: 0xf2c4e0,
    keyIntensity: 1.15,
    keyPosition: [-2, 4, 3],
  })

  const world = new THREE.Group()
  scene.add(world)

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xcaa580, roughness: 0.95 })
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 40), plinthMat)
  plinth.position.y = 0.15
  world.add(plinth)
  // Rounded lip: a lit cel band along the top edge, like a bevel.
  const plinthLip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 8, 48), plinthMat)
  plinthLip.rotation.x = Math.PI / 2
  plinthLip.position.y = 0.3
  world.add(plinthLip)

  const petalEmissiveMap = createHanjiEmissiveMap(128)
  const outerPetalGeo = createLotusPetalGeometry(0.165, 0.255, 0.036, 0.034, 0.95)
  const innerPetalGeo = createLotusPetalGeometry(0.135, 0.215, 0.030, 0.022, 0.55)
  const coreGeo = new THREE.SphereGeometry(0.068, 16, 12)
  const baseCupGeo = new THREE.CylinderGeometry(0.088, 0.056, 0.028, 20)
  const ribRingGeo = new THREE.TorusGeometry(0.098, 0.0055, 6, 24)

  const main = buildLantern(
    outerPetalGeo, innerPetalGeo, coreGeo, baseCupGeo, ribRingGeo,
    petalEmissiveMap, 0xf5a4b8, 0.6 * glowScale, night,
  )
  main.group.position.set(0, LOW_Y, 0)
  world.add(main.group)

  // Distant companion lanterns already drifting high.
  const companions: Lantern[] = []
  const companionSpots = [
    [-1.6, 2.6, -1.8],
    [1.4, 2.9, -2.2],
    [-0.7, 3.2, -3.0],
    [2.2, 2.2, -1.2],
  ]
  companionSpots.forEach(([x, y, z], i) => {
    const l = buildLantern(
      outerPetalGeo, innerPetalGeo, coreGeo, baseCupGeo, ribRingGeo,
      petalEmissiveMap, i % 2 ? 0xf8c795 : 0xf1adc6, night ? 0.5 : 0.25, night,
    )
    l.group.position.set(x, y, z)
    l.group.scale.setScalar(0.75)
    world.add(l.group)
    companions.push(l)
  })

  // Big invisible hit sphere for easy mobile taps.
  const tapZone = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  tapZone.position.set(0, LOW_Y + 0.1, 0)
  world.add(tapZone)

  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
    camera.aspect = w / Math.max(h, 1)
    const portraitBoost = camera.aspect < 0.8 ? (0.8 - camera.aspect) * 3 : 0
    cameraHome.z = 4.6 + portraitBoost
    camera.updateProjectionMatrix()
  }

  const lanternHitTest = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(pointerNdc, camera)
    return raycaster.intersectObject(tapZone, false).length > 0
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()
  const canCue = () => started && !disposed && !restoring && canAct()
  const removeCues = [
    addInteractionCue(tapZone, {
      kind: 'tap', label: '点按轻推莲灯',
      enabled: () => canCue() && step === 'ready',
    }),
    addInteractionCue(tapZone, {
      kind: 'tap', label: '点按莲灯结束静看',
      enabled: () => canCue() && step === 'rest',
    }),
  ]

  const completeScene = (fromWriting = false) => {
    if (!restoring && !ending.completing && !fromWriting) return
    if (!canAct() || step === 'done') return
    step = 'done'
    pushHandle?.setEnabled(false)
    if (!restoring) { ctx.onProgress?.(3); if (disposed || !(canAct())) return }
    syncOverlayForStep()
    if (!restoring) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goRest = () => {
    if (!canAct() || step !== 'rise') return
    step = 'rest'
    riseT = 1
    if (!restoring) ctx.onProgress?.(2)
    syncOverlayForStep()
  }

  const goRise = () => {
    if (!canAct() || step !== 'ready') return
    step = 'rise'
    riseT = 0
    pushHandle?.setEnabled(false)
    if (!restoring) {
      // Soft warm lantern tone: low, round partials with a slow fade.
      const reduced = ctx.isReducedMotion?.() ?? false
      fx.impact({
        freqs: [523.25, 784, 1046.5],
        duration: reduced ? 0.5 : 1.4,
        gain: reduced ? 0.05 : 0.08,
      })
      ctx.onProgress?.(1)
    }
    syncOverlayForStep()
    // Reduced motion: no float animation, snap straight to the resting height.
    if (!restoring && (ctx.isReducedMotion?.() ?? false)) goRest()
  }

  const onActionTap = () => {
    if (disposed || objectPointer?.isBusy()) return
    fx.prepare()
    if (step === 'ready') goRise()
    else if (step === 'rest') completeScene()
  }

  let downX = 0
  let downY = 0
  let gestureOwned = false
  const onHitDown = (x: number, y: number) => {
    gestureOwned = true
    pushHandle?.setEnabled(step === 'ready')
    if (step === 'ready' || step === 'rest') fx.prepare()
    downX = x
    downY = y
  }
  const onHitUp = (x: number, y: number) => {
    gestureOwned = false
    if (step !== 'ready' && step !== 'rest') return
    const moved = Math.hypot(x - downX, y - downY)
    if (moved >= 12 || !lanternHitTest(x, y)) return
    if (step === 'ready') goRise()
    else completeScene()
  }
  const onHitCancel = () => {
    gestureOwned = false
    pushHandle?.setEnabled(false)
  }

  const wireGestures = () => {
    // Upward push: a vertical drag of ~40px that starts on the lantern;
    // elsewhere on the stage a swipe scrolls the page.
    objectPointer = createObjectPointer(hitLayer, {
      isActive: canCue,
      canStart: (x, y) => (step === 'ready' || step === 'rest') && lanternHitTest(x, y),
      onStart: onHitDown,
      onRelease: onHitUp,
      onCancel: onHitCancel,
    })
    pushHandle = gestures.createTilt({
      startsOn: (x, y) => gestureOwned && lanternHitTest(x, y),
      pourAngleDeg: 40,
      holdMs: 0,
      onPour: () => {
        if (!canAct() || step !== 'ready') return
        goRise()
      },
    })
    pushHandle.mount(hitLayer, {})
    pushHandle.setEnabled(false)
    handles.push(pushHandle)

    actionBtn.addEventListener('click', onActionTap)
  }

  syncOverlayForStep()

  const setLanternY = (y: number) => {
    main.group.position.y = y
    tapZone.position.y = y + 0.1
  }

  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed) resize()
        })
        resizeObserver.observe(canvas)
      }
      wireGestures()
      if ((ctx.initialProgress ?? 0) >= 1) goRise()
      if ((ctx.initialProgress ?? 0) >= 2) goRest()
      if ((ctx.initialProgress ?? 0) >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      if (!canAct()) objectPointer?.cancel()
      pushHandle?.setEnabled(canAct() && gestureOwned && step === 'ready')
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001
      const visualDt = reduced ? 0 : dt

      if (step === 'rise') {
        riseT = reduced ? 1 : Math.min(1, riseT + dt / RISE_SECONDS)
        if (riseT >= 1) goRest()
      }
      const eased = riseT * riseT * (3 - 2 * riseT)
      const baseY = step === 'ready' ? LOW_Y : THREE.MathUtils.lerp(LOW_Y, HIGH_Y, eased)
      setLanternY(baseY + Math.sin(t * 1.2) * (step === 'ready' ? 0.02 : 0.05))
      main.group.rotation.y += visualDt * 0.25
      main.group.position.x = step === 'ready' ? 0 : Math.sin(t * 0.6) * 0.08 * eased

      // Warm bloom grows as the lantern rises; pulses once resting.
      const glowBase = step === 'ready' ? 0.6 : 0.6 + eased * 1.4
      const pulse = step === 'rest' || step === 'done' ? Math.sin(t * 2.2) * 0.35 : 0
      main.light.intensity = (glowBase + pulse) * glowScale
      const shellEmissive = (night ? SHELL_GLOW_NIGHT : SHELL_GLOW) + eased * 0.24 + pulse * 0.12
      main.shellMat.emissiveIntensity = shellEmissive
      main.tipMat.emissiveIntensity = shellEmissive * 0.86
      if (main.halo) main.halo.material.opacity = 0.35 + eased * 0.45 + pulse * 0.15

      companions.forEach((l, i) => {
        if (l.halo) l.halo.material.opacity = 0.4 + Math.sin(t * 1.3 + i * 1.7) * 0.06
        const [x, y, z] = companionSpots[i]!
        l.group.position.set(x + Math.sin(t * 0.3 + i) * 0.1, y + Math.sin(t * 0.8 + i * 2) * 0.08, z)
        l.group.rotation.y += visualDt * 0.15
      })

      // Camera tilts up to follow the lantern.
      const lookY = THREE.MathUtils.lerp(1.0, 1.9, eased)
      cameraLookAt.y = lookY
      camera.position.set(
        cameraHome.x + Math.sin(t * 0.12) * 0.1,
        cameraHome.y + eased * 0.3,
        cameraHome.z,
      )
      camera.lookAt(cameraLookAt)

      ending.update(dt)
      if (disposed || !(canAct())) return
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true
      resizeObserver?.disconnect()
      resizeObserver = null
      objectPointer?.dispose()
      actionBtn.removeEventListener('click', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      fx.dispose()
      for (const removeCue of removeCues) removeCue()
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      for (const l of [main, ...companions]) l.halo?.dispose()
      petalEmissiveMap.dispose()
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
