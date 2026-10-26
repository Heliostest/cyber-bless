import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { completesDirectionalDrag } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

type XYZ = [number, number, number]
type Checkpoint = 0 | 1 | 2 | 3
const COPY = {
  title: '玻珠凝彩', wind: '拿住左侧金属杆柄，向上短拖，让彩色细带绕上玻珠。',
  thread: '色带已凝定。拿住蓝绿色玻珠，向右轻移，让珠孔离开短杆、穿上细绳。',
  quiet: '轻点玻珠静看：透亮的颜色、绕行的细带，还有穿过珠孔的一根绳。',
  cooling: '彩带绕过珠面，暖色慢慢淡下，玻珠安静凝彩……',
  threading: '玻珠缓缓离开杆端，细绳从珠孔中穿过……',
  done: '愿日常留一点明亮。',
} as const
const GRIP: XYZ = [0, .035, .055], BEAD: XYZ = [0, .20, .43]
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original contemporary lampwork appreciation. Authored winding/cooling, not a thermal simulation or a complete craft lesson. */
export function createVenetianGlassBead(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let winding = 0, transfer = 0, lowering = 0, warmth = 0, dragging = false, moved = false, invalid = false
  let maxTravel = 0, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向上转动金属杆柄' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'venetian-glass-bead', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xe8f4ed, ground: 0x9d9279, key: 0xffedc5, rim: 0xd8fbff, keyPosition: [-3, 5, 4], keyIntensity: 2.2, rimIntensity: 1.1 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .012
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -2, near: .1, far: 15 })
  const subject = new THREE.Group(); subject.name = 'glass-subject'; scene.add(subject)
  const assembly = new THREE.Group(); assembly.name = 'glass-hero-assembly'; subject.add(assembly)
  const spindle = new THREE.Group(); spindle.name = 'glass-spindle'; spindle.position.set(0, 1.03, 0); subject.add(spindle)
  const matte = (color: number, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf6e6ce, roughness: .3, clearcoat: .55, clearcoatRoughness: .24 })
  const metal = matte(0xa0afb0, .23, .72), darkMetal = matte(0x596b70, .3, .55), cordMaterial = matte(0xc9a56c, .96)
  const glass = (color: number) => new THREE.MeshPhysicalMaterial({ color, roughness: .12, metalness: 0, transparent: true, opacity: .84, transmission: .24, thickness: .45, ior: 1.46, clearcoat: 1, clearcoatRoughness: .08, depthWrite: false })
  const turquoise = glass(0x20b5bd), amber = glass(0xf4ad46), coral = glass(0xe87862)
  const ribbonMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf3b055, roughness: .19, clearcoat: 1, clearcoatRoughness: .1, emissive: 0xef743b, emissiveIntensity: 0 })
  const white = new THREE.MeshBasicMaterial({ color: 0xf5ffef, transparent: true, opacity: .62, depthWrite: false })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ = [0, 0, 0], parent: THREE.Object3D = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const tube = (name: string, points: XYZ[], radius: number, material: THREE.Material, parent = subject) => add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 96, radius, 10, false), material, [0, 0, 0], parent)
  // A closed lathed lens profile with an actual open axial bore. No sphere fills the hole.
  const profile: THREE.Vector2[] = []
  for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + i / 40 * Math.PI; profile.push(new THREE.Vector2(.11 + .38 * Math.cos(a), .30 * Math.sin(a))) }
  profile.push(new THREE.Vector2(.105, .285), new THREE.Vector2(.105, -.285), profile[0]!.clone())
  const beadGeometry = new THREE.LatheGeometry(profile, 80).rotateZ(-Math.PI / 2)
  const bead = add('glass-hero-bead', beadGeometry, turquoise, [0, 0, 0], assembly)
  bead.castShadow = false; bead.receiveShadow = false; bead.renderOrder = 2; bead.userData.toonSurface = { outline: false }
  // The stripe is original geometry on the lens surface, revealed by index range.
  const ribbonPoints: THREE.Vector3[] = []
  for (let i = 0; i <= 200; i++) {
    const t = i / 200, x = -.245 + .49 * t, radius = .11 + .38 * Math.sqrt(1 - (x / .30) ** 2) + .009, a = -.7 + t * Math.PI * 4
    ribbonPoints.push(new THREE.Vector3(x, Math.cos(a) * radius, Math.sin(a) * radius))
  }
  const ribbonGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribbonPoints), 200, .025, 8, false)
  const ribbon = add('glass-colored-ribbon', ribbonGeometry, ribbonMaterial, [0, 0, 0], assembly)
  ribbon.castShadow = false; ribbon.receiveShadow = false; ribbon.userData.toonSurface = { outline: false }
  // Soft reflected window strokes reinforce the polished finish without texture assets.
  for (const side of [-1, 1]) {
    const points: XYZ[] = []
    for (let i = 0; i <= 24; i++) { const x = -.13 + i / 24 * .19, r = .11 + .38 * Math.sqrt(1 - (x / .3) ** 2) + .013, angle = side === 1 ? .55 : 2.56; points.push([x, r * Math.cos(angle), r * Math.sin(angle)]) }
    const highlight = tube(`glass-soft-reflection-${side}`, points, side === 1 ? .018 : .009, white, assembly)
    highlight.castShadow = highlight.receiveShadow = false; highlight.renderOrder = 3; highlight.userData.toonSurface = { outline: false }
  }
  const rod = add('glass-metal-mandrel', new THREE.CylinderGeometry(.035, .035, 1.66, 24).rotateZ(Math.PI / 2), metal, [-.51, 0, 0], spindle)
  const grip = add('glass-mandrel-grip', new THREE.CylinderGeometry(.075, .075, .38, 32).rotateZ(Math.PI / 2), darkMetal, [-1.24, 0, 0], spindle)
  for (let i = 0; i < 6; i++) {
    const ring = add(`glass-grip-ring-${i}`, new THREE.TorusGeometry(.076, .004, 6, 32).rotateY(Math.PI / 2), metal, [-1.38 + i * .054, 0, 0], spindle)
    ring.userData.toonSurface = { outline: false }
  }
  rod.userData.toonSurface = { outline: false }; grip.userData.toonSurface = { outline: false }
  // One compact ceramic rod rest and a low dish; there is no table or signboard.
  const rest = add('glass-ceramic-rod-rest', new THREE.CylinderGeometry(.09, .20, .925, 40), porcelain, [-1.13, .4925, -.025]); rest.scale.z = .75
  const restFoot = add('glass-rod-rest-foot', new THREE.SphereGeometry(1, 32, 16), porcelain, [-1.13, .08, -.025]); restFoot.scale.set(.30, .085, .22)
  const dishProfile = [new THREE.Vector2(0, .025), new THREE.Vector2(.67, .025), new THREE.Vector2(.89, .065), new THREE.Vector2(1, .17), new THREE.Vector2(1.02, .20), new THREE.Vector2(.98, .225), new THREE.Vector2(.91, .19), new THREE.Vector2(.74, .09), new THREE.Vector2(0, .085)]
  const dish = add('glass-low-ceramic-dish', new THREE.LatheGeometry(dishProfile, 80), porcelain, [.37, 0, .10]); dish.scale.set(1.13, 1, .84)
  dish.userData.toonSurface = { outline: false }
  for (const [i, p] of [[-.08, .28, .64], [.49, .25, .63], [-.25, .29, .15]].entries()) {
    const m = add(`glass-companion-bead-${i}`, beadGeometry, i === 1 ? coral : amber, p as XYZ); m.scale.setScalar(i === 1 ? .38 : .43); m.rotation.set(.35, -.3 + i * .6, .2); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.userData.toonSurface = { outline: false }
  }
  const cord = add('glass-threading-cord', new THREE.CylinderGeometry(.018, .018, .72, 12, 12).rotateZ(Math.PI / 2), cordMaterial, [.97, 1.03, 0])
  cord.userData.toonSurface = { outline: false }
  const cordCentre = new THREE.Object3D(); cordCentre.name = 'glass-cord-threading-centre'; cordCentre.position.set(.97, 1.03, 0); subject.add(cordCentre)
  const leftCurve = new THREE.CubicBezierCurve3(new THREE.Vector3(.35, 1.03, 0), new THREE.Vector3(.42, 1.03, 0), new THREE.Vector3(.48, 1.03, 0), new THREE.Vector3(.61, 1.03, 0))
  const rightCurve = new THREE.CatmullRomCurve3([[1.33, 1.03, 0], [1.45, 1.03, 0], [1.48, .70, .05], [1.19, .27, .12], [.55, .17, .35], [.28, .19, .66], [.48, .23, .79]].map(p => new THREE.Vector3(...p as XYZ)))
  const leftDrape = add('glass-cord-left-drape', new THREE.TubeGeometry(leftCurve, 64, .018, 10, false), cordMaterial)
  const rightDrape = add('glass-cord-right-drape', new THREE.TubeGeometry(rightCurve, 64, .018, 10, false), cordMaterial)
  leftDrape.userData.toonSurface = rightDrape.userData.toonSurface = { outline: false }
  // Reuse the same buffers throughout the drape, including cancellation/restore.
  const deformCord = (mesh: THREE.Mesh, curve: THREE.Curve<THREE.Vector3>) => {
    curve.updateArcLengths(); const frames = curve.computeFrenetFrames(64, false), positions = mesh.geometry.getAttribute('position'), normals = mesh.geometry.getAttribute('normal')
    for (let i = 0; i <= 64; i++) {
      const centre = curve.getPointAt(i / 64)
      for (let j = 0; j <= 10; j++) {
        const a = j / 10 * Math.PI * 2, n = frames.normals[i]!.clone().multiplyScalar(-Math.cos(a)).addScaledVector(frames.binormals[i]!, Math.sin(a)), index = i * 11 + j
        positions.setXYZ(index, centre.x + n.x * .018, centre.y + n.y * .018, centre.z + n.z * .018); normals.setXYZ(index, n.x, n.y, n.z)
      }
    }
    positions.needsUpdate = normals.needsUpdate = true; mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere()
  }
  // Find the first real underside contact against the ceramic surface once.
  // The colored glass ribbon is part of the bead and can be its lowest point.
  scene.updateMatrixWorld(true)
  const supportRay = new THREE.Raycaster(), supportPoint = new THREE.Vector3(); let underside = Infinity, restingHeight = 0
  for (const geometry of [beadGeometry, ribbonGeometry]) { const vertices = geometry.getAttribute('position'); for (let i = 0; i < vertices.count; i++) underside = Math.min(underside, vertices.getY(i)) }
  for (const geometry of [beadGeometry, ribbonGeometry]) {
    const vertices = geometry.getAttribute('position')
    for (let i = 0; i < vertices.count; i++) {
      if (vertices.getY(i) > underside + .04) continue
      supportPoint.set(.97 + vertices.getX(i), 3, vertices.getZ(i)); supportRay.set(supportPoint, new THREE.Vector3(0, -1, 0))
      const hit = supportRay.intersectObject(dish)[0]; if (hit) restingHeight = Math.max(restingHeight, hit.point.y - vertices.getY(i))
    }
  }
  restingHeight += .0004
  let lastCordLowering = -1
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const setPose = () => {
    const height = THREE.MathUtils.lerp(1.03, restingHeight, lowering)
    assembly.position.set(-.38 + 1.35 * transfer, height, 0); assembly.rotation.set(winding * Math.PI * 2, 0, 0); spindle.rotation.x = winding * Math.PI * 2
    cord.position.y = cordCentre.position.y = height
    if (lastCordLowering !== lowering) {
      lastCordLowering = lowering
      leftCurve.v0.set(THREE.MathUtils.lerp(.35, .25, lowering), THREE.MathUtils.lerp(1.03, .12, lowering), .12 * lowering)
      leftCurve.v1.set(THREE.MathUtils.lerp(.42, .36, lowering), THREE.MathUtils.lerp(1.03, .12, lowering), .04 * lowering)
      leftCurve.v2.set(.48, height, 0); leftCurve.v3.set(.61, height, 0)
      rightCurve.points[0]!.set(1.33, height, 0); rightCurve.points[1]!.set(1.45, height, 0); rightCurve.points[2]!.y = THREE.MathUtils.lerp(.70, .37, lowering)
      deformCord(leftDrape, leftCurve); deformCord(rightDrape, rightCurve)
    }
    ribbonGeometry.setDrawRange(0, Math.floor(winding * 200) * 8 * 6); ribbonMaterial.emissiveIntensity = warmth * .38; matrices()
  }
  const pose = (step: 0 | 1, amount: number) => { if (step === 0) { winding = amount; warmth = amount } else { transfer = amount; lowering = 0 }; setPose() }
  const restore = () => { winding = at > 0 ? 1 : 0; transfer = lowering = at >= 2 ? 1 : 0; warmth = 0; setPose() }

  transfer=1;lowering=0;setPose();const transferGoal=bead.localToWorld(new THREE.Vector3(...BEAD));transfer=0;setPose()
  const railStart=new THREE.Vector2(),railPath=new THREE.Vector2();let railRadius=0
  const project=(p:THREE.Vector3)=>{const q=p.project(camera),r=canvas.getBoundingClientRect();return new THREE.Vector2(r.left+(q.x+1)*r.width/2,r.top+(1-q.y)*r.height/2)}
  const prepareRail=(x:number,y:number)=>{const from=project(bead.localToWorld(new THREE.Vector3(...BEAD))),goal=project(transferGoal.clone());railStart.set(x,y);railPath.copy(goal).sub(from);railRadius=Math.min(22,railPath.length()*.42)}
  const moveRail=(x:number,y:number)=>{if(invalid||!insideCanvas(canvas,x,y))return false;const n=THREE.MathUtils.clamp(new THREE.Vector2(x,y).sub(railStart).dot(railPath)/Math.max(railPath.lengthSq(),1e-9),0,1);pose(1,n);return n>0&&project(bead.localToWorld(new THREE.Vector3(...BEAD))).distanceTo(project(transferGoal.clone()))<=railRadius&&!touch.occluded(x,y,bead,{ignore:subject})}

  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', direction: [0, -1], label: '向上转动金属杆柄', anchor: GRIP, priority: 3, enabled: enabled(0) }),
    addInteractionCue(bead, { kind: 'drag', destination:()=>transferGoal.clone(),targetLabel:'玻珠穿绳位置', label: '穿珠上绳', anchor: BEAD, priority: 3, enabled: enabled(1) }),
    addInteractionCue(bead, { kind: 'tap', label: '轻点玻珠静观', anchor: BEAD, priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const touch = createTouchTarget(canvas, camera, scene)
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      // The visible glass shell is a real target. Compare it with opaque surfaces
      // by ray distance; never accept a bead through a nearer rod, dish or stripe.
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1 || mesh === bead))) meshes.push(o)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const target = () => at === 0 ? grip : bead
  const reset = () => { dragging = moved = invalid = false; maxTravel = pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return nearestHit(x, y) === target() || touch.hit(x, y, target()) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); previous.copy(down); dragging = at < 2; moved = invalid = false; maxTravel = pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0;if(at===1)prepareRail(x,y)
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if(at===1){if(moveRail(x,y)&&pointer.finish()){dragging=false;advance(true)};return}
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const dx = x - down.x, dy = y - down.y
      along = at === 0 ? -dy : dx; maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along)
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dx : dy)); moved ||= maxTravel > 0
      if (dragging) pose(at as 0 | 1, THREE.MathUtils.clamp(along / 60, 0, 1))
    },
    onRelease(x, y) {
      if(at===1){const valid=dragging&&moveRail(x,y);dragging=false;if(valid)advance();else reset();return}
      const dx = x - down.x, dy = y - down.y, end = at === 0 ? -dy : dx
      const travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && Number.isFinite(x) && Number.isFinite(y) && (at < 2 ? dragging && moved && completesDirectionalDrag({ along, end, maxAlong, minAlong, backtrack, maxCross, cross: at === 0 ? dx : dy, travel })
        : travel < 12 && maxTravel < 12 && Math.hypot(dx, dy) < 12 && nearestHit(x, y) === bead)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? '向上转动金属杆柄' : at === 1 ? '向右穿珠上绳' : '轻点玻珠静观', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.cooling : COPY.threading : at === 0 ? COPY.wind : at === 1 ? COPY.thread : at === 2 ? COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  const sound = () => feedback.impact({ freqs: [783.99], duration: .11, gain: .003, type: 'sine' })
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (callbackActive()) sound() })
  }
  function advance(accepted=false) {
    if (!inputActive() || (pointer.isBusy() && !accepted) || motion || at === 3) return
    if (at === 2) {
      at = 3; restore(); withHostCallbacks(() => { ctx.onProgress?.(3); if (!callbackActive()) return; sound(); if (callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }); return
    }
    motion = { step: at, time: 0, from: at === 0 ? winding : transfer }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, .76, .12), direction = new THREE.Vector3(.70, .72, 1.65).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(), saved = [winding, transfer, lowering, warmth]; let distance = 3.5
    // Fit every vertex of both ends of the transfer and intermediate winding.
    for (const pose of [[0, 0, 0], [.25, 0, 0], [.5, 0, 0], [.75, 0, 0], [1, 0, 0], [1, .5, 0], [1, 1, 0], [1, 1, .5], [1, 1, 1]]) {
      [winding, transfer, lowering] = pose; setPose()
      subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .87), p.z + Math.abs(p.y) / (tangent * .87)) }
      })
    }
    [winding, transfer, lowering, warmth] = saved; setPose(); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
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
        if (motion.step === 0) { winding = THREE.MathUtils.lerp(motion.from, 1, ease(Math.min(1, motion.time / .55))); warmth = (1 - ease(motion.time)) * winding; setPose() }
        else { transfer = THREE.MathUtils.lerp(motion.from, 1, ease(Math.min(1, motion.time / .4))); lowering = ease(THREE.MathUtils.clamp((motion.time - .4) / .6, 0, 1)); setPose() }
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
