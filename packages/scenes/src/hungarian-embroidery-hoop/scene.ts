import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '花绣寄语', decorateAction: '添一朵线花', hangAction: '把绣圈安放在展托', quietAction: '轻点绣圈静看',
  decorate: '拿起桌前线轴，送到亚麻布留白处，添上一朵线花。',
  hang: '握住绣圈上方的小铜扣，把整幅线花送到右侧展托。',
  quiet: '轻点绣圈静看，或写一句心意后点「写好了」。',
  returning: '轻点绣圈，回看这份手作心意。', moving: '彩线慢慢铺开，手作稳稳落下…',
  done: '线花留下一点春意。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.72, 1.535, .015), REST = new THREE.Vector3(.82, 1.615, .015), SPOOL_HOME = new THREE.Vector3(-.98, .99, .64)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original raised thread flowers for contemporary craft appreciation; no traced traditional pattern. */
export function createHungarianEmbroideryHoop(ctx: SceneContext): SceneInstance {
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

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'hungarian-embroidery-hoop', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3e9d4, ground: 0xaba596, key: 0xffefdc, rim: 0xd4e7eb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'embroidery-workbench'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  const oak = material(0xc4a57b), walnut = material(0x87674f), wood = material(0xba854e, .6)
  const linen = createRitualMaterial({ color: 0xf0e5cf, roughness: .82 }, { kind: 'cloth', strength: .14, fiber: 'linen' }), weave = material(0xded1b7), pad = material(0xadbdb1)
  const rose = material(0xbc4562, .68), pink = material(0xde8090, .72), teal = material(0x428a83, .72), gold = material(0xd1a655, .6)
  const brass = new THREE.MeshStandardMaterial({ color: 0xc4a16b, roughness: .45, metalness: .48 })
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const thread = (name: string, points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 14, radius, 6, false), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  addCraftTable(world, { name: 'hoop-table', topName: 'hoop-table-top', width: 3.48, depth: 1.70, surfaceY: .76, thickness: .12, center: [0,.04], support: 'joined', finish: 'birch' })
  const ground = add('hoop-contact-shadow', new THREE.PlaneGeometry(3.9, 2.1), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .1]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  box('hoop-home-pad', [1.06, .04, .43], [-.72, .78, .015], pad)
  box('hoop-home-back-rest', [.22, .50, .08], [-.72, 1.05, -.08], walnut)
  const cradle = new THREE.Group(); cradle.name = 'hoop-display-cradle'; world.add(cradle)
  box('hoop-cradle-base', [1.12, .08, .60], [.82, .80, .015], walnut, cradle)
  const seat = box('hoop-cradle-seat', [.98, .04, .44], [.82, .86, .015], pad, cradle)
  box('hoop-cradle-back-rest', [.22, .50, .08], [.82, 1.09, -.08], walnut, cradle)
  const hoop = new THREE.Group(); hoop.name = 'hoop-body'; world.add(hoop)
  add('hoop-wooden-ring', new THREE.TorusGeometry(.68, .055, 12, 96), wood, [0, 0, 0], hoop)
  add('hoop-front-bead', new THREE.TorusGeometry(.681, .014, 8, 96), oak, [0, 0, .048], hoop)
  const cloth = add('hoop-linen', new THREE.CylinderGeometry(.668, .668, .034, 96), linen, [0, 0, 0], hoop); cloth.rotation.x = Math.PI / 2
  cloth.userData.toonSurface = { outline: false }
  // Fine warp/weft threads end inside the wooden rim.
  const clothWeave = new THREE.Group(); clothWeave.name = 'hoop-linen-weave'; hoop.add(clothWeave)
  for (let i = -8; i <= 8; i++) {
    const a = i * .068, edge = Math.sqrt(.62 * .62 - a * a)
    thread('hoop-warp', [[a, -edge, .017], [a, 0, .0172], [a, edge, .017]], .0011, weave, clothWeave)
    thread('hoop-weft', [[-edge, a, .017], [0, a, .0172], [edge, a, .017]], .0011, weave, clothWeave)
  }
  box('hoop-clamp-left', [.08, .16, .10], [-.095, .70, .005], wood, hoop)
  box('hoop-clamp-right', [.08, .16, .10], [.095, .70, .005], wood, hoop)
  const grip = add('hoop-clamp-bridge', new THREE.CylinderGeometry(.025, .025, .25, 16), brass, [0, .748, .026], hoop); grip.rotation.z = Math.PI / 2
  add('hoop-clamp-knob', new THREE.SphereGeometry(.044, 16, 12), brass, [.157, .748, .026], hoop)
  const stitches = new THREE.Group(); stitches.name = 'hoop-floral-stitches'; hoop.add(stitches)
  // Freely composed five-petal flowers: seven transverse satin-like threads per petal.
  const flower = (parent: THREE.Object3D, x: number, y: number, size: number, mat: THREE.Material) => {
    for (let petal = 0; petal < 5; petal++) {
      const a = Math.PI / 2 + petal * Math.PI * 2 / 5, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux
      for (let row = 0; row < 7; row++) {
        const t = (row + 1) / 8, r = size * (.22 + t * .78), w = size * .26 * Math.sin(Math.PI * t)
        thread('hoop-petal-stitch', [[x + ux * r - vx * w, y + uy * r - vy * w, .017], [x + ux * r, y + uy * r, .040], [x + ux * r + vx * w, y + uy * r + vy * w, .017]], .0075, mat, parent)
      }
    }
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7, r = size * .13
      const knot = add('hoop-flower-knot', new THREE.SphereGeometry(.012, 10, 8), gold, [x + r * Math.cos(a), y + r * Math.sin(a), .025], parent); knot.scale.z = .8
    }
  }
  const leaf = (x: number, y: number, dx: number, dy: number) => {
    for (let i = 0; i < 7; i++) {
      const t = (i + 1) / 8, w = Math.sin(t * Math.PI) * .037
      thread('hoop-leaf-stitch', [[x + dx * t - dy * w, y + dy * t + dx * w, .017], [x + dx * t, y + dy * t, .037], [x + dx * t + dy * w, y + dy * t - dx * w, .017]], .007, teal, stitches)
    }
  }
  thread('hoop-stem', [[-.12, -.38, .019], [-.17, -.17, .026], [-.12, .17, .019]], .011, teal, stitches)
  thread('hoop-branch', [[-.16, -.13, .019], [.04, .04, .026], [.18, .31, .019]], .008, teal, stitches)
  leaf(-.16, -.18, -.23, .13); leaf(-.15, -.30, .23, .12)
  flower(stitches, -.12, .17, .22, rose); flower(stitches, .19, .32, .105, pink)
  const flourish = new THREE.Group(); flourish.name = 'hoop-completed-flourish'; hoop.add(flourish)
  flower(flourish, .25, -.22, .14, rose)
  thread('hoop-flourish-stem', [[-.12, -.37, .017], [.10, -.37, .025], [.25, -.24, .017]], .008, teal, flourish)
  const spool = new THREE.Group(); spool.name = 'hoop-thread-spool'; world.add(spool)
  add('hoop-spool-bottom', new THREE.CylinderGeometry(.18, .18, .04, 32), wood, [0, -.21, 0], spool)
  add('hoop-spool-core', new THREE.CylinderGeometry(.09, .09, .40, 24), wood, [0, 0, 0], spool)
  add('hoop-wound-thread', new THREE.CylinderGeometry(.14, .14, .34, 40), rose, [0, 0, 0], spool)
  for (let i = -7; i <= 7; i++) {
    const coil = add('hoop-thread-coil', new THREE.TorusGeometry(.14, .009, 6, 40), i % 3 === 0 ? pink : rose, [0, i * .022, 0], spool)
    coil.rotation.x = Math.PI / 2; coil.userData.toonSurface = { outline: false }
  }
  const spoolGrip = add('hoop-spool-cap', new THREE.CylinderGeometry(.18, .18, .04, 32), wood, [0, .21, 0], spool)
  thread('hoop-spool-tail', [[.13, -.10, .05], [.24, -.17, .04], [.29, -.222, .02]], .009, rose, spool)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { hoop.position.copy(at >= 2 ? REST : HOME); spool.position.copy(SPOOL_HOME); flourish.visible = at >= 1; matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  const stitchPoint = () => hoop.localToWorld(new THREE.Vector3(.25, -.22, .017))
  addInteractionCue(spoolGrip, { kind: 'drag', label: '拿起线轴', priority: 3, enabled: enabled(0), destination: stitchPoint, targetLabel: '亚麻布留白' })
  addInteractionCue(grip, { kind: 'drag', label: '握住绣圈铜扣', priority: 3, enabled: enabled(1), destination: () => projectedGuide(seat.getWorldPosition(new THREE.Vector3()),grip.getWorldPosition(new THREE.Vector3()),hoop.localToWorld(new THREE.Vector3(0,-.735,0))), targetLabel: '绣圈展托' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点绣圈静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? spool : hoop
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => touch.hit(x, y, targets, { ignore: held })
  let arrivalRadius=22
  const arrivalPoint = () => {
    const q=(at===0?stitchPoint():seat.getWorldPosition(new THREE.Vector3())).project(camera),r=canvas.getBoundingClientRect()
    return {x:r.left+(q.x+1)*r.width/2,y:r.top+(1-q.y)*r.height/2}
  }
  const measureArrival = () => {
    const a=projectTouchPoint(canvas,camera,at===0?spoolGrip:hoop,at===0?[0,0,0]:[0,-.735,0]),b=arrivalPoint()
    arrivalRadius=a?Math.min(22,Math.hypot(a.x-b.x,a.y-b.y)*.42):0
  }
  const automaticReady = (x: number, y: number) => {
    if (at >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, at === 0 ? spoolGrip : hoop, at === 0 ? [0,0,0] : [0,-.735,0])
    const goal=arrivalPoint()
    return !!contact && !touch.occluded(x,y,at===0?cloth:seat,{ignore:moving()}) && Math.hypot(contact.x-goal.x,contact.y-goal.y)<=arrivalRadius && touch.hit(contact.x, contact.y, at === 0 ? cloth : seat, { ignore: moving() })
  }
  const reset = () => { dropFeedback.clear(); dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (notifying || motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? spool : hoop) },
    onStart(x, y) { dropFeedback.clear(); notifyHost(() => feedback.prepare()); down.set(x, y); travel = 0; dragging = at < 2; if(at<2)measureArrival(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      if (notifying) return
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices()
      dropFeedback.setReady(dragging && automaticReady(x, y))
    if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; dropFeedback.clear(); begin(true) }
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && automaticReady(x, y)
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, hoop)
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
  function settle() {
    if (!active() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync()
    notifyHost(() => ctx.onProgress?.(at))
    if (!active()) return
    notifyHost(() => feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' }))
  }
  function begin(placed = false) { if (notifying || !active() || (pointer.isBusy() && !placed) || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (notifying || !active() || pointer.isBusy() || motion || at !== 2) return
    at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) notifyHost(() => ctx.saveWish?.(text.trim()))
    if (disposed) return
    notifyHost(() => ctx.onProgress?.(3))
    if (!active()) return
    notifyHost(() => feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 }))
    if (!active()) return
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (notifying || !active() || pointer.isBusy() || motion || at === 3) return; notifyHost(() => feedback.prepare()); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.15, 6.15 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.35, 0); matrices() }
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
        if (motion.step === 0) {
          const target = stitchPoint().add(new THREE.Vector3(0, .10, .25))
          if (t < .66) { spool.position.lerpVectors(motion.from, target, Math.min(1, t / .3)); spool.position.y += Math.sin(t / .66 * Math.PI) * .045 }
          else spool.position.lerpVectors(target, SPOOL_HOME, (t - .66) / .34)
          flourish.visible = t > .35
        } else { hoop.position.lerpVectors(motion.from, REST, t); if (!reduced()) hoop.position.y += .14 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); dropFeedback.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
