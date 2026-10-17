import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

type XYZ = [number, number, number]
type Checkpoint = 0 | 1 | 2 | 3
const COPY = {
  title: '竹蜓点风', left: '拿住竹蜻蜓的头，向上轻送，让尖喙落在细枝顶端。',
  right: '轻推右侧蓝绿色长翼，向右短拖后松手，看它围着一个接触点轻摆。',
  quiet: '轻点竹蜻蜓的头，看看彩绘竹翼、细尾与枝尖之间的平衡。',
  settling: '竹翼轻轻回摆，幅度慢慢变小，尖喙停在枝尖的同一个点。',
  done: '愿今天留一点轻盈。',
} as const
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original contemporary Thach Xa public craft study; authored balance motion, not a physics simulation. */
export function createVietnameseBambooDragonfly(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}, shakeAmount = 0
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let dragging = false, moved = false, maxTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '拿住竹蜓头向上轻送' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'vietnamese-bamboo-dragonfly', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf8efcf, ground: 0x6f8661, key: 0xffe5b0, rim: 0xe7f4df, keyPosition: [-3, 6, 5], keyIntensity: 2.1, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .014
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 15 })
  const world = new THREE.Group(); world.name = 'dragonfly-world'; scene.add(world)
  const subject = new THREE.Group(); subject.name = 'dragonfly-subject'; world.add(subject)
  const pivot = new THREE.Group(); pivot.name = 'dragonfly-balance-pivot'; subject.add(pivot)
  const mat = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const bamboo = mat(0xd9b36b), cut = mat(0xf4d99a), node = mat(0x9a7a43), teal = mat(0x427e75), coral = mat(0xd96f50), ink = mat(0x344d44), stone = mat(0xa9afa0, .97)
  const wingPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .83 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = pivot) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const marker = (name: string, p: XYZ, parent: THREE.Object3D) => { const o = new THREE.Object3D(); o.name = name; o.position.set(...p); parent.add(o); return o }
  const rod = (name: string, a: XYZ, b: XYZ, bottom: number, top: number, material: THREE.Material, parent: THREE.Object3D) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start)
    const m = add(name, new THREE.CylinderGeometry(top, bottom, direction.length(), 24), material, [0, 0, 0], parent)
    m.position.copy(start).lerp(end, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return m
  }
  const sphere = new THREE.SphereGeometry(1, 24, 16)
  const foot = add('dragonfly-stone-foot', sphere, stone, [-.08, .10, .02], subject); foot.scale.set(.42, .14, .31); foot.rotation.y = -.28
  // A slightly bent bamboo upright is the sole support; its top ends in one point.
  rod('dragonfly-support-lower', [-.08, .19, .02], [-.045, .91, .065], .044, .034, bamboo, subject)
  rod('dragonfly-support-upper', [-.045, .91, .065], [0, 1.58, .10], .034, 0, bamboo, subject)
  for (const [i, y] of [.41, .91, 1.22].entries()) {
    const t = (y - .19) / 1.39, ring = add(`dragonfly-support-node-${i}`, new THREE.TorusGeometry(.033 - .01 * t, .006, 6, 24), node, [-.08 * (1 - t), y, .02 + .08 * t], subject)
    ring.rotation.x = Math.PI / 2; ring.rotation.z = -.05
  }
  marker('dragonfly-support-tip', [0, 1.58, .10], subject)
  marker('dragonfly-beak-contact', [0, 0, 0], pivot)
  rod('dragonfly-beak', [0, 0, 0], [0, .125, -.065], 0, .055, cut, pivot)
  const head = add('dragonfly-head', new THREE.SphereGeometry(.145, 28, 20), coral, [0, .145, -.067]); head.scale.set(1, .77, 1)
  for (const side of [-1, 1]) {
    const eye = add(`dragonfly-eye-${side < 0 ? 'left' : 'right'}`, sphere, ink, [side * .105, .205, .015]); eye.scale.set(.052, .048, .050)
    const glint = add(`dragonfly-eye-glint-${side}`, sphere, cut, [side * .11, .226, .052]); glint.scale.setScalar(.013); glint.userData.toonSurface = { outline: false }
  }
  const thorax = add('dragonfly-thorax', sphere, teal, [0, .155, -.34]); thorax.scale.set(.104, .066, .25)
  const tailPositions: number[] = [], tailIndices: number[] = [], rings = 30, sides = 12
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, radius = .066 * (1 - t) + .006
    for (let j = 0; j < sides; j++) { const a = j / sides * Math.PI * 2; tailPositions.push(Math.cos(a) * radius, .158 + .035 * t + Math.sin(a) * radius * .57, -.39 - 1.19 * t) }
    if (i > 0) for (let j = 0; j < sides; j++) { const a = (i - 1) * sides + j, b = (i - 1) * sides + (j + 1) % sides, c = i * sides + j, d = i * sides + (j + 1) % sides; tailIndices.push(a, c, b, b, c, d) }
  }
  tailPositions.push(0, .193, -1.585); const tipIndex = tailPositions.length / 3 - 1
  for (let j = 0; j < sides; j++) tailIndices.push(rings * sides + j, tipIndex, rings * sides + (j + 1) % sides)
  tailPositions.push(0, .158, -.39); const baseIndex = tailPositions.length / 3 - 1
  for (let j = 0; j < sides; j++) tailIndices.push(baseIndex, j, (j + 1) % sides)
  const tailGeometry = new THREE.BufferGeometry(); tailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tailPositions, 3)); tailGeometry.setIndex(tailIndices); tailGeometry.computeVertexNormals()
  add('dragonfly-tail', tailGeometry, bamboo, [0, 0, 0])
  for (let i = 0; i < 7; i++) {
    const t = .1 + i * .11, radius = .066 * (1 - t) + .007, band = add(`dragonfly-tail-painted-band-${i}`, new THREE.TorusGeometry(radius, .005, 6, 24), i % 2 ? coral : teal, [0, .158 + .035 * t, -.39 - 1.19 * t]); band.scale.y = .57
  }
  // Four solid bent strips: their long tips sweep forward and below the beak pivot.
  // Paint is stored in the surface colours, so it cannot intercept the object's cue.
  const wing = (side: number, front: boolean) => {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [], steps = 48, across = 8
    const base = new THREE.Color(front ? 0x469b94 : 0xd87957), dark = new THREE.Color(front ? 0x346e70 : 0xb9563f), gold = new THREE.Color(0xf4ce76), raw = new THREE.Color(0xd4aa60)
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = .075 + (front ? 1.525 : 1.30) * t, z = (front ? -.31 : -.61) + (front ? 1.18 : .88) * t, y = .15 - (front ? .50 : .48) * t ** 1.5
      // The visible outer bamboo carries more material, like a carved balancing toy.
      const width = .018 + (front ? .15 : .13) * Math.sin(Math.PI * t) ** .65 * (.55 + .8 * t), thickness = .016 + .092 * t ** 3
      for (let j = 0; j <= across; j++) {
        const cross = j / across * 2 - 1
        positions.push(side * (x - cross * width * .36), y + (layer ? -thickness / 2 : thickness / 2) + (1 - cross * cross) * .009, z + cross * width)
        let color = layer ? raw : Math.abs(cross) > .82 ? gold : t > .88 ? dark : base
        if (!layer && Math.abs(cross) < .60 && [.25, .49, .73].some(center => ((t - center) / .043) ** 2 + (cross / .54) ** 2 < 1)) color = gold
        if (!layer && Math.abs(cross) < .16 && t > .12 && t < .83) color = dark
        colors.push(color.r, color.g, color.b)
      }
    }
    const row = across + 1, layerSize = (steps + 1) * row
    const tri = (a: number, b: number, c: number) => side > 0 ? indices.push(a, b, c) : indices.push(a, c, b)
    for (let i = 0; i < steps; i++) for (let j = 0; j < across; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1
      tri(a, b, c); tri(b, d, c); tri(a + layerSize, c + layerSize, b + layerSize); tri(b + layerSize, c + layerSize, d + layerSize)
    }
    for (let i = 0; i < steps; i++) for (const j of [0, across]) {
      const a = i * row + j, b = a + row, c = a + layerSize, d = b + layerSize
      if (j === 0) { tri(a, b, c); tri(b, d, c) } else { tri(a, c, b); tri(b, c, d) }
    }
    for (const i of [0, steps]) for (let j = 0; j < across; j++) {
      const a = i * row + j, b = a + 1, c = a + layerSize, d = b + layerSize
      if (i === 0) { tri(a, c, b); tri(b, c, d) } else { tri(a, b, c); tri(b, d, c) }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    return add(`dragonfly-wing-${front ? 'front' : 'rear'}-${side > 0 ? 'right' : 'left'}`, geometry, wingPaint, [0, 0, 0])
  }
  let rightWing!: THREE.Mesh
  for (const side of [-1, 1]) { const front = wing(side, true); if (side > 0) rightWing = front; wing(side, false) }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  let placement = 0, sway = 0
  const setPose = () => {
    pivot.position.set(0, 1.58 - .52 * (1 - placement), .10 + .35 * (1 - placement))
    pivot.rotation.set(.035 * sway, -.23 * sway, -.075 * sway); matrices()
  }
  const pose = (step: 0 | 1, amount: number, settling = 0) => {
    shakeAmount = amount
    if (step === 0) { placement = amount; sway = 0 }
    else {
      placement = 1
      sway = settling ? amount * Math.exp(-3.8 * settling) * Math.cos(settling * Math.PI * 4) * (1 - ease(settling)) : amount
    }
    setPose()
  }
  const restore = () => { pose(0, at === 0 ? 0 : 1); shakeAmount = 0 }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(head, { kind: 'drag', label: '拿住竹蜓头向上轻送', anchor: [0, .035, .13], priority: 3, enabled: enabled(0) }),
    addInteractionCue(rightWing, { kind: 'drag', label: '轻推右侧竹翼后松手', anchor: [1.18, -.14, .545], priority: 3, enabled: enabled(1) }),
    addInteractionCue(head, { kind: 'tap', label: '轻点竹蜓静观', anchor: [0, .035, .13], priority: 3, enabled: enabled(2) }),
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
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return belongs(nearestHit(x, y)?.object, at === 1 ? rightWing : head) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y
      along = at === 0 ? -dy : dx; maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along)
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dx : dy)); moved ||= maxTravel > 0
      if (dragging) pose(at as 0 | 1, THREE.MathUtils.clamp(along / 60, 0, 1))
    },
    onRelease(x, y) {
      const dx = x - down.x, dy = y - down.y, end = at === 0 ? -dy : dx
      const valid = Number.isFinite(x) && Number.isFinite(y) && (at < 2 ? dragging && moved && along >= 42 && end >= 42 && end <= 84 && maxTravel <= 90 && minAlong >= -8 && backtrack <= 9 && maxAlong - end <= 9 && maxCross <= 18 && Math.abs(at === 0 ? dx : dy) <= 18 && Math.hypot(dx, dy) <= 90
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && belongs(nearestHit(x, y)?.object, head))
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? '拿住竹蜓头向上轻送' : at === 1 ? '轻推右侧竹翼后松手' : '轻点竹蜓静观', safe)
    setSafeText(ui.hintEl, motion ? COPY.settling : at === 0 ? COPY.left : at === 1 ? COPY.right : at === 2 ? COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  const sound = () => feedback.impact({ freqs: [659.25], duration: .11, gain: .003, type: 'sine' })
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
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, 1.04, -.12), direction = new THREE.Vector3(.04, .94, 1.25).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(), saved: [number, number] = [placement, sway]; let distance = 3.9
    // Fixed framing includes every subject vertex in the authored placement and sway poses.
    for (const pose of [[0, 0], [.5, 0], [1, 0], [1, 1], [1, -.5]]) {
      [placement, sway] = pose; setPose()
      subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return
        const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) {
          p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse)
          distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .88), p.z + Math.abs(p.y) / (tangent * .88))
        }
      })
    }
    [placement, sway] = saved; setPose(); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
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
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .95)
        if (motion.step === 0) pose(0, THREE.MathUtils.lerp(motion.from, 1, ease(motion.time)))
        else if (motion.from > 0) pose(1, motion.from, motion.time)
        else { const t = motion.time; pose(1, t < .22 ? ease(t / .22) : 1, t < .22 ? 0 : (t - .22) / .78) }
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
