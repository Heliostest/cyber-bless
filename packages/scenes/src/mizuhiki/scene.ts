import * as THREE from 'three'
import { getLocale, subscribeLocale } from '@wbr/i18n'
import { bindSceneText, sceneCopy, sceneTemplate } from '../scene-localization'
import { wrapCanvasText } from '../canvas-text'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import { createPathSweep } from '../path-sweep'
import { createTouchTarget } from '../touch-target'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay,
  createSceneFeedback, createStepOverlay, createWarmStage, disposeTree,
  observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '水引结愿',
  steps: '步骤',
  loop: '为赠礼纸封系一份祝愿。拖住绳端光圈，依次经过金色提示点绕环。',
  thread: '拖住绳端，沿另一侧的金色提示点穿过交会处，向左轻拉收结。',
  wish: '想着收礼的人，静静放好这份赠礼心意。',
  done: '水引结饰已系好，纸封上留着送给对方的祝愿。',
  loopAction: '绕出一个环',
  threadAction: '穿环并收紧',
  wishAction: '静放赠礼心意',
  movingLoop: '纸绳沿环轻轻弯起…',
  movingThread: '两侧相接，慢慢收拢…',
} as const

type Checkpoint = 0 | 1 | 2 | 3
type Coord = readonly [number, number, number]

// Deliberate paths round each lobe, then through the crossing. This is a
// decorative, source-informed knot, with no named-knot claim.
const ROUTES: readonly (readonly Coord[])[] = [
  [[-0.62, 0.31, 0.48], [-0.70, 0.31, 0.15], [-0.57, 0.31, -0.20], [-0.32, 0.31, -0.38], [-0.05, 0.31, -0.27], [0.12, 0.31, 0]],
  [[0.25, 0.31, 0.40], [0.55, 0.31, 0.25], [0.66, 0.31, -0.05], [0.52, 0.31, -0.35], [0.22, 0.31, -0.39], [0.03, 0.31, -0.10], [-0.30, 0.31, 0.19]],
]

const CORD_FORMS: readonly (readonly Coord[])[] = [
  [[0.50, 0.22, 0.43], [0.20, 0.22, 0.27], [0.02, 0.23, 0.05], [-0.12, 0.22, 0.08], [-0.32, 0.22, 0.28], [-0.62, 0.23, 0.48]],
  [[0.25, 0.22, 0.40], [0.12, 0.22, 0.24], [0, 0.26, 0.06], [-0.42, 0.21, 0.27], [-0.69, 0.21, 0.06], [-0.60, 0.21, -0.28], [-0.32, 0.21, -0.40], [-0.05, 0.22, -0.24], [0.12, 0.28, 0]],
  // The central crossing passes above, below, and above again. Heights
  // separate all three lobes instead of showing a flat intersecting line.
  [[-0.30, 0.19, 0.19], [0.05, 0.28, 0], [0.53, 0.19, -0.37], [0.67, 0.19, -0.08], [0.47, 0.19, 0.22], [0.12, 0.19, 0.22], [-0.06, 0.28, 0.05], [-0.40, 0.19, -0.38], [-0.68, 0.19, -0.24], [-0.65, 0.19, 0.09], [-0.32, 0.19, 0.28], [0, 0.145, 0.05], [0.28, 0.19, 0.43], [0.23, 0.19, 0.64], [-0.04, 0.19, 0.60], [-0.10, 0.19, 0.35], [0, 0.27, 0.05], [0.30, 0.19, 0.30], [0.49, 0.19, 0.48]],
]

function curve(points: readonly Coord[]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal')
}

function ease(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** Fine washi fibers, generated locally and shared by all paper layers. */
function paperTexture() {
  const size = 96, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fiber = ((x * 19 + y * 31) % 17) + (y % 7 === 0 ? -8 : 0)
    const i = (y * size + x) * 4
    data[i] = 246 + Math.floor(fiber / 4)
    data[i + 1] = 239 + Math.floor(fiber / 4)
    data[i + 2] = 218 + Math.floor(fiber / 3)
    data[i + 3] = 255
  }
  const map = new THREE.DataTexture(data, size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(3, 4)
  map.magFilter = map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}

function paperPolygon(points: readonly (readonly [number, number])[], y: number, material: THREE.Material) {
  const shape = new THREE.Shape()
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z))
  shape.closePath()
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  return mesh
}

export function createMizuhiki(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  Object.values(COPY).forEach(shared.assertSafeCopy)
  let started = false, disposed = false, focused = true, suspended = false
  let checkpoint: Checkpoint = 0
  let pose = 0, motionFrom = 0, motionTarget = 0, motionT = 1
  let settle = 0, sparkle = 0
  let stopResize = () => {}, stopClaim = () => {}
  let wishHandle: GestureHandle | null = null
  const feedback = createSceneFeedback(ctx)
  const canAct = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const moving = () => motionT < 1

  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.loopAction }, shared.assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
  const cameraHome = new THREE.Vector3(0, 3.5, 3.8)
  const lookAt = new THREE.Vector3(0, 0.12, 0)
  camera.position.copy(cameraHome)
  camera.lookAt(lookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'mizuhiki', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, { sky: 0xfff3df, ground: 0xcdbb9b, key: 0xffe1b2, rim: 0xe1d7f1, keyIntensity: 1.45, keyPosition: [-2, 4, 3] })

  const world = new THREE.Group()
  world.name = 'mizuhiki-craft'
  scene.add(world)
  const envelope = new THREE.Group()
  envelope.name = 'mizuhiki-envelope'
  world.add(envelope)
  const paperMap = paperTexture()
  const paper = new THREE.MeshStandardMaterial({ color: 0xfffcf0, map: paperMap, roughness: 0.96 })
  const foldedPaper = new THREE.MeshStandardMaterial({ color: 0xf3e6cb, map: paperMap, roughness: 0.98, side: THREE.DoubleSide })
  const topPaper = new THREE.MeshStandardMaterial({ color: 0xfff9e8, map: paperMap, roughness: 0.96, side: THREE.DoubleSide })
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89c45, roughness: 0.52, metalness: 0.32 })
  const red = new THREE.MeshStandardMaterial({ color: 0xb74743, roughness: 0.82 })

  const outline = new THREE.Shape()
  const w = 0.75, h = 1.06, r = 0.035
  outline.moveTo(-w + r, -h)
  outline.lineTo(w - r, -h)
  outline.quadraticCurveTo(w, -h, w, -h + r)
  outline.lineTo(w, h - r)
  outline.quadraticCurveTo(w, h, w - r, h)
  outline.lineTo(-w + r, h)
  outline.quadraticCurveTo(-w, h, -w, h - r)
  outline.lineTo(-w, -h + r)
  outline.quadraticCurveTo(-w, -h, -w + r, -h)
  const base = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.007, bevelSegments: 2, steps: 1 }), paper)
  base.rotation.x = -Math.PI / 2
  base.position.y = 0.035
  envelope.add(base)
  envelope.add(paperPolygon([[-0.742, -1.045], [0.11, -1.045], [-0.06, 1.045], [-0.742, 1.045]], 0.087, topPaper))
  envelope.add(paperPolygon([[0.18, -1.045], [0.742, -1.045], [0.742, 1.045], [-0.06, 1.045]], 0.101, topPaper))
  envelope.add(paperPolygon([[-0.725, -1.025], [0.725, -1.025], [0.105, -0.62]], 0.112, foldedPaper))
  envelope.add(paperPolygon([[-0.725, 1.025], [0.725, 1.025], [0.105, 0.67]], 0.113, topPaper))
  // The raised ivory slip and folded accent echo the photograph's layering
  // without reproducing an etiquette-specific inscription.
  envelope.add(paperPolygon([[-0.19, -0.97], [0.17, -0.97], [0.11, -0.47], [-0.14, -0.47]], 0.121, paper))
  envelope.add(paperPolygon([[0.53, -0.94], [0.66, -0.87], [0.50, -0.57], [0.46, -0.73]], 0.121, red))
  envelope.add(paperPolygon([[0.54, -0.94], [0.65, -0.87], [0.48, -0.75]], 0.128, gold))
  const seamMat = new THREE.LineBasicMaterial({ color: 0xd4c29f, transparent: true, opacity: 0.55 })
  envelope.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.13, 0.116, -0.57), new THREE.Vector3(-0.06, 0.116, 1.01)]), seamMat))

  const wishCanvas = document.createElement('canvas')
  wishCanvas.width = 768
  wishCanvas.height = 256
  const wishInk = wishCanvas.getContext('2d')
  const wishMap = new THREE.CanvasTexture(wishCanvas)
  wishMap.colorSpace = THREE.SRGBColorSpace
  const wishMark = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.32), new THREE.MeshBasicMaterial({ map: wishMap, transparent: true, depthWrite: false }))
  wishMark.name = 'mizuhiki-written-wish'
  wishMark.rotation.x = -Math.PI / 2
  wishMark.position.set(0, 0.126, 0.82)
  envelope.add(wishMark)
  const reading = document.createElement('details'); reading.className = 'scene-written-wish-reading scene-wish-slot'
  reading.style.gridArea = 'wish'; reading.style.gridColumn = '1 / -1'
  reading.style.maxBlockSize = '160px'; reading.style.overflowY = 'auto'
  const readingLabel = document.createElement('summary'), readingText = document.createElement('p')
  bindSceneText(readingLabel, '查看纸面文字'); reading.append(readingLabel, readingText); overlay.append(reading)
  let writtenText = '赠礼心意', productDefault = true
  const redrawWish = () => {
    if (!wishInk) return
    const text = productDefault ? sceneCopy(writtenText) : writtenText
    wishInk.clearRect(0, 0, 768, 256)
    wishInk.fillStyle = '#72583d'
    wishInk.textAlign = 'center'
    wishInk.textBaseline = 'middle'
    const locale = getLocale()
    const family = locale === 'ja' ? '"Hiragino Mincho ProN", "Yu Mincho", serif'
      : locale === 'ko' ? '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
      : locale === 'zh-Hant' ? '"Songti TC", "Noto Serif TC", serif'
      : locale === 'zh-Hans' ? '"Songti SC", "Noto Serif SC", serif' : 'Georgia, serif'
    let size = 40, lines: string[] = []
    do {
      wishInk.font = `${size}px ${family}`
      lines = wrapCanvasText(text, 680, value => wishInk.measureText(value).width, locale)
      if (lines.length * size * 1.3 <= 212 || size <= 14) break
      size -= 2
    } while (size >= 14)
    lines.forEach((line, i) => wishInk.fillText(line, 384, 128 + (i - (lines.length - 1) / 2) * size * 1.3))
    // The complete original remains readable in DOM even when the paper's physical space is small.
    readingText.textContent = text; reading.hidden = productDefault
    wishMap.needsUpdate = true
  }
  const paintWish = (text: string, isProductDefault = false) => {
    writtenText = text; productDefault = isProductDefault; redrawWish()
  }
  paintWish('赠礼心意', true)
  const stopWishLocale = subscribeLocale(redrawWish)
  void document.fonts?.ready.then(() => { if (!disposed) redrawWish() })

  const knot = new THREE.Group()
  knot.name = 'mizuhiki-interwoven-cords'
  world.add(knot)
  const colors = [0xb74442, 0xd6ad52, 0xfff2d8, 0xb74442, 0xe6c572]
  const cordMaterials = colors.map((color, i) => new THREE.MeshStandardMaterial({ color, roughness: i === 1 || i === 4 ? 0.54 : 0.88, metalness: i === 1 || i === 4 ? 0.28 : 0, emissive: 0xe7b264, emissiveIntensity: 0 }))
  // Five fine, individually spaced strands bind the paper envelope.
  colors.forEach((_color, i) => {
    const band = new THREE.Mesh(new THREE.TubeGeometry(curve([[-0.76, 0.145, (i - 2) * 0.025], [-0.35, 0.151, (i - 2) * 0.025 - 0.015], [0.35, 0.151, (i - 2) * 0.025 + 0.015], [0.76, 0.145, (i - 2) * 0.025 + 0.025]]), 32, 0.008, 6, false), cordMaterials[i])
    knot.add(band)
  })

  // Reuse fixed tube allocations as the strands follow prescribed curves;
  // no rope simulation or per-frame geometry allocation is required.
  const tubeSegments = 120, radialSegments = 6
  const forms = CORD_FORMS.map(curve)
  const sampled = forms.map((path) => path.getPoints(tubeSegments))
  const cordMeshes = cordMaterials.map((material, strand) => {
    const geometry = new THREE.TubeGeometry(forms[0], tubeSegments, 0.009, radialSegments, false)
    ;(geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    ;(geometry.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `mizuhiki-loop-strand-${strand}`
    knot.add(mesh)
    return mesh
  })
  const centres = Array.from({ length: tubeSegments + 1 }, () => new THREE.Vector3())
  const normal = new THREE.Vector3(), tangent = new THREE.Vector3()
  let lastPose = Number.NaN
  const poseCords = () => {
    if (pose === lastPose) return
    lastPose = pose
    const from = Math.min(1, Math.floor(pose)), to = Math.min(2, from + 1), k = ease(pose - from)
    centres.forEach((point, i) => point.lerpVectors(sampled[from][i], sampled[to][i], k))
    cordMeshes.forEach((mesh, strand) => {
      const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      const normals = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute
      const offset = (strand - 2) * 0.026
      for (let i = 0; i <= tubeSegments; i++) {
        tangent.subVectors(centres[Math.min(tubeSegments, i + 1)], centres[Math.max(0, i - 1)]).normalize()
        normal.set(-tangent.z, 0, tangent.x).normalize()
        for (let j = 0; j <= radialSegments; j++) {
          const a = j / radialSegments * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a)
          const n = i * (radialSegments + 1) + j, center = centres[i]
          positions.setXYZ(n, center.x + normal.x * (offset + 0.009 * cos), center.y + 0.009 * sin, center.z + normal.z * (offset + 0.009 * cos))
          normals.setXYZ(n, normal.x * cos, sin, normal.z * cos)
        }
      }
      positions.needsUpdate = normals.needsUpdate = true
      mesh.geometry.computeBoundingSphere()
    })
  }

  const guide = new THREE.Group()
  guide.name = 'mizuhiki-path-guide'
  world.add(guide)
  const waypointGeometry = new THREE.SphereGeometry(0.026, 10, 6)
  const waypoints = Array.from({ length: 7 }, (_v, i) => {
    const marker = new THREE.Mesh(waypointGeometry, new THREE.MeshBasicMaterial({ color: 0xb58a3b, transparent: true, opacity: 0.58, depthWrite: false }))
    marker.name = `mizuhiki-waypoint-${i}`
    guide.add(marker)
    return marker
  })
  const guideLineGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, () => new THREE.Vector3()))
  const guideLine = new THREE.Line(guideLineGeometry, new THREE.LineDashedMaterial({ color: 0xc59e55, transparent: true, opacity: 0.38, dashSize: 0.055, gapSize: 0.065, depthWrite: false }))
  guide.add(guideLine)
  const tip = new THREE.Group()
  tip.name = 'mizuhiki-cord-end'
  world.add(tip)
  const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.008, 6, 32), new THREE.MeshBasicMaterial({ color: 0xe1b75d, transparent: true, opacity: 0.75, depthWrite: false }))
  tipRing.rotation.x = -Math.PI / 2
  tip.add(tipRing)
  tip.add(new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 8), red))
  const tipTarget = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ visible: false }))
  tipTarget.name = 'mizuhiki-cord-end-target'
  tip.add(tipTarget)
  const routeCurves = ROUTES.map(curve)
  const routeSweeps = ROUTES.map(points => createPathSweep(points.map(p => [p[0], p[2]] as const), .17))

  const pointer = createPointerRay(canvas, camera)
  const touch = createTouchTarget(canvas, camera, scene)
  const guidePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.31)
  const pointerPoint = new THREE.Vector3()
  const pressed = new Set<number>()
  let blockedMulti = false
  let drag: { id: number; step: number; next: number; t: number } | null = null
  let claimedPointer: number | null = null
  // Each destination is the next ordered gate, so the cue cannot suggest an
  // invalid shortcut from the cord end straight to the route's finish.
  for (const [index, label] of ['拖绳端绕环', '拖绳端穿环'].entries()) {
    addInteractionCue(tipTarget, {
      kind: 'drag', label, priority: 2,
      enabled: () => canAct() && checkpoint === index && !moving() && !blockedMulti,
      destination: () => waypoints[Math.min(drag?.next ?? 1, ROUTES[index].length - 1)].getWorldPosition(new THREE.Vector3()),
      targetLabel: '沿金点前进',
    })
  }
  const releaseCapture = () => {
    if (claimedPointer !== null) {
      try { hitLayer.releasePointerCapture?.(claimedPointer) } catch { /* Already released by the browser. */ }
      claimedPointer = null
    }
  }
  const showTip = (t = 0) => {
    if (checkpoint < 2) tip.position.copy(routeCurves[checkpoint].getPoint(t))
    tip.updateMatrixWorld(true)
  }
  const resetDrag = () => {
    delete hintEl.dataset.progress
    drag = null
    routeSweeps.forEach(path => path.reset())
    releaseCapture()
    if (!moving()) pose = Math.min(checkpoint, 2)
    showTip()
    if (!disposed && !moving()) setSafeText(hintEl, [COPY.loop, COPY.thread, COPY.wish, COPY.done][checkpoint]!, shared.assertSafeCopy)
  }
  const updateGuide = () => {
    guide.visible = tip.visible = checkpoint < 2 && !moving()
    if (checkpoint >= 2) return
    const points = ROUTES[checkpoint]
    waypoints.forEach((marker, i) => {
      marker.visible = i < points.length
      if (i < points.length) marker.position.set(...points[i])
    })
    const positions = guideLineGeometry.getAttribute('position') as THREE.BufferAttribute
    routeCurves[checkpoint].getPoints(60).forEach((p, i) => positions.setXYZ(i, p.x, p.y, p.z))
    positions.needsUpdate = true
    guideLineGeometry.computeBoundingSphere()
    guideLine.computeLineDistances()
    showTip()
    world.updateMatrixWorld(true)
  }
  const syncUI = () => {
    delete hintEl.dataset.progress
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3
    actionBtn.disabled = !canAct() || moving()
    actionBtn.setAttribute('aria-disabled', String(actionBtn.disabled))
    wishSlot.hidden = checkpoint !== 2
    hitLayer.style.pointerEvents = canAct() && checkpoint < 2 ? 'auto' : 'none'
    wishHandle?.setEnabled(canAct() && checkpoint === 2)
    const hints = [COPY.loop, COPY.thread, COPY.wish, COPY.done]
    const actions = [COPY.loopAction, COPY.threadAction, COPY.wishAction]
    setSafeText(hintEl, moving() ? checkpoint === 0 ? COPY.movingLoop : COPY.movingThread : hints[checkpoint], shared.assertSafeCopy)
    if (checkpoint < 3) setSafeText(actionBtn, actions[checkpoint], shared.assertSafeCopy)
    updateGuide()
  }

  const finishCord = () => {
    if (disposed || checkpoint >= 2 || motionT < 1) return
    checkpoint = motionTarget as Checkpoint
    pose = checkpoint
    sparkle = 0.65
    syncUI()
    poseCords()
    ctx.onProgress?.(checkpoint)
  }
  const workCord = () => {
    if (!canAct() || checkpoint >= 2 || moving() || blockedMulti) return
    motionFrom = pose
    motionTarget = checkpoint + 1
    motionT = (ctx.isReducedMotion?.() ?? false) ? 1 : 0
    resetDrag()
    feedback.impact({ freqs: checkpoint === 0 ? [784, 1176] : [659.25, 987.77], duration: 0.3, gain: 0.035, type: 'triangle' })
    if (motionT === 1) finishCord()
    else syncUI()
  }
  const complete = (text?: string) => {
    if (!canAct() || checkpoint !== 2) return
    // Lock before calling the host, including saveWish, to prevent re-entry.
    checkpoint = 3
    resetDrag()
    paintWish(text || '赠你祝愿', !text)
    syncUI()
    feedback.impact({ freqs: [523.25, 784, 1046.5], duration: 0.5, gain: 0.05 })
    if (text) ctx.saveWish?.(text)
    ctx.onProgress?.(3)
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const onObject = (x: number, y: number) => {
    if (!canAct() || checkpoint >= 2 || moving() || blockedMulti) return false
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    return touch.hit(x, y, tip)
  }
  // Track the whole pointer stream: a second finger on the page or action
  // button must cancel a cord drag just as a second finger on the canvas does.
  const onWindowDown = (e: PointerEvent) => {
    if (disposed || !started) return
    pressed.add(e.pointerId)
    if (pressed.size > 1) { blockedMulti = true; resetDrag() }
  }
  const onWindowEnd = (e: PointerEvent) => {
    pressed.delete(e.pointerId)
    if (blockedMulti && pressed.size === 0) blockedMulti = false
  }
  const onWindowCancel = (e: PointerEvent) => {
    onWindowEnd(e)
    if (drag?.id === e.pointerId) resetDrag()
  }
  const onDown = (e: PointerEvent) => {
    if (disposed || !started) return
    pressed.add(e.pointerId)
    if (pressed.size > 1) { blockedMulti = true; resetDrag(); return }
    if (e.button !== undefined && e.button !== 0) return
    if (!onObject(e.clientX, e.clientY)) return
    routeSweeps[checkpoint]!.reset()
    drag = { id: e.pointerId, step: checkpoint, next: 1, t: 0 }
    claimedPointer = e.pointerId
    try { hitLayer.setPointerCapture?.(e.pointerId) } catch { /* Optional on synthetic/unsupported pointers. */ }
    feedback.prepare()
  }
  const moveAlongGuide = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id || blockedMulti) return
    if (!canAct() || checkpoint !== drag.step || e.buttons === 0) { resetDrag(); return }
    sampleGuide(e.clientX, e.clientY)
  }
  const sampleGuide = (x: number, y: number) => {
    if (!drag || !pointer.aim(x, y).ray.intersectPlane(guidePlane, pointerPoint)) return
    const path = routeSweeps[checkpoint]!
    path.sample([pointerPoint.x, pointerPoint.z]); drag.next = path.next; drag.t = path.progress
    pose = checkpoint + drag.t * 0.76
    hintEl.dataset.progress = 'true'
    setSafeText(hintEl, path.complete([pointerPoint.x, pointerPoint.z], .19) ? '这一段已绕好，松手即可。' : sceneTemplate('已沿金点前进 {p0}%，继续到下一处提示。', { p0: Math.round(path.progress * 100) }), shared.assertSafeCopy)
    showTip(drag.t)
    poseCords()
  }
  const onUp = (e: PointerEvent) => {
    const current = drag
    pressed.delete(e.pointerId)
    if (blockedMulti) {
      resetDrag()
      if (pressed.size === 0) blockedMulti = false
      return
    }
    if (!current || e.pointerId !== current.id) return
    // A browser may deliver the final gate only in pointerup. Previous gates
    // must already have been followed, so release alone cannot skip the path.
    if (current.next > 1 && canAct() && checkpoint === current.step) sampleGuide(e.clientX, e.clientY)
    const point = pointer.aim(e.clientX, e.clientY).ray.intersectPlane(guidePlane, pointerPoint)
    const valid = canAct() && point !== null && routeSweeps[current.step]!.complete([pointerPoint.x, pointerPoint.z], .19)
    drag = null
    releaseCapture()
    if (valid) workCord()
    else resetDrag()
  }
  const onCancel = (e: PointerEvent) => {
    pressed.delete(e.pointerId)
    resetDrag()
    if (pressed.size === 0) blockedMulti = false
  }
  const onLostCapture = (e: PointerEvent) => {
    if (drag?.id === e.pointerId) resetDrag()
  }
  const onAction = () => {
    if (!canAct() || moving() || blockedMulti || drag) return
    feedback.prepare()
    if (checkpoint < 2) workCord()
    else complete()
  }
  const blur = () => { focused = false; resetDrag(); pressed.clear(); blockedMulti = false; poseCords(); syncUI() }
  const focus = () => { focused = true; if (!disposed) syncUI() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.8 + portraitBoost(aspect, 4)
    camera.position.copy(cameraHome)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld(true)
  }

  syncUI()
  poseCords()
  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      stopClaim = claimObjectTouches(hitLayer, onObject)
      window.addEventListener('pointerdown', onWindowDown, true)
      window.addEventListener('pointerup', onWindowEnd, true)
      window.addEventListener('pointercancel', onWindowCancel, true)
      hitLayer.addEventListener('pointerdown', onDown)
      hitLayer.addEventListener('pointermove', moveAlongGuide)
      hitLayer.addEventListener('pointerup', onUp)
      hitLayer.addEventListener('pointercancel', onCancel)
      hitLayer.addEventListener('lostpointercapture', onLostCapture)
      actionBtn.addEventListener('click', onAction)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      wishHandle = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: (text) => {
        if (!canAct() || checkpoint !== 2) return
        feedback.prepare()
        complete(text)
      } })
      wishHandle.mount(wishSlot, {})
      // Reconstruct checkpoints directly: no transitions, feedback, save or
      // completion events are emitted during restoration.
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      pose = Math.min(checkpoint, 2)
      motionTarget = pose
      settle = checkpoint === 3 ? 1 : 0
      if (checkpoint === 3) paintWish('赠你祝愿', true)
      poseCords()
      syncUI()
    },
    update(dt) {
      if (disposed || !started) return
      if (!canAct()) {
        suspended = true
        resetDrag()
        poseCords()
        syncUI()
        styleRenderer.render()
        return
      }
      if (suspended) { suspended = false; syncUI() }
      wishHandle?.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      if (moving()) {
        motionT = reduced ? 1 : Math.min(1, motionT + Math.max(0, dt) / (checkpoint === 0 ? 0.9 : 1.15))
        pose = THREE.MathUtils.lerp(motionFrom, motionTarget, ease(motionT))
        if (motionT === 1) finishCord()
      }
      poseCords()
      settle = checkpoint === 3 ? reduced ? 1 : Math.min(1, settle + dt / 0.75) : 0
      world.rotation.y = -0.065 * ease(settle)
      sparkle = Math.max(0, sparkle - dt)
      cordMaterials.forEach((mat) => { mat.emissiveIntensity = reduced ? 0 : sparkle * 0.16 })
      // A stable desk camera keeps both loops and every fold edge readable.
      tipRing.scale.setScalar(reduced ? 1 : 1 + Math.sin(performance.now() * 0.003) * 0.045)
      waypoints.forEach((marker, i) => { (marker.material as THREE.MeshBasicMaterial).opacity = drag && i < drag.next ? 0.22 : 0.58 })
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopWishLocale()
      resetDrag()
      pressed.clear()
      stopResize()
      stopClaim()
      window.removeEventListener('pointerdown', onWindowDown, true)
      window.removeEventListener('pointerup', onWindowEnd, true)
      window.removeEventListener('pointercancel', onWindowCancel, true)
      hitLayer.removeEventListener('pointerdown', onDown)
      hitLayer.removeEventListener('pointermove', moveAlongGuide)
      hitLayer.removeEventListener('pointerup', onUp)
      hitLayer.removeEventListener('pointercancel', onCancel)
      hitLayer.removeEventListener('lostpointercapture', onLostCapture)
      actionBtn.removeEventListener('click', onAction)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      wishHandle?.dispose()
      wishHandle = null
      feedback.dispose()
      styleRenderer.dispose()
      disposeTree(scene)
      paperMap.dispose()
      wishMap.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      scene.clear()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
