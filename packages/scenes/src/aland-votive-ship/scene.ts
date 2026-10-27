import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '舟模寄谢', mastAction: '立好桅杆', cradleAction: '把舟模放上船架', quietAction: '轻点舟模细看',
  mast: '握住桅杆下端的木握柄，拖到船身的金色桅座。',
  cradle: '握住甲板前侧的木把手，把舟模移到船架前端的暖色木扣。',
  quiet: '轻点舟模静看，留一份对平安归来的珍惜与感谢。',
  returning: '轻点船架上的舟模，再看这份记录航海记忆的小景。',
  masting: '桅杆缓缓落入桅座，帆与索具随之就位…', placing: '舟模缓缓移向船架，船腹落入承托…', done: '舟模已在船架上放稳，留一份对平安归来的珍惜与感谢。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.12, 1, .38), SEATED = new THREE.Vector3(.42, 1.16, -.35)
const MAST_HOME = new THREE.Vector3(-1.4, .80, .45), MAST_SEAT = new THREE.Vector3(0, .30, .19)
const ease = (t: number) => t * t * (3 - 2 * t)

/** A contemporary, original craft model; no church donation or sacrament is enacted. */
export function createAlandVotiveShip(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let writer: GestureHandle | null = null, stopResize = () => {}
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  let dragging = false, travel = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.mastAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'aland-votive-ship', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff1dd, ground: 0xb7b19a, key: 0xffe4bd, rim: 0xc8e0e5,
    keyPosition: [-3, 5, 4], keyIntensity: 1.2, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'ship-workshop'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  const oak = material(0xc3a074), dark = material(0x8d6248), honey = material(0xd5b58b)
  const cream = material(0xeee2bd), rope = material(0x5e594d), teal = material(0x819d8d), brass = material(0xc6a467, .55)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.035, ...size.map(v => v / 3))), mat, p, parent)
  const oval = (name: string, p: [number, number, number], scale: [number, number, number], mat: THREE.Material, parent: THREE.Object3D = world) => {
    const m = add(name, new THREE.SphereGeometry(1, 24, 16), mat, p, parent); m.scale.set(...scale); return m
  }
  const line = (name: string, points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D = world) => {
    const m = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 8, false), mat, [0, 0, 0], parent)
    m.userData.toonSurface = { outline: false }; return m
  }
  addCraftTable(world, { name: 'ship-table', topName: 'ship-table-top', width: 3.45, depth: 1.8, surfaceY: .745, thickness: .13, center: [-.1,0], support: 'trestle', finish: 'honey' })
  const shadow = add('ship-ground-shadow', new THREE.PlaneGeometry(4, 2.4), new THREE.ShadowMaterial({ opacity: .13 }), [0, .003, 0])
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false

  // Both work positions have real support: a soft keel rest and a two-post V cradle.
  box('ship-work-rest', [1.30, .035, .42], [-.12, .755, .38], teal)
  const cradle = new THREE.Group(); cradle.name = 'ship-two-post-cradle'; world.add(cradle)
  box('ship-cradle-base', [1.76, .065, .62], [.42, .777, -.35], dark, cradle)
  for (const x of [-.06, .90]) {
    box('ship-cradle-post', [.16, .12, .22], [x, .87, -.35], oak, cradle)
    line('ship-cradle-saddle', [[x, 1.089, -.57], [x, .963, -.46], [x, .929, -.35], [x, .963, -.24], [x, 1.089, -.13]], .035, honey, cradle)
    line('ship-cradle-felt', [[x, 1.105, -.57], [x, .979, -.46], [x, .945, -.35], [x, .979, -.24], [x, 1.105, -.13]], .019, teal, cradle)
  }
  const cradleTarget = oval('ship-cradle-target', [1.15, .836, -.09], [.115, .026, .10], brass, cradle)
  box('ship-loose-mast-rest', [.27, .055, .27], [-1.4, .773, .45], teal)

  const ship = new THREE.Group(); ship.name = 'ship-model'; world.add(ship)
  // Lofted bent hull: tapered ends, curved belly, raised sheer. This is not an elongated box.
  const vertices: number[] = [], indices: number[] = [], nx = 40, nt = 24
  for (let i = 0; i <= nx; i++) {
    const x = -1 + 2 * i / nx, width = .33 * Math.sqrt(Math.max(.0001, 1 - x * x))
    const bottom = -.24 + .39 * Math.pow(Math.abs(x), 3), top = .24 + .07 * x * x
    for (let j = 0; j <= nt; j++) {
      const angle = -Math.PI / 2 + Math.PI * j / nt
      vertices.push(x, bottom + (1 - Math.cos(angle)) * (top - bottom), Math.sin(angle) * width)
      if (i < nx && j < nt) { const n = i * (nt + 1) + j; indices.push(n, n + 1, n + nt + 1, n + 1, n + nt + 2, n + nt + 1) }
    }
  }
  const hullGeometry = new THREE.BufferGeometry(); hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); hullGeometry.setIndex(indices); hullGeometry.computeVertexNormals()
  const hull = add('ship-curved-wooden-hull', hullGeometry, oak, [0, 0, 0], ship); hull.material.side = THREE.DoubleSide
  const deckShape = new THREE.Shape(); deckShape.moveTo(-.99, 0); deckShape.bezierCurveTo(-.68, -.42, .69, -.42, .99, 0); deckShape.bezierCurveTo(.69, .42, -.68, .42, -.99, 0)
  const deck = add('ship-inlaid-deck', new THREE.ExtrudeGeometry(deckShape, { depth: .045, bevelEnabled: false, curveSegments: 24 }), honey, [0, .245, 0], ship)
  deck.rotation.x = Math.PI / 2
  for (const side of [-1, 1]) {
    line('ship-rounded-gunwale', [[-.98, .31, 0], [-.58, .275, side * .28], [0, .268, side * .32], [.58, .275, side * .28], [.98, .31, 0]], .023, dark, ship)
    line('ship-plank-stripe', [[-.91, .15, 0], [-.50, -.02, side * .29], [0, -.08, side * .28], [.50, -.02, side * .29], [.91, .15, 0]], .012, honey, ship)
  }
  line('ship-keel', [[-.86, .05, 0], [-.47, -.21, 0], [0, -.24, 0], [.47, -.21, 0], [.86, .05, 0]], .024, dark, ship)
  for (const x of [-.66, -.42, -.19, .19, .42, .66]) line('ship-deck-seam', [[x, .248, -.19], [x, .248, .19]], .006, oak, ship)
  box('ship-cabin', [.35, .14, .28], [-.49, .325, -.055], teal, ship)
  box('ship-cabin-roof', [.40, .055, .33], [-.49, .418, -.055], cream, ship)
  const socket = add('ship-mast-socket', new THREE.CylinderGeometry(.090, .090, .012, 28), dark, [0, .30, .19], ship)
  const collar = add('ship-mast-collar', new THREE.TorusGeometry(.110, .014, 12, 32), brass, [0, .315, .19], ship)
  collar.rotation.x = Math.PI / 2
  add('ship-mast-socket-housing', new THREE.CylinderGeometry(.110, .110, .06, 32, 1, true), brass, [0, .285, .19], ship)
  const handle = oval('ship-deck-handle', [.48, .31, .27], [.13, .065, .075], dark, ship)
  for (const x of [.40, .56]) box('ship-handle-foot', [.045, .06, .055], [x, .275, .25], dark, ship)
  line('ship-bowsprit', [[.79, .30, 0], [1.16, .40, 0]], .023, dark, ship)
  const mast = new THREE.Group(); mast.name = 'ship-mast-assembly'; world.add(mast)
  line('ship-mast-pole', [[0, 0, 0], [0, 1.12, 0]], .029, dark, mast)
  const grip = oval('ship-mast-grip', [0, .13, .09], [.095, .09, .085], oak, mast)
  line('ship-mast-grip-collar', [[-.06, .09, .04], [0, .07, .075], [.06, .09, .04]], .013, brass, mast)
  line('ship-boom', [[-.025, .30, 0], [.68, .30, .025]], .024, dark, mast)
  // A curved cloth surface with independent spar and seam meshes.
  const sailVertices: number[] = [], sailIndices: number[] = [], rows = 16, cols = 12
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const u = x / cols, v = y / rows, w = .66 * (1 - .76 * v)
    sailVertices.push(.04 + u * w, .32 + .73 * v, .03 + .065 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v))
    if (y < rows && x < cols) { const n = y * (cols + 1) + x; sailIndices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1) }
  }
  const sailGeometry = new THREE.BufferGeometry(); sailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sailVertices, 3)); sailGeometry.setIndex(sailIndices); sailGeometry.computeVertexNormals()
  const sailMaterial = cream.clone(); sailMaterial.side = THREE.DoubleSide
  add('ship-cream-cloth-sail', sailGeometry, sailMaterial, [0, 0, 0], mast)
  line('ship-sail-hem', [[.04, .33, .035], [.70, .33, .035], [.20, 1.05, .035], [.04, 1.05, .035], [.04, .33, .035]], .008, brass, mast)
  for (const v of [.33, .66]) line('ship-sail-seam', [[.05, .32 + .73 * v, .046], [.04 + .66 * (1 - .76 * v), .32 + .73 * v, .046]], .004, honey, mast)
  oval('ship-mast-finial', [0, 1.14, 0], [.039, .045, .039], brass, mast)
  const rigging = new THREE.Group(); rigging.name = 'ship-rigging'; ship.add(rigging)
  line('ship-forestay', [[0, 1.44, .19], [1.14, .40, 0]], .008, rope, rigging)
  line('ship-backstay', [[0, 1.44, .19], [-.84, .30, 0]], .008, rope, rigging)
  for (const sign of [-1, 1]) line('ship-shroud', [[0, 1.28, .19], [-.21, .26, sign * .30]], .006, rope, rigging)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const seatMast = () => mast.position.copy(ship.position).add(MAST_SEAT)
  const restore = () => { ship.position.copy(at >= 2 ? SEATED : HOME); if (at >= 1) seatMast(); else mast.position.copy(MAST_HOME); rigging.visible = at >= 1; matrices() }
  const cueActive = (step: number) => () => active() && !motion && at === step
  addInteractionCue(grip, { kind: 'drag', label: '握住桅杆下端', priority: 3, enabled: cueActive(0), destination: socket, targetLabel: '金色桅座' })
  addInteractionCue(handle, { kind: 'drag', label: '握住甲板木把手', priority: 3, enabled: cueActive(1), destination: cradleTarget, targetLabel: '船架前端木扣' })
  addInteractionCue(handle, { kind: 'tap', label: '轻点舟模细看', priority: 3, enabled: cueActive(2) })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3(), down = new THREE.Vector2()
  const reset = () => { dragging = false; travel = 0; if (!motion) restore() }
  const visibleHit = (x: number, y: number, targets: THREE.Object3D[], held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible || p === held || at === 1 && held === ship && p === mast) return
      if (((object as THREE.Mesh).material as THREE.Material).transparent) return
      meshes.push(object)
    })
    return targets.includes(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object)
  }
  const finishTargets: THREE.Object3D[] = []
  ship.traverse(object => { if ((object as THREE.Mesh).isMesh) finishTargets.push(object) })
  mast.traverse(object => { if ((object as THREE.Mesh).isMesh) finishTargets.push(object) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? [grip] : at === 1 ? [handle] : finishTargets) },
    onStart(x, y) {
      feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2
      const moving = at === 0 ? mast : ship
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (at===0?grip:handle).getWorldPosition(new THREE.Vector3()))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving.position).sub(point)
    },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      const moving = at === 0 ? mast : ship; moving.position.copy(point).add(offset)
      moving.position.x = THREE.MathUtils.clamp(moving.position.x, -1.6, 1.4); moving.position.y = THREE.MathUtils.clamp(moving.position.y, .80, 2.0)
      if (at === 1) seatMast(); matrices()
      if (at < 2 && placementHit(canvas, camera, at === 0 ? grip : handle, x, y, (px,py) => visibleHit(px,py,[at === 0 ? socket : cradleTarget],at === 0 ? mast : ship)) && pointer.finish()) { dragging = false; begin((at === 0 ? mast : ship).position.clone(),true) }
    },
    onRelease(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        const moving = at === 0 ? mast : ship; moving.position.copy(point).add(offset)
        moving.position.x = THREE.MathUtils.clamp(moving.position.x, -1.6, 1.4); moving.position.y = THREE.MathUtils.clamp(moving.position.y, .80, 2.0)
        if (at === 1) seatMast(); matrices()
      }
      // Test the fixed, visible destination before the carried object can obscure it.
      const moved = (at === 0 ? mast : ship).position.clone()
      const valid = at < 2 ? dragging && placementHit(canvas, camera, at === 0 ? grip : handle, x, y, (px, py) => visibleHit(px, py, [at === 0 ? socket : cradleTarget], at === 0 ? mast : ship))
        : at === 2 && travel < 12 && visibleHit(x, y, finishTargets)
      restore()
      dragging = false
      if (valid) { if (at < 2) begin(moved); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); wishSlot.hidden = returning || at !== 2
    writer?.setEnabled(active() && !returning && at === 2 && !motion)
    ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? COPY.mastAction : at === 1 ? COPY.cradleAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.masting : COPY.placing : at === 0 ? COPY.mast : at === 1 ? COPY.cradle : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settle() {
    if (!active() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync(); ctx.onProgress?.(at)
    feedback.impact({ freqs: [392, 493.88], duration: .19, gain: .012, type: 'triangle' })
  }
  function begin(from?: THREE.Vector3, placed = false) {
    if (!active() || (pointer.isBusy() && !placed) || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, from: from?.clone() ?? (at === 0 ? mast : ship).position.clone() }
    sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    at = 3; restore(); sync(); if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    ctx.onProgress?.(3); feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 3.30, 5.75 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.27, 0); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }; return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .75)
        const t = ease(motion.time), lift = reduced() ? 0 : .11 * Math.sin(Math.PI * t)
        if (motion.step === 0) { mast.position.lerpVectors(motion.from, ship.position.clone().add(MAST_SEAT), t); mast.position.y += lift }
        else { ship.position.lerpVectors(motion.from, SEATED, t); ship.position.y += lift; seatMast() }
        if (motion.time === 1) settle()
      }
      matrices(); style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
