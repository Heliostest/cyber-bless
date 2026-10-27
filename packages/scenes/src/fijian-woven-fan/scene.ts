import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '叶扇纳凉', assemble: '拿起桌前的收口绑带，接到木柄上端。',
  display: '握住木柄，把完整的叶扇移到右侧木展座，让扇柄落稳。',
  rest: '轻点扇柄，静看编叶交错的纹理。',
  moving: '编叶轻轻合拢，木柄缓缓落稳…', done: '愿清凉与安宁留在日常。',
} as const
const HOME = new THREE.Vector3(-.64, .80, 0), REST = new THREE.Vector3(.69, .99, 0)
const BINDING_HOME = new THREE.Vector3(-.90, .91, .64), JOIN = new THREE.Vector3(0, .86, .03)
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original pandanus craft appreciation, not a sevusevu or kava ceremony. */
export function createFijianWovenFan(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, suspended = false
  let dragging = false, maxTravel = 0, notifying = false, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ prepareFeedback: ctx.prepareFeedback, haptic: ctx.haptic,
    isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '接好收口绑带' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'fijian-woven-fan', label: COPY.title }); style.setStyle(CEL_STYLE)
  // Suspend presentation without a late GPU frame after a host callback pauses us.
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf4eee0, ground: 0xb1b4a3, key: 0xffedcf, rim: 0xd9e8e9,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .48 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .018
  const world = new THREE.Group(); world.name = 'fan-workbench'; scene.add(world)
  const material = (color: number, roughness = .83) => new THREE.MeshStandardMaterial({ color, roughness })
  const straw = material(0xd9bd7f), pale = material(0xe3cc99), reed = material(0xad8751), sage = material(0x788b63)
  const sienna = material(0xa86240), oak = material(0xcbb18b), walnut = material(0x8c7051), wood = material(0xaa7e4b, .68)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p)
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.02, ...size.map(v => v / 3))), mat, p, parent)
  const tube = (name: string, points: XYZ[], radius: number, mat: THREE.Material, parent: THREE.Object3D, closed = false, segments = 64) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal'), segments, radius, 6, closed), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  addCraftTable(world, { name: 'fan-table', topName: 'fan-table', width: 3.58, depth: 1.64, surfaceY: .76, thickness: .12, center: [0,.03], support: 'trestle', finish: 'honey' })
  const shadow = add('fan-contact-shadow', new THREE.PlaneGeometry(4, 2.2), new THREE.ShadowMaterial({ opacity: .12 }), [0, .003, .1]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('fan-home-seat', [.67, .04, .45], [-.64, .78, 0], sage)
  box('fan-home-back-rest', [.17, .57, .09], [-.64, 1.085, -.088], walnut)
  box('fan-binding-pad', [.40, .04, .35], [-.90, .78, .64], sage)
  box('fan-display-base', [.90, .06, .58], [.69, .79, 0], walnut)
  box('fan-display-post', [.54, .11, .38], [.69, .875, 0], walnut)
  const seat = box('fan-display-seat', [.78, .06, .48], [.69, .96, 0], sage)
  box('fan-display-back-rest', [.17, .59, .09], [.69, 1.285, -.088], walnut)
  const fan = new THREE.Group(); fan.name = 'fan-body'; world.add(fan)
  const grip = box('fan-handle-grip', [.15, .70, .14], [0, .35, .028], wood, fan)
  box('fan-handle-upper', [.14, .33, .14], [0, .76, .028], wood, fan)
  // Split handle forks overlap the blade and frame; no detached ornament.
  for (const z of [-.02, .072]) box('fan-handle-split', [.13, .35, .045], [0, 1.025, z], wood, fan)
  const joint = box('fan-neck-joint', [.205, .22, .17], [0, .86, .03], reed, fan)
  // Freely drawn spade-shaped leaf. Its over/under weave is a contemporary
  // simplification, not the coiled construction or decoration of a museum item.
  const outline: [number, number][] = [[0, .92], [-.23, 1.04], [-.50, 1.29], [-.68, 1.61], [-.67, 1.87], [-.48, 2.09], [-.20, 2.28], [0, 2.43], [.20, 2.28], [.48, 2.09], [.67, 1.87], [.68, 1.61], [.50, 1.29], [.23, 1.04]]
  const outlineCurve = new THREE.CatmullRomCurve3(outline.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal')
  const boundary = outlineCurve.getPoints(168).map(p => new THREE.Vector2(p.x, p.y))
  const blade = add('fan-woven-core', new THREE.ExtrudeGeometry(new THREE.Shape(boundary), { depth: .038, bevelEnabled: false, steps: 1 }), straw, [0, 0, -.014], fan)
  blade.userData.toonSurface = { outline: false }
  tube('fan-bound-edge', outline.map(([x, y]) => [x, y, .018]), .035, reed, fan, true, 120)
  const intersections = (level: number, direction: number) => {
    const points: THREE.Vector2[] = []
    for (let i = 0; i < boundary.length - 1; i++) {
      const a = boundary[i], b = boundary[i + 1], da = a.y - direction * a.x - level, db = b.y - direction * b.x - level
      if (da * db < 0) points.push(a.clone().lerp(b, da / (da - db)))
    }
    return points.sort((a, b) => a.x - b.x)
  }
  // Each clipped strip is a closed shallow ribbon; alternating raised crossings
  // cast small shadows while the backing leaf keeps the fan fully opaque.
  for (const direction of [-1, 1]) for (let row = -2; row <= 32; row++) {
    const points = intersections(.64 + row * .061, direction)
    if (points.length < 2) continue
    const a = points[0], b = points[points.length - 1], length = a.distanceTo(b)
    if (length < .045) continue
    const segments = Math.max(2, Math.ceil(length / .043)), positions: number[] = [], indices: number[] = []
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, x = THREE.MathUtils.lerp(a.x, b.x, t), y = THREE.MathUtils.lerp(a.y, b.y, t)
      const z = .029 + .008 * Math.sin((y + direction * x - .64) / .061 * Math.PI + (direction < 0 ? Math.PI : 0))
      for (const [side, depth] of [[-1, 0], [1, 0], [-1, -.014], [1, -.014]]) positions.push(x + nx * .019 * side, y + ny * .019 * side, z + depth)
      if (i < segments) {
        const n = i * 4
        indices.push(n, n + 1, n + 5, n, n + 5, n + 4, n + 2, n + 6, n + 7, n + 2, n + 7, n + 3,
          n, n + 4, n + 6, n, n + 6, n + 2, n + 1, n + 3, n + 7, n + 1, n + 7, n + 5)
      }
    }
    indices.push(0, 2, 3, 0, 3, 1); const end = segments * 4; indices.push(end, end + 1, end + 3, end, end + 3, end + 2)
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const strip = add('fan-woven-strip', geometry, row % 5 === 0 ? reed : direction > 0 ? pale : straw, [0, 0, 0], fan)
    strip.userData.toonSurface = { outline: false }
  }
  for (const x of [-.48, 0, .48]) tube('fan-reed-rib', [[0, .96, -.022], [x * .7, 1.54, -.031], [x, x === 0 ? 2.40 : 2.09, -.014]], .018, reed, fan)
  for (let i = 0; i < 50; i++) {
    const p = outlineCurve.getPointAt(i / 50), tangent = outlineCurve.getTangentAt(i / 50), nx = -tangent.y, ny = tangent.x
    tube('fan-edge-tie', [[p.x - nx * .031, p.y - ny * .031, -.012], [p.x, p.y, -.019], [p.x + nx * .033, p.y + ny * .033, .018], [p.x, p.y, .055], [p.x - nx * .031, p.y - ny * .031, .039]], .006, straw, fan, false, 12)
  }
  const binding = new THREE.Group(); binding.name = 'fan-loose-binding'; world.add(binding)
  const bindingGrip = box('fan-binding-grip', [.255, .22, .032], [0, 0, .099], sienna, binding)
  box('fan-binding-back', [.255, .22, .032], [0, 0, -.099], straw, binding)
  for (const x of [-.114, .114]) box('fan-binding-side', [.027, .22, .20], [x, 0, 0], straw, binding)
  for (const y of [-.077, -.036, .046, .087]) box('fan-binding-strand', [.255, .009, .007], [0, y, .116], reed, binding)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    fan.position.copy(checkpoint >= 2 ? REST : HOME); fan.rotation.set(0, 0, 0)
    if (checkpoint >= 1) { fan.add(binding); binding.position.copy(JOIN) } else { world.add(binding); binding.position.copy(BINDING_HOME) }
    binding.rotation.set(0, 0, 0); matrices()
  }
  const enabled = (at: number) => () => active() && !notifying && !transition && checkpoint === at
  const removeCues = [
    addInteractionCue(bindingGrip, { kind: 'drag', label: '接好收口绑带', priority: 3, enabled: enabled(0), destination: joint, targetLabel: '木柄收口' }),
    addInteractionCue(grip, { kind: 'drag', label: '把叶扇放上展座', priority: 3, enabled: enabled(1), destination: seat, targetLabel: '木展座' }),
    addInteractionCue(grip, { kind: 'tap', label: '轻点扇柄静看', priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? binding : fan
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const visibleHit = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || (held && belongsTo(object, held))) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (!materials.some(mat => mat.visible && (!mat.transparent || mat.opacity >= 1))) return
      meshes.push(object)
    })
    return belongsTo(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object, target)
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: () => active() && !notifying,
    canStart(x, y) { if (notifying || transition || checkpoint === 3) return false; matrices(); return visibleHit(x, y, checkpoint === 0 ? binding : fan) },
    onStart(x, y) {
      withHostCallbacks(() => feedback.prepare()); if (!active()) { pointer.cancel(); return }
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (checkpoint===0?bindingGrip:grip).getWorldPosition(new THREE.Vector3()))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point)
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset)
      matrices()
      if (checkpoint < 2 && placementHit(canvas, camera, checkpoint === 0 ? bindingGrip : grip, x, y, (px, py) => visibleHit(px, py, checkpoint === 0 ? joint : seat, moving())) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset)
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && placementHit(canvas, camera, checkpoint === 0 ? bindingGrip : grip, x, y, (px, py) => visibleHit(px, py, checkpoint === 0 ? joint : seat, moving()))
        : maxTravel < 12 && visibleHit(x, y, fan)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || notifying || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '接好收口绑带' : checkpoint === 1 ? '把叶扇放上展座' : '轻点扇柄静看', safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.assemble : checkpoint === 1 ? COPY.display : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  // A host may synchronously click, dispatch pointer input or update us while
  // notified. Commit one user action atomically across all external callbacks.
  function withHostCallbacks(callback: () => void) {
    notifying = true; sync()
    try { callback() } finally { notifying = false; if (!disposed) sync() }
  }
  function settle() {
    if (!active() || !transition) return
    checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(checkpoint)
      if (active()) feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .012, type: 'triangle' })
    })
  }
  function advance(placed = false) {
    if (!active() || notifying || (pointer.isBusy() && !placed) || transition || checkpoint === 3) return
    if (checkpoint === 2) {
      checkpoint = 3; restore()
      withHostCallbacks(() => {
        ctx.onProgress?.(3)
        if (!active()) return
        feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .012 })
        if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
      })
      return
    }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle()
  }
  const action = () => { if (!active() || notifying || pointer.isBusy() || transition || checkpoint === 3) return; withHostCallbacks(() => feedback.prepare()); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.48 + boost * .35, 6.7 + boost); camera.lookAt(0, 1.55, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed || notifying) return
      if (!active()) { pointer.cancel(); if (!suspended) { sync(); suspended = true } return }
      if (suspended) { suspended = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        transition.time = reduced() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        const dest = transition.step === 0 ? fan.localToWorld(JOIN.clone()) : REST
        moving().position.lerpVectors(transition.from, dest, t)
        if (!reduced()) moving().position.y += Math.sin(t * Math.PI) * .12
        if (transition.time === 1) settle()
      }
      if (!active()) return
      matrices(); style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world)
      Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
