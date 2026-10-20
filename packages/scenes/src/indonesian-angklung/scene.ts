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
  title: '竹音轻摇', play: '按住竹架或竹管来回摇动，让竹音跟着手的节奏响起。',
  quiet: '可以继续自由摇动，轻重快慢由你决定；想收尾时点「结束体验」。',
  done: '把轻柔留给今天。',
} as const

/** Original object study: one angklung, one pitch with a quiet octave overtone. */
export function createIndonesianAngklung(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}, controlsBusy = false, dragging = false
  let lastMove = 0, lastBeat = -Infinity
  let reducedMode = ctx.isReducedMotion?.() ?? false
  const beatOrigin = new THREE.Vector2(), strokeDirection = new THREE.Vector2()
  const offset = new THREE.Vector2(), velocity = new THREE.Vector2(), sway = new THREE.Vector2(), swayVelocity = new THREE.Vector2()
  const dragOrigin = new THREE.Vector2(), savedOffset = new THREE.Vector2(), savedVelocity = new THREE.Vector2(), savedSway = new THREE.Vector2(), savedSwayVelocity = new THREE.Vector2()
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, haptic: undefined, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '自由摇动', action: '轻摇一下' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  ui.dotsEl.hidden = true
  const finishButton = document.createElement('button'); finishButton.type = 'button'; finishButton.className = 'scene-angklung-finish'
  setSafeText(finishButton, '结束体验', safe); overlay.append(finishButton)
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
  for (const [size, x, height, railY] of [['long', -.43, 2.3, 2.82], ['short', .43, 1.78, 2.30]] as const) {
    const socket = new THREE.Group(); socket.name = `angklung-socket-${size}`; socket.position.set(x, .38, 0); frame.add(socket)
    add(`angklung-socket-floor-${size}`, new RoundedBoxGeometry(.36, .07, .41, 2, .015), node, [0, -.1, 0], socket)
    const group = new THREE.Group(); group.name = `angklung-tube-${size}`; group.position.set(x, .38, 0); frame.add(group); resonators.push(group)
    add(`angklung-foot-${size}`, new THREE.SphereGeometry(.065, 16, 12), fresh, [0, 0, 0], group)
    rod(`angklung-foot-neck-${size}`, [0, .01, 0], [0, .17, 0], .064, fresh, group)
    add(`angklung-tube-${size}-body`, resonator(height), shellMaterial, [0, 0, 0], group)
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
  const pose = () => {
    frame.position.set(offset.x, offset.y, 0)
    resonators[0].rotation.set(sway.y, 0, sway.x); resonators[1].rotation.set(sway.y * .72, 0, sway.x * .72)
    updateSuspension()
  }
  const restore = () => { offset.set(0, 0); velocity.set(0, 0); sway.set(0, 0); swayVelocity.set(0, 0); pose() }
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', direction: [1, 0], label: '按住竹架或竹管，反复轻摇', anchor: [0, 0, .10], priority: 3, enabled: () => inputActive() && at < 3 }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), lastPointer = new THREE.Vector2()
  const refreshMotionMode = () => {
    const next = ctx.isReducedMotion?.() ?? false
    if (next === reducedMode) return false
    reducedMode = next; restore()
    if (dragging) {
      down.copy(lastPointer); dragOrigin.copy(offset); beatOrigin.copy(offset); strokeDirection.set(0, 0); lastMove = performance.now()
      savedOffset.copy(offset); savedVelocity.copy(velocity); savedSway.copy(sway); savedSwayVelocity.copy(swayVelocity)
    }
    return true
  }
  const belongs = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const reset = () => {
    const held = dragging; dragging = false
    if (held && !disposed) { offset.copy(savedOffset); velocity.copy(savedVelocity); sway.copy(savedSway); swayVelocity.copy(savedSwayVelocity); pose() }
    if (!disposed) sync()
  }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return belongs(nearestHit(x, y)?.object, frame) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      refreshMotionMode(); lastPointer.set(x, y)
      down.set(x, y); dragging = true; dragOrigin.copy(offset); beatOrigin.copy(offset); strokeDirection.set(0, 0); lastMove = performance.now()
      savedOffset.copy(offset); savedVelocity.copy(velocity); savedSway.copy(sway); savedSwayVelocity.copy(swayVelocity); sync()
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { pointer.cancel(); return }
      lastPointer.set(x, y); if (refreshMotionMode()) return
      const scale = reducedMode ? .25 : 1, before = offset.clone()
      offset.set(THREE.MathUtils.clamp(dragOrigin.x + (x - down.x) * .004 * scale, -.28 * scale, .28 * scale), THREE.MathUtils.clamp(dragOrigin.y - (y - down.y) * .003 * scale, -.20 * scale, .20 * scale))
      const delta = offset.clone().sub(before), distance = Math.hypot(delta.x / (.004 * scale), delta.y / (.003 * scale))
      if (distance < .01) return
      if (strokeDirection.dot(delta) < 0) beatOrigin.copy(before)
      strokeDirection.copy(delta)
      const now = performance.now(), dt = THREE.MathUtils.clamp((now - lastMove) / 1000, 1 / 120, .1)
      velocity.copy(delta).divideScalar(dt).clampScalar(-1.2, 1.2)
      sway.lerp(new THREE.Vector2(THREE.MathUtils.clamp(-velocity.x * .13, -.09 * scale, .09 * scale), THREE.MathUtils.clamp(velocity.y * .10, -.06 * scale, .06 * scale)), 1 - Math.exp(-18 * dt))
      swayVelocity.set(0, 0); lastMove = now; pose()
      const stroke = Math.hypot((offset.x - beatOrigin.x) / (.004 * scale), (offset.y - beatOrigin.y) / (.003 * scale))
      if (stroke >= 16 && now - lastBeat >= 110) {
        beatOrigin.copy(offset); lastBeat = now; beat(Math.min(1, distance / dt / 700))
      }
    },
    onRelease(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { reset(); return }
      refreshMotionMode()
      dragging = false; velocity.multiplyScalar(Math.exp(-Math.max(0, (performance.now() - lastMove) / 1000 - .1) * 12))
      if (reducedMode) restore()
      sync()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    controlsBusy = pointer.isBusy(); ui.renderDots(at, 3); ui.actionBtn.hidden = finishButton.hidden = at === 3
    ui.actionBtn.disabled = !inputActive() || controlsBusy || at === 3
    finishButton.disabled = !inputActive() || controlsBusy || at === 0 || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); finishButton.setAttribute('aria-disabled', String(finishButton.disabled))
    ui.hitLayer.style.pointerEvents = inputActive() && at < 3 ? 'auto' : 'none'
    setSafeText(ui.hintEl, at === 3 ? COPY.done : at === 0 ? COPY.play : COPY.quiet, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function beat(force: number) {
    if (!inputActive() || at === 3) return
    withHostCallbacks(() => {
      if (at < 2) { at = 2; ctx.onProgress?.(2) }
      if (!callbackActive()) return
      ctx.haptic?.(force > .6 ? 'medium' : 'light'); if (!callbackActive()) return
      feedback.impact({ freqs: [392, 784], duration: .12, gain: .003 + force * .003, type: 'sine' })
    })
  }
  const finish = () => {
    if (!inputActive() || pointer.isBusy() || at === 0 || at === 3 || !prepareInput()) return
    at = 3; restore()
    withHostCallbacks(() => { ctx.onProgress?.(3); if (!callbackActive()) return; ctx.haptic?.('light'); if (callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) })
  }
  const action = () => {
    if (!inputActive() || pointer.isBusy() || at === 3) return
    const now = performance.now()
    if (now - lastBeat < 110 || !prepareInput()) return
    lastBeat = now
    refreshMotionMode()
    offset.x = offset.x > 0 ? -.10 : .10; velocity.x = 0; sway.x = offset.x > 0 ? -.065 : .065; pose(); beat(.5)
    if (inputActive() && ctx.isReducedMotion?.()) restore()
  }
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
      ui.actionBtn.addEventListener('click', action); finishButton.addEventListener('click', finish); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      refreshMotionMode()
      if (suspended) { suspended = false; sync() }
      if (controlsBusy !== pointer.isBusy()) sync()
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (at < 3) {
        if (dragging) sway.multiplyScalar(Math.exp(-5 * delta))
        else {
          const steps = Math.ceil(delta * 120), h = steps ? delta / steps : 0
          for (let n = 0; n < steps; n++) {
            velocity.addScaledVector(offset, -45 * h).multiplyScalar(Math.exp(-11 * h)); offset.addScaledVector(velocity, h)
            offset.x = THREE.MathUtils.clamp(offset.x, -.30, .30); offset.y = THREE.MathUtils.clamp(offset.y, -.22, .22)
            swayVelocity.addScaledVector(sway, -60 * h).multiplyScalar(Math.exp(-8 * h)); sway.addScaledVector(swayVelocity, h)
          }
          if (offset.lengthSq() + velocity.lengthSq() + sway.lengthSq() + swayVelocity.lengthSq() < 1e-8) { offset.set(0, 0); velocity.set(0, 0); sway.set(0, 0); swayVelocity.set(0, 0) }
        }
        pose()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); finishButton.removeEventListener('click', finish)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
