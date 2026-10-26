import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '铜碗拾暖', polish: '把桌前的软布移到铜碗外壁，轻轻擦亮一小片暖色。',
  place: '握住铜碗的外壁或卷边，移到右侧的软毡托座。',
  rest: '轻点铜碗静看，让目光沿着碗口与浅浅的锤纹停一会儿。',
  moving: '软布与铜碗轻轻就位…', done: '铜色温润，留一刻欣赏手作的耐心。',
} as const
const HOME = new THREE.Vector3(-.63, .745, -.12), REST = new THREE.Vector3(.94, .87, -.12)
const PAD_HOME = new THREE.Vector3(-1.25, .74, .66), BOWL_ANCHOR: [number, number, number] = [0, .43, .705]
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original basin, with one closed wall cross-section and tiny integral hammer depressions. */
function bowlGeometry() {
  const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(.15, 0), new THREE.Vector2(.285, 0)]
  for (let i = 1; i <= 36; i++) { const t = i / 36; profile.push(new THREE.Vector2(.285 + .493 * t, .56 * t ** 1.65)) }
  profile.push(new THREE.Vector2(.744, .56))
  for (let i = 35; i >= 0; i--) { const t = i / 36; profile.push(new THREE.Vector2(.265 + .479 * t, .075 + .485 * t ** 1.65)) }
  profile.push(new THREE.Vector2(.15, .075), new THREE.Vector2(0, .075))
  const geometry = new THREE.LatheGeometry(profile, 160), positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), radius = Math.hypot(x, z)
    if (radius < .32 || y < .035 || y > .53) continue
    const row = y / .077, phase = Math.atan2(x, z) / (2 * Math.PI) * 40 + (Math.floor(row) % 2) * .5
    const u = phase - Math.floor(phase) - .5, v = row - Math.floor(row) - .5
    const dent = -.0032 * Math.exp(-(u * u + v * v) * 14) * Math.sin((y - .035) / .495 * Math.PI)
    positions.setXYZ(i, x * (1 + dent / radius), y, z * (1 + dent / radius))
  }
  geometry.computeVertexNormals()
  return geometry
}

/** Public copper craft appreciation, with no ritual or wish-writing claim. */
export function createPurepechaCopperBowl(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '轻拭铜碗' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 40)

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'purepecha-copper-bowl', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff2de, ground: 0xb4b29c, key: 0xffe9ca, rim: 0xe7eef0, keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.4, right: 2.4, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .015
  const world = new THREE.Group(); world.name = 'copper-workbench'; scene.add(world)
  const material = (color: number, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const oak = material(0xb4946c), walnut = material(0x785943), felt = material(0x536b60), linen = material(0xe6d7b9), blue = material(0x789697), thread = material(0xc1d3c6)
  const copper = material(0xc78055, .39, .60), lipCopper = material(0xdb9968, .30, .64)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.025, h / 3, d / 3)), mat, xyz, name, parent)
  const disc = (r: number, h: number, mat: THREE.Material, xyz: [number, number, number], name: string) => add(new THREE.CylinderGeometry(r, r, h, 72), mat, xyz, name)
  addCraftTable(world, { name: 'copper-table', topName: 'copper-table', width: 3.6, depth: 1.92, surfaceY: .72, thickness: .12, center: [0,0], support: 'trestle', finish: 'chestnut' })
  const shadow = add(new THREE.PlaneGeometry(4.4, 2.7), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0], 'copper-ground-shadow'); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  disc(.60, .025, linen, [-.63, .7325, -.12], 'copper-work-felt')
  disc(.65, .12, walnut, [.94, .78, -.12], 'copper-display-wood')
  const cradle = disc(.60, .03, felt, [.94, .855, -.12], 'copper-display-felt')
  box(.53, .02, .43, linen, [-1.25, .73, .66], 'copper-pad-rest')

  const bowl = new THREE.Group(); bowl.name = 'copper-bowl'; world.add(bowl)
  const shell = add(bowlGeometry(), copper, [0, 0, 0], 'copper-bowl-shell', bowl)
  shell.userData.toonSurface = { metalness: .60, roughness: .39 }
  const lip = add(new THREE.TorusGeometry(.764, .027, 16, 160), lipCopper, [0, .553, 0], 'copper-rolled-lip', bowl); lip.rotation.x = Math.PI / 2
  lip.userData.toonSurface = { metalness: .64, roughness: .30, outline: false }
  const pad = new THREE.Group(); pad.name = 'copper-pad-group'; world.add(pad)
  const padBody = box(.40, .09, .30, blue, [0, .045, 0], 'copper-polishing-pad', pad)
  // Stitched edging and a folded corner are physically part of the same soft pad.
  for (const x of [-.155, .155]) for (let z = -.105; z < .11; z += .035) {
    const stitch = box(.008, .003, .019, thread, [x, .089, z], 'copper-pad-stitch', pad); stitch.userData.toonSurface = { outline: false }
  }
  const fold = box(.08, .012, .27, blue, [.17, .091, 0], 'copper-pad-fold', pad); fold.rotation.z = -.14; fold.userData.toonSurface = { outline: false }
  // Quiet bench details: timber grain sits inside the tabletop surface.
  for (const z of [-.74, .36]) {
    const grain = box(2.95, .002, .009, walnut, [0, .7205, z], 'copper-table-grain'); grain.userData.toonSurface = { outline: false }
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    bowl.position.copy(checkpoint >= 2 ? REST : HOME); bowl.rotation.set(0, 0, 0)
    pad.position.copy(PAD_HOME); pad.rotation.set(0, 0, 0)
    copper.color.setHex(checkpoint >= 1 ? 0xce885b : 0xc78055)
    matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(padBody, { kind: 'drag', label: '轻拭铜碗', priority: 3, enabled: enabled(0), destination: () => bowl.localToWorld(new THREE.Vector3(...BOWL_ANCHOR)), targetLabel: '铜碗外壁' })
  addInteractionCue(shell, { kind: 'drag', label: '移到软毡托座', anchor: BOWL_ANCHOR, priority: 3, enabled: enabled(1), destination: () => projectedGuide(cradle.getWorldPosition(new THREE.Vector3()),shell.localToWorld(new THREE.Vector3(...BOWL_ANCHOR)),bowl.getWorldPosition(new THREE.Vector3())), targetLabel: '右侧软毡' })
  addInteractionCue(shell, { kind: 'tap', label: '轻点铜碗静看', anchor: BOWL_ANCHOR, priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? pad : bowl
  const belongsTo = (object: THREE.Object3D, parent: THREE.Object3D) => { for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === parent) return true; return false }
  const touchTarget = createTouchTarget(canvas, camera, scene)
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => touchTarget.hit(x, y, target, { ignore: held })
  const automaticReady = (x: number, y: number) => {
    if (checkpoint >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? padBody : bowl, [0,0,0])
    return !!contact && !touchTarget.occluded(x,y,checkpoint === 0 ? shell : cradle,{ignore:moving()}) && touchTarget.hit(contact.x, contact.y, checkpoint === 0 ? shell : cradle, { ignore: moving() })
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return hitsVisible(x, y, checkpoint === 0 ? pad : bowl) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), object.position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices(); if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && automaticReady(x, y) : maxTravel < 12 && hitsVisible(x, y, bowl)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '轻拭铜碗' : checkpoint === 1 ? '移到软毡托座' : '轻点铜碗静看', safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.polish : checkpoint === 1 ? COPY.place : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  function settle() { if (!active() || !transition) return; checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); if (!active()) return; feedback.impact() }
  function advance(placed = false) {
    if (!active() || (pointer.isBusy() && !placed) || transition || checkpoint === 3) return
    if (checkpoint === 2) {
      checkpoint = 3; restore(); sync(); ctx.onProgress?.(3)
      if (!active()) return
      feedback.impact()
      if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
      return
    }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 7); camera.position.set(0, 3.2 + boost * .2, 6.3 + boost); camera.lookAt(0, 1.22, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .85)
        const t = transition.time
        if (transition.step === 0) {
          const contact = bowl.localToWorld(new THREE.Vector3(0, .43, .708))
          if (t < .30) pad.position.lerpVectors(transition.from, contact, ease(t / .30))
          else if (t < .70) { pad.position.copy(contact); pad.position.x += Math.sin((t - .30) / .40 * Math.PI * 2) * .09 }
          else pad.position.lerpVectors(contact, PAD_HOME, ease((t - .70) / .30))
          pad.rotation.x = t < .30 ? 2.075 * ease(t / .30) : t < .70 ? 2.075 : 2.075 * (1 - ease((t - .70) / .30))
        } else { const e = ease(t); bowl.position.lerpVectors(transition.from, REST, e); if (!ctx.isReducedMotion?.()) bowl.position.y += Math.sin(e * Math.PI) * .17 }
        if (t === 1) settle()
      }
      if (active()) style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
