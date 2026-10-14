import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '贝链留光', thread: '沿露出的细线，把上方已备好的最后一枚黄螺壳向左穿入贝链。',
  gather: '拉住上方的线端，向上轻拉，让贝链收成柔和的弧形。',
  quiet: '轻点贝链静看，或写一句心意；点「写好了」才会保存。',
  returning: '轻点贝链，回看这串日常的暖黄。', done: '留一串暖黄在日常。（当代贝链手作欣赏练习结束）',
  threading: '最后一枚小螺壳沿细线滑入…', gathering: '细线牵起，黄螺壳慢慢聚成弧形…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const ease = (t: number) => t * t * (3 - 2 * t)
const SHELL_ANCHOR: XYZ = [.0125, 0, .07848191718467962]

/** Prepared yellow land-snail shells on an original shallow display tray. */
export function createNiueShellNecklace(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null
  let lifecycleVersion = 0
  let motion: { step: 0 | 1; time: number; thread: number; gather: number } | null = null
  let dragging = false, maxTravel = 0, maxCross = 0, moved = 0, maxAlong = 0, minAlong = 0, backtrack = 0, threadAmount = 0, gatherAmount = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向左穿入最后一枚螺壳' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'niue-shell-necklace', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf0f0e6, ground: 0xb2ad95, key: 0xfff2dc, rim: 0xd7e7df, keyPosition: [-3, 5, 4], keyIntensity: 1.7, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .015
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 12 })
  const world = new THREE.Group(); world.name = 'shell-workbench'; scene.add(world)
  const mat = (color: number, roughness = .88, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const wood = mat(0xb69a77), trayMat = mat(0xb9ced1), trayEdge = mat(0x8fa9ad)
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xf2cf75, roughness: .59, metalness: 0, clearcoat: .13, clearcoatRoughness: .62, side: THREE.DoubleSide })
  const ivoryMat = new THREE.MeshPhysicalMaterial({ color: 0xf5dda0, roughness: .62, clearcoat: .10, clearcoatRoughness: .65, side: THREE.DoubleSide })
  const sutureMat = mat(0xba933e), cordMat = mat(0xf4ebce)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent: THREE.Object3D = world) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.035, ...size.map(n => n / 3))), material, p, parent)
  box('shell-table', [9, .18, 7], [0, .625, 0], wood)
  const tray = new THREE.Group(); tray.name = 'shell-shallow-tray'; tray.position.set(0, .780, 0); tray.rotation.x = -Math.PI / 2; world.add(tray)
  const oval = (rx: number, ry: number, depth: number) => {
    const shape = new THREE.Shape(); shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 })
  }
  // A low oval dish rests directly on the broad tabletop. Its floor keeps the
  // existing shell contact height while the round lip frames the whole strand.
  add('shell-tray-backing', oval(1.72, 1.34, .065), trayEdge, [0, 0, -.065], tray)
  add('shell-tray-face', oval(1.66, 1.28, .0365), trayMat, [0, 0, 0], tray)
  const rimPoints = Array.from({ length: 129 }, (_, i) => {
    const a = i / 128 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 1.69, Math.sin(a) * 1.31, .055)
  })
  const rim = add('shell-tray-rim', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints), 128, .03, 8, true), trayEdge, [0, 0, 0], tray)
  rim.userData.toonSurface = { outline: false }

  // Each original shell is a hollow, tapering 3.7-whorl surface. The annular
  // mouth and prepared apex perforation are real openings, with no end caps.
  // The prepared tip has .022 inner clearance for the .006-radius cord
  // plus its small bend across the rigid shell, retaining a .006 wall.
  const profile = [[-.10, .028], [-.075, .033], [-.045, .040], [-.012, .060], [.022, .077], [.05, .071], [.08, .052]]
  const radius = (t: number, angle: number) => {
    const x = -.10 + .18 * t
    let i = 0; while (i < profile.length - 2 && x > profile[i + 1]![0]!) i++
    const a = profile[i]!, b = profile[i + 1]!, u = ease(THREE.MathUtils.clamp((x - a[0]!) / (b[0]! - a[0]!), 0, 1))
    return THREE.MathUtils.lerp(a[1]!, b[1]!, u) * (1 + .075 * Math.sin(Math.PI * 7.4 * t - angle) * Math.sin(Math.PI * t))
  }
  const positions: number[] = [], indices: number[] = [], ringCount = 64, sides = 32
  for (let inner = 0; inner < 2; inner++) for (let i = 0; i <= ringCount; i++) for (let j = 0; j <= sides; j++) {
    const t = i / ringCount, angle = j / sides * Math.PI * 2, r = radius(t, angle) - (inner ? .006 : 0)
    positions.push(-.10 + .18 * t, Math.sin(angle) * r, Math.cos(angle) * r)
  }
  const count = (ringCount + 1) * (sides + 1)
  for (let inner = 0; inner < 2; inner++) for (let i = 0; i < ringCount; i++) for (let j = 0; j < sides; j++) {
    const a = inner * count + i * (sides + 1) + j, b = a + sides + 1
    if (inner) indices.push(a, b, a + 1, a + 1, b, b + 1); else indices.push(a, a + 1, b, a + 1, b + 1, b)
  }
  for (const i of [0, ringCount]) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + count
    indices.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const shellGeometry = new THREE.BufferGeometry(); shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); shellGeometry.setIndex(indices); shellGeometry.computeVertexNormals()
  const helix: THREE.Vector3[] = []
  for (let i = 0; i <= 128; i++) {
    const t = .02 + .94 * i / 128, a = Math.PI * 7.4 * t, r = radius(t, a) + .0005
    helix.push(new THREE.Vector3(-.10 + .18 * t, Math.sin(a) * r, Math.cos(a) * r))
  }
  const sutureGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 128, .0031, 6, false)
  const mouthGeometry = new THREE.TorusGeometry(.049, .004, 8, 32)
  const mouthMat = mat(0xf8e6b5, .66)
  const makeShell = (name: string, ivory = false) => {
    const group = new THREE.Group(); group.name = name; tray.add(group)
    const body = add(`${name}-body`, shellGeometry, ivory ? ivoryMat : shellMat, [0, 0, 0], group)
    const suture = add(`${name}-suture`, sutureGeometry, sutureMat, [0, 0, 0], group)
    const mouth = add(`${name}-mouth`, mouthGeometry, mouthMat, [.08, 0, 0], group); mouth.rotation.y = Math.PI / 2; mouth.userData.toonSurface = { outline: false, shading: 'smooth' }
    body.userData.toonSurface = { outline: false, roughness: .59, metalness: 0 }; suture.userData.toonSurface = { outline: false }
    return group
  }
  const shells = Array.from({ length: 31 }, (_, i) => makeShell(`shell-strand-${i}`, i % 5 === 2))
  const last = makeShell('shell-last'), lastBody = last.getObjectByName('shell-last-body')!, quietBody = shells[24]!.getObjectByName('shell-strand-24-body')!
  // A short doubled cord is the physical grip. It remains fine yarn rather
  // than an invisible plane or a separate decorative button.
  const grip = add('shell-cord-grip', new THREE.CapsuleGeometry(.018, .12, 5, 10), cordMat, [1.30, .62, .064], tray)
  grip.rotation.z = -.32; grip.userData.toonSurface = { outline: false }
  const initialCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.5, .6, .12), new THREE.Vector3(0, -.8, .12), new THREE.Vector3(1.3, .6, .12)])
  const thread = add('shell-thread', new THREE.TubeGeometry(initialCurve, 300, .006, 6, false), cordMat, [0, 0, 0], tray)
  thread.userData.toonSurface = { outline: false }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const rawPose = (u: number, gathered: number) => {
    const angle = .41 + u * (Math.PI * 2 - .82), rx = THREE.MathUtils.lerp(1.19, 1.15, gathered), ry = THREE.MathUtils.lerp(.70, .85, gathered)
    return new THREE.Vector3(-Math.sin(angle) * rx, Math.cos(angle) * ry - .10, .117)
  }
  const setShape = () => {
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 81 }, (_, i) => rawPose(i / 80, gatherAmount)))
    const shellPose = (u: number, _gathered: number) => path.getPointAt(u)
    const centers: THREE.Vector3[] = []
    for (let i = 0; i < shells.length; i++) {
      const u = (i + 1) / 32, center = shellPose(u, gatherAmount), tangent = shellPose(Math.min(1, u + .001), gatherAmount).sub(center)
      shells[i]!.position.copy(center); shells[i]!.rotation.z = Math.atan2(tangent.y, tangent.x); centers.push(center)
    }
    const endpoint = shellPose(0, gatherAmount), axis = path.getTangentAt(0).multiplyScalar(-1)
    last.position.copy(endpoint).addScaledVector(axis, (1 - threadAmount) * .67); last.rotation.z = Math.atan2(axis.y, axis.x)
    // A straight exposed section crosses both real openings of the prepared
    // shell. Its tangent joins the first strung shell, without doubling back.
    const gripPosition = endpoint.clone().addScaledVector(axis, .95); gripPosition.y += gatherAmount * .26
    grip.position.copy(gripPosition)
    const points = [gripPosition.clone().add(new THREE.Vector3(0, .06, 0)), gripPosition,
      endpoint.clone().addScaledVector(axis, .80), endpoint.clone().addScaledVector(axis, .33), endpoint,
      endpoint.clone().addScaledVector(axis, -.12), ...centers, shellPose(1, gatherAmount), new THREE.Vector3(.39, .94, .117)]
    const curve = new THREE.CatmullRomCurve3(points), frames = curve.computeFrenetFrames(300, false), attr = thread.geometry.getAttribute('position')
    for (let i = 0; i <= 300; i++) {
      const center = curve.getPointAt(i / 300)
      for (let j = 0; j <= 6; j++) {
        const a = j / 6 * Math.PI * 2, offset = frames.normals[i]!.clone().multiplyScalar(-Math.cos(a) * .006).addScaledVector(frames.binormals[i]!, Math.sin(a) * .006)
        attr.setXYZ(i * 7 + j, center.x + offset.x, center.y + offset.y, center.z + offset.z)
      }
    }
    attr.needsUpdate = true; thread.geometry.computeVertexNormals(); thread.geometry.computeBoundingSphere(); thread.geometry.computeBoundingBox()
  }
  const setThread = (amount: number) => { threadAmount = amount; setShape() }
  const setGather = (amount: number) => { gatherAmount = amount; setShape() }
  const restore = () => { threadAmount = at > 0 ? 1 : 0; gatherAmount = at >= 2 ? 1 : 0; setShape(); matrices() }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(lastBody, { kind: 'drag', label: '向左穿入小螺壳', anchor: SHELL_ANCHOR, priority: 3, enabled: enabled(0) }),
    addInteractionCue(grip, { kind: 'drag', label: '向上拉拢线端', anchor: [0, 0, .018], priority: 3, enabled: enabled(1) }),
    addInteractionCue(quietBody, { kind: 'tap', label: '轻点贝链静看', anchor: SHELL_ANCHOR, priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const visibleHit = (x: number, y: number, target: THREE.Object3D) => belongsTo(nearestHit(x, y)?.object, target)
  const necklaceHit = (x: number, y: number) => { const hit = nearestHit(x, y)?.object; return belongsTo(hit, last) || shells.some(shell => belongsTo(hit, shell)) }
  const reset = () => { dragging = false; maxTravel = maxCross = moved = maxAlong = minAlong = backtrack = 0; if (!motion && !disposed) restore() }
  // Guard before the pointer controller: its inactive move path would otherwise
  // cancel the original owner during synchronous prepareFeedback reentry.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) {
      if (motion || at === 3) return false; matrices()
      return at === 0 ? visibleHit(x, y, last) : at === 1 ? visibleHit(x, y, grip) : necklaceHit(x, y)
    },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; maxTravel = maxCross = moved = maxAlong = minAlong = backtrack = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dy : dx))
      moved = at === 0 ? -dx : -dy
      maxAlong = Math.max(maxAlong, moved); minAlong = Math.min(minAlong, moved); backtrack = Math.max(backtrack, maxAlong - moved)
      if (dragging && at === 0) setThread(THREE.MathUtils.clamp(moved / 60, 0, 1))
      else if (dragging && at === 1) setGather(THREE.MathUtils.clamp(moved / 60, 0, 1))
      matrices()
    },
    onRelease(x, y) {
      matrices(); const dx = x - down.x, dy = y - down.y
      const along = at === 0 ? -dx : -dy, cross = at === 0 ? Math.abs(dy) : Math.abs(dx)
      const valid = at < 2 ? dragging && moved >= 40 && along >= 40 && minAlong >= -10 && backtrack <= 12 && maxAlong - along <= 12 && maxCross <= Math.max(18, along * .4) && cross <= Math.max(18, along * .4)
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && (necklaceHit(x, y))
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '向左穿入最后一枚螺壳' : at === 1 ? '向上拉拢线端' : '轻点贝链静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.threading : COPY.gathering : at === 0 ? COPY.thread : at === 1 ? COPY.gather : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() {
    const revision = lifecycleVersion
    withHostCallbacks(() => feedback.prepare())
    return inputActive() && revision === lifecycleVersion
  }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [392, 523.25], duration: .13, gain: .008, type: 'triangle' }) })
  }
  function begin() {
    if (!inputActive() || pointer.isBusy() || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, thread: threadAmount, gather: gatherAmount }; sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    withHostCallbacks(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!active()) return
      feedback.impact({ freqs: [392, 587.33], duration: .20, gain: .009 }); if (!active()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), distance = Math.max(4.55, 5.4 / aspect)
    camera.position.set(0, .82 + distance * .93, distance * .37); camera.lookAt(0, .82, 0); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: text => { if (!inputActive() || pointer.isBusy() || motion || at !== 2 || !text.trim() || !prepareInput()) return; finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); writer?.setEnabled(false); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(delta)
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .72); const t = ease(motion.time)
        if (motion.step === 0) setThread(THREE.MathUtils.lerp(motion.thread, 1, t))
        else setGather(THREE.MathUtils.lerp(motion.gather, 1, t))
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
