import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { setPlacementInspectionHelp } from '../placement-inspection'
import { placementHit } from '../placement-hit'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '珠星映光', assemble: '拿起木托上的最后一串玻璃珠，接到星臂露出的银珠处。',
  rotate: '自由转动珠星查看正反面，再轻点静看。', quiet: '轻点珠星静看，让这一刻停留。',
  moving: '细线相连，珠光轻转…', done: '留一束清亮的光。',
  assembleAction: '接上最后一串珠', quietAction: '轻点珠星静看',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const STAR_HOME = new THREE.Vector3(0, 1.80, .05), STRAND_HOME = new THREE.Vector3(.70, .424, .40)
const ARM_ROOT = new THREE.Vector3(.29, 0, 0), ARM_TIP = new THREE.Vector3(Math.cos(Math.PI / 6) * 1.08, .54, 0)
const JOIN = ARM_ROOT.clone().lerp(ARM_TIP, .5), ARM_ANGLE = Math.atan2(ARM_TIP.y - ARM_ROOT.y, ARM_TIP.x - ARM_ROOT.x)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original open six-point beadwork; no borrowed artisan ornament pattern. */
export function createCzechBeadStar(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, checkpoint: Checkpoint = 0
  let dragging = false, viewing = false, maxTravel = 0, previousX = 0, stopResize = () => {}
  let transition: { step: 0; time: number; from: THREE.Vector3; angle: number; turn: number } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.assembleAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'czech-bead-star', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3f3eb, ground: 0xbab8a9, key: 0xfff6e3, rim: 0xc9e4f0,
    keyPosition: [-3, 5, 4], keyIntensity: 2.6, rimIntensity: 1.1, ambientIntensity: .45, hemiIntensity: .95 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3.5, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'bead-workbench'; scene.add(world)
  const star = new THREE.Group(); star.name = 'bead-star-body'; world.add(star)
  const loose = new THREE.Group(); loose.name = 'bead-loose-strand'; world.add(loose)
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xdce8e8, roughness: .20, metalness: .64, clearcoat: .75, clearcoatRoughness: .12 })
  const blue = new THREE.MeshPhysicalMaterial({ color: 0x739daf, roughness: .24, metalness: .46, clearcoat: .8, clearcoatRoughness: .13 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8b779, roughness: .29, metalness: .63 })
  const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x858c86, roughness: .37, metalness: .74 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xbfa587, roughness: .78 })
  const woodEdge = new THREE.MeshStandardMaterial({ color: 0xa98d6e, roughness: .83 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: THREE.Vector3, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.copy(p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], material = wood) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.032, ...size.map(v => v / 3))), material, new THREE.Vector3(...p))
  box('bead-wood-base', [2.30, .22, .92], [0, .22, .02])
  box('bead-wood-foot', [2.13, .06, .80], [0, .08, .02], woodEdge)
  box('bead-wood-post', [.09, 2.88, .09], [-1.02, 1.77, -.27])
  box('bead-wood-top', [1.16, .09, .09], [-.485, 3.255, -.27])
  // A low groove gives the loose strand a tangible resting place on the wood.
  box('bead-strand-rest', [.93, .015, .16], [.68, .3375, .40], woodEdge)
  const wire = (name: string, from: THREE.Vector3, to: THREE.Vector3, parent: THREE.Object3D, radius = .007, material: THREE.Material = wireMaterial) => {
    const mesh = add(name, new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 8), material, from.clone().lerp(to, .5), parent)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
    mesh.userData.threadWire = true; mesh.userData.toonSurface = { outline: false, roughness: .37, metalness: .74 }; return mesh
  }
  // A closed thin shell around an open axial passage. The return profile runs
  // inside the outer wall, keeping both cut rims connected without end caps.
  const profile: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI; profile.push(new THREE.Vector2(.025 + .054 * Math.sin(t), -.072 * Math.cos(t))) }
  for (let i = 16; i >= 0; i--) { const t = i / 16 * Math.PI; profile.push(new THREE.Vector2(.020 + .049 * Math.sin(t), -.072 * Math.cos(t))) }
  profile.push(profile[0]!.clone())
  const beadGeometry = new THREE.LatheGeometry(profile, 20)
  const bead = (name: string, p: THREE.Vector3, axis: THREE.Vector3, material: THREE.Material, parent: THREE.Object3D, scale = 1) => {
    const mesh = add(name, beadGeometry, material, p, parent); mesh.scale.setScalar(scale)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize())
    mesh.userData.beadShell = true
    mesh.userData.toonSurface = { outline: false, roughness: material === blue ? .24 : .20, metalness: material === blue ? .46 : .64 }
    return mesh
  }
  const xAxis = new THREE.Vector3(1, 0, 0)
  const center = bead('bead-star-center', new THREE.Vector3(0, 0, .026), xAxis, blue, star, 1.5)
  const ringPoints = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(.29 * Math.cos(i * Math.PI / 3), .29 * Math.sin(i * Math.PI / 3), 0))
  let joint!: THREE.Mesh
  for (let i = 0; i < 6; i++) {
    const root = ringPoints[i]!, next = ringPoints[(i + 1) % 6]!, theta = (i + .5) * Math.PI / 3
    const tip = new THREE.Vector3(1.08 * Math.cos(theta), 1.08 * Math.sin(theta), 0)
    const joinBead = bead(i === 0 ? 'bead-star-arm-joint' : 'bead-inner-joint', root, xAxis, silver, star)
    if (i === 0) joint = joinBead
    bead(i === 0 ? 'bead-star-arm-tip' : 'bead-arm-tip', tip, tip.clone().normalize(), blue, star, .82)
    wire('bead-inner-wire', root, next, star)
    wire('bead-spoke-wire', new THREE.Vector3(), root, star)
    bead('bead-inner-silver', root.clone().multiplyScalar(.57), root.clone().normalize(), silver, star, .65)
    for (const [side, start] of [root, next].entries()) {
      if (i === 0 && side === 0) continue
      wire('bead-arm-wire', start, tip, star)
      const axis = tip.clone().sub(start).normalize()
      for (let j = 0; j < 4; j++) bead('bead-arm-shell', start.clone().lerp(tip, (j + .68) / 4.35), axis, j % 3 === 1 ? blue : silver, star)
    }
  }
  // The last side remains an actual independent strand until it is connected.
  const length = ARM_ROOT.distanceTo(ARM_TIP)
  wire('bead-strand-wire', new THREE.Vector3(-length / 2, 0, 0), new THREE.Vector3(length / 2, 0, 0), loose)
  let grip!: THREE.Mesh
  for (let i = 0; i < 4; i++) {
    const b = bead(i === 0 ? 'bead-strand-grip' : 'bead-strand-shell', new THREE.Vector3(length * ((i + .68) / 4.35 - .5), 0, 0), xAxis, i % 3 === 1 ? blue : silver, loose)
    if (i === 0) grip = b
  }
  // Top beadwork is joined by a slender wire loop to the support hook.
  const topLoop = add('bead-hanging-loop', new THREE.TorusGeometry(.083, .008, 8, 32), gold, new THREE.Vector3(0, 1.22, 0), star)
  topLoop.userData.toonSurface = { outline: false, roughness: .29, metalness: .63 }
  wire('bead-hanging-yoke-left', new THREE.Vector3(-.29 / 2, .29 * Math.sin(Math.PI / 3), 0), new THREE.Vector3(0, 1.14, 0), star, .005)
  wire('bead-hanging-yoke-right', new THREE.Vector3(.29 / 2, .29 * Math.sin(Math.PI / 3), 0), new THREE.Vector3(0, 1.14, 0), star, .005)
  wire('bead-support-hook', new THREE.Vector3(0, 3.255, -.27), new THREE.Vector3(0, 3.10, .05), world, .013, gold)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    star.position.copy(STAR_HOME); star.rotation.set(0, 0, 0)
    if (checkpoint === 0) { world.add(loose); loose.position.copy(STRAND_HOME); loose.rotation.set(0, 0, 0) }
    else { star.add(loose); loose.position.copy(JOIN); loose.rotation.set(0, 0, ARM_ANGLE) }
    matrices()
  }
  const enabled = (step: number) => () => inputActive() && !transition && checkpoint === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', label: '拿起最后一串珠', priority: 3, enabled: enabled(0), destination: joint, targetLabel: '接到这颗银珠' }),
    addInteractionCue(center, { kind: 'rotate', label: COPY.rotate, priority: 3, enabled: () => inputActive() && !transition && checkpoint > 0 && checkpoint < 3 }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const belongsTo = (object: THREE.Object3D | undefined, parent: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === parent) return true; return false }
  const visibleHit = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh || held && belongsTo(o, held)) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
    })
    return belongsTo(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object, target)
  }
  const reset = () => {
    dragging = viewing = false; maxTravel = 0
    if (transition || disposed) return
    restore(); sync()
  }
  const turnStar = (pixels: number) => {
    if (checkpoint === 0 || checkpoint === 3 || !Number.isFinite(pixels)) return
    // Yaw around the vertical hanging axis: the loop center stays on its hook.
    star.rotation.y += pixels * .010
    star.rotation.x = star.rotation.z = 0
    matrices()
  }
  // A reentrant pointermove must not reach the controller's inactive-cancel
  // path while prepareFeedback is still inside the original pointerdown.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => ui.hitLayer.addEventListener(type, guardCallbackInput, true))
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return visibleHit(x, y, checkpoint === 0 ? loose : star) },
    onStart(x, y) {
      withHostCallbacks(() => feedback.prepare()); if (!inputActive()) { pointer.cancel(); return }
      down.set(x, y); previousX = x; maxTravel = 0; viewing = false; dragging = checkpoint === 0
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), grip.getWorldPosition(new THREE.Vector3()))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(loose.position).sub(point)
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x-down.x, y-down.y))
      if (checkpoint === 0 && dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        loose.position.copy(point).add(offset); loose.position.x = THREE.MathUtils.clamp(loose.position.x, -1.20, 1.20); loose.position.y = THREE.MathUtils.clamp(loose.position.y, .424, 2.85)
      } else if (checkpoint > 0) { viewing = true; turnStar(x-previousX) }
      previousX = x; matrices()
      if (dragging && checkpoint === 0 && maxTravel > 0 && placementHit(canvas, camera, grip, x, y, (px, py) => visibleHit(px, py, joint, loose)) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      matrices()
      if (checkpoint === 0) {
        const valid = dragging && maxTravel > 0 && placementHit(canvas, camera, grip, x, y, (px, py) => visibleHit(px, py, joint, loose))
        dragging = false; if (valid) advance(); else reset()
      } else if (!viewing && maxTravel < 12 && visibleHit(x, y, star)) advance()
    },
    onRotate(dx) { if (checkpoint > 0) { viewing = true; turnStar(dx) } },
    onRebase(x, y) {
      down.set(x,y); previousX=x; maxTravel=0
      if (checkpoint === 0) {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), grip.getWorldPosition(new THREE.Vector3()))
        if (ray.aim(x,y).ray.intersectPlane(plane,point)) offset.copy(loose.position).sub(point)
      }
    },
    onInspectEnd() { if (checkpoint === 0) reset(); else { dragging = false; matrices() } },
    onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(checkpoint === 0 ? 0 : checkpoint === 3 ? 2 : 1, 2); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !inputActive() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !transition && checkpoint < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.assembleAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.assemble : checkpoint < 3 ? COPY.rotate : COPY.done, safe)
    setPlacementInspectionHelp(ui.hintEl,!transition&&checkpoint>0&&checkpoint<3)
  }
  // Keep acceptance atomic across synchronous host input, update, and disposal.
  function withHostCallbacks(work: () => void) {
    notifying = true; sync()
    try { work() } finally { notifying = false; if (!disposed) sync() }
  }
  function settle() {
    if (!inputActive() || !transition) return
    checkpoint = 2; transition = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(checkpoint)
      if (active()) feedback.impact({ freqs: [523.25, 783.99], duration: .14, gain: .009, type: 'triangle' })
    })
  }
  function advance(arrived = false) {
    if (!inputActive() || (pointer.isBusy() && !arrived) || transition || checkpoint === 3) return
    if (checkpoint > 0) {
      const turn = star.rotation.y; checkpoint = 3; restore(); star.rotation.y = turn; matrices()
      withHostCallbacks(() => {
        ctx.onProgress?.(3); if (!active()) return
        feedback.impact({ freqs: [523.25, 659.25], duration: .22, gain: .008 })
        if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
      }); return
    }
    transition = { step: 0, time: 0, from: loose.position.clone(), angle: loose.rotation.z, turn: star.rotation.y }; sync(); if (reduced()) settle()
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || transition || checkpoint === 3) return; withHostCallbacks(() => feedback.prepare()); advance() }
  const inspectKey = (event: KeyboardEvent) => {
    if (!inputActive() || transition || pointer.isBusy() || checkpoint === 0 || checkpoint === 3 || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') { event.preventDefault(); reset(); return }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault(); withHostCallbacks(() => feedback.prepare())
    if (inputActive()) turnStar(event.key === 'ArrowLeft' ? -20 : 20)
  }
  const blur = () => { focused = false; pointer.cancel(); if (!transition) reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { pointer.cancel(); if (!transition) reset(); const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 7); camera.position.set(0, 2.72 + boost * .2, 6.45 + boost); camera.lookAt(0, 1.68, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); ui.actionBtn.addEventListener('keydown', inspectKey); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed || notifying) return
      if (!active()) { pointer.cancel(); if (!transition) reset(); if (!suspended) { sync(); suspended = true } return }
      if (suspended) { suspended = false; sync() }

      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        transition.time = reduced() ? 1 : Math.min(1, transition.time + delta / .7); const t = ease(transition.time)
        if (transition.step === 0) {
          loose.position.lerpVectors(transition.from, star.localToWorld(JOIN.clone()), t); loose.rotation.z = THREE.MathUtils.lerp(transition.angle, ARM_ANGLE, t)
          if (!reduced()) loose.position.z += Math.sin(t * Math.PI) * .09
        }
        if (transition.time === 1) settle()
      }
      if (!active()) return
      matrices(); style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); ui.actionBtn.removeEventListener('keydown', inspectKey)
      guardedEvents.forEach(type => ui.hitLayer.removeEventListener(type, guardCallbackInput, true))
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world)
      Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
