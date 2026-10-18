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
  title: '节旗轻展',
  unfurl: '拖动布旗右上角的浅金布耳，扣到横杆右端，让布面展开。',
  place: '握住下方缠线的木杆，把旗子安放到右侧木座的圆孔里。',
  rest: '轻触木杆或布面，静看海浪与太阳的纹样。',
  opening: '布耳扣向横杆，折叠的布面缓缓展开……', placing: '木杆稳稳落入木座……',
  done: '愿每一次相聚，都有人细心准备。',
} as const
const HOME = new THREE.Vector3(-.78, .70, -.13), SEATED = new THREE.Vector3(.84, .82, .23)
const LEFT = -.52, TOP = 1.78, FULL_WIDTH = 1.14, FOLDED_WIDTH = .24
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** An original miniature craft, not a replica of a parish banner or a religious act. */
export function createBretonBanner(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, inactiveRendered = false, checkpoint: Checkpoint = 0
  let dragging = false, maxTravel = 0, open = 0, lift = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3; open: number; lift: number } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '展开布旗' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'breton-banner', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf1eee0, ground: 0x829b8f, key: 0xffe5b5, rim: 0xc5dfdd, keyPosition: [-3, 5, 4], keyIntensity: 1.2, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0006; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'banner-workshop'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide })
  const wood = mat(0xb48b60), endgrain = mat(0x8d6848), clothMat = mat(0x487f85), border = mat(0xe0c681), thread = mat(0xd5dabd), socketMat = mat(0x78674f)
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.03, h / 3, d / 3)), material, xyz, name, parent)
  addCraftTable(world, { name: 'banner-table', topName: 'banner-workbench', width: 3.1, depth: 1.6, surfaceY: .7, thickness: .12, center: [0,0], support: 'joined', finish: 'honey' })
  const shadow = add(new THREE.PlaneGeometry(3.7, 2.4), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  add(new THREE.CylinderGeometry(.43, .46, .10, 36), wood, [.84, .75, .23], 'banner-stand-base')
  const socket = add(new THREE.CylinderGeometry(.17, .17, .012, 32), socketMat, [.84, .814, .23], 'banner-stand-socket')
  const collar = add(new THREE.TorusGeometry(.19, .020, 10, 36), endgrain, [.84, .842, .23], 'banner-stand-collar'); collar.rotation.x = Math.PI / 2
  // A small spool and folded offcut read as a workbench, without ceremonial props.
  add(new THREE.CylinderGeometry(.09, .09, .11, 20), thread, [-1.21, .755, .53], 'banner-thread-spool')
  for (const y of [.713, .817]) add(new THREE.CylinderGeometry(.115, .115, .015, 20), wood, [-1.21, y, .53])
  box(.40, .016, .26, clothMat, [-.67, .710, .53], 'banner-offcut')
  const assembly = new THREE.Group(); assembly.name = 'banner-assembly'; world.add(assembly)
  add(new THREE.CylinderGeometry(.043, .043, 1.89, 16), wood, [0, .945, 0], 'banner-staff', assembly)
  const crossbar = add(new THREE.CylinderGeometry(.038, .038, 1.39, 16), wood, [.045, 1.84, .06], 'banner-crossbar', assembly); crossbar.rotation.z = Math.PI / 2
  for (const x of [-.66, .75]) add(new THREE.SphereGeometry(.059, 16, 10), endgrain, [x, 1.84, .06], '', assembly)
  const clip = box(.16, .13, .10, border, [.64, TOP + .035, .11], 'banner-crossbar-clip', assembly)
  const grip = add(new THREE.CylinderGeometry(.078, .078, .30, 24), thread, [0, .43, .018], 'banner-staff-grip', assembly)
  for (let y = .30; y <= .57; y += .045) {
    const ring = add(new THREE.TorusGeometry(.079, .005, 6, 24), border, [0, y, .018], '', assembly); ring.rotation.x = Math.PI / 2
  }
  // Accordion folds carry the paint, seams and tassels with the actual cloth vertices.
  const cloth = new THREE.Group(); cloth.name = 'banner-cloth-assembly'; assembly.add(cloth)
  const patches: { mesh: THREE.Mesh; uv: Float32Array; depth: number }[] = []
  function patch(name: string, uvs: number[], indices: number[], material: THREE.Material, depth = 0) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(uvs.length / 2 * 3), 3)); geo.setIndex(indices)
    const mesh = add(geo, material, [0, 0, 0], name, cloth)
    patches.push({ mesh, uv: new Float32Array(uvs), depth }); return mesh
  }
  function strip(name: string, points: [number, number][], half: number, material: THREE.Material, depth = .004) {
    const uv: number[] = [], indices: number[] = []
    points.forEach(([u, v], i) => { uv.push(u, v - half, u, v + half); if (i) { const j = i * 2; indices.push(j - 2, j - 1, j, j - 1, j + 1, j) } })
    return patch(name, uv, indices, material, depth)
  }
  const uv: number[] = [], faces: number[] = [], cols = 40, rows = 20
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    uv.push(x / cols, y / rows)
    if (x < cols && y < rows) { const i = y * (cols + 1) + x; faces.push(i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2) }
  }
  patch('banner-cloth', uv, faces, clothMat)
  for (const v of [.025, .95]) strip('banner-woven-hem', Array.from({ length: 41 }, (_, i) => [i / 40, v]), .011, border)
  for (const u of [.025, .975]) {
    const edgeUV: number[] = [], edgeFaces: number[] = []
    for (let i = 0; i <= 20; i++) { edgeUV.push(u - .011, i / 20, u + .011, i / 20); if (i) { const j = i * 2; edgeFaces.push(j - 2, j - 1, j, j - 1, j + 1, j) } }
    patch('banner-side-hem', edgeUV, edgeFaces, border, .004)
  }
  const sunUV = [.50, .33], sunFaces: number[] = []
  for (let ring = 1; ring <= 8; ring++) for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, fraction = ring / 8
    sunUV.push(.50 + Math.cos(a) * .102 * fraction, .33 + Math.sin(a) * .108 * fraction)
    const here = 1 + (ring - 1) * 32 + i, next = 1 + (ring - 1) * 32 + (i + 1) % 32
    if (ring === 1) sunFaces.push(0, here, next)
    else sunFaces.push(here - 32, here, next, here - 32, next, next - 32)
  }
  patch('banner-original-sun', sunUV, sunFaces, border, .008)
  for (const v of [.62, .72]) strip('banner-original-wave', Array.from({ length: 35 }, (_, i) => { const u = .15 + i / 34 * .70; return [u, v + Math.sin((u - .15) / .70 * Math.PI * 2) * .027] }), .013, thread, .006)
  const tab = box(.16, .145, .075, border, [0, 0, 0], 'banner-hem-tab', cloth)
  const fixed = box(.046, .065, .025, thread, [LEFT, TOP, .1], 'banner-fixed-hem', cloth)
  box(.055, .075, .04, thread, [LEFT, TOP, .08], 'banner-crossbar-left-tie', assembly)
  const tassels = [0, .5, 1].map(u => {
    const group = new THREE.Group(); group.name = 'banner-tassel'; cloth.add(group)
    add(new THREE.SphereGeometry(.025, 10, 6), border, [0, -.025, 0], '', group)
    for (const x of [-.021, 0, .021]) add(new THREE.CylinderGeometry(.007, .011, .13, 6), thread, [x, -.10, 0], '', group)
    return { u, group }
  })
  const surface = (u: number, v: number, depth = 0) => new THREE.Vector3(
    LEFT + (FOLDED_WIDTH + (FULL_WIDTH - FOLDED_WIDTH) * open) * u,
    TOP - v * (1.04 + .055 * Math.cos(u * Math.PI * 2)) + lift * u,
    .10 + Math.sin(u * Math.PI * 12) * (.065 * (1 - open) + .012 * open) * Math.sin(v * Math.PI / 2) + depth,
  )
  const deform = (value: number, rise = 0) => {
    open = THREE.MathUtils.clamp(value, 0, 1); lift = rise
    for (const { mesh, uv: coordinates, depth } of patches) {
      const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) { const vertex = surface(coordinates[i * 2], coordinates[i * 2 + 1], depth); p.setXYZ(i, vertex.x, vertex.y, vertex.z) }
      p.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox()
    }
    tab.position.copy(surface(1, 0, .05)); fixed.position.copy(surface(0, 0, .006))
    for (const { u, group } of tassels) group.position.copy(surface(u, 1, .01))
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { assembly.position.copy(checkpoint >= 2 ? SEATED : HOME); deform(checkpoint >= 1 ? 1 : 0); matrices() }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(tab, { kind: 'drag', label: '展开布旗', priority: 3, enabled: enabled(0), destination: clip, targetLabel: '横杆右端夹头' })
  addInteractionCue(grip, { kind: 'drag', label: '握住木杆', priority: 3, enabled: enabled(1), destination: socket, targetLabel: '木座圆孔' })
  addInteractionCue(grip, { kind: 'tap', label: '轻触静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const firstVisible = (x: number, y: number, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === held) return
      meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const tappable = (hit: THREE.Object3D | undefined) => {
    if (!hit) return false
    if (hit === grip || hit.name === 'banner-staff') return true
    for (let parent: THREE.Object3D | null = hit; parent; parent = parent.parent) if (parent === cloth) return true
    return false
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); const hit = firstVisible(x, y); return checkpoint === 2 ? tappable(hit) : hit === (checkpoint === 0 ? tab : grip) },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare()
      const origin = checkpoint === 0 ? tab.getWorldPosition(new THREE.Vector3()) : assembly.position
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), origin)
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(origin).sub(point)
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        point.add(offset)
        if (checkpoint === 0) { assembly.worldToLocal(point); deform((point.x - LEFT - FOLDED_WIDTH) / (FULL_WIDTH - FOLDED_WIDTH), THREE.MathUtils.clamp(point.y - TOP, -.28, .28)) }
        else assembly.position.copy(point)
      }
      matrices()
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && maxTravel >= 8 && placementHit(canvas, camera, checkpoint === 0 ? tab : grip, x, y, (px, py) => firstVisible(px, py, checkpoint === 0 ? cloth : assembly) === (checkpoint === 0 ? clip : socket)) : maxTravel < 12 && tappable(firstVisible(x, y))
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '展开布旗' : checkpoint === 1 ? '安放木杆' : '轻触静看', safe)
    setSafeText(ui.hintEl, transition ? transition.step === 0 ? COPY.opening : COPY.placing : checkpoint === 0 ? COPY.unfurl : checkpoint === 1 ? COPY.place : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  function settle() {
    if (!active() || !transition) return
    checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [349.23, 523.25], duration: .16, gain: .009 })
  }
  function advance() {
    if (!active() || pointer.isBusy() || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(); sync(); ctx.onProgress?.(3); feedback.impact({ freqs: [349.23, 523.25], duration: .20, gain: .009 }); overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: assembly.position.clone(), open, lift }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 7); camera.position.set(0, 3.5 + boost * .4, 5.9 + boost); camera.lookAt(0, 1.3, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return; started = true
      const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .8); const t = ease(transition.time)
        if (transition.step === 0) deform(THREE.MathUtils.lerp(transition.open, 1, t), transition.lift * (1 - t))
        else { assembly.position.lerpVectors(transition.from, SEATED, t); if (!ctx.isReducedMotion?.()) assembly.position.y += Math.sin(t * Math.PI) * .24 }
        if (transition.time === 1) settle()
      }
      style.render()
    },
    dispose() {
      if (disposed) return; disposed = true; pointer.dispose(); stopResize(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
