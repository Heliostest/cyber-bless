import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '陶鸡报晓', paintAction: '给陶鸡添纹', placeAction: '把陶鸡放上展台', quietAction: '轻点陶鸡细看',
  paint: '握住桌前画笔的木柄，送到陶鸡胸前，添上叶芽纹样。',
  place: '轻托陶鸡，把它放到右侧圆形展台上。',
  quiet: '轻点陶鸡，带着此刻的祝愿，细看这件寓意好运的陈设。', returning: '轻点陶鸡，回看这件带着好运寓意的陈设。',
  painting: '叶芽彩纹慢慢显现在陶鸡胸前…', placing: '陶鸡连同陶土底座，缓缓落在展台上…', done: '陶鸡已在展台上放稳，静赏它的色彩与美好寓意。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.75, .78, -.06), SEATED = new THREE.Vector3(.77, .95, -.06)
const BRUSH_HOME = new THREE.Vector3(-1.05, .835, .63)
const ease = (t: number) => t * t * (3 - 2 * t)

/** An original contemporary workshop homage to Barcelos ceramic figures. */
export function createBarcelosClayRooster(ctx: SceneContext): SceneInstance {
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
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'barcelos-clay-rooster', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf5e8d9, ground: 0xa5a38d, key: 0xffe5c8, rim: 0xc6dddb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.2, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'rooster-pottery-workbench'; scene.add(world)
  const material = (color: number, roughness = .8) => new THREE.MeshStandardMaterial({ color, roughness })
  const charcoal = material(0x293c40, .61), cream = material(0xf0dfae), green = material(0x739481), red = material(0xbd5142, .66)
  const oak = material(0xc4aa85), dark = material(0x8f7153), clay = material(0xad7359), gold = material(0xcea060), linen = material(0xabc0ad)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const lathe = (name: string, profile: [number, number][], mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) =>
    add(name, new THREE.LatheGeometry(profile.map(v => new THREE.Vector2(...v)), 64), mat, p, parent)
  const tube = (name: string, points: [number, number, number][], width: number, mat: THREE.Material, parent: THREE.Object3D) =>
    add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, width, 10, false), mat, [0, 0, 0], parent)
  addCraftTable(world, { name: 'rooster-table', topName: 'rooster-table-top', width: 3.65, depth: 1.88, surfaceY: .74, thickness: .12, center: [0,0], support: 'arched', finish: 'honey' })
  const shadow = add('rooster-ground-shadow', new THREE.PlaneGeometry(4.15, 2.65), new THREE.ShadowMaterial({ opacity: .13 }), [0, .003, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('rooster-linen-rest', [1.18, .04, 1.00], [-.75, .76, -.06], linen)
  box('rooster-brush-rest', [.89, .04, .25], [-1.05, .76, .63], cream)
  lathe('rooster-dye-dish', [[0, 0], [.22, 0], [.25, .03], [.26, .085], [.24, .10], [.21, .06], [0, .06]], clay, [-1.44, .74, -.62])
  add('rooster-dye-pool', new THREE.CylinderGeometry(.208, .208, .008, 40), green, [-1.44, .804, -.62])
  const plinth = new THREE.Group(); plinth.name = 'rooster-display-plinth'; world.add(plinth)
  const plinthEdge = lathe('rooster-plinth-edge', [[0, .74], [.52, .74], [.58, .78], [.58, .88], [.54, .93], [0, .93]], clay, [.77, 0, -.06], plinth)
  const plinthTop = add('rooster-plinth-top', new THREE.CylinderGeometry(.535, .535, .035, 64), cream, [.77, .9325, -.06], plinth)
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2
    const dash = add('rooster-plinth-brush-dash', new THREE.CapsuleGeometry(.011, .027, 3, 6), green, [.77 + .579 * Math.sin(a), .833, -.06 + .579 * Math.cos(a)], plinth)
    dash.userData.toonSurface = { outline: false }
  }
  const rooster = new THREE.Group(); rooster.name = 'barcelos-rooster'; world.add(rooster)
  const base = lathe('rooster-clay-base', [[0, 0], [.42, 0], [.47, .025], [.47, .075], [.42, .115], [0, .115]], red, [0, 0, 0], rooster); base.scale.z = .69
  for (const z of [-.17, .17]) {
    tube('rooster-leg', [[-.06, .105, z], [-.06, .31, z], [-.11, .55, z]], .066, gold, rooster)
    for (const spread of [-1, 0, 1]) tube('rooster-toe', [[-.06, .15, z], [-.20, .13, z + spread * .045], [-.29, .115, z + spread * .075]], .031, gold, rooster)
  }
  // The chest, neck and head are one continuous ring surface, not disconnected balls.
  const bodyCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.02, .40, 0), new THREE.Vector3(.015, .54, .29), new THREE.Vector3(.015, .81, .44),
    new THREE.Vector3(-.05, 1.06, .42), new THREE.Vector3(-.20, 1.29, .27), new THREE.Vector3(-.32, 1.53, .20),
    new THREE.Vector3(-.38, 1.71, .22), new THREE.Vector3(-.38, 1.87, .13), new THREE.Vector3(-.37, 1.91, 0),
  ], false, 'catmullrom', .5)
  const surface = (theta: number, t: number, offset = .006) => {
    const p = bodyCurve.getPoint(THREE.MathUtils.clamp(t, 0, 1)), r = Math.max(0, p.z)
    return new THREE.Vector3(p.x + (r + offset) * Math.sin(theta), p.y, (r * .73 + offset) * Math.cos(theta))
  }
  const patch = (name: string, theta0: number, theta1: number, t0: number, t1: number, mat: THREE.Material, parent: THREE.Object3D, offset = .006) => {
    const vertices: number[] = [], indices: number[] = [], center = surface((theta0 + theta1) / 2, (t0 + t1) / 2, offset)
    const w = name === 'rooster-body' ? 64 : 16, h = name === 'rooster-body' ? 100 : 16
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const p = surface(theta0 + (theta1 - theta0) * i / w, t0 + (t1 - t0) * j / h, offset).sub(center); vertices.push(p.x, p.y, p.z)
      if (i < w && j < h) { const n = j * (w + 1) + i; indices.push(n, n + 1, n + w + 1, n + 1, n + w + 2, n + w + 1) }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    return add(name, geometry, mat, center.toArray() as [number, number, number], parent)
  }
  patch('rooster-body', -Math.PI, Math.PI, 0, 1, charcoal, rooster, 0)
  const paintSurface = patch('rooster-paint-surface', -.20, .24, .37, .49, charcoal, rooster)
  paintSurface.userData.toonSurface = { outline: false }
  const sculpt = (name: string, shape: THREE.Shape, depth: number, mat: THREE.Material, z: number) => {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .018, bevelThickness: .018, curveSegments: 24 })
    return add(name, geometry, mat, [0, 0, z - depth / 2], rooster)
  }
  // Broad, arched feather shapes root well inside the back of the chest.
  const tails = [
    [.22, .79, .48, 1.76, .95, 1.91, 1.07, 1.69, .88, 1.51],
    [.26, .74, .71, 1.49, 1.17, 1.70, 1.22, 1.46, .91, 1.20],
    [.24, .70, .81, 1.22, 1.26, 1.43, 1.30, 1.17, .78, .91],
  ]
  tails.forEach((p, i) => {
    const s = new THREE.Shape(); s.moveTo(p[0], p[1]); s.bezierCurveTo(p[0] + .11, p[3], p[2], p[5], p[4], p[5]); s.quadraticCurveTo(p[6] + .06, p[5], p[6], p[7]); s.bezierCurveTo(p[8], p[9], .55, .88, p[0], p[1]); s.closePath()
    sculpt(`rooster-tail-feather-${i}`, s, .11, charcoal, -.06 + i * .085)
    tube('rooster-tail-painted-arc', [[p[0] + .06, p[1] + .15, .013 + i * .085], [p[2], p[3] -.08, .013 + i * .085], [p[4] -.04, p[5] -.10, .013 + i * .085]], .014, i % 2 ? green : cream, rooster).userData.toonSurface = { outline: false }
  })
  const comb = new THREE.Shape(); comb.moveTo(-.55, 1.80); comb.lineTo(-.58, 1.91)
  comb.bezierCurveTo(-.71, 2.04, -.55, 2.18, -.46, 2.00)
  comb.bezierCurveTo(-.46, 2.25, -.25, 2.28, -.27, 2.03)
  comb.bezierCurveTo(-.15, 2.19, .01, 2.05, -.17, 1.93)
  comb.lineTo(-.25, 1.83); comb.closePath(); sculpt('rooster-scalloped-comb', comb, .13, red, 0)
  const beak = new THREE.Shape(); beak.moveTo(-.55, 1.78); beak.quadraticCurveTo(-.74, 1.80, -.82, 1.70); beak.quadraticCurveTo(-.70, 1.66, -.56, 1.67); beak.closePath(); sculpt('rooster-beak', beak, .13, gold, .015)
  const wattle = new THREE.Shape(); wattle.moveTo(-.53, 1.68); wattle.bezierCurveTo(-.70, 1.47, -.54, 1.35, -.46, 1.51); wattle.quadraticCurveTo(-.42, 1.61, -.53, 1.68); sculpt('rooster-wattle', wattle, .095, red, .10)
  for (const side of [-1, 1]) {
    const eye = add('rooster-eye-cream', new THREE.SphereGeometry(1, 20, 12), cream, [-.48, 1.77, side * .15], rooster); eye.scale.set(.050, .055, .018)
    const pupil = add('rooster-eye-pupil', new THREE.SphereGeometry(1, 16, 12), charcoal, [-.494, 1.773, side * .168], rooster); pupil.scale.set(.020, .027, .008)
  }
  const motif = new THREE.Group(); motif.name = 'rooster-invented-motif'; rooster.add(motif)
  const stroke = (name: string, points: [number, number][], width: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([theta, t]) => new THREE.Vector3(theta, t, 0))), vertices: number[] = [], indices: number[] = []
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, p = curve.getPoint(t), d = curve.getTangent(t), thickness = width * (.2 + .8 * Math.sin(Math.PI * t))
      for (const side of [-1, 1]) { const v = surface(p.x - d.y * thickness * side, p.y + d.x * thickness * .16 * side, .009); vertices.push(v.x, v.y, v.z) }
      if (i < 32) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3) }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals()
    const m = add(name, g, mat, [0, 0, 0], motif); m.userData.toonSurface = { outline: false }; (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  }
  // Original alternating leaf sprays keep the central dark breast clear as the visible grip.
  for (const a of [-.83, .84, 2.32, 3.88]) {
    stroke('rooster-leaf-stem', [[a, .22], [a + .05, .34], [a, .51]], .022, cream)
    for (let j = 0; j < 3; j++) for (const side of [-1, 1]) {
      const t = .26 + j * .067
      stroke('rooster-leaf-petal', [[a, t], [a + side * .22, t + .026], [a + side * .26, t + .065]], .057, j % 2 ? cream : green)
    }
  }
  for (let i = 0; i < 14; i++) stroke('rooster-neck-dash', [[i * Math.PI * 2 / 14, .57], [i * Math.PI * 2 / 14 + .07, .60]], .035, cream)
  const brush = new THREE.Group(); brush.name = 'rooster-brush'; world.add(brush)
  const grip = add('rooster-brush-grip', new THREE.CapsuleGeometry(.067, .34, 6, 16), dark, [-.04, 0, 0], brush); grip.rotation.z = Math.PI / 2
  const ferrule = add('rooster-brush-ferrule', new THREE.CylinderGeometry(.045, .045, .13, 16), gold, [.245, 0, 0], brush); ferrule.rotation.z = Math.PI / 2
  const tip = add('rooster-brush-tip', new THREE.ConeGeometry(.045, .17, 16), green, [.385, 0, 0], brush); tip.rotation.z = -Math.PI / 2
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { rooster.position.copy(at >= 2 ? SEATED : HOME); brush.position.copy(BRUSH_HOME); motif.visible = at >= 1; matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  addInteractionCue(grip, { kind: 'drag', label: '握住画笔木柄', priority: 3, enabled: enabled(0), destination: paintSurface, targetLabel: '陶鸡胸前' })
  addInteractionCue(paintSurface, { kind: 'drag', label: '轻托陶鸡', priority: 3, enabled: enabled(1), destination: plinthTop, targetLabel: '圆形展台' })
  addInteractionCue(paintSurface, { kind: 'tap', label: '轻点陶鸡细看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? brush : rooster
  const roosterTargets: THREE.Object3D[] = []; rooster.traverse(object => { if ((object as THREE.Mesh).isMesh) roosterTargets.push(object) })
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
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? [grip] : roosterTargets) },
    onStart(x, y) { feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .78, 2.0); matrices()
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && travel >= 8 && visibleHit(x, y, at === 0 ? roosterTargets : [plinthTop, plinthEdge], moving())
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, roosterTargets)
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
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    at = 3
    const input = wishSlot.querySelector<HTMLInputElement>('input'); if (input) input.value = ''
    restore(); sync()
    if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    ctx.onProgress?.(3); feedback.impact({ freqs: [440, 659.25], duration: .24, gain: .012 }); overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(.15, 3.55, Math.max(6.6, 6.2 / aspect)); camera.lookAt(.15, 1.35, 0); matrices() }
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
        } else { rooster.position.lerpVectors(motion.from, SEATED, t); if (!reduced()) rooster.position.y += .20 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      matrices(); style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
