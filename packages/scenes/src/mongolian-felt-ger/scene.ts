import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { placementHit } from '../placement-hit'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createGerModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['展开木格', '支起顶圈', '铺好白毡']
const DRAG_LABELS = ['拖木格到浅金轮廓后松手', '把顶圈抬到圆环轮廓后松手', '把白毡放到木架上后松手']
const READY = ['木格已展开到位，松手固定。', '顶圈已抬到位，松手放稳。', '白毡已放到木架上，松手铺开。']
const HINTS = [
  '按住前侧红色木格端头，拖到浅金色端头轮廓处，展开围壁后松手。',
  '按住红色顶圈，抬到上方浅金色圆环轮廓处，松手架稳屋顶。',
  '按住白毡卷，拖到浅金色木架覆盖区上松手，铺好屋顶和围壁。',
  '白毡已铺好，绳带收拢，毡屋小景搭好了。',
]
const MOVING = ['木格慢慢展开，留下明亮的空隙……', '顶圈升起，椽杆向四周舒展……', '白毡沿屋顶和围壁铺展，绳带收束……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createMongolianFeltGer(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...DRAG_LABELS, ...READY, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; heldFrom?: THREE.Vector3 } | null = null
  let amount = 0, moved = false, invalid = false, dragging = false
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '毡屋向阳', stepsAria: '搭建步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'mongolian-felt-ger', label: '毡屋向阳' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15 })
  const model = createGerModel(); scene.add(model.subject)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number, held?: THREE.Vector3) => { amount = n; model.pose(step > 0 ? 1 : n, step > 1 ? 1 : step === 1 ? n : 0, step === 2 ? n : step > 2 ? 1 : 0, step, held); matrices() }
  const restore = () => { pose(at, 0); model.highlightDrop(false) }
  const dropPoint = (step: number = at) => model.placements[step]!.object.localToWorld(new THREE.Vector3(...model.placements[step]!.anchor))
  const dropCues = model.targets.map((_,i) => ({ kind: 'drag' as const, destination: () => dropPoint(i), label: DRAG_LABELS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const removeCues = model.targets.map((target,i) => addInteractionCue(target!,dropCues[i]!))
  const touch = createTouchTarget(canvas, camera, scene)
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), from = new THREE.Vector2(), to = new THREE.Vector2()
  const plane = new THREE.Plane(), dragPoint = new THREE.Vector3(), offset = new THREE.Vector3(), held = new THREE.Vector3()
  const project = (p: THREE.Vector3) => {
    const rect = canvas.getBoundingClientRect(), q = p.clone().project(camera)
    return new THREE.Vector2(rect.left+(q.x+1)*rect.width/2,rect.top+(1-q.y)*rect.height/2)
  }
  const insideStage = (x: number,y: number) => {
    const r=canvas.getBoundingClientRect()
    return Number.isFinite(x) && Number.isFinite(y) && x>=r.left && x<=r.left+r.width && y>=r.top && y<=r.top+r.height
  }
  const overDrop = (x: number,y: number) => {
    if (!insideStage(x,y) || at===3) return false
    matrices()
    if (at===2) return ray.aim(x,y).intersectObject(model.placements[2]!.object,true).length>0
    return ray.aim(x,y).ray.distanceSqToPoint(dropPoint()) <= .18**2
  }
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const reset = () => { moved = invalid = dragging = false; if (!motion && !disposed) { restore(); if(at<3)dropCues[at]!.label=DRAG_LABELS[at]!;setSafeText(ui.hintEl,HINTS[at]!,safe) } }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x, y, model.targets[at]!) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x,y); moved=invalid=false; dragging=true
      const target=model.targets[at]!
      held.copy(target.position); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),held)
      if (!ray.aim(x,y).ray.intersectPlane(plane,dragPoint)) { invalid=true; return }
      offset.copy(held).sub(dragPoint)
      from.copy(project(target.localToWorld(new THREE.Vector3(...model.anchors[at]!)))); to.copy(project(dropPoint()))
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      moved ||= Math.hypot(x-down.x,y-down.y)>0
      if (!ray.aim(x,y).ray.intersectPlane(plane,dragPoint)) { invalid=true; return }
      held.copy(dragPoint).add(offset)
      // This only previews the linked frame/cloth. Acceptance uses the spatial drop below.
      const path=to.clone().sub(from), fraction=new THREE.Vector2(x-down.x,y-down.y).dot(path)/Math.max(path.lengthSq(),1)
      pose(at,THREE.MathUtils.clamp(fraction,0,at===2?.8:1),held)
      const ready=!invalid && insideStage(x,y) && placementHit(canvas,camera,model.targets[at]!,x,y,overDrop,model.anchors[at])
      model.highlightDrop(ready);dropCues[at]!.label=ready?READY[at]!:DRAG_LABELS[at]!
      setSafeText(ui.hintEl,ready?READY[at]!:HINTS[at]!,safe)
    },
    onRelease(x, y) {
      const valid = dragging && !invalid && moved && insideStage(x,y) && placementHit(canvas,camera,model.targets[at]!,x,y,overDrop,model.anchors[at])
      dragging=false
      if (valid) advance(true); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    model.placements.forEach(({object},i) => { object.visible=inputActive() && !motion && at===i })
    setSafeText(ui.actionBtn, ACTIONS[Math.min(at, 2)]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [523.25], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(dropped = false) { if (!inputActive() || pointer.isBusy() || motion || at === 3) return; motion = { step: at, time: 0, from: amount, heldFrom: dropped ? model.targets[at]!.position.clone() : undefined }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, 1.04, .06), direction = new THREE.Vector3(.48, .66, 1.5).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0]]) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    pose(at, saved); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .85)
        const n=ease(motion.time), end=dropPoint(motion.step).sub(new THREE.Vector3(...model.anchors[motion.step]!))
        pose(motion.step,THREE.MathUtils.lerp(motion.from,1,n),motion.heldFrom?.clone().lerp(end,n))
        model.placements.forEach(({object})=>{object.visible=false})
        if (motion.time===1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.disposeTexture(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
