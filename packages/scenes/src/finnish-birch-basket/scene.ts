import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '桦篮拾光', attach: '把台前弯曲的提柄装到篮沿。欣赏芬兰桦皮编织的日常手艺。',
  place: '提起编好的桦篮，放到右侧的灰绿垫上。', rest: '轻点篮沿，静看桦皮与谷粒的温柔色泽。',
  attaching: '提柄的两端稳稳扣入篮沿……', placing: '桦篮轻轻落在布垫上……', done: '把平常的一天，收进手作的温暖里。',
} as const
const BASKET_HOME = new THREE.Vector3(-.72, .72, -.32), BASKET_REST = new THREE.Vector3(.76, .755, -.24)
const HANDLE_HOME = new THREE.Vector3(-.86, .735, .43), HANDLE_ATTACHED = new THREE.Vector3(0, .445, 0)
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), UPRIGHT = new THREE.Quaternion()
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original everyday craft interpretation, not a reconstruction of a religious rite. */
export function createFinnishBirchBasket(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3; rotation: THREE.Quaternion } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '装好提柄' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'finnish-birch-basket', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf6f0df, ground: 0x9ca99a, key: 0xffe0ae, rim: 0xd7e5d4, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .018
  const world = new THREE.Group(); world.name = 'birch-veranda-workbench'; scene.add(world)
  const material = (color: number, roughness = .91) => new THREE.MeshStandardMaterial({ color, roughness })
  const bark = [material(0xc08b48), material(0xdbac66), material(0xe5bf7c), material(0xb57d40)]
  const edge = material(0xa9763e), wood = material(0xc2a680), endGrain = material(0x977d5c), paleWood = material(0xdfc7a0)
  const linen = material(0x81988b), stitch = material(0xc2cbb4), grainMat = material(0xe2c280), darkGrain = material(0xba9459)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.045, h / 3, d / 3)), mat, xyz, name, parent)
  const tube = (points: THREE.Vector3[], radius: number, mat: THREE.Material, parent: THREE.Object3D, closed = false, name = '') => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), points.length * 3, radius, 6, closed), mat, [0, 0, 0], name, parent)

  // A broad, braced working bench belongs to the veranda; every loose piece rests on it.
  addCraftTable(world, { name: 'birch-bench', topName: 'birch-bench-top', width: 3.5, depth: 2.24, surfaceY: .72, thickness: .14, center: [0,0], support: 'arched', finish: 'birch' })
  const shadow = add(new THREE.PlaneGeometry(4, 3), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  // A small rear rail locates the work outdoors without crowding the craft silhouette.
  for (const x of [-1.68, 1.68]) box(.09, .75, .09, linen, [x, 1.095, -1.015])
  box(3.4, .09, .09, linen, [0, 1.38, -1.015])
  const displayMat = box(1.38, .035, 1.00, linen, [.76, .7375, -.24], 'birch-display-mat')
  for (const x of [.12, 1.4]) for (let i = 0; i < 13; i++) box(.03, .003, .018, stitch, [x, .7565, -.65 + i * .065])
  for (let i = 0; i < 17; i++) for (const z of [-.702, .222]) box(.034, .003, .012, stitch, [.18 + i * .072, .7565, z])

  const basket = new THREE.Group(); basket.name = 'birch-basket'; world.add(basket)
  const bottom = new THREE.Shape(), bx = .53, bz = .315, br = .11
  bottom.moveTo(-bx + br, -bz); bottom.lineTo(bx - br, -bz); bottom.quadraticCurveTo(bx, -bz, bx, -bz + br)
  bottom.lineTo(bx, bz - br); bottom.quadraticCurveTo(bx, bz, bx - br, bz); bottom.lineTo(-bx + br, bz)
  bottom.quadraticCurveTo(-bx, bz, -bx, bz - br); bottom.lineTo(-bx, -bz + br); bottom.quadraticCurveTo(-bx, -bz, -bx + br, -bz)
  const bottomGeometry = new THREE.ExtrudeGeometry(bottom, { depth: .042, bevelEnabled: false, curveSegments: 8 }); bottomGeometry.rotateX(-Math.PI / 2)
  add(bottomGeometry, bark[1], [0, 0, 0], 'birch-basket-base', basket)
  // A rounded rectangular perimeter, stretched gently outwards towards the rim.
  const segments = [1.0, Math.PI * .13 / 2, .48, Math.PI * .13 / 2, 1.0, Math.PI * .13 / 2, .48, Math.PI * .13 / 2]
  const perimeter = segments.reduce((a, b) => a + b, 0), stripCount = 28, spacing = perimeter / stripCount
  const surface = (distance: number, y: number, depth = 0) => {
    let s = ((distance % perimeter) + perimeter) % perimeter, side = 0
    while (s > segments[side] && side < 7) { s -= segments[side]; side++ }
    let x = 0, z = 0, nx = 0, nz = 0
    const theta = s / .13
    if (side === 0) { x = -.5 + s; z = .37; nz = 1 }
    if (side === 1) { x = .5 + .13 * Math.sin(theta); z = .24 + .13 * Math.cos(theta); nx = Math.sin(theta); nz = Math.cos(theta) }
    if (side === 2) { x = .63; z = .24 - s; nx = 1 }
    if (side === 3) { x = .5 + .13 * Math.cos(theta); z = -.24 - .13 * Math.sin(theta); nx = Math.cos(theta); nz = -Math.sin(theta) }
    if (side === 4) { x = .5 - s; z = -.37; nz = -1 }
    if (side === 5) { x = -.5 - .13 * Math.sin(theta); z = -.24 - .13 * Math.cos(theta); nx = -Math.sin(theta); nz = -Math.cos(theta) }
    if (side === 6) { x = -.63; z = -.24 + s; nx = -1 }
    if (side === 7) { x = -.5 - .13 * Math.cos(theta); z = .24 + .13 * Math.sin(theta); nx = -Math.cos(theta); nz = Math.sin(theta) }
    const taper = .83 + .17 * y / .46
    return new THREE.Vector3(x * taper + nx * depth, y, z * taper + nz * depth)
  }
  // Each diagonal strip has thickness. The two directions alternate over/under at crossings.
  for (const direction of [-1, 1]) for (let strip = 0; strip < stripCount; strip++) {
    const vertices: number[] = [], indices: number[] = [], subdivisions = 30
    for (let j = 0; j <= subdivisions; j++) {
      const y = .022 + j / subdivisions * .423, along = strip * spacing + direction * y
      const weave = direction * .010 * Math.cos(2 * Math.PI * y / spacing)
      for (const depth of [weave - .005, weave + .005]) for (const across of [-.058, .058]) vertices.push(...surface(along + across, y, depth).toArray())
    }
    for (let j = 0; j < subdivisions; j++) {
      const n = j * 4
      for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) indices.push(n + a, n + b, n + b + 4, n + a, n + b + 4, n + a + 4)
    }
    indices.push(0, 2, 3, 0, 3, 1)
    const n = subdivisions * 4; indices.push(n, n + 1, n + 3, n, n + 3, n + 2)
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const mesh = add(geometry, bark[(strip + (direction > 0 ? 0 : 1)) % bark.length], [0, 0, 0], `birch-weave-${direction}-${strip}`, basket)
    mesh.material.side = THREE.DoubleSide
  }
  const rim = new THREE.Group(); rim.name = 'birch-rim'; basket.add(rim)
  for (const y of [.435, .474]) {
    const points = Array.from({ length: 65 }, (_, i) => surface(i / 65 * perimeter, y))
    tube(points, .024, edge, rim, true)
  }
  // The exposed front finishing strip is a real grip and the visible interaction anchor.
  const rimGrip = box(.34, .084, .052, bark[2], [0, .465, .38], 'birch-rim-grip', rim)
  for (const x of [-.4, -.2, .2, .4]) box(.027, .06, .050, bark[1], [x, .454, .373], '', rim)
  for (let i = 0; i < 24; i++) {
    const x = -.37 + (i % 6) * .136, z = -.17 + Math.floor(i / 6) * .11
    const grain = add(new THREE.SphereGeometry(1, 10, 6), i % 4 ? grainMat : darkGrain, [x, .063, z], `birch-grain-${i}`, basket)
    grain.scale.set(.039, .021, .019); grain.rotation.y = (i * 1.7) % Math.PI
  }
  // Three solid swept pieces form a flat birch handle; its crest is a separate grip.
  const handle = new THREE.Group(); handle.name = 'birch-handle'; world.add(handle)
  const arch = (a: number, b: number, name: string) => {
    const shape = new THREE.Shape(), steps = 24
    for (let i = 0; i <= steps; i++) {
      const t = a + (b - a) * i / steps, x = .651 * Math.sin(t), y = .57 * Math.cos(t)
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
    }
    for (let i = steps; i >= 0; i--) { const t = a + (b - a) * i / steps; shape.lineTo(.609 * Math.sin(t), .528 * Math.cos(t)) }
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .03, bevelEnabled: false, curveSegments: 8 }); geometry.translate(0, 0, -.015)
    const originY = name === 'birch-handle-grip' ? .549 : 0
    geometry.translate(0, -originY, 0)
    return add(geometry, bark[2], [0, originY, 0], name, handle)
  }
  arch(-Math.PI / 2, -.20, 'birch-handle-left'); arch(-.20, .20, 'birch-handle-grip'); arch(.20, Math.PI / 2, 'birch-handle-right')
  for (const [x, name] of [[-.63, 'left'], [.63, 'right']] as const) box(.05, .08, .03, edge, [x, .014, 0], `birch-handle-foot-${name}`, handle)

  // A hollow wooden scoop and a few offcuts make this a working still life.
  const scoop = new THREE.Group(); scoop.name = 'birch-grain-scoop'; scoop.position.set(.76, .72, .69); scoop.rotation.y = -.18; world.add(scoop)
  const profile = [[0, 0], [.10, 0], [.18, .038], [.22, .11], [.22, .14], [.195, .14], [.16, .055], [.08, .028], [0, .028]].map(([x, y]) => new THREE.Vector2(x, y))
  add(new THREE.LatheGeometry(profile, 24), paleWood, [0, 0, 0], 'birch-scoop-bowl', scoop)
  box(.37, .055, .085, paleWood, [.32, .1125, 0], 'birch-scoop-stem', scoop)
  for (let i = 0; i < 8; i++) {
    const seed = add(new THREE.SphereGeometry(1, 8, 6), grainMat, [-.07 + i % 3 * .065, .05, -.06 + Math.floor(i / 3) * .053], '', scoop); seed.scale.set(.027, .015, .015)
  }
  for (let i = 0; i < 3; i++) { const offcut = box(.47, .012, .055, bark[i], [.02, .727 + i * .012, -.85]); offcut.rotation.y = -.12 + i * .09 }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    basket.position.copy(checkpoint >= 2 ? BASKET_REST : BASKET_HOME)
    if (checkpoint >= 1) { basket.add(handle); handle.position.copy(HANDLE_ATTACHED); handle.quaternion.copy(UPRIGHT) }
    else { world.add(handle); handle.position.copy(HANDLE_HOME); handle.quaternion.copy(FLAT) }
    matrices()
  }
  const handleGrip = handle.getObjectByName('birch-handle-grip')!
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(handleGrip, { kind: 'drag', label: '装好提柄', priority: 3, enabled: enabled(0), destination: rimGrip, targetLabel: '桦篮前沿' })
  addInteractionCue(rimGrip, { kind: 'drag', label: '安放桦篮', priority: 3, enabled: enabled(1), destination: displayMat, targetLabel: '灰绿布垫' })
  addInteractionCue(rimGrip, { kind: 'tap', label: '轻点桦篮静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? handle : basket
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === held) return
      meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object === target
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return hitsVisible(x, y, checkpoint === 0 ? handleGrip : rimGrip) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), object.position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices() },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && maxTravel >= 8 && placementHit(canvas, camera, checkpoint === 0 ? handleGrip : rimGrip, x, y, (px, py) => hitsVisible(px, py, checkpoint === 0 ? rimGrip : displayMat, moving())) : maxTravel < 12 && hitsVisible(x, y, rimGrip)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '装好提柄' : checkpoint === 1 ? '安放桦篮' : '轻点桦篮静看', safe)
    setSafeText(ui.hintEl, transition ? transition.step === 0 ? COPY.attaching : COPY.placing : checkpoint === 0 ? COPY.attach : checkpoint === 1 ? COPY.place : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  function settle() { if (!active() || !transition) return; checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [349.23, 440], duration: .15, gain: .011 }) }
  function advance() {
    if (!active() || pointer.isBusy() || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(); sync(); ctx.onProgress?.(3); feedback.impact({ freqs: [349.23, 523.25], duration: .21, gain: .012 }); overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: moving().position.clone(), rotation: moving().quaternion.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.5 + boost * .4, 5.8 + boost); camera.lookAt(0, .85, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        if (transition.step === 0) { handle.position.lerpVectors(transition.from, basket.position.clone().add(HANDLE_ATTACHED), t); handle.quaternion.slerpQuaternions(transition.rotation, UPRIGHT, t); if (!ctx.isReducedMotion?.()) handle.position.y += Math.sin(t * Math.PI) * .18 }
        else { basket.position.lerpVectors(transition.from, BASKET_REST, t); if (!ctx.isReducedMotion?.()) basket.position.y += Math.sin(t * Math.PI) * .19 }
        if (transition.time === 1) settle()
      }
      style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
