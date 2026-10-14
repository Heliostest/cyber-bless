import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '剪纸开花', cut: '拿住剪刀，沿右侧最后一道纸边向上剪开；松手，让边角料落下。',
  unfold: '拉住折纸右侧的纸边，向左慢慢展开，让两边的花叶相见。',
  quiet: '轻点剪纸静看，或写一句心意；点「写好了」才会保存。',
  returning: '轻点剪纸，回看这一朵纸上的花。', done: '留一朵纸花在日常。（当代剪纸欣赏练习结束）',
  cutting: '最后一道纸边剪开，边角料轻轻落下…', opening: '折痕展开，两边的花叶慢慢相见…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const TOOL_HOME = new THREE.Vector3(.946, -.41, .092), TOOL_REST = new THREE.Vector3(1.32, -.61, .080)
const SCRAP_HOME = new THREE.Vector3(1.058, .195, .040), SCRAP_REST = new THREE.Vector3(1.25, -.45, .050)
const ease = (t: number) => t * t * (3 - 2 * t)

/** A small original floral cutout, folded at its own stem; no artisan pattern is reproduced. */
export function createPolishPaperCut(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null
  let lifecycleRevision = 0
  let motion: { step: 0 | 1; time: number; cut: number; fold: number } | null = null
  let dragging = false, maxTravel = 0, maxCross = 0, moved = 0, cutAmount = 0, foldAmount = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向上剪开最后一道纸边' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'polish-paper-cut', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf0f0e6, ground: 0xb2ad95, key: 0xfff2dc, rim: 0xd7e7df, keyPosition: [-3, 5, 4], keyIntensity: 1.7, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .015
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 12 })
  const world = new THREE.Group(); world.name = 'paper-workbench'; scene.add(world)
  const mat = (color: number, roughness = .88, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const wood = mat(0xbb9973), darkWood = mat(0x947453), boardMat = mat(0xefe6ce), boardEdge = mat(0xd3c6a7)
  const paperMat = mat(0x376c68), paperEdge = mat(0x2e5b57), silver = mat(0xaab6b4, .36, .62), handles = mat(0x53686b, .5, .32)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent: THREE.Object3D = world) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.028, ...size.map(n => n / 3))), material, p, parent)
  box('paper-wood-table', [3.75, .13, 2.12], [0, .65, .06], wood)
  for (const x of [-1.53, 1.53]) for (const z of [-.75, .87]) box('paper-table-leg', [.13, .58, .13], [x, .295, z], darkWood)
  box('paper-table-apron', [3.25, .15, .08], [0, .52, .94], darkWood)
  const shadow = add('paper-contact-shadow', new THREE.PlaneGeometry(3.95, 2.4), new THREE.ShadowMaterial({ opacity: .12 }), [0, .003, .08]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  const board = new THREE.Group(); board.name = 'paper-tilted-board-group'; board.position.set(0, 1.59, 0); board.rotation.x = -.70; world.add(board)
  const backing = box('paper-board-backing', [3.37, 2.37, .09], [0, 0, -.055], boardEdge, board)
  box('paper-cream-board', [3.32, 2.32, .06], [0, 0, -.003], boardMat, board)
  // A wooden rear support and a lip keep the sloping work board visibly grounded.
  board.updateWorldMatrix(true, true)
  const supportBase = new THREE.Vector3(0, .719, -.67)
  const supportHeight = new THREE.Raycaster(supportBase, new THREE.Vector3(0, 1, 0)).intersectObject(backing)[0]!.distance - .006
  box('paper-board-support', [.20, supportHeight, .04], [0, supportBase.y + supportHeight / 2, supportBase.z], darkWood)
  box('paper-board-foot', [2.72, .07, .11], [0, .758, .82], darkWood)

  // The asymmetric half is cut from a single shape. Mirroring around the stem
  // produces bilateral leaves; each aperture is a real hole through both faces.
  const outline = new THREE.Shape()
  outline.moveTo(0, -.96); outline.lineTo(.15, -.96); outline.quadraticCurveTo(.17, -.80, .12, -.71)
  outline.bezierCurveTo(.39, -.80, .59, -.83, .69, -.62); outline.quadraticCurveTo(.60, -.39, .31, -.43)
  outline.lineTo(.16, -.25); outline.quadraticCurveTo(.37, -.19, .47, -.34)
  outline.bezierCurveTo(.69, -.43, .91, -.33, .95, -.08); outline.lineTo(.95, .45)
  outline.quadraticCurveTo(.74, .58, .49, .32); outline.lineTo(.23, .19); outline.lineTo(.16, .39)
  outline.bezierCurveTo(.38, .42, .64, .46, .71, .64); outline.quadraticCurveTo(.69, .84, .51, .85)
  outline.quadraticCurveTo(.34, .86, .23, .69); outline.quadraticCurveTo(.19, .99, 0, 1.06); outline.closePath()
  for (const [x, y, rx, ry] of [[.57, .06, .17, .105], [.40, -.59, .13, .065], [.35, .67, .105, .044]]) {
    const hole = new THREE.Path(); hole.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, -.20); outline.holes.push(hole)
  }
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: .016, bevelEnabled: false, curveSegments: 16 })
  const fixed = add('paper-fixed-half', geometry, [paperMat, paperEdge], [0, 0, .040], board)
  const hinge = new THREE.Group(); hinge.name = 'paper-fold-hinge'; hinge.position.z = .056; board.add(hinge)
  const folded = add('paper-folded-half', geometry, [paperMat, paperEdge], [0, 0, 0], hinge)
  // A narrow attached margin is the final uncut edge, not a separate hit plane.
  const seam = box('paper-final-cut-edge', [.024, .53, .031], [.955, .185, .056], paperMat, board)
  const scrap = box('paper-offcut', [.20, .53, .031], [0, 0, 0], paperMat, board)
  const crease = box('paper-stem-crease', [.011, 1.83, .007], [0, -.005, .059], paperEdge, board)
  for (const mesh of [fixed, folded, seam, scrap, crease]) mesh.userData.toonSurface = { outline: false }

  const scissors = new THREE.Group(); scissors.name = 'paper-scissors'; board.add(scissors)
  const leftBlade = new THREE.Group(), rightBlade = new THREE.Group(); scissors.add(leftBlade, rightBlade)
  const bladeShape = new THREE.Shape(); bladeShape.moveTo(-.035, -.12); bladeShape.lineTo(.028, -.07); bladeShape.lineTo(.019, .46); bladeShape.quadraticCurveTo(-.026, .39, -.041, .03); bladeShape.closePath()
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: .024, bevelEnabled: true, bevelSize: .003, bevelThickness: .002, bevelSegments: 1, curveSegments: 8 })
  for (const [side, parent] of [[-1, leftBlade], [1, rightBlade]] as const) {
    const blade = add(side === -1 ? 'paper-scissors-blade-left' : 'paper-scissors-blade-right', bladeGeometry, silver, [0, 0, side === -1 ? 0 : .028], parent)
    blade.scale.x = side
    const handle = add(side === -1 ? 'paper-scissors-handle-left' : 'paper-scissors-handle-right', new THREE.TorusGeometry(.107, .025, 10, 36), handles, [side * .088, -.335, .02], parent)
    handle.scale.y = 1.35
    box(side === 1 ? 'paper-scissors-grip' : 'paper-scissors-handle-neck', [.08, .18, .048], [side * .055, -.16, .028], handles, parent)
  }
  const rivet = add('paper-scissors-rivet', new THREE.CylinderGeometry(.044, .044, .027, 24), silver, [0, 0, .067], scissors); rivet.rotation.x = Math.PI / 2
  const grip = scissors.getObjectByName('paper-scissors-grip')!
  for (const o of [leftBlade, rightBlade]) o.traverse(m => { if ((m as THREE.Mesh).isMesh) m.userData.toonSurface = { outline: false, roughness: .36, metalness: .5 } })
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const setCut = (amount: number) => {
    cutAmount = amount; scissors.position.copy(TOOL_HOME); scissors.position.y += amount * .51
    scissors.rotation.set(0, 0, 0)
    const aperture = .16 + Math.sin(amount * Math.PI * 8) * .10
    leftBlade.rotation.z = -aperture; rightBlade.rotation.z = aperture
    // The tool visibly separates only the traversed part of the final strip.
    seam.scale.y = Math.max(.015, 1 - amount); seam.position.y = .185 + .265 * amount
  }
  const setFold = (amount: number) => { foldAmount = amount; hinge.rotation.y = -Math.PI * amount }
  const restore = () => {
    setCut(at > 0 ? 1 : 0); setFold(at >= 2 ? 1 : 0); seam.visible = at === 0
    scrap.position.copy(at > 0 ? SCRAP_REST : SCRAP_HOME); scrap.rotation.z = at > 0 ? -.55 : 0
    if (at > 0) { scissors.position.copy(TOOL_REST); scissors.rotation.z = -.19; leftBlade.rotation.z = -.065; rightBlade.rotation.z = .065 }
    matrices()
  }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', label: '拿剪刀，向上剪开', anchor: [0, 0, .024], priority: 3, enabled: enabled(0) }),
    addInteractionCue(folded, { kind: 'drag', label: '拉住纸边，向左展开', anchor: [.84, .20, .016], priority: 3, enabled: enabled(1) }),
    addInteractionCue(fixed, { kind: 'tap', label: '轻点剪纸静看', anchor: [.32, .59, .016], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const visibleHit = (x: number, y: number, target: THREE.Object3D) => belongsTo(nearestHit(x, y)?.object, target)
  const reset = () => { dragging = false; maxTravel = maxCross = moved = 0; if (!motion && !disposed) restore() }
  // Guard before the pointer controller: its inactive move path would otherwise
  // cancel the original owner during synchronous prepareFeedback reentry.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) {
      if (motion || at === 3) return false; matrices()
      if (at !== 1) return at === 0 ? visibleHit(x, y, scissors) : visibleHit(x, y, fixed) || visibleHit(x, y, folded)
      const hit = nearestHit(x, y)
      if (hit?.object !== folded) return false
      const contact = folded.worldToLocal(hit.point.clone())
      return contact.x >= .72 && contact.y >= -.10 && contact.y <= .45
    },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; maxTravel = maxCross = moved = 0
    },
    onMove(x, y) {
      const dx = x - down.x, dy = y - down.y
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dx : dy))
      moved = at === 0 ? -dy : -dx
      if (dragging && at === 0) setCut(THREE.MathUtils.clamp(moved / 64, 0, 1))
      else if (dragging && at === 1) setFold(THREE.MathUtils.clamp(moved / 72, 0, 1))
      matrices()
    },
    onRelease(x, y) {
      matrices(); const dx = x - down.x, dy = y - down.y
      const valid = at === 0 ? dragging && moved >= 42 && -dy >= 42 && maxCross <= Math.max(20, -dy * .55) && Math.abs(dx) <= Math.max(20, -dy * .55)
        : at === 1 ? dragging && moved >= 48 && -dx >= 48 && maxCross <= Math.max(20, -dx * .45) && Math.abs(dy) <= Math.max(20, -dx * .45)
          : maxTravel < 12 && Math.hypot(dx, dy) < 12 && (visibleHit(x, y, fixed) || visibleHit(x, y, folded))
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '向上剪开最后一道纸边' : at === 1 ? '向左展开折纸' : '轻点剪纸静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.cutting : COPY.opening : at === 0 ? COPY.cut : at === 1 ? COPY.unfold : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() {
    const revision = lifecycleRevision
    withHostCallbacks(() => feedback.prepare())
    return inputActive() && revision === lifecycleRevision
  }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [392, 523.25], duration: .13, gain: .008, type: 'triangle' }) })
  }
  function begin() {
    if (!inputActive() || pointer.isBusy() || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, cut: cutAmount, fold: foldAmount }; sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    withHostCallbacks(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!active()) return
      feedback.impact({ freqs: [392, 587.33], duration: .20, gain: .009 }); if (!active()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; lifecycleRevision++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 4.1, 7.25 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.19, 0); matrices() }
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
      if (!active()) { lifecycleRevision++; pointer.cancel(); writer?.setEnabled(false); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(delta)
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .72); const t = ease(motion.time)
        if (motion.step === 0) {
          setCut(THREE.MathUtils.lerp(motion.cut, 1, Math.min(t * 2.6, 1)))
          const release = ease(THREE.MathUtils.clamp((t - .36) / .64, 0, 1))
          seam.visible = release === 0; scrap.position.lerpVectors(SCRAP_HOME, SCRAP_REST, release); scrap.rotation.z = -.55 * release
          scissors.position.lerp(TOOL_REST, release); scissors.rotation.z = -.19 * release
        } else setFold(THREE.MathUtils.lerp(motion.fold, 1, t))
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
