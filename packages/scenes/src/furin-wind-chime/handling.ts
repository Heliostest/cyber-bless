import * as THREE from 'three'
import { createCloseInspection } from '../close-inspection'
import { createObjectPointer } from '../object-pointer'
import { addInteractionCue } from '../scene-localization'
import { insideCanvas } from '../touch-target'
import { setSafeText, type StepOverlay } from '../procedural-kit'

const COPY = {
  hang: '挂起风铃',
  hint: '握住风铃上方的悬绳，拖到木檐挂钩附近，松手挂稳。',
  ready: '已对准挂钩，松手挂稳。',
  moving: '正在挂稳风铃……',
  source: '提起风铃悬绳',
  target: '木檐挂钩',
}
type Options = {
  canvas: HTMLCanvasElement; scene: THREE.Scene; camera: THREE.PerspectiveCamera
  world: THREE.Group; actor: THREE.Group; ui: StepOverlay
  isActive(): boolean; isReducedMotion(): boolean; hit(x: number, y: number): boolean
  prepare(): boolean; safe(text: string): void; changed(): void; progress(n: number): void
}
/** Product handling prelude. Existing ringing/listening checkpoints begin at 2. */
export function createFurinHandling(options: Options) {
  const { canvas, scene, camera, world, actor, ui } = options
  Object.values(COPY).forEach(options.safe)
  let at = 0, disposed = false, focused = true, notifying = false, ready = false
  let motion: { from: THREE.Vector3; elapsed: number } | undefined
  const home = actor.position.clone(), loose = home.clone().add(new THREE.Vector3(-.62, -.36, .22))
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane()
  const offset = new THREE.Vector3(), intersection = new THREE.Vector3()
  const active = () => !disposed && focused && !notifying && options.isActive()
  const hook = new THREE.Group(); hook.name = 'furin-eave-hook'; hook.position.copy(home); world.add(hook)
  const brass = new THREE.MeshStandardMaterial({ color: 0xcfb071, roughness: .45, metalness: .5 })
  const hookRing = new THREE.Mesh(new THREE.TorusGeometry(.035, .007, 8, 24, Math.PI * 1.7), brass)
  hookRing.position.y = -.006; hook.add(hookRing)
  const loop = new THREE.Mesh(new THREE.TorusGeometry(.023, .005, 8, 24), brass)
  loop.name = 'furin-hanging-loop'; loop.position.y = -.015; actor.add(loop)
  const targetMat = new THREE.MeshBasicMaterial({ color: 0x80cdb9, transparent: true, opacity: .55, depthTest: false, depthWrite: false })
  const target = new THREE.Mesh(new THREE.TorusGeometry(.12, .008, 8, 40), targetMat)
  target.name = 'furin-hanging-target'; target.position.z = .04; hook.add(target)
  // A temporary product display rack supports the loose chime before pickup.
  const rack = new THREE.Group(); rack.name = 'furin-preparation-rack'; world.add(rack)
  const wood = new THREE.MeshStandardMaterial({ color: 0xc8a77a, roughness: .85 })
  for (const [size, position] of [
    [[.48, .08, .44], [loose.x - .22, .04, loose.z]],
    [[.045, loose.y, .045], [loose.x - .35, loose.y / 2, loose.z]],
    [[.4, .045, .065], [loose.x - .18, loose.y, loose.z]],
  ]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), wood)
    part.position.fromArray(position); rack.add(part)
  }
  actor.position.copy(loose)
  const notify = (n: number) => {
    notifying = true
    try { options.progress(n) } finally { notifying = false }
    if (!disposed) options.changed()
  }
  function resetDrag() {
    ready = false
    if (!motion && at < 2) actor.position.copy(loose)
    if (!disposed) options.changed()
  }
  function point(x: number, y: number) {
    const box = canvas.getBoundingClientRect()
    ndc.set((x - box.left) / box.width * 2 - 1, 1 - (y - box.top) / box.height * 2)
    camera.updateMatrixWorld(true); ray.setFromCamera(ndc, camera)
    return ray.ray.intersectPlane(plane, intersection)
  }
  function align(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !point(x, y)) { ready = false; return }
    actor.position.copy(intersection).add(offset)
    actor.position.x = THREE.MathUtils.clamp(actor.position.x, -1.2, 1)
    actor.position.y = THREE.MathUtils.clamp(actor.position.y, 1.3, 2.7)
    const source = actor.position.clone().project(camera), destination = home.clone().project(camera)
    const box = canvas.getBoundingClientRect()
    ready = insideCanvas(canvas, x, y) && Math.hypot((source.x - destination.x) * box.width / 2, (source.y - destination.y) * box.height / 2) <= 28
    options.changed()
  }
  function settle() {
    if (!active() || !motion) return
    actor.position.copy(home); motion = undefined; ready = false; at = 2; rack.visible = target.visible = false
    notify(2)
  }
  function hang() {
    if (!active() || at !== 1 || motion) return
    motion = { from: actor.position.clone(), elapsed: 0 }; ready = false
    if (options.isReducedMotion()) settle()
    else options.changed()
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: () => active() && at === 1 && !motion,
    canStart: options.hit,
    onStart(x, y) {
      if (!options.prepare() || !active()) { pointer.cancel(); return }
      ready = false
      camera.updateMatrixWorld(true)
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), actor.position)
      if (point(x, y)) offset.copy(actor.position).sub(intersection)
      else pointer.cancel()
    },
    onMove: align,
    onRelease(x, y) { align(x, y); if (ready) hang(); else resetDrag() },
    onCancel: resetDrag,
  })
  const inspection = createCloseInspection({ canvas, scene, camera, actor, ui, autoReturn: false,
    isActive: () => active() && at === 0, isReducedMotion: options.isReducedMotion,
    prepare: options.prepare, safe: options.safe, changed: () => {
      if (!disposed && at === 0 && inspection.canPlace()) { at = 1; notify(1) }
      else if (!disposed) options.changed()
    },
  })
  const removeCue = addInteractionCue(actor, { kind: 'drag', label: COPY.source, anchor: [0, -.15, 0], destination: hook,
    targetLabel: COPY.target, priority: 4, enabled: () => active() && at === 1 && !motion })
  const action = (event: MouseEvent) => {
    if (at !== 1) return
    event.stopImmediatePropagation()
    if (event.detail > 1 || !active() || pointer.isBusy() || motion || !options.prepare() || !active()) return
    hang()
  }
  ui.actionBtn.addEventListener('click', action)
  const blur = () => { focused = false; inspection.cancel(); pointer.cancel(); if (!motion) resetDrag() }
  const focus = () => { focused = true; if (!disposed) options.changed() }
  window.addEventListener('blur', blur); window.addEventListener('focus', focus)
  return {
    isHung: () => at >= 2 && !notifying,
    isInspecting: () => at === 0,
    start(progress: number) {
      at = Math.min(2, progress); actor.position.copy(at >= 2 ? home : loose)
      rack.visible = at < 2; inspection.decorate(at > 0); target.visible = at === 1
    },
    sync() {
      if (disposed) return
      target.visible = active() && at === 1 && !motion
      targetMat.color.setHex(ready ? 0xf2bb6d : 0x80cdb9)
      if (at === 0) inspection.decorate(false)
      else {
        inspection.decorate(true)
        if (at === 1) {
          ui.actionBtn.hidden = false; ui.actionBtn.disabled = !active() || !!motion
          ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
          ui.hitLayer.style.pointerEvents = active() && !motion ? 'auto' : 'none'
          setSafeText(ui.actionBtn, COPY.hang, options.safe)
          setSafeText(ui.hintEl, motion ? COPY.moving : ready ? COPY.ready : COPY.hint, options.safe)
        }
      }
      ui.renderDots(at, 5)
    },
    update(dt: number) {
      if (disposed) return
      if (!active()) { inspection.cancel(); pointer.cancel(); return }
      inspection.update(dt)
      if (motion && active()) {
        motion.elapsed += Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        const n = options.isReducedMotion() ? 1 : Math.min(1, motion.elapsed / .55), eased = n * n * (3 - 2 * n)
        actor.position.lerpVectors(motion.from, home, eased)
        if (n === 1) settle()
      }
    },
    cancel() { inspection.cancel(); pointer.cancel(); if (!motion && at < 2) resetDrag() },
    dispose() {
      if (disposed) return
      disposed = true; inspection.dispose(); pointer.dispose(); removeCue()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
    },
  }
}
