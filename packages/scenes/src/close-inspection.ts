import * as THREE from 'three'
import { createObjectPointer } from './object-pointer'
import { addInteractionCue, bindSceneAttribute } from './scene-localization'
import { setSafeText, type StepOverlay } from './procedural-kit'
import { insideCanvas } from './touch-target'

const COPY = {
  pickup: '拿近看看',
  continue: '继续安放',
  ready: '拿起物品，靠近看看它的细节。',
  approaching: '正在拿近……',
  viewing: '左右拖动转看，准备好后继续安放。',
  returning: '正在回到安放视角……',
  pickupHelp: '点按物品或辅助按钮拿近查看。',
}
type Phase = 'ready' | 'approaching' | 'viewing' | 'returning' | 'placement'
type Options = {
  canvas: HTMLCanvasElement
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  actor: THREE.Object3D
  ui: StepOverlay
  isActive(): boolean
  isReducedMotion(): boolean
  prepare(): boolean
  safe(text: string): void
  changed(): void
  /** Returning on a timer is opt-in; viewers choose when to continue by default. */
  autoReturn?: boolean
}
const ease = (n: number) => n * n * (3 - 2 * n)
const belongs = (object: THREE.Object3D, root: THREE.Object3D) => {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === root) return true
  return false
}

/** A local product viewing stage. Storage checkpoints and final placement stay
 * owned by the scene; inspecting never reports progress or ritual completion. */
export function createCloseInspection(options: Options) {
  const { canvas, scene, camera, actor, ui } = options
  Object.values(COPY).forEach(options.safe)
  let phase: Phase = 'ready', completed = false, disposed = false, elapsed = 0, handoffPending = false
  let manual = false, yaw = 0, elevation = .55, radius = 1, lastX = 0, lastY = 0
  let snapshot: {
    actorPosition: THREE.Vector3
    actorQuaternion: THREE.Quaternion
    cameraPosition: THREE.Vector3
    cameraQuaternion: THREE.Quaternion
    cameraUp: THREE.Vector3
    fov: number
    zoom: number
    visibility: { object: THREE.Object3D; visible: boolean }[]
  } | undefined
  const focus = new THREE.Vector3(), raisedPosition = new THREE.Vector3(), homeFocus = new THREE.Vector3()
  const homeWorld = new THREE.Vector3(), cameraGoal = new THREE.Vector3(), cameraRotation = new THREE.Quaternion()
  const bbox = new THREE.Box3(), sphere = new THREE.Sphere(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const viewLight = new THREE.PointLight(0xfff6ec, .25, 0, 0)
  viewLight.name = 'close-inspection-fill'; viewLight.visible = false; scene.add(viewLight)
  const showing = () => phase === 'approaching' || phase === 'viewing' || phase === 'returning'
  const interactive = () => !disposed && !completed && options.isActive()
  const notify = () => { if (!disposed) options.changed() }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const setWorldPosition = (position: THREE.Vector3) => {
    actor.position.copy(actor.parent ? actor.parent.worldToLocal(position.clone()) : position)
    actor.updateWorldMatrix(true, true)
  }
  function orbit() {
    cameraGoal.set(Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation)).multiplyScalar(radius).add(focus)
    camera.position.copy(camera.parent ? camera.parent.worldToLocal(cameraGoal.clone()) : cameraGoal)
    camera.up.set(0, 1, 0); camera.lookAt(focus); camera.updateMatrixWorld(true)
    viewLight.position.copy(camera.getWorldPosition(new THREE.Vector3()))
  }
  function restore() {
    if (!snapshot) return
    actor.position.copy(snapshot.actorPosition); actor.quaternion.copy(snapshot.actorQuaternion)
    camera.position.copy(snapshot.cameraPosition); camera.quaternion.copy(snapshot.cameraQuaternion); camera.up.copy(snapshot.cameraUp)
    camera.fov = snapshot.fov; camera.zoom = snapshot.zoom; camera.updateProjectionMatrix()
    snapshot.visibility.forEach(({ object, visible }) => { object.visible = visible })
    viewLight.visible = false
    matrices(); snapshot = undefined
  }
  function cancel() {
    const wasShowing = showing()
    if (wasShowing) { restore(); phase = 'ready'; elapsed = 0; manual = false }
    // A pickup can already own a touch while the viewing stage is still ready.
    pointer.cancel()
    if (wasShowing) notify()
  }
  function finishReturn() {
    restore(); phase = 'placement'; elapsed = 0; handoffPending = true; notify()
  }
  function leave() {
    if (!interactive() || phase !== 'viewing' || pointer.isBusy()) return
    phase = 'returning'; elapsed = 0
    cameraGoal.copy(camera.position); cameraRotation.copy(camera.quaternion)
    if (options.isReducedMotion()) finishReturn()
    else notify()
  }
  function begin() {
    if (!interactive() || phase !== 'ready' || !options.prepare() || !interactive()) return
    matrices()
    bbox.setFromObject(actor, true)
    if (bbox.isEmpty()) return
    snapshot = {
      actorPosition: actor.position.clone(), actorQuaternion: actor.quaternion.clone(),
      cameraPosition: camera.position.clone(), cameraQuaternion: camera.quaternion.clone(), cameraUp: camera.up.clone(),
      fov: camera.fov, zoom: camera.zoom, visibility: [],
    }
    bbox.getCenter(homeFocus); actor.getWorldPosition(homeWorld)
    const lift = THREE.MathUtils.clamp(bbox.max.y - bbox.min.y, .3, 1.5) * .4
    raisedPosition.copy(homeWorld).add(new THREE.Vector3(0, lift, 0)); focus.copy(homeFocus).add(new THREE.Vector3(0, lift, 0))
    bbox.getBoundingSphere(sphere)
    const vertical = THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2
    const limiting = Math.atan(Math.tan(vertical) * Math.min(1, camera.aspect) * .85)
    radius = Math.max(.35, sphere.radius / Math.sin(limiting))
    const direction = camera.getWorldPosition(new THREE.Vector3()).sub(homeFocus).normalize()
    yaw = Math.atan2(direction.x, direction.z)
    elevation = THREE.MathUtils.clamp(Math.asin(direction.y), .25, 1.1)
    // Keep light sources and actor ancestors. Hide only surrounding renderables,
    // preserving pre-existing hidden objects and shared material identities.
    scene.traverse(object => {
      const drawable = object as THREE.Object3D & { isMesh?: boolean; isLine?: boolean; isSprite?: boolean }
      if ((drawable.isMesh || drawable.isLine || drawable.isSprite) && !belongs(object, actor) && !belongs(actor, object)) {
        snapshot!.visibility.push({ object, visible: object.visible }); object.visible = false
      }
    })
    phase = 'approaching'; elapsed = 0; manual = false
    viewLight.intensity = scene.backgroundIntensity < .25 ? 3.2 : .25; viewLight.visible = true
    if (options.isReducedMotion()) { setWorldPosition(raisedPosition); orbit(); phase = 'viewing' }
    notify()
  }
  function hit(x: number, y: number) {
    if (!insideCanvas(canvas, x, y) || !Number.isFinite(x) || !Number.isFinite(y)) return false
    matrices()
    const rect = canvas.getBoundingClientRect(), meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(material => material.visible && (belongs(object, actor) || !material.transparent || material.opacity >= .5))) meshes.push(object)
    })
    ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2)
    ray.setFromCamera(ndc, camera)
    const first = ray.intersectObjects(meshes, false)[0]
    return !!first && belongs(first.object, actor)
  }
  function turn(dx: number, dy: number) {
    if (!interactive() || phase !== 'viewing' || !Number.isFinite(dx) || !Number.isFinite(dy)) return
    // Orbiting the camera needs the opposite horizontal turn to rotating the
    // asset: its visible surface should travel with the finger on screen.
    manual = true; yaw -= dx; elevation = THREE.MathUtils.clamp(elevation + dy, -.55, 1.25)
    orbit()
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: () => interactive() && (phase === 'ready' || phase === 'viewing'),
    canStart: (x,y) => phase === 'viewing' ? Number.isFinite(x) && Number.isFinite(y) && insideCanvas(canvas,x,y) : hit(x,y),
    onStart(x,y) { lastX = x; lastY = y },
    onMove(x,y) { if (phase === 'viewing') turn((x-lastX)*.008,(y-lastY)*.005); lastX=x; lastY=y },
    onRelease(x,y) { if (phase === 'ready' && insideCanvas(canvas,x,y)) begin() },
    onCancel: cancel,
  })
  const click = (event: MouseEvent) => {
    if (disposed || completed) return
    if (phase === 'placement') {
      // The label changes under this very button. Neither the same task's
      // synthetic tail nor a native double-click may operate the next action.
      if (handoffPending || event.detail > 1) event.stopImmediatePropagation()
      return
    }
    event.stopImmediatePropagation()
    if (event.detail > 1 || !interactive() || pointer.isBusy()) return
    if (phase === 'ready') begin()
    else if (phase === 'viewing') leave()
  }
  const keyboard = (event: KeyboardEvent) => {
    if (!interactive() || phase === 'placement' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); return }
    const direction: Record<string,[number,number]> = { ArrowLeft: [-.16,0], ArrowRight: [.16,0], ArrowUp: [0,-.12], ArrowDown: [0,.12] }
    const delta = direction[event.key]
    if (!delta) return
    event.preventDefault(); event.stopImmediatePropagation(); turn(...delta)
  }
  const blur = () => cancel()
  ui.actionBtn.addEventListener('click', click, true); ui.actionBtn.addEventListener('keydown', keyboard, true)
  window.addEventListener('blur', blur)
  const center = actor.worldToLocal(homeFocus.copy(bbox.setFromObject(actor,true).getCenter(new THREE.Vector3())))
  const removeCue = addInteractionCue(actor, { kind: 'tap', label: COPY.pickup, anchor: center.toArray() as [number,number,number], priority: 4, enabled: () => interactive() && phase === 'ready' })

  return {
    canPlace: () => !disposed && (completed || phase === 'placement' && !handoffPending),
    decorate(done: boolean) {
      completed = done
      if (done && showing()) { restore(); phase = 'placement' }
      ui.actionBtn.classList.toggle('scene-inspection-action', !done && phase !== 'placement')
      ui.hitLayer.parentElement?.setAttribute('data-close-inspection', done ? 'done' : phase)
      ui.renderDots(done ? 2 : phase === 'placement' ? 1 : 0, 2)
      if (done || phase === 'placement') {
        if (!done && handoffPending) { ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled','true'); ui.hitLayer.style.pointerEvents = 'none' }
        return
      }
      delete ui.hintEl.dataset.placementInspection; delete ui.hintEl.dataset.ready
      const busy = phase === 'approaching' || phase === 'returning'
      ui.actionBtn.hidden = false; ui.actionBtn.disabled = !interactive() || busy
      ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
      ui.hitLayer.style.pointerEvents = interactive() && !busy ? 'auto' : 'none'
      setSafeText(ui.actionBtn, phase === 'ready' || phase === 'approaching' ? COPY.pickup : COPY.continue, options.safe)
      const hint = phase === 'ready' ? COPY.ready : phase === 'approaching' ? COPY.approaching : phase === 'returning' ? COPY.returning : COPY.viewing
      setSafeText(ui.hintEl, hint, options.safe)
      bindSceneAttribute(ui.actionBtn, 'title', phase === 'ready' ? COPY.pickupHelp : hint)
    },
    update(dt: number) {
      if (disposed) return
      if (handoffPending) { handoffPending = false; notify(); return }
      if (!showing()) return
      if (!options.isActive()) { cancel(); return }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt,0,.05) : 0
      if (phase === 'approaching' && snapshot) {
        elapsed += delta
        const amount = options.isReducedMotion() ? 1 : Math.min(1,elapsed/.65), t = ease(amount)
        setWorldPosition(homeWorld.clone().lerp(raisedPosition,t))
        orbit(); const endPosition = camera.position.clone(), endRotation = camera.quaternion.clone()
        camera.position.lerpVectors(snapshot.cameraPosition,endPosition,t)
        camera.quaternion.slerpQuaternions(snapshot.cameraQuaternion,endRotation,t); camera.updateMatrixWorld(true)
        if (amount === 1) { phase = 'viewing'; elapsed = 0; notify() }
      } else if (phase === 'viewing' && !manual && !options.isReducedMotion()) {
        const before = elapsed; elapsed = Math.min(6,elapsed+delta); yaw += (ease(elapsed/6)-ease(before/6))*Math.PI*2; orbit()
        if (elapsed >= 6 && options.autoReturn === true && !pointer.isBusy()) leave()
      } else if (phase === 'returning' && snapshot) {
        elapsed += delta
        const amount = options.isReducedMotion() ? 1 : Math.min(1,elapsed/.5), t = ease(amount)
        setWorldPosition(raisedPosition.clone().lerp(homeWorld,t))
        camera.position.lerpVectors(cameraGoal,snapshot.cameraPosition,t)
        camera.quaternion.slerpQuaternions(cameraRotation,snapshot.cameraQuaternion,t); camera.updateMatrixWorld(true)
        if (amount === 1) finishReturn()
      }
    },
    cancel,
    dispose() {
      if (disposed) return
      disposed = true; restore(); pointer.dispose(); removeCue()
      viewLight.removeFromParent(); viewLight.dispose()
      ui.actionBtn.removeEventListener('click',click,true); ui.actionBtn.removeEventListener('keydown',keyboard,true); window.removeEventListener('blur',blur)
      ui.actionBtn.classList.remove('scene-inspection-action')
      ui.hitLayer.parentElement?.removeAttribute('data-close-inspection')
    },
  }
}
