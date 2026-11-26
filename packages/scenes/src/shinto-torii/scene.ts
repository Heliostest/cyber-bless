import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createQuietEnding } from '../quiet-ending'
import { bindSceneAttribute } from '../scene-localization'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addCelLights,
  CEL_STYLE,
  claimObjectTouches,
  createPointerRay,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
  disposeTree,
  observeCanvasResize,
  portraitBoost,
  setSafeText,
  sizeStage,
} from '../procedural-kit'
import { createWoodGrainTexture, projectCylinderWoodUVs, projectWoodUVs, type WoodGrainOptions } from './wood-grain'

type Step = 'approach' | 'bow' | 'ema' | 'done'

const STEP_ORDER: Step[] = ['approach', 'bow', 'ema']

const COPY = {
  title: '庭前一礼',
  hintApproach: '鸟居标示神社入口。点按鸟居或向上轻滑，走到它跟前。',
  hintWalking: '缓步走近…',
  hintBow: '入社前低头示敬。按住鸟居向下轻滑，也可竖起手机稍停，或点「轻轻一礼」。',
  hintBowing: '低头，再缓缓抬起…',
  hintEma: '带着心里的祈愿，在鸟居前静立片刻，再点「静立片刻」结束。',
  approachTap: '走到鸟居前',
  bowTap: '轻轻一礼',
  emaTap: '静立片刻',
  done: '鸟居前的一礼已毕，留一刻敬意。',
  wishLabel: '在绘马形木牌上留一句祈愿',
  wishPlaceholder: '愿家人平安…',
  stepsAria: '步骤',
  cueApproach: '点按鸟居走近',
  cueBow: '向下轻滑一礼',
} as const

const WALK_SECONDS = 1.8
const BOW_SECONDS = 2.4
const FAR_Z = 7.6
const NEAR_Z = 4.9
const SWIPE_PX = 40

/** Box bent upward toward both ends: the kasagi's lifted tips. */
function upswept(width: number, height: number, depth: number, lift: number) {
  const geo = new THREE.BoxGeometry(width, height, depth, 24, 1, 1)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const u = Math.abs(pos.getX(i)) / (width / 2)
    pos.setY(i, pos.getY(i) + lift * Math.pow(u, 2.6))
  }
  geo.computeVertexNormals()
  return geo
}

/** Five-sided wooden board (plain, no text or crest). */
function emaGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.1, -0.07)
  s.lineTo(0.1, -0.07)
  s.lineTo(0.1, 0.035)
  s.lineTo(0, 0.09)
  s.lineTo(-0.1, 0.035)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false })
}

export function createShintoTorii(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'approach'
  let disposed = false
  let started = false
  let restoring = true
  let walkT = 0
  let walking = false
  let bowT = 0
  let bowing = false
  let emaGlow = 0

  const handles: GestureHandle[] = []
  let dragHandle: GestureHandle | null = null
  let gyroHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.approachTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui
  actionBtn.dataset.gyroFallback = ''
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const ending = createQuietEnding(ctx, { ui: ui, isActive: () => started && !disposed && canAct(),
    duration: 3, motion: 'glow', targets: () => [torii], cancelInput: () => { dragHandle?.setEnabled(false) }, complete: () => completeScene(),
  })
  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = walking || bowing || step === 'done'
    wishSlot.hidden = step !== 'ema'
    hitLayer.style.pointerEvents =
      (step === 'approach' || step === 'bow') && !walking && !bowing ? 'auto' : 'none'
    if (step === 'approach') {
      setHint(walking ? COPY.hintWalking : COPY.hintApproach)
      setSafeText(actionBtn, COPY.approachTap, assertSafeCopy)
    } else if (step === 'bow') {
      setHint(bowing ? COPY.hintBowing : COPY.hintBow)
      setSafeText(actionBtn, COPY.bowTap, assertSafeCopy)
    } else if (step === 'ema') {
      setHint(COPY.hintEma)
      setSafeText(actionBtn, COPY.emaTap, assertSafeCopy)
    } else setHint(COPY.done)
    ending.sync(step === 'ema')
  }

  // Transparent over the island stage: clear morning key, pale sky rim on the vermilion.
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const EYE_Y = 1.45
  // Extra distance on narrow portrait screens so both pillars stay in frame.
  let zBoost = 0
  camera.position.set(0, EYE_Y, FAR_Z)
  const cameraLookAt = new THREE.Vector3(0, 1.55, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'shinto-torii', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addCelLights(scene, {
    sky: 0xfff3e4,
    ground: 0xd8c4a8,
    key: 0xffe4c0,
    rim: 0xcfe4ff,
    keyIntensity: 1.35,
    keyPosition: [3, 5, 4],
  })

  const world = new THREE.Group()
  scene.add(world)

  // Myōjin-style torii: two pillars, nuki tie beam, shimaki + upswept kasagi.
  // Proportions are an art choice, not a survey of any one shrine.
  const torii = new THREE.Group()
  world.add(torii)
  const woodTextures: THREE.DataTexture[] = []
  const lacquer = (
    axis: 'x' | 'y',
    color: number,
    roughness: number,
    clearcoat: number,
    clearcoatRoughness: number,
    scale: number,
    strength: number,
    grainOpts: WoodGrainOptions,
    offsetU = 0,
    offsetV = 0,
  ) => {
    const map = createWoodGrainTexture({ lacquer: true, ...grainOpts }, offsetU, offsetV)
    woodTextures.push(map)
    return applyCraftSurface(
      new THREE.MeshPhysicalMaterial({
        color,
        roughness,
        clearcoat,
        clearcoatRoughness,
        map,
      }),
      { kind: 'wood', axis, strength, scale },
    )
  }
  const rawWood = (
    axis: 'x' | 'y',
    color: number,
    roughness: number,
    scale: number,
    strength: number,
    grainOpts: WoodGrainOptions,
    offsetU = 0,
    offsetV = 0,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) => {
    const map = createWoodGrainTexture(grainOpts, offsetU, offsetV)
    woodTextures.push(map)
    return applyCraftSurface(
      new THREE.MeshStandardMaterial({ color, roughness, map, ...extra }),
      { kind: 'wood', axis, strength, scale },
    )
  }
  const pillarMatLeft = lacquer('y', 0xe55a30, 0.54, 0.38, 0.27, 0.44, 0.18, {
    seed: 11, rings: 5.2, drift: 0.084, arch: 0.06, contrast: 0.115, wash: 0.03,
    knots: [{ u: 0.42, v: 0.5, rx: 0.056, ry: 0.044, pull: 0.72, depth: 0.76 }],
  })
  const pillarMatRight = lacquer('y', 0xde532b, 0.58, 0.34, 0.3, 0.54, 0.2, {
    seed: 19, rings: 6.0, drift: 0.08, arch: 0.056, contrast: 0.11, wash: 0.028,
    knots: [{ u: 0.64, v: 0.48, rx: 0.052, ry: 0.042, pull: 0.7, depth: 0.72 }],
  })
  const nukiMat = lacquer('x', 0xe65d33, 0.55, 0.36, 0.28, 0.48, 0.18, {
    seed: 29, rings: 5.4, drift: 0.088, arch: 0.064, contrast: 0.115, wash: 0.03,
    knots: [{ u: 0.35, v: 0.52, rx: 0.052, ry: 0.036, pull: 0.72, depth: 0.76 }],
  })
  const shimakiMat = lacquer('x', 0xdc512a, 0.59, 0.32, 0.32, 0.56, 0.2, {
    seed: 37, rings: 6.2, drift: 0.082, arch: 0.058, contrast: 0.11, wash: 0.028,
    knots: [{ u: 0.68, v: 0.48, rx: 0.05, ry: 0.034, pull: 0.7, depth: 0.72 }],
  })
  const kasagiMat = lacquer('x', 0xe86035, 0.52, 0.39, 0.26, 0.42, 0.16, {
    seed: 43, rings: 4.8, drift: 0.09, arch: 0.068, contrast: 0.105, wash: 0.026,
    knots: [{ u: 0.28, v: 0.5, rx: 0.054, ry: 0.036, pull: 0.7, depth: 0.7 }],
  })
  const gakuzukaMat = lacquer('y', 0xd94f29, 0.6, 0.31, 0.33, 0.62, 0.2, {
    seed: 53, rings: 6.4, drift: 0.075, arch: 0.05, contrast: 0.11, wash: 0.028,
  })
  const ink = new THREE.MeshStandardMaterial({ color: 0x2f2a2a, roughness: 0.84 })
  const inkCapMap = createWoodGrainTexture({
    seed: 61, rings: 5.6, drift: 0.075, arch: 0.05, contrast: 0.12, wash: 0.025, lacquer: true,
  })
  woodTextures.push(inkCapMap)
  const inkCap = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0x2f2a2a,
      roughness: 0.66,
      clearcoat: 0.24,
      clearcoatRoughness: 0.36,
      map: inkCapMap,
    }),
    { kind: 'wood', axis: 'x', strength: 0.18, scale: 0.58 },
  )
  const baseGeo = new THREE.CylinderGeometry(0.135, 0.14, 0.26, 24)
  for (const side of [-1, 1]) {
    const isLeft = side < 0
    const pillarGeo = projectCylinderWoodUVs(
      new THREE.CylinderGeometry(0.1, 0.115, 2.4, 24),
      Math.PI * 2 * 0.108,
      2.4,
      isLeft ? 0.42 : 0.46,
      1.45,
      isLeft ? 0.5 : 0.28,
      0.5,
    )
    const pillar = new THREE.Mesh(pillarGeo, isLeft ? pillarMatLeft : pillarMatRight)
    pillar.name = isLeft ? 'torii-pillar-left' : 'torii-pillar-right'
    pillar.position.set(side * 0.92, 1.2, 0)
    pillar.rotation.z = side * 0.025 // slight inward lean
    torii.add(pillar)
    const base = new THREE.Mesh(baseGeo, ink)
    base.position.set(side * 0.935, 0.13, 0)
    torii.add(base)
  }
  const nuki = new THREE.Mesh(projectWoodUVs(new RoundedBoxGeometry(2.5, 0.13, 0.1, 2, 0.02), 'x', 0.38, 1.8, 0.5, 0.5), nukiMat)
  nuki.name = 'torii-nuki'
  nuki.position.y = 1.86
  torii.add(nuki)
  const gakuzuka = new THREE.Mesh(projectWoodUVs(new RoundedBoxGeometry(0.12, 0.3, 0.09, 2, 0.015), 'y', 1.4, 2.2, 0.5, 0.5), gakuzukaMat)
  gakuzuka.name = 'torii-gakuzuka'
  gakuzuka.position.y = 2.07
  torii.add(gakuzuka)
  const shimaki = new THREE.Mesh(projectWoodUVs(new RoundedBoxGeometry(2.62, 0.12, 0.17, 2, 0.02), 'x', 0.42, 1.9, 0.24, 0.42), shimakiMat)
  shimaki.name = 'torii-shimaki'
  shimaki.position.y = 2.28
  torii.add(shimaki)
  const kasagi = new THREE.Mesh(projectWoodUVs(upswept(3.0, 0.13, 0.2, 0.13), 'x', 0.34, 1.6, 0.5, 0.5), kasagiMat)
  kasagi.name = 'torii-kasagi'
  kasagi.position.y = 2.41
  torii.add(kasagi)
  const kasagiTop = new THREE.Mesh(projectWoodUVs(upswept(3.12, 0.055, 0.25, 0.15), 'x', 0.36, 1.7, 0.35, 0.5), inkCap)
  kasagiTop.name = 'torii-kasagi-top'
  kasagiTop.position.y = 2.5
  torii.add(kasagiTop)

  // A few approach-path stones (参道) mark entrance → path; no hall is modelled.
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcfc5b6, roughness: 0.95 })
  applyCraftSurface(stoneMat, { kind: 'stone', strength: .4 })

  const stoneGeo = new RoundedBoxGeometry(0.72, 0.05, 0.42, 2, 0.02)
  for (let i = 0; i < 6; i++) {
    const stone = new THREE.Mesh(stoneGeo, stoneMat)
    stone.position.set((i % 2 ? 0.03 : -0.03), 0.025, 3.2 - i * 0.62)
    world.add(stone)
  }

  // Plain ema rack to the right, past the torii.
  const rack = new THREE.Group()
  rack.position.set(1.95, 0, -1.1)
  rack.rotation.y = -0.5
  world.add(rack)
  const rackPostLeft = rawWood('y', 0x866045, 0.81, 0.5, 0.2, {
    seed: 71, rings: 5.8, drift: 0.086, arch: 0.06, contrast: 0.17, wash: 0.048,
    knots: [{ u: 0.44, v: 0.52, rx: 0.062, ry: 0.038, pull: 0.74, depth: 0.84 }],
  })
  const rackPostRight = rawWood('y', 0x79563e, 0.83, 0.62, 0.22, {
    seed: 79, rings: 6.4, drift: 0.082, arch: 0.056, contrast: 0.165, wash: 0.046,
    knots: [{ u: 0.68, v: 0.48, rx: 0.058, ry: 0.036, pull: 0.72, depth: 0.8 }],
  })
  const rackBarTop = rawWood('x', 0x8c6549, 0.8, 0.48, 0.2, {
    seed: 89, rings: 5.6, drift: 0.088, arch: 0.064, contrast: 0.17, wash: 0.048,
    knots: [{ u: 0.38, v: 0.5, rx: 0.058, ry: 0.036, pull: 0.74, depth: 0.82 }],
  })
  const rackBarBottom = rawWood('x', 0x7d5940, 0.83, 0.6, 0.22, {
    seed: 97, rings: 6.4, drift: 0.082, arch: 0.056, contrast: 0.165, wash: 0.044,
  }, 0.27, 0.44)

  for (const x of [-0.45, 0.45]) {
    const isLeft = x < 0
    const post = new THREE.Mesh(
      projectWoodUVs(new RoundedBoxGeometry(0.06, 1.3, 0.06, 2, 0.015), 'y', isLeft ? 0.72 : 0.8, 3.2, isLeft ? 0.5 : 0.22, 0.5),
      isLeft ? rackPostLeft : rackPostRight,
    )
    post.name = isLeft ? 'torii-rack-post-left' : 'torii-rack-post-right'
    post.position.set(x, 0.65, 0)
    rack.add(post)
  }
  for (const y of [1.2, 0.9]) {
    const isTop = y > 1
    const bar = new THREE.Mesh(
      projectWoodUVs(new RoundedBoxGeometry(1.0, 0.04, 0.05, 2, 0.012), 'x', isTop ? 0.9 : 1.02, 3.6, isTop ? 0.5 : 0.18, 0.5),
      isTop ? rackBarTop : rackBarBottom,
    )
    bar.name = isTop ? 'torii-rack-bar-top' : 'torii-rack-bar-bottom'
    bar.position.set(0, y, 0)
    rack.add(bar)
  }
  const emaGeo = emaGeometry()
  // The apex remains on the rack while the lower board stirs in the breeze.
  emaGeo.translate(0, -.09, 0)
  projectWoodUVs(emaGeo, 'x', 3.0, 2.4, 0.5, 0.72)

  const emaPalette: [number, number, number, number, number][] = [
    [0xe5c99e, 0.3, 107, 0.08, 0.12],
    [0xd8b788, 0.36, 113, 0.34, 0.46],
    [0xe1c395, 0.42, 127, 0.61, 0.22],
    [0xd2af80, 0.32, 137, 0.21, 0.71],
    [0xddbc8f, 0.44, 149, 0.74, 0.38],
  ]
  const emaSpots: [number, number][] = [
    [-0.3, 1.1], [-0.08, 1.1], [0.2, 1.1], [-0.2, 0.8], [0.3, 0.8],
  ]
  const emas: THREE.Mesh[] = []
  for (const [i, [x, y]] of emaSpots.entries()) {
    const [hex, scale, seed, offU, offV] = emaPalette[i]!
    const emaMat = rawWood('x', hex, 0.77 + (i % 3) * 0.015, scale, 0.18, {
      seed, rings: 4.4 + (i % 3) * 0.45, drift: 0.055, arch: 0.04, contrast: 0.11, wash: 0.04,
      knots: i % 2 === 0 ? [{ u: 0.32 + i * 0.12, v: 0.55, rx: 0.068, ry: 0.04, pull: 0.7, depth: 0.68 }] : [],
    }, offU, offV)
    const ema = new THREE.Mesh(emaGeo, emaMat)
    ema.name = `torii-rack-ema-${emas.length}`
    ema.position.set(x, y + .09, 0.03)
    rack.add(ema)
    emas.push(ema)
  }
  // The visitor's own board: appears on the rack once written.
  const ownEmaMat = rawWood('x', 0xe7cba0, 0.76, 0.34, 0.18, {
    seed: 157, rings: 4.6, drift: 0.055, arch: 0.04, contrast: 0.11, wash: 0.038,
    knots: [{ u: 0.72, v: 0.46, rx: 0.064, ry: 0.036, pull: 0.7, depth: 0.68 }],
  }, 0.16, 0.28, { emissive: 0xffb060, emissiveIntensity: 0 })
  const ownEma = new THREE.Mesh(emaGeo, ownEmaMat)
  ownEma.name = 'torii-own-ema'
  ownEma.position.set(0.05, 0.89, 0.05)
  ownEma.visible = false
  rack.add(ownEma)

  const toriiZone = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.6, 0.6),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  toriiZone.position.set(0, 1.3, 0)
  world.add(toriiZone)

  const pointer = createPointerRay(canvas, camera)
  /** Taps and swipes that start on the torii are the scene's; elsewhere the page scrolls. */
  const onTorii = (x: number, y: number) => pointer.hits(x, y, [toriiZone])

  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    zBoost = portraitBoost(aspect, 4)
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()

  addInteractionCue(toriiZone, {
    kind: 'tap',
    label: COPY.cueApproach,
    enabled: () => started && !disposed && !restoring && canAct() &&
      step === 'approach' && !walking,
  })
  addInteractionCue(toriiZone, {
    kind: 'drag',
    label: COPY.cueBow,
    enabled: () => started && !disposed && !restoring && canAct() &&
      step === 'bow' && !bowing,
  })

  const completeScene = (fromWriting = false) => {
    if (!restoring && !ending.completing && !fromWriting) return
    if (!canAct() || step === 'done') return
    step = 'done'
    dragHandle?.setEnabled(false)
    gyroHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    if (!restoring) { ctx.onProgress?.(3); if (disposed || !(canAct())) return }
    syncOverlayForStep()
    if (!restoring) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goEma = () => {
    if (!canAct() || step !== 'bow') return
    step = 'ema'
    bowing = false
    bowT = 1
    dragHandle?.setEnabled(false)
    gyroHandle?.setEnabled(false)
    wishHandle?.setEnabled(true)
    if (!restoring) {
      // Quiet, low round tone as the head lifts again.
      fx.impact({ freqs: [293.66, 440], duration: 1.2, gain: 0.06 })
      ctx.onProgress?.(2)
    }
    syncOverlayForStep()
  }

  const startBow = () => {
    if (!canAct() || step !== 'bow' || bowing) return
    bowing = true
    bowT = 0
    gyroHandle?.setEnabled(false)
    syncOverlayForStep()
    if (ctx.isReducedMotion?.() ?? false) goEma()
  }

  const goBow = () => {
    if (!canAct() || step !== 'approach') return
    step = 'bow'
    walking = false
    walkT = 1
    gyroHandle?.setEnabled(true)
    if (!restoring) {
      fx.impact({ freqs: [440, 660], duration: 0.3, gain: 0.035, type: 'triangle' })
      ctx.onProgress?.(1)
    }
    syncOverlayForStep()
  }

  const startWalk = () => {
    if (!canAct() || step !== 'approach' || walking) return
    walking = true
    walkT = 0
    syncOverlayForStep()
    if (ctx.isReducedMotion?.() ?? false) goBow()
  }

  const leaveEma = () => {
    ownEma.visible = true
    emaGlow = 1
    fx.impact({ freqs: [660, 990], duration: 0.3, gain: 0.04, type: 'triangle' })
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'approach') startWalk()
    else if (step === 'bow') startBow()
    else if (step === 'ema') completeScene()
  }

  let downX = 0
  let downY = 0
  let interactionPointerId: number | null = null
  const onHitDown = (e: PointerEvent) => {
    if (!canAct() || interactionPointerId !== null || !onTorii(e.clientX, e.clientY)) return
    interactionPointerId = e.pointerId
    fx.prepare()
    downX = e.clientX
    downY = e.clientY
  }
  const onHitUp = (e: PointerEvent) => {
    if (e.pointerId !== interactionPointerId) return
    interactionPointerId = null
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 12 && step === 'approach' && onTorii(e.clientX, e.clientY)) {
      startWalk()
    }
  }
  const onHitCancel = (e?: PointerEvent) => {
    if (e && e.pointerId !== interactionPointerId) return
    interactionPointerId = null
  }
  const onInputBlur = () => onHitCancel()

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    hitLayer.addEventListener('pointercancel', onHitCancel)
    hitLayer.addEventListener('lostpointercapture', onHitCancel)
    window.addEventListener('blur', onInputBlur)
    stopClaim = claimObjectTouches(hitLayer, onTorii)
    // Swipe up = step forward; swipe down = lower the head. Either swipe must
    // start on the torii, so scrolling past the stage never walks or bows.
    dragHandle = gestures.createDrag({
      startsOn: (x, y) => canAct() && onTorii(x, y),
      hitTest: (_x, y) =>
        step === 'approach' ? downY - y > SWIPE_PX : step === 'bow' && y - downY > SWIPE_PX,
      onDrop: (hit) => {
        if (!hit) return
        if (step === 'approach') startWalk()
        else if (step === 'bow') startBow()
      },
    })
    dragHandle.mount(hitLayer, {})
    handles.push(dragHandle)
    hitLayer.addEventListener('pointerup', onHitUp)
    actionBtn.addEventListener('click', onActionTap)

    // Device motion can also start the bow; without sensors the tap button stands in.
    gyroHandle = gestures.createGyro({
      // Near-upright and held: a deliberate raise, not the usual reading angle.
      bowBetaDeg: 60,
      holdMs: 600,
      fallbackTapSelector: '[data-gyro-fallback]',
      onHold: () => startBow(),
    })
    gyroHandle.mount(overlay, {})
    gyroHandle.setEnabled(false)
    handles.push(gyroHandle)

    let submittingWish = false
    wishHandle = gestures.createWishWrite({
      maxLen: 40,
      saves: ctx.saveWish !== undefined,
      onSubmit: (text) => {
        if (submittingWish || disposed || step !== 'ema' || !canAct()) return
        submittingWish = true
        try {
          ctx.saveWish?.(text)
          if (disposed || !canAct()) return
          leaveEma()
          completeScene(true)
        } finally {
          submittingWish = false
        }
      },
    })
    wishHandle.mount(wishSlot, {})
    const input = wishSlot.querySelector('input')
    if (input) { bindSceneAttribute(input, 'aria-label', COPY.wishLabel); bindSceneAttribute(input, "placeholder", COPY.wishPlaceholder) }
    wishHandle.setEnabled(false)
    handles.push(wishHandle)
  }

  syncOverlayForStep()

  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      stopResize = observeCanvasResize(canvas, () => {
        if (!disposed) resize()
      })
      wireGestures()
      const initial = ctx.initialProgress ?? 0
      if (initial >= 1) goBow()
      if (initial >= 2) goEma()
      if (initial >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      if (!canAct()) {
        onHitCancel()
        dragHandle?.setEnabled(false)
        gyroHandle?.setEnabled(false)
        return
      }
      dragHandle?.setEnabled(step === 'approach' || step === 'bow')
      gyroHandle?.setEnabled(step === 'bow' && !bowing)
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      if (walking) {
        walkT = Math.min(1, walkT + dt / WALK_SECONDS)
        if (walkT >= 1) goBow()
      }
      if (bowing) {
        bowT = Math.min(1, bowT + dt / BOW_SECONDS)
        if (bowT >= 1) goEma()
      }

      // Walk: ease the camera from the path's start to just before the torii,
      // with a faint step bob.
      const w = walkT * walkT * (3 - 2 * walkT)
      const z = THREE.MathUtils.lerp(FAR_Z, NEAR_Z, w) + zBoost
      const bob = walking && !reduced ? Math.abs(Math.sin(walkT * Math.PI * 4)) * 0.025 : 0

      // Bow (一礼): pitch down and back up in one slow arc; no clapping sequence.
      const bowArc = bowing ? Math.sin(Math.PI * bowT) : 0
      const pitch = bowArc * bowArc * (3 - 2 * bowArc)
      camera.position.set(
        Math.sin(t * 0.12) * 0.06,
        EYE_Y + bob - pitch * 0.18,
        z - pitch * 0.12,
      )
      cameraLookAt.set(0, 1.55 - pitch * 1.6, 0)
      camera.lookAt(cameraLookAt)

      // The rack's boards stir a little in the breeze.
      emas.forEach((ema, i) => {
        ema.rotation.z = reduced ? 0 : Math.sin(t * 1.3 + i * 1.9) * 0.06
      })
      emaGlow = Math.max(0, emaGlow - dt * (reduced ? 3 : 0.6))
      ownEmaMat.emissiveIntensity = emaGlow * 0.6
      ownEma.rotation.z = reduced ? 0 : Math.sin(t * 1.5) * 0.08

      ending.update(dt)
      if (disposed || !(canAct())) return
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true
      stopResize()
      stopClaim()
      hitLayer.removeEventListener('pointerdown', onHitDown)
      hitLayer.removeEventListener('pointerup', onHitUp)
      hitLayer.removeEventListener('pointercancel', onHitCancel)
      hitLayer.removeEventListener('lostpointercapture', onHitCancel)
      window.removeEventListener('blur', onInputBlur)
      actionBtn.removeEventListener('click', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      fx.dispose()
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      disposeTree(world)
      woodTextures.forEach(tex => tex.dispose())
      woodTextures.length = 0
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
