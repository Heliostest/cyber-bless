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
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '蓝白晾晴', rinseAction: '将扎布送到漂洗盆', hangAction: '把蓝白布搭上晾杆', quietAction: '轻点布面静看',
  rinse: '握住凳上的扎布，送到盆中，看看蓝白留纹。',
  hang: '握住盆前可见的布边，将蓝白布搭到右侧木晾杆。',
  quiet: '轻点蓝白布静看，也可写一句心愿；点「写好了」保存。',
  returning: '轻点蓝白布，回看这份安静的心意。', moving: '将布放稳，慢慢展开…',
  done: '蓝白布已晾好，留一刻晴朗。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const BUNDLE_HOME = new THREE.Vector3(-1.03, .36, .89)
const RINSED = new THREE.Vector3(-.78, .79, .49), HUNG = new THREE.Vector3(.84, 1.90, -.06)
const CLOTH_ANCHOR: [number, number, number] = [-.50, -.35, .085]
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original blue-white cloth, including both faces and the fold, as one closed surface. */
function clothGeometry() {
  const nx = 72, ny = 120, radius = .073, front = .67, back = .49, length = front + Math.PI * radius + back
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const indigo = new THREE.Color(0x174d82), pale = new THREE.Color(0xf6f2dc), bloom = new THREE.Color(0x6791b2)
  const surface = (u: number, v: number) => {
    const x = (u - .5) * 1.24, s = v * length
    if (s < front) {
      const away = (front - s) / front
      return new THREE.Vector3(x, s - front + .013 * Math.cos(u * Math.PI * 6) * away * away,
        radius + .025 * Math.sin(u * Math.PI * 8 + .4) * away)
    }
    if (s <= front + Math.PI * radius) {
      const angle = (s - front) / radius
      return new THREE.Vector3(x, radius * Math.sin(angle), radius * Math.cos(angle))
    }
    const away = (s - front - Math.PI * radius) / back
    return new THREE.Vector3(x, -away * back, -radius + .018 * Math.sin(u * Math.PI * 8 + .4) * away)
  }
  for (let side = 0; side < 2; side++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny, p = surface(u, v)
    const du = surface(Math.min(1, u + .0001), v).sub(surface(Math.max(0, u - .0001), v))
    const dv = surface(u, Math.min(1, v + .0001)).sub(surface(u, Math.max(0, v - .0001)))
    p.addScaledVector(du.cross(dv).normalize(), side === 0 ? .003 : -.003)
    positions.push(p.x, p.y, p.z)
    // Invented offset oval reserves and narrow bands; no copied workshop or sacred motif.
    const cellX = ((u * 4 + (Math.floor(v * 6) % 2) * .5) % 1) - .5, cellY = (v * 6 % 1) - .5
    const ring = Math.abs(Math.hypot(cellX / .85, cellY) - .24), border = Math.min(u, 1 - u)
    const reserve = Math.max(1 - THREE.MathUtils.smoothstep(ring, .028, .08), border > .046 && border < .062 ? 1 : 0)
    const dye = indigo.clone().lerp(bloom, .12 + .08 * Math.sin(u * 31 + v * 19)).lerp(pale, reserve)
    colors.push(dye.r, dye.g, dye.b)
  }
  const layer = (nx + 1) * (ny + 1)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1
    indices.push(a, b, d, a, d, c, a + layer, d + layer, b + layer, a + layer, c + layer, d + layer)
  }
  const rim: number[] = []
  for (let i = 0; i <= nx; i++) rim.push(i)
  for (let j = 1; j <= ny; j++) rim.push(j * (nx + 1) + nx)
  for (let i = nx - 1; i >= 0; i--) rim.push(ny * (nx + 1) + i)
  for (let j = ny - 1; j > 0; j--) rim.push(j * (nx + 1))
  for (let i = 0; i < rim.length; i++) { const a = rim[i], b = rim[(i + 1) % rim.length]; indices.push(a, a + layer, b + layer, a, b + layer, b) }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox()
  return geometry
}

export function createBaiIndigoCloth(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false, feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.rinseAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'bai-indigo-cloth', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf0efdf, ground: 0xa5ac98, key: 0xffefdc, rim: 0xc6e4ea,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'indigo-veranda-workshop'; scene.add(world)
  const material = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const oak = material(0xbd9965), walnut = material(0x796447), ceramic = material(0x9baaa8), blue = material(0x214e7c), linen = material(0xebdfbd)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const rod = (name: string, radius: number, length: number, p: [number, number, number], mat = oak) => {
    const mesh = add(name, new THREE.CylinderGeometry(radius, radius, length, 40), mat, p); mesh.rotation.z = Math.PI / 2; return mesh
  }
  const shadow = add('indigo-contact-shadow', new THREE.PlaneGeometry(3.8, 2.35), new THREE.ShadowMaterial({ opacity: .12 }), [0, .002, .1]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('indigo-bundle-stool-top', [.66, .06, .54], [-1.03, .19, .89])
  for (const x of [-1.27, -.79]) for (const z of [.73, 1.05]) box('indigo-stool-leg', [.07, .16, .07], [x, .08, z], walnut)
  const profile = [[0, -.04], [.30, -.04], [.30, 0], [.47, .49], [.46, .53], [.41, .52], [.26, .08], [0, .08]]
  const basin = add('indigo-rinse-basin', new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), 64), ceramic, [-.78, .04, -.10])
  basin.userData.toonSurface = { outline: false }
  const water = add('indigo-rinse-water', new THREE.CylinderGeometry(.384, .384, .012, 56), material(0x749da3, .40), [-.78, .44, -.10]); water.castShadow = false
  rod('indigo-rinse-rest', .07, 1.42, [RINSED.x, RINSED.y, RINSED.z])
  for (const x of [-1.45, -.11]) {
    box('indigo-rinse-rest-foot', [.16, .07, .40], [x, .035, .49], walnut)
    box('indigo-rinse-rest-post', [.065, .75, .065], [x, .415, .49])
  }
  const rail = rod('indigo-drying-rail', .07, 1.58, [HUNG.x, HUNG.y, HUNG.z])
  for (const x of [.10, 1.58]) {
    box('indigo-drying-foot', [.26, .09, .80], [x, .045, -.06], walnut)
    box('indigo-drying-post', [.09, 1.90, .10], [x, .98, -.06])
    rod('indigo-rail-end-cap', .09, .055, [x, 1.90, -.06], walnut)
  }
  const bundle = new THREE.Group(); bundle.name = 'indigo-tied-cloth'; world.add(bundle)
  const bundleGeometry = new THREE.SphereGeometry(1, 40, 28), positions = bundleGeometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), fold = 1 + .055 * Math.cos(Math.atan2(z, x) * 10)
    positions.setXYZ(i, x * .26 * fold, y * .14, z * .23 * fold)
  }
  bundleGeometry.computeVertexNormals()
  const tiedBody = add('indigo-bundle-body', bundleGeometry, blue, [0, 0, 0], bundle)
  for (const angle of [-.34, .40]) {
    const tie = add('indigo-bundle-tie', new THREE.TorusGeometry(.15, .013, 8, 56), linen, [0, 0, 0], bundle)
    tie.scale.set(1.70, 1, 1); tie.rotation.y = angle; tie.rotation.x = .12
  }
  const knot = add('indigo-bundle-knot', new THREE.SphereGeometry(.045, 20, 14), linen, [.02, .142, .075], bundle); knot.scale.set(1.3, .65, 1)
  const cloth = new THREE.Group(); cloth.name = 'indigo-open-cloth'; world.add(cloth)
  const body = add('indigo-cloth-body', clothGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94, side: THREE.DoubleSide }), [0, 0, 0], cloth)
  body.userData.toonSurface = { outline: false }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { bundle.position.copy(BUNDLE_HOME); bundle.visible = at === 0; cloth.visible = at >= 1; cloth.position.copy(at >= 2 ? HUNG : RINSED); matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  addInteractionCue(tiedBody, { kind: 'drag', label: '握住扎布', priority: 3, enabled: enabled(0), destination: water, targetLabel: '漂洗盆' })
  addInteractionCue(body, { kind: 'drag', label: '握住蓝白布边', priority: 3, anchor: CLOTH_ANCHOR, enabled: enabled(1), destination: rail, targetLabel: '木晾杆' })
  addInteractionCue(body, { kind: 'tap', label: '轻点布面静看', priority: 3, anchor: CLOTH_ANCHOR, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? bundle : cloth
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => touch.hit(x, y, targets, { ignore: held })
  const placementReady = (x: number, y: number) => at < 2 && travel > 0
    // A higher grab on the tied knot can overlap the basin or its rest while
    // the cloth's contact anchor reaches the water. They are one destination
    // assembly; unrelated foreground objects still block the carried cloth.
    && !touch.occluded(x, y, at === 0 ? [water, basin, scene.getObjectByName('indigo-rinse-rest')!] : rail, { ignore: moving() })
    && placementHit(canvas, camera, at === 0 ? tiedBody : body, x, y, (px, py) => visibleHit(px, py, at === 0 ? water : rail, moving()), at === 0 ? [0, 0, 0] : CLOTH_ANCHOR)
  const reset = () => { dropFeedback.clear(); dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? bundle : body) },
    onStart(x, y) { dropFeedback.clear(); feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (at === 0 ? tiedBody : body).localToWorld(new THREE.Vector3(...(at === 0 ? [0,0,0] : CLOTH_ANCHOR)))); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .22, 2.4); matrices()
      dropFeedback.setReady(dragging && placementReady(x, y))
          if (dragging && at < 2 && placementReady(x, y) && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && placementReady(x, y)
        : at === 2 && travel < 12 - 1e-6 && Math.hypot(x - down.x, y - down.y) < 12 - 1e-6 && visibleHit(x, y, body)
      dropFeedback.clear(); dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    dropFeedback.clear()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.rinseAction : at === 1 ? COPY.hangAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.rinse : at === 1 ? COPY.hang : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settle() { if (!active() || !motion) return; at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync(); ctx.onProgress?.(at); if (!active()) return; feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' }) }
  function begin(arrived = false) { if (!active() || (pointer.isBusy() && !arrived) || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    // An accepted save and its checkpoint stay atomic across pause, but not disposal.
    if (disposed) return
    ctx.onProgress?.(3)
    if (!active()) return
    feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 })
    if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.20, 6.05 + portraitBoost(aspect, 9)); camera.lookAt(0, 1.0, .08); matrices() }
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
        if (motion.step === 0) bundle.position.lerpVectors(motion.from, water.position.clone().add(new THREE.Vector3(0, .10, 0)), t)
        else { cloth.position.lerpVectors(motion.from, HUNG, t); if (!reduced()) cloth.position.y += .10 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); dropFeedback.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
