import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '木勺寄情', decorateAction: '轻拭木勺', hangAction: '把木勺安放在展托', quietAction: '轻点木勺静看',
  decorate: '拿起桌前软布，轻拭木勺的凹面。以原创木雕，欣赏威尔士爱勺的赠礼手艺。',
  hang: '握住木柄，把整只木勺送到右侧展托，让勺底轻轻落稳。',
  quiet: '轻点木勺静看，或写一句赠予在意之人的心意；点「写好了」才会保存。',
  returning: '轻点木勺，回看这份温暖的赠礼心意。', moving: '轻拭木纹，再让木勺稳稳落下…',
  done: '木纹留住手作的温度。（当代手作致敬练习结束）',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const REST = new THREE.Vector3(.78, .88, .02), CLOTH_HOME = new THREE.Vector3(-.85, .81, .62)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original carved gift spoon inspired by public Welsh craft; no copied maker design. */
export function createWelshLoveSpoon(ctx: SceneContext): SceneInstance {
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
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'welsh-love-spoon', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3e9d4, ground: 0xaba596, key: 0xffefdc, rim: 0xd4e7eb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'spoon-veranda-workbench'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  const carved = material(0xc69050, .62), grain = material(0xe1b579, .62), oak = material(0xc5ac80), walnut = material(0x80634b), linen = material(0x94b4ad)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const tube = (name: string, points: THREE.Vector3[], radius: number, mat: THREE.Material, parent: THREE.Object3D, closed = false) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), 64, radius, 8, closed), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  box('spoon-table-top', [3.12, .12, 1.62], [0, .70, .04])
  for (const x of [-1.32, 1.32]) for (const z of [-.55, .63]) box('spoon-table-leg', [.13, .64, .13], [x, .32, z], walnut)
  box('spoon-table-apron', [2.76, .12, .075], [0, .58, .62], walnut)
  const ground = add('spoon-contact-shadow', new THREE.PlaneGeometry(3.8, 2.1), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .1]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  box('spoon-home-pad', [.9, .04, .5], [-.72, .78, .02], linen)
  box('spoon-home-back-rest', [.22, .44, .08], [-.72, 1.02, -.13], walnut)
  const stand = new THREE.Group(); stand.name = 'spoon-display-stand'; world.add(stand)
  box('spoon-stand-base', [.95, .08, .66], [.78, .80, .02], walnut, stand)
  const seat = box('spoon-display-seat', [.76, .04, .43], [.78, .86, .02], linen, stand)
  box('spoon-display-back-rest', [.19, .54, .08], [.78, 1.15, -.13], walnut, stand)
  const spoon = new THREE.Group(); spoon.name = 'spoon-body'; world.add(spoon)
  // A closed profile gives the spoon a concave front and a convex, thick wooden back.
  const profile = [[0, 0], [.28, .009], [.55, .035], [.8, .085], [.98, .155], [1, .17], [1.06, .15], [1.06, .10], [.95, .005], [.6, -.095], [0, -.125]]
  const positions: number[] = [], indices: number[] = [], segments = 64
  for (const [r, z] of profile) for (let j = 0; j <= segments; j++) {
    const angle = j / segments * Math.PI * 2; positions.push(.33 * r * Math.cos(angle), .45 * r * Math.sin(angle), z)
  }
  for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < segments; j++) {
    const a = i * (segments + 1) + j, b = a + segments + 1; indices.push(a, b, b + 1, a, b + 1, a + 1)
  }
  const bowlGeometry = new THREE.BufferGeometry(); bowlGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); bowlGeometry.setIndex(indices); bowlGeometry.computeVertexNormals()
  const bowl = add('spoon-bowl', bowlGeometry, carved, [0, .477, 0], spoon)
  bowl.userData.toonSurface = { outline: false }
  const handleShape = new THREE.Shape()
  handleShape.moveTo(-.115, .79); handleShape.lineTo(-.12, 1.30); handleShape.bezierCurveTo(-.16, 1.40, -.34, 1.58, -.34, 1.79)
  handleShape.bezierCurveTo(-.34, 2.10, -.10, 2.12, 0, 1.92); handleShape.bezierCurveTo(.10, 2.12, .34, 2.10, .34, 1.79)
  handleShape.bezierCurveTo(.34, 1.58, .16, 1.40, .12, 1.30); handleShape.lineTo(.115, .79); handleShape.closePath()
  const hole = new THREE.Path(); hole.moveTo(0, 1.58); hole.bezierCurveTo(-.07, 1.66, -.23, 1.77, -.19, 1.87)
  hole.bezierCurveTo(-.15, 1.99, -.03, 1.87, 0, 1.81); hole.bezierCurveTo(.03, 1.87, .15, 1.99, .19, 1.87); hole.bezierCurveTo(.23, 1.77, .07, 1.66, 0, 1.58); handleShape.holes.push(hole)
  const handleGeometry = new THREE.ExtrudeGeometry(handleShape, { depth: .14, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 3, curveSegments: 24 }); handleGeometry.translate(0, 0, -.07)
  const handle = add('spoon-carved-handle', handleGeometry, carved, [0, 0, 0], spoon)
  // The small raised lozenge is part of the carved handle, not a transparent touch proxy.
  const grip = box('spoon-handle-grip', [.105, .105, .022], [0, 1.18, .096], grain, spoon); grip.rotation.z = Math.PI / 4
  const polished = new THREE.Group(); polished.name = 'spoon-polished-grain'; spoon.add(polished)
  for (const side of [-1, 1]) tube('spoon-grain-stroke', [[side * .065, .91, .087], [side * .074, 1.04, .087], [side * .068, 1.19, .087], [side * .08, 1.32, .087]].map(p => new THREE.Vector3(...p as [number, number, number])), .0035, grain, polished)
  const home = new THREE.Vector3(-.72, .80, .02)
  const cloth = new THREE.Group(); cloth.name = 'spoon-polishing-cloth'; world.add(cloth)
  const clothGrip = box('spoon-cloth-grip', [.52, .10, .30], [0, 0, 0], linen, cloth)
  box('spoon-cloth-fold', [.48, .018, .11], [0, .057, -.07], linen, cloth)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { spoon.position.copy(at >= 2 ? REST : home); cloth.position.copy(CLOTH_HOME); polished.visible = at >= 1; matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  const bowlPoint = () => bowl.getWorldPosition(new THREE.Vector3())
  addInteractionCue(clothGrip, { kind: 'drag', label: '拿起软布', priority: 3, enabled: enabled(0), destination: bowl, targetLabel: '木勺凹面' })
  addInteractionCue(grip, { kind: 'drag', label: '握住木柄', priority: 3, enabled: enabled(1), destination: seat, targetLabel: '木勺展托' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点木勺静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? cloth : spoon
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
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? clothGrip : [bowl, handle, grip, polished]) },
    onStart(x, y) { feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices()
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && travel >= 8 && visibleHit(x, y, at === 0 ? bowl : seat, moving())
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, [bowl, handle, grip, polished])
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
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.35, 6.05 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.50, 0); matrices() }
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
          const target = bowlPoint().add(new THREE.Vector3(0, 0, .24))
          if (t < .66) { cloth.position.lerpVectors(motion.from, target, Math.min(1, t / .3)); cloth.position.y += Math.sin(t / .66 * Math.PI * 2) * .065 }
          else cloth.position.lerpVectors(target, CLOTH_HOME, (t - .66) / .34)
          polished.visible = t > .35
        } else { spoon.position.lerpVectors(motion.from, REST, t); if (!reduced()) spoon.position.y += .14 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      matrices(); style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
