import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createChimeAudio, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createSansiModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['轻拨中央长簧片', '轻拨左侧簧片', '轻拨右侧簧片']
const HINTS = [
  '按住中央最长簧片的末端，向下短拖再松手。金属弯下后回弹，发出第一个音。',
  '按住左侧提示处的簧片末端，向下短拖再松手，听第二个音。',
  '按住右侧提示处的簧片末端，向下短拖再松手，让第三个音轻轻收尾。',
  '三次拨奏结束，簧片回到原处。木板、金属与指尖，共同留下短短的回响。（原创音阶片段，非传统曲目；可在设置中开启音效。）',
]
const MOVING = ['中央长簧片回弹，余振渐息……', '左侧簧片回弹，余振渐息……', '右侧簧片回弹，余振渐息……']
const NOTES = [261.63, 329.63, 392]

export function createMalawiSansi(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const audio = createChimeAudio()
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => false })
  const ui = createStepOverlay(overlay, { title: '铁舌轻鸣', stepsAria: '拨奏步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'malawi-sansi', label: '铁舌轻鸣' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15 })
  const model = createSansiModel(); scene.add(model.subject)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => pose(at, 0)
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const axes = (dx: number, dy: number) => [dy, dx]
  const reset = () => { moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return nearest(x, y) === model.targets[at] },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0 },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      pose(at, THREE.MathUtils.clamp(along / 60, 0, 1))
    },
    onRelease(x, y) {
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && Number.isFinite(x) && Number.isFinite(y) && moved && along >= 40 && end! >= 40 && end! <= 84 && travel <= 90 && minAlong >= -8 && backtrack <= 9 && maxAlong - end! <= 9 && maxCross <= 18 && Math.abs(cross!) <= 18
      if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[Math.min(at, 2)]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => { feedback.prepare(); if (callbackActive() && (ctx.isSoundEnabled?.() ?? true)) audio.unlock() }); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact()
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance() { if (!inputActive() || pointer.isBusy() || motion || at === 3) return; motion = { step: at, time: 0, from: amount || 1 }; pose(at, motion.from); sync();
    withHostCallbacks(() => { if (callbackActive() && (ctx.isSoundEnabled?.() ?? true)) audio.play({ freqs: [NOTES[at]!], duration: .65, gain: .045, type: 'sine' }) });
    if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, .20, .02), direction = new THREE.Vector3(.12, 1.8, 1.5).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [[0, 0], [0, 1], [0, -.6], [1, 0], [1, 1], [1, -.6], [2, 0], [2, 1], [2, -.6], [3, 0]]) {
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
      if (motion) { motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .85); pose(motion.step, motion.time === 1 ? 0 : motion.from * Math.exp(-5 * motion.time) * Math.cos(8 * Math.PI * motion.time)); if (motion.time === 1) settle() }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); audio.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
