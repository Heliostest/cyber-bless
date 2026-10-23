import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { placementHit } from '../placement-hit'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '釉彩映晴', decorateAction: '嵌入最后一块花砖', hangAction: '把花砖安放在展托', quietAction: '轻点花砖静看',
  decorate: '拿起桌前花砖，补上中央空位，让蓝白花纹相连。',
  hang: '握住木框下沿，把完整花砖送到右侧展托。',
  quiet: '轻点花砖静看，或写一句心意后点「写好了」。',
  returning: '轻点花砖，回看这份留在晴日里的心意。', moving: '让花砖轻轻落稳…',
  done: '釉彩映着晴日，心意留在此刻。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const REST = new THREE.Vector3(.78, .88, -.02), PIECE_HOME = new THREE.Vector3(-1.04, .7875, .64)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original framed ceramic panel: a contemporary craft exercise, not a religious object. */
export function createAndalusianCeramicTile(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  const returning = ctx.returning === true
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  // Host callbacks may synchronously dispatch input or call update again.
  let notifying = false
  function notifyHost(callback: () => void) {
    const previous = notifying; notifying = true
    try { callback() } finally { notifying = previous }
  }
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.decorateAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'andalusian-ceramic-tile', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3eee0, ground: 0xa4afa0, key: 0xfff4dd, rim: 0xd9eef1,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'tile-courtyard-workbench'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  const white = material(0xf2efe0, .33), blue = material(0x416c9b, .32), teal = material(0x82b5b0, .34), gold = material(0xcea452, .34)
  const oak = material(0xc7b38c), walnut = material(0x936c50), clay = material(0xb37452), linen = material(0x94b4ad), mortar = material(0xb0ae99)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.015, ...size.map(v => v / 3))), mat, p, parent)
  addCraftTable(world, { name: 'tile-table', topName: 'tile-table-top', width: 3.35, depth: 1.72, surfaceY: .76, thickness: .12, center: [0,.04], support: 'arched', finish: 'honey' })
  const ground = add('tile-contact-shadow', new THREE.PlaneGeometry(3.9, 2.2), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .1]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  box('tile-home-pad', [1.27, .04, .48], [-.67, .78, -.02], linen)
  box('tile-home-back-rest', [.20, .44, .12], [-.67, 1.02, -.13], walnut)
  const stand = new THREE.Group(); stand.name = 'tile-display-stand'; world.add(stand)
  box('tile-stand-base', [1.28, .08, .65], [.78, .80, -.02], walnut, stand)
  const seat = box('tile-display-seat', [1.23, .04, .46], [.78, .86, -.02], linen, stand)
  box('tile-display-back-rest', [.20, .54, .12], [.78, 1.15, -.13], walnut, stand)
  const panel = new THREE.Group(); panel.name = 'tile-panel'; world.add(panel)
  box('tile-wooden-frame', [1.20, 1.20, .10], [0, .60, 0], walnut, panel)
  box('tile-grout-bed', [1.02, 1.02, .012], [0, .60, .056], mortar, panel)
  const socket = box('tile-empty-seat', [.302, .302, .008], [0, .60, .066], clay, panel)
  const grip = box('tile-frame-grip', [.18, .060, .035], [0, .046, .070], blue, panel)
  grip.userData.toonSurface = { outline: false, roughness: .4 }
  const flower = (parent: THREE.Group, center: boolean) => {
    box(center ? 'tile-piece-clay' : 'tile-fired-clay', [.307, .307, .047], [0, 0, -.004], clay, parent)
    const glaze = box('tile-glaze-face', [.303, .303, .012], [0, 0, .0255], white, parent)
    glaze.userData.toonSurface = { outline: false, roughness: .38 }
    // Four broad teardrops are an original small floral repeat, not a copied historic tile.
    for (let i = 0; i < 4; i++) {
      const shape = new THREE.Shape(); shape.moveTo(0, .028); shape.bezierCurveTo(-.065, .067, -.047, .112, 0, .134); shape.bezierCurveTo(.047, .112, .065, .067, 0, .028)
      const petal = add('tile-painted-petal', new THREE.ExtrudeGeometry(shape, { depth: .0036, bevelEnabled: false, curveSegments: 14 }), i % 2 ? teal : blue, [0, 0, .0315], parent); petal.rotation.z = i * Math.PI / 2
      petal.castShadow = false; petal.userData.toonSurface = { outline: false }
    }
    const dot = add(center ? 'tile-loose-grip' : 'tile-flower-center', new THREE.CylinderGeometry(.029, .029, .008, 24), gold, [0, 0, .0355], parent)
    dot.rotation.x = Math.PI / 2; dot.userData.toonSurface = { outline: false, roughness: .4 }
    return dot
  }
  for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) {
    if (!row && !col) continue
    const cell = new THREE.Group(); cell.name = 'tile-fixed-cell'; cell.position.set(col * .327, .60 + row * .327, .0895); panel.add(cell); flower(cell, false)
  }
  const piece = new THREE.Group(); piece.name = 'tile-center-piece'; world.add(piece)
  const pieceGrip = flower(piece, true)
  const home = new THREE.Vector3(-.67, .80, -.02)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { panel.position.copy(at >= 2 ? REST : home); (at >= 1 ? panel : world).add(piece); piece.position.copy(at >= 1 ? new THREE.Vector3(0, .60, .0975) : PIECE_HOME); piece.rotation.set(at >= 1 ? 0 : -Math.PI / 2, 0, 0); matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  const fittedPoint = () => panel.localToWorld(new THREE.Vector3(0, .60, .0975))
  addInteractionCue(pieceGrip, { kind: 'drag', label: '拿起花砖', priority: 3, enabled: enabled(0), destination: socket, targetLabel: '中央空位' })
  addInteractionCue(grip, { kind: 'drag', label: '握住木框', priority: 3, enabled: enabled(1), destination: seat, targetLabel: '花砖展托' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点花砖静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? piece : panel
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => touch.hit(x, y, targets, { ignore: held })
  const placementReady = (x: number, y: number) => at < 2 && travel >= 8
    && !touch.occluded(x, y, at === 0 ? socket : seat, { ignore: moving() })
    && placementHit(canvas, camera, at === 0 ? pieceGrip : grip, x, y, (px, py) => visibleHit(px, py, at === 0 ? socket : seat, moving()), [0, 0, 0])
  const reset = () => { dropFeedback.clear(); dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (notifying || motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? piece : panel) },
    onStart(x, y) { dropFeedback.clear(); notifyHost(() => feedback.prepare()); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      if (notifying) return
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices(); dropFeedback.setReady(dragging && placementReady(x, y))
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && placementReady(x, y)
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, panel)
      dropFeedback.clear(); dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    dropFeedback.clear()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.decorateAction : at === 1 ? COPY.hangAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.decorate : at === 1 ? COPY.hang : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settle() { if (!active() || !motion) return; at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync(); notifyHost(() => ctx.onProgress?.(at)); if (disposed || !active()) return; notifyHost(() => feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' })) }
  function begin() { if (notifying || !active() || pointer.isBusy() || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (notifying || !active() || pointer.isBusy() || motion || at !== 2) return
    at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) notifyHost(() => ctx.saveWish?.(text.trim()))
    // An accepted save and its checkpoint are atomic across pause, but not disposal.
    if (disposed) return
    notifyHost(() => ctx.onProgress?.(3))
    if (!active()) return
    notifyHost(() => feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 }))
    if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (notifying || !active() || pointer.isBusy() || motion || at === 3) return; notifyHost(() => feedback.prepare()); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.1, 5.75 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.22, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (notifying || !active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; notifyHost(() => feedback.prepare()); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true }; return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .8); const t = ease(motion.time)
        if (motion.step === 0) { piece.position.lerpVectors(motion.from, fittedPoint(), t); piece.rotation.x = -Math.PI / 2 * (1 - t); if (!reduced()) piece.position.y += .12 * Math.sin(Math.PI * t) }
        else { panel.position.lerpVectors(motion.from, REST, t); if (!reduced()) panel.position.y += .14 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); dropFeedback.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
