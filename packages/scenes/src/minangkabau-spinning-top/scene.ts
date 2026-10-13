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
  title: '归乡轻转', pull: '把木拉珠拖到木板右侧的浅色圆点，松开棉绳，让陀螺轻转。',
  settle: '轻点陀螺顶端的木帽，让这一程慢慢停稳。', quiet: '轻点木帽静看，或写一句归乡心意；只有点「写好了」才会保存。',
  returning: '轻点木帽，回看这段旅途与家乡。', done: '带着问候出发，也为归乡留一份心意。（手势练习结束）', moving: '让木陀螺轻轻转动、停稳…',
  pullAction: '拉绳轻转', settleAction: '轻点木帽停稳', quietAction: '轻点木帽静看',
  context: '当代原创非宗教练习。借木陀螺寄托出发与归乡，致意米南加保大屋的家族与社区。',
} as const
const HOME = new THREE.Vector3(.38, .34, .52), TARGET = new THREE.Vector3(1.08, .34, .52)
const AXLE = new THREE.Vector3(-.42, .21, -.09)
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1; time: number; from: THREE.Vector3 }
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original contemporary departure/return tribute, not a reproduction of an adat ritual. */
export function createMinangkabauSpinningTop(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let checkpoint: Checkpoint = 0, started = false, disposed = false, focused = true, inactiveRendered = false
  let motion: Motion | null = null, dragging = false, maxTravel = 0, spinTime = 0
  let writer: GestureHandle | null = null, stopResize = () => {}
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false, feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.pullAction }, safe)
  const context = document.createElement('div'); context.className = 'top-cultural-context'
  context.style.cssText = 'position:absolute;top:4px;left:18px;right:18px;max-width:360px;margin:auto;padding:7px 10px;border-radius:12px;background:rgba(255,247,230,.92);color:#665749;font-size:11px;line-height:1.5;pointer-events:none;'
  setSafeText(context, COPY.context, safe); overlay.append(context)
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'minangkabau-spinning-top', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffedda, ground: 0xb4a193, key: 0xffe6c7, rim: 0xe5ddd3, keyPosition: [-3, 5, 3], keyIntensity: 1.15, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'homeward-top-workshop'; scene.add(world)
  const wood = new THREE.MeshStandardMaterial({ color: 0xc3a074, roughness: .76 })
  const walnut = new THREE.MeshStandardMaterial({ color: 0x8b6445, roughness: .8 })
  const pale = new THREE.MeshStandardMaterial({ color: 0xe1c69e, roughness: .8 })
  const cotton = new THREE.MeshStandardMaterial({ color: 0xeee2bd, roughness: 1 })
  const sage = new THREE.MeshStandardMaterial({ color: 0x819d8d, roughness: .84 })
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.name = name
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const oval = (position: [number, number, number], scale: [number, number, number], material: THREE.Material, name = '', parent = world) => {
    const mesh = add(new THREE.SphereGeometry(1, 32, 20), material, position, name, parent); mesh.scale.set(...scale); return mesh
  }
  const board = add(new RoundedBoxGeometry(2.9, .14, 1.62, 5, .065), wood, [0, .14, 0], 'top-board')
  board.userData.toonSurface = { outline: false }
  for (const x of [-1.05, 1.05]) add(new RoundedBoxGeometry(.23, .09, 1.2, 3, .035), walnut, [x, .045, 0], 'top-board-foot')
  for (const x of [-1.2, -.82, -.05, .7]) {
    const grain = add(new RoundedBoxGeometry(.013, .005, 1.27, 2, .002), pale, [x, .213, -.02], 'top-board-grain')
    grain.userData.toonSurface = { outline: false }
  }
  // The axial tip touches the board; all spinning geometry rotates together around that contact point.
  const rotor = new THREE.Group(); rotor.name = 'top-rotor'; rotor.position.copy(AXLE); world.add(rotor)
  const profile = [[0, 0], [.025, 0], [.055, .035], [.13, .13], [.29, .27], [.45, .40], [.52, .53], [.53, .62], [.49, .71], [.38, .80], [.24, .845], [.12, .85], [0, .85]]
  add(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64), wood, [0, 0, 0], 'top-rounded-body', rotor)
  for (const [y, radius, material] of [[.53, .519, walnut], [.67, .513, pale], [.755, .435, sage]] as const) {
    const ring = add(new THREE.TorusGeometry(radius, .014, 8, 64), material, [0, y, 0], 'top-inlay-ring', rotor); ring.rotation.x = Math.PI / 2; ring.userData.toonSurface = { outline: false }
  }
  add(new THREE.CylinderGeometry(.08, .09, .31, 32), walnut, [0, .955, 0], 'top-spindle', rotor)
  const cap = oval([0, 1.14, 0], [.17, .095, .17], pale, 'top-cap', rotor)
  const coils = new THREE.Group(); coils.name = 'top-wound-cotton'; coils.position.copy(AXLE); world.add(coils)
  for (let i = 0; i < 6; i++) {
    const coil = add(new THREE.TorusGeometry(.101, .022, 8, 40), cotton, [0, .853 + .033 * i, 0], `top-cotton-coil-${i}`, coils); coil.rotation.x = Math.PI / 2
  }
  const bead = oval(HOME.toArray() as [number, number, number], [.13, .13, .13], walnut, 'top-pull-bead')
  const anchor = oval(TARGET.toArray() as [number, number, number], [.10, .09, .10], pale, 'top-pull-anchor')
  add(new THREE.CylinderGeometry(.077, .087, .1, 24), pale, [TARGET.x, .255, TARGET.z], 'top-anchor-foot')
  // The cord remains a physical opaque tube; its end is rebuilt from the bead position, not a screen-space line.
  const cordGeometry = () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    ...(checkpoint === 0 ? [new THREE.Vector3(AXLE.x + .10, 1.075, AXLE.z), new THREE.Vector3(-.06, .72, .25)] : [new THREE.Vector3(-.04, .235, .45), new THREE.Vector3(.21, .235, .65), new THREE.Vector3(.46, .235, .36), new THREE.Vector3(.74, .235, .41)]),
    new THREE.Vector3(bead.position.x - .19, .29, bead.position.z), bead.position.clone(),
  ]), 32, .021, 8, false)
  const cord = add(cordGeometry(), cotton, [0, 0, 0], 'top-loose-cord')
  const updateCord = () => { const old = cord.geometry; cord.geometry = cordGeometry(); old.dispose() }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restorePose = () => {
    bead.position.copy(checkpoint === 0 ? HOME : TARGET); bead.visible = true
    cord.visible = true; coils.visible = checkpoint === 0
    coils.children.forEach(child => { child.visible = true }); anchor.visible = checkpoint === 0
    rotor.rotation.x = rotor.rotation.z = 0
    if (checkpoint === 0) rotor.rotation.y = 0
    updateCord(); matrices()
  }
  const cueActive = (at: number) => () => active() && !motion && checkpoint === at
  addInteractionCue(bead, { kind: 'drag', label: '拉动木珠松开棉绳', priority: 3, enabled: cueActive(0), destination: anchor, targetLabel: '木板浅色圆点' })
  addInteractionCue(cap, { kind: 'tap', label: '轻点木帽停稳', priority: 3, enabled: cueActive(1) })
  addInteractionCue(cap, { kind: 'tap', label: '轻点木帽静看', priority: 3, enabled: cueActive(2) })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOME.y)
  const point = new THREE.Vector3(), offset = new THREE.Vector3(), down = new THREE.Vector2()
  // A target must be the nearest visible opaque surface. Only the held bead
  // and its moving cord are excluded when testing the board drop destination.
  const visibleHit = (x: number, y: number, target: THREE.Object3D, dropping = false) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || (dropping && (object === bead || object === cord))) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (!materials.some(material => material.visible && !material.transparent && material.opacity > 0)) return
      meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object === target
  }
  const resetDrag = () => { dragging = false; maxTravel = 0; if (!motion) restorePose() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || checkpoint === 3) return false; matrices(); return visibleHit(x, y, checkpoint === 0 ? bead : cap) },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint === 0; feedback.prepare()
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(bead.position).sub(point)
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        bead.position.copy(point).add(offset); bead.position.x = THREE.MathUtils.clamp(bead.position.x, -.03, 1.27)
        bead.position.z = THREE.MathUtils.clamp(bead.position.z, .3, .67); updateCord(); matrices()
      }
    },
    onRelease(x, y) {
      const moved = maxTravel; maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint === 0 ? dragging && moved > 8 && visibleHit(x, y, anchor, true) : maxTravel < 12 && visibleHit(x, y, cap)
      dragging = false
      if (!valid) { resetDrag(); return }
      if (checkpoint < 2) begin(); else finish()
    }, onCancel: resetDrag,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3
    ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3; ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    wishSlot.hidden = returning || checkpoint !== 2; writer?.setEnabled(active() && checkpoint === 2 && !returning && !motion)
    ui.hitLayer.style.pointerEvents = checkpoint < 3 && !motion ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.pullAction : checkpoint === 1 ? COPY.settleAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : checkpoint === 0 ? COPY.pull : checkpoint === 1 ? COPY.settle : checkpoint === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settled() {
    if (!active() || !motion) return
    checkpoint = (motion.step + 1) as Checkpoint; motion = null; restorePose(); sync(); ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .015, type: 'triangle' })
  }
  function begin() {
    if (!active() || pointer.isBusy() || motion || checkpoint >= 2) return
    motion = { step: checkpoint as 0 | 1, time: 0, from: bead.position.clone() }; sync()
    if (reduced()) settled()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || checkpoint !== 2) return
    const line = text.trim(); checkpoint = 3; restorePose(); sync()
    if (line && !returning) ctx.saveWish?.(line)
    ctx.onProgress?.(3); feedback.impact({ freqs: [392, 493.88], duration: .26, gain: .015 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || checkpoint === 3) return; feedback.prepare(); if (checkpoint < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 3.3, 5.4 + portraitBoost(aspect, 9)); camera.lookAt(0, .55, 0); matrices()
  }
  restorePose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restorePose(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) {
        writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: text => { if (!active() || pointer.isBusy() || motion || checkpoint !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } })
        writer.mount(wishSlot, {})
      }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }; return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(checkpoint === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .75)
        const t = ease(motion.time)
        if (motion.step === 0) {
          bead.position.lerpVectors(motion.from, TARGET, t); updateCord(); rotor.rotation.y += reduced() ? 0 : delta * 10
          coils.children.forEach((child, i) => { child.visible = i / 6 >= t }); cord.visible = t < .86
        } else { rotor.rotation.y += reduced() ? 0 : delta * 8 * (1 - t); rotor.rotation.x *= 1 - t; rotor.rotation.z *= 1 - t }
        if (motion.time === 1) settled()
      } else if (checkpoint === 1 && !reduced()) {
        spinTime += delta; rotor.rotation.y += delta * 8
        rotor.rotation.x = Math.sin(spinTime * 3) * .012; rotor.rotation.z = Math.cos(spinTime * 3) * .012
      } else { rotor.rotation.x = rotor.rotation.z = 0 }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
