import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { completesDirectionalDrag } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '影偶小戏', lift: '握住下方主杆，向上轻提，让彩色小鸟的影子登上布幕。',
  turn: '握住右侧翼杆，向右轻移，让小鸟舒展开一片镂空翅膀。',
  quiet: '轻点彩色小鸟静看，或写一句心意；点「写好了」才会保存。',
  returning: '轻点小鸟，回看布幕上这一刻的光影。', done: '留一幕温暖在日常。',
  lifting: '主杆轻提，小鸟和它的影子一同升起…', turning: '翼杆牵动关节，镂空翅膀慢慢舒展…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const ease = (t: number) => t * t * (3 - 2 * t)
const GRIP_ANCHOR: XYZ = [0, 0, .075], QUIET_ANCHOR: XYZ = [.16, 0, .028]
const SCREEN_Z = -.16

/** An original public craft appreciation: pierced paper bird, rods and cloth. */
export function createChineseShadowPuppet(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null, lifecycleVersion = 0
  let motion: { step: 0 | 1; time: number; lift: number; turn: number } | null = null
  let dragging = false, maxTravel = 0, maxCross = 0, moved = 0, maxAlong = 0, minAlong = 0, backtrack = 0, liftAmount = 0, turnAmount = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向上提起主杆' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-shadow-puppet', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xe6d8c5, ground: 0x685343, key: 0xffe1b3, rim: 0xcbd4d4, keyPosition: [1, 4, 5], keyIntensity: 1.3, rimIntensity: .3 })
  const world = new THREE.Group(); world.name = 'shadow-theatre'; scene.add(world)
  const rig = new THREE.Group(); rig.name = 'shadow-puppet-rig'; world.add(rig)
  const mat = (color: number, roughness = .84, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
  const timber = mat(0x614336), edges = mat(0x9c6540), gold = mat(0xe0a43d), teal = mat(0x248d8a), red = mat(0xc84e3b), amber = mat(0xe6ad45), brass = mat(0xbd8f48, .46, .35)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent: THREE.Object3D = world) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.028, ...size.map(n => n / 3))), material, p, parent)
  for (const side of [-1, 1]) {
    box(`shadow-post-${side}`, [.16, 3.12, .19], [side * 1.64, 1.64, -.18], timber)
    box(`shadow-foot-${side}`, [.43, .16, 1.34], [side * 1.64, .08, -.18], timber)
    box(`shadow-foot-cap-${side}`, [.45, .05, .18], [side * 1.64, .17, -.18], edges)
    box(`shadow-post-inlay-${side}`, [.032, 2.38, .018], [side * 1.64, 1.82, -.073], gold)
  }
  box('shadow-top-beam', [3.56, .22, .24], [0, 3.18, -.18], timber)
  box('shadow-top-inlay', [3.28, .035, .026], [0, 3.20, -.047], gold)
  box('shadow-bottom-beam', [3.24, .14, .20], [0, .64, -.18], timber)
  // An unlit textile gradient avoids the host's cel band swallowing the shadow.
  const clothGeometry = new THREE.PlaneGeometry(3.10, 2.36, 28, 24), clothColors: number[] = []
  const clothPositions = clothGeometry.getAttribute('position'), centerColor = new THREE.Color(0xffe9b5), edgeColor = new THREE.Color(0xc7a478)
  for (let i = 0; i < clothPositions.count; i++) {
    const distance = Math.min(1, Math.hypot(clothPositions.getX(i) / 1.8, clothPositions.getY(i) / 1.6))
    const color = centerColor.clone().lerp(edgeColor, distance * .35 + Math.sin(i * 13.2) * .012); clothColors.push(color.r, color.g, color.b)
  }
  clothGeometry.setAttribute('color', new THREE.Float32BufferAttribute(clothColors, 3))
  const cloth = add('shadow-cloth', clothGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), [0, 1.89, SCREEN_Z - .012]); cloth.userData.toonSurface = { outline: false }; cloth.castShadow = false
  const stitchMat = new THREE.MeshBasicMaterial({ color: 0xbda27d })
  for (let i = 0; i < 27; i++) for (const y of [.76, 3.02]) box(`shadow-stitch-${i}-${y}`, [.035, .006, .004], [-1.44 + i * .11, y, SCREEN_Z - .006], stitchMat)
  // The visible luminous aperture is the mathematical projection origin.
  const lightPosition = new THREE.Vector3(-.75, 1.80, 3.10)
  box('shadow-lamp-base', [.52, .12, .43], [-.75, .08, 3.10], timber)
  const lampStem = add('shadow-lamp-stem', new THREE.CylinderGeometry(.034, .045, 1.48, 10), brass, [-.75, .86, 3.10]); lampStem.userData.toonSurface = { outline: false }
  const lamp = new THREE.Group(); lamp.name = 'shadow-lamp'; lamp.position.copy(lightPosition); world.add(lamp)
  const shade = add('shadow-lamp-shade', new THREE.CylinderGeometry(.22, .13, .30, 24, 1, true), brass, [0, 0, .11], lamp); shade.rotation.x = Math.PI / 2
  const source = add('shadow-light-source', new THREE.SphereGeometry(.085, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }), [0, 0, 0], lamp); source.castShadow = false
  const lampLight = new THREE.PointLight(0xffd493, .75, 3, 2); lampLight.position.copy(lightPosition); world.add(lampLight)
  const bird = new THREE.Group(); bird.name = 'shadow-bird'; rig.add(bird)
  const shape = (points: [number, number][]) => { const s = new THREE.Shape(); points.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s }
  const hole = (s: THREE.Shape, x: number, y: number, rx: number, ry = rx, angle = 0) => { const h = new THREE.Path(); h.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, angle); s.holes.push(h) }
  const cut = (name: string, s: THREE.Shape, material: THREE.Material, p: XYZ, parent: THREE.Object3D = bird) => {
    const mesh = add(name, new THREE.ExtrudeGeometry(s, { depth: .026, bevelEnabled: false, curveSegments: 18 }), material, p, parent); mesh.userData.toonSurface = { outline: false, shading: 'smooth' }; return mesh
  }
  const bodyShape = new THREE.Shape()
  bodyShape.moveTo(-.57, .06); bodyShape.bezierCurveTo(-.37, -.32, .16, -.33, .37, -.06)
  bodyShape.quadraticCurveTo(.46, .02, .47, .13); bodyShape.quadraticCurveTo(.67, .09, .70, .28)
  bodyShape.lineTo(.92, .28); bodyShape.lineTo(.70, .39); bodyShape.bezierCurveTo(.64, .59, .38, .59, .32, .37)
  bodyShape.bezierCurveTo(.10, .36, -.17, .30, -.57, .06); bodyShape.closePath()
  for (const [x, y, rx, ry] of [[-.34, -.05, .037, .065], [-.19, -.13, .04, .035], [-.02, -.13, .04, .035], [.13, -.12, .035, .03], [.02, .15, .034, .048], [.20, .22, .035, .045], [.53, .36, .04, .04]]) hole(bodyShape, x!, y!, rx!, ry!)
  const body = cut('shadow-bird-body', bodyShape, teal, [0, 0, 0])
  cut('shadow-bird-chest', shape([[.34, .18], [.43, .12], [.37, -.04], [.25, -.15], [.25, .04]]), red, [0, 0, .028])
  cut('shadow-bird-beak', shape([[.70, .28], [.92, .28], [.70, .39]]), amber, [0, 0, .028])
  for (let i = 0; i < 3; i++) {
    const feather = shape([[-.42, .03], [-1.02 + i * .06, -.09 - i * .16], [-.91 + i * .08, -.26 - i * .15], [-.32, -.12]])
    hole(feather, -.71 + i * .055, -.145 - i * .13, .085, .018, .3 + i * .22)
    cut(`shadow-tail-${i}`, feather, i % 2 ? red : amber, [0, 0, -.012 - i * .007])
  }
  for (let i = 0; i < 3; i++) cut(`shadow-crest-${i}`, shape([[.39 + i * .07, .48], [.28 + i * .09, .72 - i * .015], [.39 + i * .08, .66], [.47 + i * .07, .48]]), amber, [0, 0, -.009])
  const wing = new THREE.Group(); wing.name = 'shadow-wing'; wing.position.set(-.22, .07, .055); bird.add(wing)
  const wingShape = new THREE.Shape(); wingShape.moveTo(.09, .04); wingShape.quadraticCurveTo(-.12, .15, -.36, -.04)
  wingShape.lineTo(-.77, -.28); wingShape.lineTo(-.61, -.31); wingShape.lineTo(-.70, -.40); wingShape.lineTo(-.53, -.38); wingShape.lineTo(-.58, -.48)
  wingShape.bezierCurveTo(-.28, -.45, -.05, -.28, .09, .04); wingShape.closePath()
  for (const [x, y, rx, ry, angle] of [[-.21, -.10, .075, .024, .42], [-.36, -.19, .10, .023, .42], [-.48, -.29, .10, .023, .32]]) hole(wingShape, x!, y!, rx!, ry!, angle!)
  cut('shadow-wing-feather', wingShape, red, [0, 0, 0], wing)
  const hinge = add('shadow-wing-hinge', new THREE.CylinderGeometry(.045, .045, .075, 16), brass, [0, 0, .015], wing); hinge.rotation.x = Math.PI / 2; hinge.userData.toonSurface = { outline: false }
  const mainJoint = add('shadow-main-joint', new THREE.SphereGeometry(.033, 12, 8), brass, [.12, -.13, .060], bird)
  const wingJoint = add('shadow-wing-joint', new THREE.SphereGeometry(.031, 12, 8), brass, [-.43, -.23, .060], wing)
  const mainGrip = add('shadow-main-grip', new THREE.CapsuleGeometry(.075, .17, 6, 12), edges, [0, 0, 0], rig)
  const wingGrip = add('shadow-wing-grip', new THREE.CapsuleGeometry(.075, .17, 6, 12), edges, [0, 0, 0], rig)
  const rodGeometry = new THREE.CylinderGeometry(.017, .019, 1, 8)
  const mainRod = add('shadow-main-rod', rodGeometry, amber, [0, 0, 0], rig), wingRod = add('shadow-wing-rod', rodGeometry, amber, [0, 0, 0], rig)
  for (const mesh of [mainJoint, wingJoint, mainGrip, wingGrip, mainRod, wingRod]) mesh.userData.toonSurface = { outline: false, shading: 'smooth' }
  const sources: THREE.Mesh[] = []; rig.traverse(o => { if ((o as THREE.Mesh).isMesh) sources.push(o as THREE.Mesh) })
  // Project actual triangles through the lamp, preserving cutouts and articulation.
  // Clip at the cloth hems; a single opaque material prevents doubled front/back opacity.
  const projectionGeometry = new THREE.BufferGeometry()
  // A triangle clipped to four sides has at most seven corners (five triangles).
  const maxProjectedVertices = sources.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) * 5, 0)
  const projectedBuffer = new Float32Array(maxProjectedVertices * 3)
  projectionGeometry.setAttribute('position', new THREE.BufferAttribute(projectedBuffer, 3)); projectionGeometry.setDrawRange(0, 0)
  const projection = add('shadow-projection', projectionGeometry, new THREE.MeshBasicMaterial({ color: 0x624630, side: THREE.DoubleSide }), [0, 0, 0]); projection.castShadow = projection.receiveShadow = false; projection.userData.toonSurface = { outline: false }
  const clip = (points: THREE.Vector3[], axis: 'x' | 'y', limit: number, positive: boolean) => {
    const result: THREE.Vector3[] = []
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!, aInside = positive ? a[axis] >= limit : a[axis] <= limit, bInside = positive ? b[axis] >= limit : b[axis] <= limit
      if (aInside) result.push(a)
      if (aInside !== bInside) result.push(a.clone().lerp(b, (limit - a[axis]) / (b[axis] - a[axis])))
    }
    return result
  }
  const updateProjection = () => {
    let count = 0
    for (const sourceMesh of sources) {
      const position = sourceMesh.geometry.getAttribute('position'), index = sourceMesh.geometry.index, length = index?.count ?? position.count
      const points = Array.from({ length: position.count }, (_, i) => {
        const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(sourceMesh.matrixWorld).sub(lightPosition)
        return lightPosition.clone().addScaledVector(p, (SCREEN_Z - lightPosition.z) / p.z)
      })
      for (let i = 0; i < length; i += 3) {
        let polygon = [points[index ? index.getX(i) : i]!, points[index ? index.getX(i + 1) : i + 1]!, points[index ? index.getX(i + 2) : i + 2]!]
        polygon = clip(clip(clip(clip(polygon, 'x', -1.54, true), 'x', 1.54, false), 'y', .72, true), 'y', 3.06, false)
        for (let j = 1; j < polygon.length - 1; j++) for (const p of [polygon[0]!, polygon[j]!, polygon[j + 1]!]) { projectedBuffer[count++] = p.x; projectedBuffer[count++] = p.y; projectedBuffer[count++] = SCREEN_Z }
      }
    }
    projectionGeometry.setDrawRange(0, count / 3); projectionGeometry.getAttribute('position').needsUpdate = true
    projectionGeometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.54, .72, SCREEN_Z), new THREE.Vector3(1.54, 3.06, SCREEN_Z)); projectionGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.89, SCREEN_Z), 2)
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const connect = (rod: THREE.Mesh, joint: THREE.Object3D, grip: THREE.Mesh, offset: THREE.Vector3) => {
    const end = joint.getWorldPosition(new THREE.Vector3()), base = end.clone().add(offset)
    grip.position.copy(base).add(new THREE.Vector3(0, -.12, 0)); rod.position.lerpVectors(end, base, .5)
    rod.scale.y = end.distanceTo(base); rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(base).normalize())
  }
  const setShape = () => {
    bird.position.set(-.27, 1.57 + liftAmount * .45, .60); wing.rotation.z = -turnAmount * .9; matrices()
    connect(mainRod, mainJoint, mainGrip, new THREE.Vector3(0, -.94, .30))
    connect(wingRod, wingJoint, wingGrip, new THREE.Vector3(Math.sin(.98 + turnAmount * .27), -Math.cos(.98 + turnAmount * .27), .22).normalize().multiplyScalar(1.14))
    matrices(); updateProjection()
  }
  const setLift = (amount: number) => { liftAmount = amount; setShape() }
  const setTurn = (amount: number) => { turnAmount = amount; setShape() }
  const restore = () => { liftAmount = at > 0 ? 1 : 0; turnAmount = at >= 2 ? 1 : 0; setShape(); matrices() }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(mainGrip, { kind: 'drag', direction: [0, -1], label: '向上提起主杆', anchor: GRIP_ANCHOR, priority: 3, enabled: enabled(0) }),
    addInteractionCue(wingGrip, { kind: 'drag', direction: [1, 0], label: '向右移动翼杆', anchor: GRIP_ANCHOR, priority: 3, enabled: enabled(1) }),
    addInteractionCue(body, { kind: 'tap', label: '轻点小鸟静看', anchor: QUIET_ANCHOR, priority: 3, enabled: enabled(2) }),
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
  const birdHit = (x: number, y: number) => { const hit = nearestHit(x, y)?.object; return belongsTo(hit, bird) }
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
      return at === 0 ? visibleHit(x, y, mainGrip) : at === 1 ? visibleHit(x, y, wingGrip) : birdHit(x, y)
    },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; maxTravel = maxCross = moved = maxAlong = minAlong = backtrack = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dx : dy))
      moved = at === 0 ? -dy : dx
      maxAlong = Math.max(maxAlong, moved); minAlong = Math.min(minAlong, moved); backtrack = Math.max(backtrack, maxAlong - moved)
      if (dragging && at === 0) setLift(THREE.MathUtils.clamp(moved / 60, 0, 1))
      else if (dragging && at === 1) setTurn(THREE.MathUtils.clamp(moved / 60, 0, 1))
      matrices()
    },
    onRelease(x, y) {
      matrices(); const dx = x - down.x, dy = y - down.y
      const along = at === 0 ? -dy : dx, cross = at === 0 ? Math.abs(dx) : Math.abs(dy)
      const valid = at < 2 ? dragging && completesDirectionalDrag({ along: moved, end: along, maxAlong, minAlong, backtrack, maxCross, cross, travel: maxTravel })
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && (birdHit(x, y))
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '向上提起主杆' : at === 1 ? '向右移动翼杆' : '轻点小鸟静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.lifting : COPY.turning : at === 0 ? COPY.lift : at === 1 ? COPY.turn : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
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
    motion = { step: at as 0 | 1, time: 0, lift: liftAmount, turn: turnAmount }; sync(); if (reduced()) settle()
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
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, 1.5, .8), direction = new THREE.Vector3(.42, .24, .875).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverseView = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3()
    let distance = 5
    world.traverse(o => {
      const mesh = o as THREE.Mesh; if (!mesh.geometry || mesh === projection) return
      const vertices = mesh.geometry.getAttribute('position')
      for (let i = 0; i < vertices.count; i++) {
        p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).sub(target).applyQuaternion(inverseView)
        distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .91), p.z + Math.abs(p.y) / (tangent * .91))
      }
    })
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
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
        if (motion.step === 0) setLift(THREE.MathUtils.lerp(motion.lift, 1, t))
        else setTurn(THREE.MathUtils.lerp(motion.turn, 1, t))
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); lampLight.dispose(); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
