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
  title: '彩心相赠', decorateAction: '给红心添上糖霜', hangAction: '把彩心挂上木钉', quietAction: '轻点彩心静看',
  decorate: '握住桌前裱花袋，把袋口送到红心。用原创糖霜花纹，致意克罗地亚 licitar 手艺。',
  hang: '轻托红心，把它送到右侧展架的木钉，让布带挂环稳稳挂好。',
  quiet: '轻点彩心静看，或写一句送给在意之人的心愿；只有点「写好了」才会保存。',
  returning: '轻点彩心，回看这份相赠的心意。', moving: '让糖霜成花，让挂环稳稳落下…',
  done: '一颗彩心，留下一份相赠的心意。（当代手作致敬练习结束）',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HUNG = new THREE.Vector3(.80, .96, .015), CONE_HOME = new THREE.Vector3(-.93, .937, .58)
const HEART_ANCHOR: [number, number, number] = [.20, -.10, .158]
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original licitar-inspired gift craft; no borrowed workshop motif or enacted religious rite. */
export function createCroatianLicitarHeart(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  const returning = ctx.returning === true
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.decorateAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'croatian-licitar-heart', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3e9d4, ground: 0xaba596, key: 0xffefdc, rim: 0xd4e7eb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'licitar-courtyard-workbench'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  const red = material(0xce293c, .62), cream = material(0xffedc9), green = material(0x6e9780), blue = material(0x85a7b3)
  const oak = material(0xc29e6b), walnut = material(0x80613f), linen = material(0xc7d5cd), paleMirror = material(0xc5dae0, .40)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const tube = (name: string, points: THREE.Vector3[], radius: number, mat: THREE.Material, parent: THREE.Object3D, closed = false) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(24, points.length * 2), radius, 8, closed), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  addCraftTable(world, { name: 'licitar-table', topName: 'licitar-table-top', width: 3.24, depth: 1.66, surfaceY: .76, thickness: .12, center: [0,.04], support: 'joined', finish: 'birch' })
  const ground = add('licitar-contact-shadow', new THREE.PlaneGeometry(3.8, 2.1), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .1]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  box('licitar-heart-rest', [1.26, .05, .42], [-.66, .785, .01], linen)
  box('licitar-heart-back-rest', [.32, .38, .065], [-.66, .98, -.19], walnut)
  box('licitar-cone-rest', [.91, .035, .37], [-.94, .7775, .58], linen)
  const bowl = add('licitar-icing-bowl', new THREE.LatheGeometry([[0, 0], [.16, 0], [.19, .10], [.18, .13], [.155, .12], [.13, .05], [0, .05]].map(p => new THREE.Vector2(...p as [number, number])), 40), blue, [-1.17, .76, -.49])
  bowl.userData.toonSurface = { outline: false }
  add('licitar-icing-in-bowl', new THREE.CylinderGeometry(.144, .13, .025, 32), cream, [-1.17, .835, -.49])

  const stand = new THREE.Group(); stand.name = 'licitar-display-stand'; world.add(stand)
  box('licitar-stand-base', [.85, .10, .62], [.8, .81, -.15], walnut, stand)
  box('licitar-stand-upright', [.105, 1.68, .11], [.8, 1.70, -.22], oak, stand)
  box('licitar-stand-crossbar', [.37, .10, .105], [.8, 2.47, -.22], oak, stand)
  // The inside ceiling of the .022-radius ribbon contacts this .036-radius shaft.
  const pegY = HUNG.y + 1.45 - .022 - .036
  const shaft = add('licitar-stand-peg-shaft', new THREE.CylinderGeometry(.036, .036, .37, 32), oak, [.8, pegY, -.065], stand); shaft.rotation.x = Math.PI / 2
  const peg = add('licitar-stand-peg-cap', new THREE.CylinderGeometry(.074, .074, .045, 40), cream, [.8, pegY, .1425], stand); peg.rotation.x = Math.PI / 2

  const heart = new THREE.Group(); heart.name = 'licitar-heart'; world.add(heart)
  const shape = new THREE.Shape()
  shape.moveTo(0, -.55)
  shape.bezierCurveTo(-.11, -.39, -.59, -.11, -.59, .19)
  shape.bezierCurveTo(-.59, .57, -.20, .69, 0, .37)
  shape.bezierCurveTo(.20, .69, .59, .57, .59, .19)
  shape.bezierCurveTo(.59, -.11, .11, -.39, 0, -.55)
  const heartGeometry = new THREE.ExtrudeGeometry(shape, { depth: .20, bevelEnabled: true, bevelThickness: .06, bevelSize: .045, bevelSegments: 5, curveSegments: 32 })
  heartGeometry.translate(0, 0, -.10); heartGeometry.computeBoundingBox()
  const body = add('licitar-heart-body', heartGeometry, red, [0, .55, 0], heart)
  // Mesh bounds, rather than an approximate outline, determine real table contact.
  const home = new THREE.Vector3(-.66, .81 - (heartGeometry.boundingBox!.min.y + .55), .015)
  const motif = new THREE.Group(); motif.name = 'licitar-original-icing'; heart.add(motif)
  const border = shape.getSpacedPoints(100).slice(0, -1).map(p => new THREE.Vector3(p.x * .82, .55 + p.y * .82, .168))
  tube('licitar-piped-cream-border', border, .018, cream, motif, true)
  const beadGeometry = new THREE.SphereGeometry(1, 12, 8)
  for (let i = 0; i < border.length; i += 4) {
    const p = border[i], bead = add('licitar-icing-border-bead', beadGeometry, cream, [p.x * .95, .55 + (p.y - .55) * .95, .166], motif)
    bead.scale.set(.016, .016, .015); bead.userData.toonSurface = { outline: false }
  }
  // Three invented flowers and two sprigs use ordinary piping shapes, not a copied artisan motif.
  for (const [x, y, radius] of [[-.26, .82, .07], [.26, .82, .07], [0, .27, .06]]) {
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2
      const petal = add('licitar-floral-icing-petal', beadGeometry, cream, [x + Math.sin(a) * radius * .62, y + Math.cos(a) * radius * .62, .166], motif)
      petal.scale.set(.026, radius * .72, .018); petal.rotation.z = -a; petal.userData.toonSurface = { outline: false }
    }
    const center = add('licitar-flower-blue-center', beadGeometry, blue, [x, y, .168], motif); center.scale.set(.028, .028, .022); center.userData.toonSurface = { outline: false }
  }
  for (const side of [-1, 1]) {
    tube('licitar-icing-sprig-stem', [[side * .22, .54, .166], [side * .32, .60, .166], [side * .32, .68, .166]].map(p => new THREE.Vector3(...p as [number, number, number])), .010, green, motif)
    for (const [x, y, angle] of [[.27, .58, -.65], [.34, .62, .45]]) {
      const leaf = add('licitar-icing-sprig-leaf', beadGeometry, green, [side * x, y, .166], motif); leaf.scale.set(.020, .041, .016); leaf.rotation.z = side * angle; leaf.userData.toonSurface = { outline: false }
    }
  }
  const inset = add('licitar-small-mirror-inset', new THREE.CylinderGeometry(.092, .092, .012, 40), paleMirror, [0, .66, .163], motif); inset.rotation.x = Math.PI / 2; inset.scale.z = .84; inset.userData.toonSurface = { outline: false }
  const frame = add('licitar-mirror-icing-frame', new THREE.TorusGeometry(.098, .011, 8, 48), cream, [0, .66, .165], motif); frame.scale.y = .84; frame.userData.toonSurface = { outline: false }

  const ribbonPoints = Array.from({ length: 80 }, (_, i) => { const a = i / 80 * Math.PI * 2; return new THREE.Vector3(.115 * Math.cos(a), 1.23 + .22 * Math.sin(a), .015) })
  tube('licitar-ribbon-loop', ribbonPoints, .022, cream, heart, true)
  for (const side of [-1, 1]) tube('licitar-ribbon-tie', [[side * .14, .86, -.085], [side * .12, 1.025, .015], [side * .112, 1.20, .015]].map(p => new THREE.Vector3(...p as [number, number, number])), .022, cream, heart)

  const cone = new THREE.Group(); cone.name = 'licitar-icing-cone'; world.add(cone)
  const grip = add('licitar-icing-grip', new THREE.CylinderGeometry(.057, .142, .43, 24, 5), cream, [0, 0, 0], cone); grip.rotation.z = -Math.PI / 2
  const nozzle = add('licitar-icing-nozzle', new THREE.CylinderGeometry(.009, .055, .15, 16), paleMirror, [.29, 0, 0], cone); nozzle.rotation.z = -Math.PI / 2
  const knot = add('licitar-icing-bag-twist', new THREE.SphereGeometry(.08, 16, 10), cream, [-.24, 0, 0], cone); knot.scale.set(.65, 1, .8)
  const band = add('licitar-icing-bag-band', new THREE.TorusGeometry(.079, .012, 8, 24), red, [-.24, 0, 0], cone); band.rotation.y = Math.PI / 2

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { heart.position.copy(at >= 2 ? HUNG : home); cone.position.copy(CONE_HOME); motif.visible = at >= 1; matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  const heartPoint = () => body.localToWorld(new THREE.Vector3(...HEART_ANCHOR))
  addInteractionCue(grip, { kind: 'drag', label: '握住裱花袋', priority: 3, enabled: enabled(0), destination: heartPoint, targetLabel: '红心表面' })
  addInteractionCue(body, { kind: 'drag', label: '轻托彩心', priority: 3, anchor: HEART_ANCHOR, enabled: enabled(1), destination: peg, targetLabel: '展架木钉' })
  addInteractionCue(body, { kind: 'tap', label: '轻点彩心静看', priority: 3, anchor: HEART_ANCHOR, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? cone : heart
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || (held && belongsTo(object, held))) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (!materials.some(mat => mat.visible && (!mat.transparent || mat.opacity >= 1))) return
      meshes.push(object)
    })
    const first = ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
    return (Array.isArray(targets) ? targets : [targets]).some(target => belongsTo(first, target))
  }
  const reset = () => { dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? grip : [body, motif]) },
    onStart(x, y) { feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices()
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && travel >= 8 && visibleHit(x, y, at === 0 ? body : peg, moving())
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, [body, motif])
      dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.decorateAction : at === 1 ? COPY.hangAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.decorate : at === 1 ? COPY.hang : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settle() { if (!active() || !motion) return; at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync(); ctx.onProgress?.(at); feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' }) }
  function begin() { if (!active() || pointer.isBusy() || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    ctx.onProgress?.(3); feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 }); overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.20, 5.75 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.30, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } }); writer.mount(wishSlot, {}) }
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
          const target = heartPoint().add(new THREE.Vector3(-.365, 0, .02))
          if (t < .66) { cone.position.lerpVectors(motion.from, target, Math.min(1, t / .3)); cone.position.y += Math.sin(t / .66 * Math.PI * 2) * .025 }
          else cone.position.lerpVectors(target, CONE_HOME, (t - .66) / .34)
          motif.visible = t > .35
        } else { heart.position.lerpVectors(motion.from, HUNG, t); if (!reduced()) heart.position.y += .14 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      matrices(); style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
