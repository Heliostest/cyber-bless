import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '织毯寄暖', weaveAction: '收好最后一行纬线', displayAction: '把织毯安放在展架', quietAction: '轻点织毯静看',
  weave: '拿起桌前木梭，送到织毯下缘的留白。以原创织纹，欣赏摩洛哥阿马齐格羊毛织作。',
  display: '握住织毯上方的木夹杆，把整幅织毯移到右侧展架。',
  quiet: '轻点织毯静看，或写一句心意；点「写好了」才会保存。', returning: '轻点织毯，回看这一份暖意。',
  moving: '纬线收拢，织毯缓缓安放…', done: '留一份手作的暖意。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.75, 1.63, .10), REST = new THREE.Vector3(.75, 1.63, .10)
const SHUTTLE_HOME = new THREE.Vector3(-.73, .78, .62)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original wool stripes and offset blocks; no borrowed ritual motifs or symbolic claims. */
export function createAmazighWovenRug(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false, callbackLocked = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !callbackLocked
  const reduced = () => ctx.isReducedMotion?.() ?? false
  // A feedback callback can deactivate its host; audio must observe that immediately.
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.weaveAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'amazigh-woven-rug', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3e9d4, ground: 0xaba596, key: 0xffefdc, rim: 0xd4e7eb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'rug-workbench'; scene.add(world)
  const material = (color: number, roughness = .92) => new THREE.MeshStandardMaterial({ color, roughness })
  const ivory = material(0xe6d9bd), ochre = material(0xb78343), rust = material(0xa95f4c), indigo = material(0x566e83)
  const flax = material(0xd2c4a7), oak = material(0xc4aa83, .8), wood = material(0xa08463, .8)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const thread = (name: string, points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 10, radius, 6, false), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  addCraftTable(world, { name: 'rug-table', topName: 'rug-table-top', width: 3.26, depth: 1.52, surfaceY: .74, thickness: .12, center: [0,.02], support: 'trestle', finish: 'chestnut' })
  const ground = add('rug-contact-shadow', new THREE.PlaneGeometry(3.7, 1.95), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .02]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  const stand = (prefix: string, x: number) => {
    const group = new THREE.Group(); group.name = `${prefix}-stand`; world.add(group)
    box(`${prefix}-base`, [1.42, .08, .48], [x, .78, -.04], wood, group)
    for (const dx of [-.64, .64]) box(`${prefix}-upright`, [.065, 1.36, .09], [x + dx, 1.50, .035], oak, group)
    // Rear lip catches the clamp; its front stops behind the wool surface.
    return box(`${prefix}-seat`, [1.42, .10, .06], [x, 2.23, .035], oak, group)
  }
  stand('rug-home', -.75); const seat = stand('rug-display', .75)
  const rug = new THREE.Group(); rug.name = 'rug-body'; world.add(rug)
  const wool = box('rug-wool', [1.08, 1.34, .068], [0, 0, 0], ivory, rug); wool.userData.toonSurface = { outline: false }
  const grip = box('rug-top-grip', [1.34, .10, .17], [0, .70, -.01], wood, rug)
  for (const x of [-.46, .46]) {
    const peg = add('rug-clamp-peg', new THREE.CylinderGeometry(.026, .026, .016, 16), oak, [x, .70, .082], rug); peg.rotation.x = Math.PI / 2
  }
  for (const x of [-.527, .527]) thread('rug-bound-edge', [[x, -.65, 0], [x, 0, .006], [x, .65, 0]], .018, ochre, rug)
  for (let i = 0; i < 30; i++) {
    const y = -.64 + i * .0435
    thread('rug-back-weft', [[-.51, y, -.032], [0, y + .002, -.035], [.51, y, -.032]], .0035, flax, rug)
    if (y > -.49) thread('rug-ivory-weft', [[-.50, y, .034], [0, y + .0015, .037], [.50, y, .034]], .0035, flax, rug)
  }
  // Non-symbolic bands and offset blocks are built from actual wool ridges.
  const band = (x: number, y: number, width: number, rows: number, mat: THREE.Material, parent: THREE.Object3D = rug) => {
    for (let i = 0; i < rows; i++) {
      const dy = y + i * .019
      thread('rug-colored-weft', [[x - width / 2, dy, .036], [x - width / 4, dy + .003, .043], [x, dy, .039], [x + width / 4, dy + .003, .043], [x + width / 2, dy, .036]], .010, mat, parent)
    }
  }
  band(0, .47, .99, 5, ochre); band(0, .385, .99, 2, indigo)
  band(-.25, .06, .43, 10, rust); band(.24, -.105, .41, 10, indigo); band(-.23, -.30, .39, 6, ochre)
  band(0, -.425, .99, 3, rust)
  const gap = box('rug-weft-gap', [1.00, .13, .016], [0, -.55, .033], ivory, rug); gap.userData.toonSurface = { outline: false }
  const finishing = new THREE.Group(); finishing.name = 'rug-finished-row'; rug.add(finishing)
  band(0, -.593, .99, 5, ochre, finishing)
  for (let i = 0; i < 18; i++) for (const side of [-1, 1]) {
    const x = -.49 + i * .0575 + side * .005, length = .115 + (i % 3) * .01
    thread('rug-fringe', [[x, -.651, .007], [x + side * .007, -.699, .01], [x + side * .009, -.651 - length, .022]], .006, ivory, rug)
  }
  const shuttle = new THREE.Group(); shuttle.name = 'rug-shuttle'; world.add(shuttle)
  const hullShape = new THREE.Shape().moveTo(-.35, 0).lineTo(-.23, -.10).lineTo(.23, -.10).lineTo(.35, 0).lineTo(.23, .10).lineTo(-.23, .10).closePath()
  const hull = add('rug-shuttle-hull', new THREE.ExtrudeGeometry(hullShape, { depth: .08, bevelEnabled: false }), wood, [0, .04, 0], shuttle); hull.rotation.x = Math.PI / 2
  const yarn = add('rug-shuttle-yarn', new THREE.CylinderGeometry(.049, .049, .32, 24), ochre, [-.045, .049, 0], shuttle); yarn.rotation.z = Math.PI / 2
  for (let i = 0; i < 13; i++) {
    const coil = add('rug-shuttle-coil', new THREE.TorusGeometry(.05, .005, 6, 24), ivory, [-.19 + i * .024, .049, 0], shuttle); coil.rotation.y = Math.PI / 2; coil.userData.toonSurface = { outline: false }
  }
  const shuttleGrip = box('rug-shuttle-grip', [.12, .035, .15], [.25, .048, 0], oak, shuttle)
  thread('rug-shuttle-tail', [[-.14, .055, .044], [-.20, .00, .13], [-.28, -.034, .15]], .006, ochre, shuttle)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { rug.position.copy(at >= 2 ? REST : HOME); shuttle.position.copy(SHUTTLE_HOME); finishing.visible = at >= 1; matrices() }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(shuttleGrip, { kind: 'drag', label: '拿起木梭', priority: 3, enabled: enabled(0), destination: gap, targetLabel: '下缘留白' }),
    addInteractionCue(grip, { kind: 'drag', label: '握住木夹杆', priority: 3, enabled: enabled(1), destination: seat, targetLabel: '织毯展架' }),
    addInteractionCue(grip, { kind: 'tap', label: '轻点织毯静看', priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? shuttle : rug
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const visibleHit = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || (held && belongsTo(object, held))) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(mat => mat.visible && (!mat.transparent || mat.opacity >= 1))) meshes.push(object)
    })
    return belongsTo(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object, target)
  }
  const reset = () => { dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? shuttle : rug) },
    onStart(x, y) {
      callbackBoundary(() => feedback.prepare()); if (!active()) { pointer.cancel(); return }
      down.set(x, y); travel = 0; dragging = at < 2
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position)
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point)
    },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.25, 1.25); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices()
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && travel >= 8 && visibleHit(x, y, at === 0 ? gap : seat, moving())
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, rug)
      dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.weaveAction : at === 1 ? COPY.displayAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.weave : at === 1 ? COPY.display : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  // Host callbacks may synchronously dispatch input or update the scene. Keep this
  // entire acceptance boundary closed until the original action has returned.
  function callbackBoundary(work: () => void) {
    callbackLocked = true; sync()
    try { work() } finally { callbackLocked = false; if (!disposed) sync() }
  }
  function settle() {
    if (!inputActive() || !motion) return
    const next = (motion.step + 1) as Checkpoint
    callbackBoundary(() => {
      at = next; motion = null; restore(); sync(); ctx.onProgress?.(at)
      if (!active()) return
      feedback.impact({ freqs: [349.23, 523.25], duration: .17, gain: .011, type: 'triangle' })
    })
  }
  function begin() { if (!inputActive() || pointer.isBusy() || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    callbackBoundary(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      // Saving and the accepted checkpoint commit together through a pause, but never after disposal.
      if (disposed) return
      ctx.onProgress?.(3); if (!active()) return
      feedback.impact({ freqs: [349.23, 523.25], duration: .22, gain: .011 }); if (!active()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3) return; callbackBoundary(() => feedback.prepare()); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.1, 6.3 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.34, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!inputActive() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; callbackBoundary(() => feedback.prepare()); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed || callbackLocked) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (cueLayer) cueLayer.hidden = true; if (!inactiveRendered) { style.render(); inactiveRendered = true }; return }
      if (inactiveRendered || cueLayer?.hidden) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .8); const t = ease(motion.time)
        if (motion.step === 0) {
          const target = gap.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, .13))
          if (t < .72) { shuttle.position.lerpVectors(motion.from, target, Math.min(1, t / .28)); shuttle.position.x += Math.sin(t / .72 * Math.PI) * .12 }
          else shuttle.position.lerpVectors(target, SHUTTLE_HOME, (t - .72) / .28)
          finishing.visible = t > .4
        } else { rug.position.lerpVectors(motion.from, REST, t); if (!reduced()) rug.position.y += .15 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
