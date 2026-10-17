import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

type XYZ = [number, number, number]
type Checkpoint = 0 | 1 | 2 | 3
const COPY = {
  title: '竹音轻摇', left: '拿住上方浅色横柄，向左短拖，让竹管轻轻跟随竹架。',
  right: '仍拿住同一横柄，向右短拖，完成一次轻柔的往返。',
  quiet: '轻点长竹管的正面，静听同一个音，看看空腔、竹节与藤绑。',
  settling: '竹架停住，竹管轻轻跟随，再慢慢安定…',
  done: '把轻柔留给今天。',
} as const
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original object study: one angklung, one pitch with a quiet octave overtone. */
export function createIndonesianAngklung(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}, shakeAmount = 0
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let dragging = false, moved = false, maxTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '拿住横柄向左轻摇' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'indonesian-angklung', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf8efcf, ground: 0x6f8661, key: 0xffe5b0, rim: 0xe7f4df, keyPosition: [-3, 6, 5], keyIntensity: 2.1, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .014
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 15 })
  const world = new THREE.Group(); world.name = 'angklung-world'; scene.add(world)
  const subject = new THREE.Group(); subject.name = 'angklung-subject'; world.add(subject)
  const frame = new THREE.Group(); frame.name = 'angklung-frame'; subject.add(frame)
  const mat = (color: number, roughness = .84) => new THREE.MeshStandardMaterial({ color, roughness })
  const bamboo = mat(0xc7a05b), fresh = mat(0xe8c981), node = mat(0x9a793e), rattan = mat(0x80613c, .97), grain = mat(0xb28a49, .93), inside = mat(0x73532b, .97)
  const shellMaterial = mat(0xdab775, .9); shellMaterial.side = THREE.DoubleSide
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = frame) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const rod = (name: string, a: XYZ, b: XYZ, radius: number, material = bamboo, parent: THREE.Object3D = frame) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from)
    const mesh = add(name, new THREE.CylinderGeometry(radius, radius * 1.025, direction.length(), 20), material, [0, 0, 0], parent)
    mesh.position.copy(from).lerp(to, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return mesh
  }
  const tube = (name: string, points: XYZ[], radius: number, material: THREE.Material, parent: THREE.Object3D, segments = 20) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
    const mesh = add(name, new THREE.TubeGeometry(curve, segments, radius, 6, false), material, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false, roughness: .95 }; return mesh as THREE.Mesh<THREE.TubeGeometry>
  }
  const marker = (name: string, p: XYZ, parent: THREE.Object3D) => { const o = new THREE.Object3D(); o.name = name; o.position.set(...p); parent.add(o); return o }
  const ring = (name: string, y: number, radius: number, parent: THREE.Object3D, material = node, thickness = .012) => {
    const m = add(name, new THREE.TorusGeometry(radius, thickness, 6, 40), material, [0, y, 0], parent); m.rotation.x = Math.PI / 2; return m
  }
  // Slotted resonator shell: lower chamber is annular; the upper front half is cut away.
  // The back tongue and two exposed cut edges remain real thick geometry.
  const resonator = (height: number) => {
    const positions: number[] = [], outer = .19, inner = .153, slot = height * .57, low = .12, steps = 64
    const pt = (a: number, y: number, r: number): XYZ => [Math.sin(a) * r, y, Math.cos(a) * r]
    const quad = (a: XYZ, b: XYZ, c: XYZ, d: XYZ) => positions.push(...a, ...b, ...d, ...b, ...c, ...d)
    const section = (lo: number, hi: number, start: number, end: number) => {
      for (let i = start; i < end; i++) {
        const a = i / steps * Math.PI * 2, b = (i + 1) / steps * Math.PI * 2
        quad(pt(a, lo, outer), pt(a, hi, outer), pt(b, hi, outer), pt(b, lo, outer))
        quad(pt(b, lo, inner), pt(b, hi, inner), pt(a, hi, inner), pt(a, lo, inner))
        quad(pt(a, hi, outer), pt(a, hi, inner), pt(b, hi, inner), pt(b, hi, outer))
        quad(pt(a, lo, inner), pt(a, lo, outer), pt(b, lo, outer), pt(b, lo, inner))
      }
    }
    section(low, slot, 0, steps); section(slot, height, steps / 4, steps * 3 / 4)
    for (const a of [Math.PI / 2, Math.PI * 1.5]) quad(pt(a, slot, outer), pt(a, height, outer), pt(a, height, inner), pt(a, slot, inner))
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals(); return geometry
  }
  for (const [side, x] of [['left', -.94], ['right', .94]] as const) {
    rod(`angklung-upright-${side}`, [x, .22, -.04], [x, 3.13, -.04], .069)
    for (const [i, y] of [.36, 1.05, 1.92, 2.83, 3.04].entries()) {
      const m = ring(`angklung-frame-node-${side}-${i}`, y, .074, frame, node, .011); m.position.x = x; m.position.z = -.04
    }
  }
  rod('angklung-top-rail', [-1.01, 3.02, -.025], [1.01, 3.02, -.025], .074, fresh)
  const grip = add('angklung-frame-grip', new RoundedBoxGeometry(.72, .18, .2, 3, .055), fresh, [0, 3.02, 0])
  for (const sign of [-1, 1]) {
    const points: XYZ[] = []
    for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2 * 5; points.push([sign * .34 + i / 96 * .09, 3.02 + Math.cos(a) * .094, Math.sin(a) * .105]) }
    tube(`angklung-grip-binding-${sign}`, points, .011, rattan, frame, 96)
  }
  rod('angklung-long-suspension-rail', [-.94, 2.82, -.21], [.05, 2.82, -.21], .051)
  rod('angklung-short-suspension-rail', [.05, 2.30, -.21], [.94, 2.30, -.21], .051)
  rod('angklung-bottom-rail-front', [-1.03, .28, .19], [1.03, .28, .19], .092, fresh)
  rod('angklung-bottom-rail-back', [-1.03, .28, -.19], [1.03, .28, -.19], .092, bamboo)
  for (const [i, x] of [-.94, .94].entries()) {
    for (let j = 0; j < 4; j++) tube(`angklung-base-binding-${i}-${j}`, [[x - .045 + j * .027, .37, -.25], [x - .045 + j * .027, .42, 0], [x - .045 + j * .027, .36, .27], [x - .045 + j * .027, .16, .23], [x - .045 + j * .027, .14, -.23], [x - .045 + j * .027, .37, -.25]], .009, rattan, frame)
  }
  const suspension: { mesh: THREE.Mesh<THREE.TubeGeometry>; a: THREE.Object3D; b: THREE.Object3D }[] = []
  const resonators: THREE.Group[] = []
  let longBody!: THREE.Mesh
  for (const [size, x, height, railY] of [['long', -.43, 2.3, 2.82], ['short', .43, 1.78, 2.30]] as const) {
    const socket = new THREE.Group(); socket.name = `angklung-socket-${size}`; socket.position.set(x, .38, 0); frame.add(socket)
    add(`angklung-socket-floor-${size}`, new RoundedBoxGeometry(.36, .07, .41, 2, .015), node, [0, -.1, 0], socket)
    const group = new THREE.Group(); group.name = `angklung-tube-${size}`; group.position.set(x, .38, 0); frame.add(group); resonators.push(group)
    add(`angklung-foot-${size}`, new THREE.SphereGeometry(.065, 16, 12), fresh, [0, 0, 0], group)
    rod(`angklung-foot-neck-${size}`, [0, .01, 0], [0, .17, 0], .064, fresh, group)
    const body = add(`angklung-tube-${size}-body`, resonator(height), shellMaterial, [0, 0, 0], group); if (size === 'long') longBody = body
    add(`angklung-diaphragm-${size}`, new THREE.CylinderGeometry(.153, .153, .035, 40), inside, [0, .12, 0], group)
    ring(`angklung-tube-${size}-basal-node`, .16, .194, group, node, .015)
    ring(`angklung-tube-${size}-node`, height * .48, .194, group, fresh, .015)
    for (const [i, a] of [.35, 1.02, 1.8, 2.8, 3.7, 4.7, 5.6].entries()) {
      const r = .191, end = Math.cos(a) <= 0 ? height - .06 : height * .56
      tube(`angklung-grain-${size}-${i}`, [[Math.sin(a) * r, .21, Math.cos(a) * r], [Math.sin(a + .012) * r, end / 2, Math.cos(a + .012) * r], [Math.sin(a) * r, end, Math.cos(a) * r]], .0026, grain, group, 14)
    }
    for (const [side, sign] of [['front', -1], ['back', 1]] as const) {
      const a = marker(`angklung-suspension-${size}-frame-${side}`, [x + sign * .12, railY, -.16], frame)
      const b = marker(`angklung-suspension-${size}-tube-${side}`, [sign * .12, height - .12, -.147], group)
      const fastening = add(`angklung-tie-${size}-${side}`, new THREE.TorusGeometry(.032, .012, 7, 16), rattan, [sign * .12, height - .12, -.147], group); fastening.rotation.y = sign * .6
      const railWrap = add(`angklung-rail-wrap-${size}-${side}`, new THREE.TorusGeometry(.054, .011, 7, 16), rattan, [x + sign * .12, railY, -.21]); railWrap.rotation.y = Math.PI / 2
      const mesh = tube(`angklung-lashing-${size}-${side}`, [[0, 0, 0], [0, .1, 0], [0, .2, 0]], .011, rattan, frame)
      const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      const normal = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute
      position.setUsage(THREE.DynamicDrawUsage); normal.setUsage(THREE.DynamicDrawUsage)
      suspension.push({ mesh, a, b })
    }
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const point = new THREE.Vector3(), radial = new THREE.Vector3()
  const updateSuspension = () => {
    matrices()
    for (const { mesh, a, b } of suspension) {
      const curve = mesh.geometry.parameters.path as THREE.CatmullRomCurve3
      curve.points[0].copy(frame.worldToLocal(a.getWorldPosition(new THREE.Vector3())))
      curve.points[2].copy(frame.worldToLocal(b.getWorldPosition(new THREE.Vector3())))
      curve.points[1].copy(curve.points[0]).lerp(curve.points[2], .5); curve.points[1].z -= .018; curve.updateArcLengths()
      const frames = curve.computeFrenetFrames(20, false), position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal')
      for (let i = 0; i <= 20; i++) {
        curve.getPointAt(i / 20, point)
        for (let j = 0; j <= 6; j++) {
          const a = j / 6 * Math.PI * 2, index = i * 7 + j
          radial.copy(frames.normals[i]).multiplyScalar(-Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize()
          position.setXYZ(index, point.x + radial.x * .011, point.y + radial.y * .011, point.z + radial.z * .011); normal.setXYZ(index, radial.x, radial.y, radial.z)
        }
      }
      position.needsUpdate = normal.needsUpdate = true; mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere()
    }
  }
  const pose = (step: 0 | 1, amount: number, settling = 0) => {
    shakeAmount = amount; frame.position.x = step === 0 ? -.2 * amount : -.2 + .2 * amount
    const sign = step === 0 ? -1 : 1, sway = Math.sin(amount * Math.PI) * .075 + Math.sin(settling * Math.PI * 3) * (1 - settling) * .033
    resonators[0].rotation.z = sign * sway; resonators[1].rotation.z = sign * sway * .72
    if (amount === 1 && (settling === 0 || settling === 1)) resonators.forEach(o => { o.rotation.z = 0 })
    updateSuspension()
  }
  const restore = () => { pose(at === 0 ? 0 : at === 1 ? 0 : 1, at === 0 ? 0 : 1); shakeAmount = 0 }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', label: '拿住横柄向左轻摇', anchor: [0, 0, .10], priority: 3, enabled: enabled(0) }),
    addInteractionCue(grip, { kind: 'drag', label: '拿住横柄向右轻摇', anchor: [0, 0, .10], priority: 3, enabled: enabled(1) }),
    addInteractionCue(longBody, { kind: 'tap', label: '轻点竹管静听', anchor: [0, .7, .19], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const belongs = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const reset = () => { dragging = moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return belongs(nearestHit(x, y)?.object, at < 2 ? grip : longBody) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y
      along = dx * (at === 0 ? -1 : 1); maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along)
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(dy)); moved ||= maxTravel > 0
      if (dragging) pose(at as 0 | 1, THREE.MathUtils.clamp(along / 60, 0, 1))
    },
    onRelease(x, y) {
      const dx = x - down.x, dy = y - down.y, end = dx * (at === 0 ? -1 : 1)
      const valid = Number.isFinite(x) && Number.isFinite(y) && (at < 2 ? dragging && moved && along >= 42 && end >= 42 && end <= 84 && maxTravel <= 90 && minAlong >= -8 && backtrack <= 9 && maxAlong - end <= 9 && maxCross <= 18 && Math.abs(dy) <= 18
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && belongs(nearestHit(x, y)?.object, longBody))
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? '拿住横柄向左轻摇' : at === 1 ? '拿住横柄向右轻摇' : '轻点竹管静听', safe)
    setSafeText(ui.hintEl, motion ? COPY.settling : at === 0 ? COPY.left : at === 1 ? COPY.right : at === 2 ? COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  const sound = () => feedback.impact({ freqs: [392, 784], duration: .19, gain: .005, type: 'sine' })
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (callbackActive()) sound() })
  }
  function advance() {
    if (!inputActive() || pointer.isBusy() || motion || at === 3) return
    if (at === 2) {
      at = 3; restore(); withHostCallbacks(() => { ctx.onProgress?.(3); if (!callbackActive()) return; sound(); if (callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }); return
    }
    motion = { step: at, time: 0, from: shakeAmount }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), distance = Math.max(5.4, 3.85 / aspect)
    camera.position.set(0, 1.67 + distance * .035, distance); camera.lookAt(0, 1.67, 0); matrices()
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
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .78)
        pose(motion.step, THREE.MathUtils.lerp(motion.from, 1, ease(motion.time)), motion.time)
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
