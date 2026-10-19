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
  title: '彩蛋寄春', paintAction: '给彩蛋添纹', placeAction: '把彩蛋放进陶杯', quietAction: '轻点彩蛋细看',
  paint: '握住桌前画笔的木柄，把笔送到青蓝蛋壳上，为复活节赠礼添上花枝纹。',
  place: '轻托彩蛋，把它移到右侧陶杯的浅色杯沿，先在杯中摆好。',
  quiet: '想着要赠予的人，带着复活节的祝愿，轻点彩蛋细看。', returning: '轻点彩蛋，回看为在意之人准备的复活节赠礼。', painting: '花枝笔触慢慢显现在蛋壳上…', placing: '彩蛋缓缓移向陶杯，在杯中落稳…',
  done: '彩蛋已在杯中放稳，留一份准备赠人的复活节祝愿。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.48, .78, .08), SEATED = new THREE.Vector3(.87, .94, -.06)
const BRUSH_HOME = new THREE.Vector3(-1.02, .825, .56), HEIGHT = 1.42
const radius = (y: number) => .51 * Math.pow(Math.max(0, Math.sin(Math.PI * y / HEIGHT)), .65) * (1 - .24 * y / HEIGHT)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original digital spring craft, without copying an artisan's motif or enacting a religious rite. */
export function createSorbianPaintedEgg(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let dragging = false, travel = 0, stopResize = () => {}
  let writer: GestureHandle | null = null
  const returning = ctx.returning === true
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.paintAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'sorbian-painted-egg', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xe5f0ea, ground: 0xafa896, key: 0xffe8ca, rim: 0xc9e2ec,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'egg-spring-workbench'; scene.add(world)
  const material = (color: number, roughness = .83) => new THREE.MeshStandardMaterial({ color, roughness })
  const blue = material(0x427a83, .67), cream = material(0xf0e3bd), sage = material(0x94aaa0), gold = material(0xcaa26c)
  const oak = material(0xc7b294), dark = material(0x94795c), clay = material(0xb78169), pigment = material(0x456e75, .57)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const lathe = (name: string, profile: [number, number][], mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) =>
    add(name, new THREE.LatheGeometry(profile.map(v => new THREE.Vector2(...v)), 64), mat, p, parent)
  addCraftTable(world, { name: 'egg-table', topName: 'egg-table-top', width: 3.3, depth: 1.78, surfaceY: .74, thickness: .12, center: [0,0], support: 'joined', finish: 'birch' })
  const shadow = add('egg-ground-shadow', new THREE.PlaneGeometry(3.9, 2.5), new THREE.ShadowMaterial({ opacity: .13 }), [0, .003, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('egg-linen-rest', [1.01, .04, .91], [-.48, .76, .08], sage)
  box('egg-brush-rest', [.85, .036, .24], [-1.02, .758, .56], cream)
  // The dish has a raised ceramic rim around a shallow painted pool.
  lathe('egg-dye-dish', [[0, 0], [.23, 0], [.28, .035], [.29, .095], [.26, .11], [.235, .07], [0, .06]], clay, [-1.13, .74, -.56])
  add('egg-dye-pool', new THREE.CylinderGeometry(.232, .232, .009, 48), pigment, [-1.13, .807, -.56])

  const cup = new THREE.Group(); cup.name = 'egg-display-cup'; cup.position.set(SEATED.x, 0, SEATED.z); world.add(cup)
  lathe('egg-cup-foot', [[0, .74], [.26, .74], [.29, .76], [.26, .79], [.10, .81], [.065, .87], [.11, .93], [0, .94]], clay, [0, 0, 0], cup)
  const cupProfile: [number, number][] = [[0, .917]]
  for (let i = 0; i <= 20; i++) { const y = .25 * i / 20; cupProfile.push([radius(y) + .035, SEATED.y + y - .015]) }
  for (let i = 20; i >= 0; i--) { const y = .25 * i / 20; cupProfile.push([radius(y) + .003, SEATED.y + y]) }
  cupProfile.push([0, .917])
  lathe('egg-cup-bowl', cupProfile, clay, [0, 0, 0], cup)
  const rim = add('egg-cup-cream-rim', new THREE.TorusGeometry(radius(.25) + .018, .018, 10, 64), cream, [0, 1.183, 0], cup); rim.rotation.x = Math.PI / 2
  const cupTarget = add('egg-cup-target', new THREE.SphereGeometry(1, 24, 16), cream, [0, 1.125, .303], cup); cupTarget.scale.set(.13, .055, .025)
  cupTarget.userData.toonSurface = { outline: false }
  const egg = new THREE.Group(); egg.name = 'sorbian-painted-egg'; world.add(egg)
  const profile: [number, number][] = Array.from({ length: 81 }, (_, i) => { const y = HEIGHT * i / 80; return [radius(y), y] })
  const shell = lathe('egg-lathed-shell', profile, blue, [0, 0, 0], egg)
  // Small curved patches follow the same surface function as the shell, with a paint-thin offset.
  const surface = (theta: number, y: number, offset = .004) => new THREE.Vector3((radius(y) + offset) * Math.sin(theta), y, (radius(y) + offset) * Math.cos(theta))
  const patch = (name: string, theta0: number, theta1: number, y0: number, y1: number, mat: THREE.Material, parent = egg) => {
    const vertices: number[] = [], indices: number[] = [], center = surface((theta0 + theta1) / 2, (y0 + y1) / 2)
    for (let j = 0; j <= 10; j++) for (let i = 0; i <= 10; i++) {
      const p = surface(theta0 + (theta1 - theta0) * i / 10, y0 + (y1 - y0) * j / 10).sub(center); vertices.push(p.x, p.y, p.z)
      if (i < 10 && j < 10) { const n = j * 11 + i; indices.push(n, n + 1, n + 11, n + 1, n + 12, n + 11) }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const mesh = add(name, geometry, mat, center.toArray() as [number, number, number], parent); mesh.userData.toonSurface = { outline: false }; return mesh
  }
  const paintSurface = patch('egg-paint-surface', -.33, .33, .73, 1.04, blue)
  const motif = new THREE.Group(); motif.name = 'egg-invented-motif'; egg.add(motif)
  const stroke = (name: string, points: [number, number][], width: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([theta, y]) => new THREE.Vector3(theta, y, 0)))
    const vertices: number[] = [], indices: number[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, p = curve.getPoint(t), tangent = curve.getTangent(t), thickness = width * (.24 + .76 * Math.sin(Math.PI * t))
      for (const side of [-1, 1]) { const pos = surface(p.x - tangent.y * thickness * side, p.y + tangent.x * thickness * side, .006); vertices.push(pos.x, pos.y, pos.z) }
      if (i < 24) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3) }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const mesh = add(name, geometry, mat, [0, 0, 0], motif); mesh.userData.toonSurface = { outline: false }
  }
  // Invented sprigs and a loose dotted crown; no borrowed artisan pattern or claimed symbolic meaning.
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI * 2 / 16
    stroke('egg-crown-dash', [[angle - .04, 1.11], [angle, 1.17], [angle + .04, 1.21]], .019, cream)
  }
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7
    stroke('egg-sprig-stem', [[angle, .32], [angle + .03, .47], [angle, .64]], .014, gold)
    for (const side of [-1, 1]) stroke('egg-sprig-leaf', [[angle, .43], [angle + side * .20, .52], [angle + side * .23, .62]], .028, cream)
    stroke('egg-sprig-accent', [[angle, .52], [angle + .11, .60], [angle + .08, .68]], .021, sage)
  }
  const brush = new THREE.Group(); brush.name = 'egg-brush'; world.add(brush)
  const grip = add('egg-brush-grip', new THREE.CapsuleGeometry(.061, .31, 6, 16), dark, [-.04, 0, 0], brush); grip.rotation.z = Math.PI / 2
  const ferrule = add('egg-brush-ferrule', new THREE.CylinderGeometry(.043, .043, .13, 16), gold, [.22, 0, 0], brush); ferrule.rotation.z = Math.PI / 2
  const tip = add('egg-brush-tip', new THREE.ConeGeometry(.042, .17, 16), cream, [.37, 0, 0], brush); tip.rotation.z = -Math.PI / 2
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { egg.position.copy(at >= 2 ? SEATED : HOME); brush.position.copy(BRUSH_HOME); motif.visible = at >= 1; matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  addInteractionCue(grip, { kind: 'drag', label: '握住画笔木柄', priority: 3, enabled: enabled(0), destination: paintSurface, targetLabel: '青蓝蛋壳' })
  addInteractionCue(paintSurface, { kind: 'drag', label: '轻托彩蛋', priority: 3, enabled: enabled(1), destination: cupTarget, targetLabel: '陶杯浅色杯沿' })
  addInteractionCue(paintSurface, { kind: 'tap', label: '轻点彩蛋细看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? brush : egg
  const eggTargets: THREE.Object3D[] = []; egg.traverse(object => { if ((object as THREE.Mesh).isMesh) eggTargets.push(object) })
  const visibleHit = (x: number, y: number, targets: THREE.Object3D[], held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === held) return
      const materials = (object as THREE.Mesh).material, list = Array.isArray(materials) ? materials : [materials]
      if (!list.some(mat => mat.visible && (!mat.transparent || mat.opacity >= 1))) return
      meshes.push(object)
    })
    return targets.includes(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object)
  }
  const reset = () => { dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? [grip] : eggTargets) },
    onStart(x, y) { feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .78, 2.0); matrices()
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && travel >= 8 && visibleHit(x, y, at === 0 ? [paintSurface, shell] : [cupTarget], moving())
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, eggTargets)
      dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.paintAction : at === 1 ? COPY.placeAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.painting : COPY.placing : at === 0 ? COPY.paint : at === 1 ? COPY.place : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settle() { if (!active() || !motion) return; at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync(); ctx.onProgress?.(at); feedback.impact({ freqs: [440, 554.37], duration: .19, gain: .012, type: 'triangle' }) }
  function begin() { if (!active() || pointer.isBusy() || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') { if (!active() || pointer.isBusy() || motion || at !== 2) return; at = 3; restore(); sync(); if (text.trim() && !returning) ctx.saveWish?.(text.trim()); ctx.onProgress?.(3); feedback.impact({ freqs: [440, 659.25], duration: .24, gain: .012 }); overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.45, 5.55 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.20, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
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
          const target = paintSurface.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-.37, 0, .055))
          if (t < .64) { brush.position.lerpVectors(motion.from, target, Math.min(1, t / .3)); brush.position.y += Math.sin(t / .64 * Math.PI * 2) * .05 }
          else brush.position.lerpVectors(target, BRUSH_HOME, (t - .64) / .36)
          motif.visible = t > .36
        } else { egg.position.lerpVectors(motion.from, SEATED, t); if (!reduced()) egg.position.y += .20 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      matrices(); style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
