import { sceneProductCopy, sceneTemplate } from '../scene-localization'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue, type InteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPosePlacement } from '../pose-placement'
import { completesDirectionalDrag } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createYutnoriModel } from './model'
import { encodeYutPlay, moveYut, restoreYutPlay, throwYut, yutSteps, type YutPlay } from './play'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['向右合拢木柶', '向上抛出木柶', '移动棋子到本次落点']
const HINTS = [
  '按住席前左侧的木柶向右短拖，把四根木柶合拢。',
  '按住合拢的木柶向上短拖，看它们翻转后落在席上。',
  '拿住蓝色棋子，移到本次掷数对应的外圈标记处，到位后会自动落稳。',
  '木柶静静落在席上，棋子停在本次落点。留住相聚时的轻松。',
]
const MOVING = ['四根木柶靠拢……', '木柶轻轻翻转，落回席上……', '棋子沿外圈前行……']
const RESULT_NAMES = ['Mo', 'Do', 'Gae', 'Geol', 'Yut']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createKoreanYutnori(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let play = restoreYutPlay(undefined, 0)
  let motion: { step: 0 | 1 | 2; time: number; from: number; next: YutPlay; repeat: boolean; placed: boolean } | null = null
  let tokenPlacement: ReturnType<typeof createPosePlacement> | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '木柶行棋', stepsAria: '行棋步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const finishBtn = document.createElement('button')
  finishBtn.type = 'button'; finishBtn.className = 'scene-yut-finish'
  setSafeText(finishBtn, '结束仪式', safe); overlay.append(finishBtn)
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'korean-yutnori', label: '木柶行棋' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15 })
  const model = createYutnoriModel(); scene.add(model.subject)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const actionStep = (): 0 | 1 | 2 => at === 0 ? 0 : play.phase === 'move' ? 2 : 1
  const pose = (step: number, n: number) => {
    amount = n
    model.pose(step, n, { ...play, mask: motion?.next.mask ?? play.mask, steps: yutSteps(play.mask), fromMask: play.mask, repeat: motion?.repeat ?? play.phase === 'again' })
    matrices()
  }
  const restore = () => pose(at === 0 ? 0 : at === 3 || play.phase === 'again' ? 3 : actionStep(), 0)
  const rebuildTokenPlacement = () => {
    tokenPlacement?.cancel(); tokenPlacement = null
    if (at >= 3 || play.phase !== 'move') return
    tokenPlacement = createPosePlacement(canvas, camera, {
      roots: [model.roots[2]!], targets: [model.targets[2]!], anchors: [model.anchors[2]!],
      pose(_step, n) { model.pose(2, n, { ...play, steps: yutSteps(play.mask) }); matrices() },
    }, scene, { planeNormal: new THREE.Vector3(0, 1, 0) })
    restore()
  }
  const cueSpecs: InteractionCue[] = model.targets.map((_, i) => ({ kind: 'drag',
    ...(i === 2 ? { destination: () => tokenPlacement!.destination(0), targetLabel: '本次掷数的落点' } : { direction: (i === 0 ? [1, 0] : [0, -1]) as [number, number] }),
    label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at < 3 && actionStep() === i }))
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, cueSpecs[i]!))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const axes = (dx: number, dy: number) => actionStep() === 0 ? [dx, dy] : [-dy, dx]
  const reset = () => { tokenPlacement?.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y), root = model.roots[actionStep()]!; return !!hit && (hit === root || root.getObjectById(hit.id) === hit) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (actionStep() === 2 && !tokenPlacement?.begin(0, x, y)) pointer.cancel() },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (actionStep() === 2) { if (!invalid && tokenPlacement?.move(x, y) && pointer.finish()) { tokenPlacement.capture(); advance(true) }; return }
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      const step = actionStep()
      pose(step, THREE.MathUtils.clamp(along / 60, 0, 1) * (step === 1 ? .2 : 1))
    },
    onRelease(x, y) {
      if (actionStep() === 2) { if (!invalid && tokenPlacement?.move(x, y)) { tokenPlacement.capture(); advance(true) } else reset(); return }
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && moved && completesDirectionalDrag({ along, end: end!, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel })
      if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    finishBtn.hidden = at === 3 || play.phase !== 'again'
    finishBtn.disabled = !inputActive() || !!motion
    const steps = yutSteps(play.mask), flats = play.mask.toString(2).replace(/0/g, '').length
    cueSpecs[2]!.label = sceneTemplate("移到前行 {p0} 格的落点", { p0: steps })
    const hint = at === 3 ? sceneTemplate("已完成 {p0} 次抛掷。{p1}", { p0: play.turns, p1: sceneProductCopy(HINTS[3]!) })
      : motion ? motion.step === 2 ? sceneTemplate("棋子沿外圈前行 {p0} 格……", { p0: steps }) : MOVING[motion.step]!
      : at === 0 ? HINTS[0]!
      : play.phase === 'move' ? sceneTemplate("第 {p0} 掷 · {p1}：{p2}，前行 {p3} 格。拿住蓝色棋子，移到本次标记的落点。", { p0: play.turns, p1: RESULT_NAMES[flats], p2: sceneProductCopy(flats === 0 ? '四根圆面朝上' : sceneTemplate("{p0} 根平面朝上", { p0: flats })), p3: steps })
      : play.phase === 'again' ? sceneTemplate("本次已前行 {p0} 格，累计掷了 {p1} 次。再抛木柶继续，或点「结束仪式」。", { p0: steps, p1: play.turns })
      : HINTS[1]!
    setSafeText(ui.actionBtn, play.phase === 'again' && at < 3 ? '再掷一次' : ACTIONS[actionStep()]!, safe)
    setSafeText(ui.hintEl, hint, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    const step = motion.step, next = (step === 0 ? 1 : 2) as Checkpoint, changed = next !== at
    tokenPlacement?.cancel(); play = motion.next; at = next; motion = null; restore(); rebuildTokenPlacement()
    withHostCallbacks(() => {
      ctx.onVariantChange?.(encodeYutPlay(play)); if (!callbackActive()) return
      if (changed) ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [523.25], duration: .09, gain: .003, type: 'sine' })
    })
  }
  function advance(placed = false) {
    if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return
    const step = actionStep(), next = step === 1 ? throwYut(play) : step === 2 ? moveYut(play) : play
    motion = { step, time: 0, from: amount, next, repeat: play.phase === 'again', placed }; sync()
    if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const finish = () => {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2 || play.phase !== 'again' || !prepareInput()) return
    at = 3; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(3); if (!callbackActive()) return
      ctx.haptic?.('medium'); if (!callbackActive()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, .36, .32), direction = new THREE.Vector3(.18, 5.2, 6).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 4.2
    const saved = amount
    for (const [step, n] of [0,1,2].flatMap(step=>Array.from({length:21},(_,i)=>[step,i/20])).concat([[3,0]])) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    if (motion || pointer.isBusy()) pose(motion?.step ?? actionStep(), saved); else restore()
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      play = restoreYutPlay(at === 0 ? undefined : ctx.initialVariant, at)
      restore(); rebuildTokenPlacement(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); finishBtn.addEventListener('click', finish); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) { motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.placed ? .3 : .85)); pose(motion.step, THREE.MathUtils.lerp(motion.from, 1, ease(motion.time))); if (motion.placed) tokenPlacement?.settle(ease(motion.time)); if (motion.time === 1) settle() }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); finishBtn.removeEventListener('click', finish)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
