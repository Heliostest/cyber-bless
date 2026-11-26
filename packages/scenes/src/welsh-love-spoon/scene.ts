import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { createQuietEnding } from '../quiet-ending'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'
import { applyCarvedSpoonUVs, applyStandBoxWoodUVs, createSpoonWoodTextures } from './wood-grain'

const COPY = {
  title: '木勺寄情', decorateAction: '轻拭木勺', hangAction: '把木勺安放在展托', quietAction: '轻点木勺细看',
  decorate: '想着一位在意的人，拿起桌前软布，拖到木勺凹面，轻拭木纹。',
  hang: '握住木柄，把准备赠人的木勺安放到右侧展托，让勺底轻轻落稳。',
  quiet: '想着在意的人，轻点木勺细看，留一刻祝愿。',
  returning: '轻点木勺，回看为在意之人准备的赠礼。', wiping: '软布轻拭勺面，木纹渐渐清晰…', placing: '木勺缓缓移向展托，勺底轻轻落稳…',
  done: '木勺已安放在展托，留一份准备赠人的心意。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const REST = new THREE.Vector3(.78, .88, .02), CLOTH_HOME = new THREE.Vector3(-.85, .81, .62)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original carved gift spoon inspired by public Welsh craft; no copied maker design. */
export function createWelshLoveSpoon(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  const returning = ctx.returning === true
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.decorateAction }, safe)
  const dropFeedback = createDropFeedback(ui.hintEl, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'welsh-love-spoon', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3e9d4, ground: 0xaba596, key: 0xffefdc, rim: 0xd4e7eb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'spoon-veranda-workbench'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  // Distinct warm oiled-wood grain scales, organic flow & sparse knots across spoon, peg & stand base.
  const carvedTex = createSpoonWoodTextures({
    key: 'welsh-spoon-carved-v3', seed: 23, grainAxis: 'v',
    earlywood: '#d6954c', latewood: '#a86b2e', knotCore: '#7a491d', knotHalo: '#e5ac64',
    ringFreq: 5.2, flowAmp: 0.175, archAmp: 0.38, washStrength: 0.08, roughnessRange: [0.80, 0.98],
    knots: [
      { along: 0.82, across: 0.26, radiusAlong: 0.036, radiusAcross: 0.036, deflect: 0.072, strength: 0.76 },
      { along: 0.19, across: 0.69, radiusAlong: 0.040, radiusAcross: 0.038, deflect: 0.076, strength: 0.72 },
    ],
  })
  const grainTex = createSpoonWoodTextures({
    key: 'welsh-spoon-inlay-v3', seed: 61, grainAxis: 'v',
    earlywood: '#ecb876', latewood: '#cf9552', knotCore: '#a56f34',
    ringFreq: 6.8, flowAmp: 0.10, archAmp: 0.22, washStrength: 0.05, roughnessRange: [0.78, 0.94],
  })
  const walnutBaseTex = createSpoonWoodTextures({
    key: 'welsh-stand-base-v3', seed: 103, grainAxis: 'u',
    earlywood: '#8b6346', latewood: '#64442c', knotCore: '#4c301c', knotHalo: '#9e7556',
    ringFreq: 4.9, flowAmp: 0.16, archAmp: 0.38, washStrength: 0.08, roughnessRange: [0.82, 1.0],
    knots: [
      { along: 0.76, across: 0.84, radiusAlong: 0.068, radiusAcross: 0.044, deflect: 0.066, strength: 0.80 },
    ],
  })
  const walnutPegTex = createSpoonWoodTextures({
    key: 'welsh-stand-peg-v3', seed: 149, grainAxis: 'u',
    earlywood: '#a37855', latewood: '#785437', knotCore: '#5c3c24', knotHalo: '#b68a65',
    ringFreq: 7.4, flowAmp: 0.14, archAmp: 0.30, washStrength: 0.075, roughnessRange: [0.82, 1.0],
    knots: [
      { along: 0.62, across: 0.50, radiusAlong: 0.084, radiusAcross: 0.080, deflect: 0.105, strength: 0.78 },
    ],
  })
  const woodTextures = [carvedTex, grainTex, walnutBaseTex, walnutPegTex]
  const carved = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: carvedTex.map, bumpMap: carvedTex.bumpMap, bumpScale: .0045, roughnessMap: carvedTex.roughnessMap, roughness: .54, clearcoat: .19, clearcoatRoughness: .43, envMapIntensity: .8 })
  const grain = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: grainTex.map, bumpMap: grainTex.bumpMap, bumpScale: .0025, roughnessMap: grainTex.roughnessMap, roughness: .52, clearcoat: .18, clearcoatRoughness: .44, envMapIntensity: .76 })
  const walnut = new THREE.MeshStandardMaterial({ color: 0xffffff, map: walnutBaseTex.map, bumpMap: walnutBaseTex.bumpMap, bumpScale: .0048, roughnessMap: walnutBaseTex.roughnessMap, roughness: .64 })
  const walnutPeg = new THREE.MeshStandardMaterial({ color: 0xffffff, map: walnutPegTex.map, bumpMap: walnutPegTex.bumpMap, bumpScale: .0045, roughnessMap: walnutPegTex.roughnessMap, roughness: .66 })
  const linen = material(0x94b4ad)
  applyCraftSurface(carved, { kind: 'wood', strength: .12, scale: .64, axis: 'y' })
  applyCraftSurface(grain, { kind: 'wood', strength: .10, scale: 1.15, axis: 'y' })
  applyCraftSurface(walnut, { kind: 'wood', strength: .12, scale: .58, axis: 'x' })
  applyCraftSurface(walnutPeg, { kind: 'wood', strength: .12, scale: .94, axis: 'y' })
  applyCraftSurface(linen, { kind: 'fabric', strength: .26 })

  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const tube = (name: string, points: THREE.Vector3[], radius: number, mat: THREE.Material, parent: THREE.Object3D, closed = false) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), 64, radius, 8, closed), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  addCraftTable(world, { name: 'spoon-table', topName: 'spoon-table-top', width: 3.12, depth: 1.62, surfaceY: .76, thickness: .12, center: [0,.04], support: 'trestle', finish: 'honey' })
  const ground = add('spoon-contact-shadow', new THREE.PlaneGeometry(3.8, 2.1), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .1]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  box('spoon-home-pad', [.9, .04, .5], [-.72, .78, .02], linen)
  const homePeg = box('spoon-home-back-rest', [.22, .44, .08], [-.72, 1.02, -.13], walnutPeg)
  applyStandBoxWoodUVs(homePeg.geometry, [.22, .44, .08], 'y', { flipX: true, uShift: -.08 })
  const stand = new THREE.Group(); stand.name = 'spoon-display-stand'; world.add(stand)
  const standBase = box('spoon-stand-base', [.95, .08, .66], [.78, .80, .02], walnut, stand)
  applyStandBoxWoodUVs(standBase.geometry, [.95, .08, .66], 'x')
  const seat = box('spoon-display-seat', [.76, .04, .43], [.78, .86, .02], linen, stand)
  const displayPeg = box('spoon-display-back-rest', [.19, .54, .08], [.78, 1.15, -.13], walnutPeg, stand)
  applyStandBoxWoodUVs(displayPeg.geometry, [.19, .54, .08], 'y')
  const spoon = new THREE.Group(); spoon.name = 'spoon-body'; world.add(spoon)
  // A closed profile gives the spoon a concave front and a convex, thick wooden back.
  const profile = [[0, 0], [.28, .009], [.55, .035], [.8, .085], [.98, .155], [1, .17], [1.06, .15], [1.06, .10], [.95, .005], [.6, -.095], [0, -.125]]
  const positions: number[] = [0, 0, profile[0]![1]!], indices: number[] = [], segments = 64, rings = profile.length - 2
  for (let i = 1; i <= rings; i++) {
    const [r, z] = profile[i]!
    for (let j = 0; j < segments; j++) {
      const angle = j / segments * Math.PI * 2; positions.push(.33 * r! * Math.cos(angle), .45 * r! * Math.sin(angle), z!)
    }
  }
  const backPole = 1 + rings * segments
  positions.push(0, 0, profile[profile.length - 1]![1]!)
  for (let j = 0; j < segments; j++) indices.push(0, 1 + j, 1 + (j + 1) % segments)
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments, a = 1 + i * segments + j, a1 = 1 + i * segments + next, b = a + segments, b1 = a1 + segments
    indices.push(a, b, b1, a, b1, a1)
  }
  const lastRing = 1 + (rings - 1) * segments
  for (let j = 0; j < segments; j++) indices.push(lastRing + j, backPole, lastRing + (j + 1) % segments)
  const bowlGeometry = new THREE.BufferGeometry(); bowlGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); bowlGeometry.setIndex(indices); bowlGeometry.computeVertexNormals(); applyCarvedSpoonUVs(bowlGeometry, .477)
  const bowl = add('spoon-bowl', bowlGeometry, carved, [0, .477, 0], spoon)
  bowl.userData.toonSurface = { outline: false }
  const handleShape = new THREE.Shape()
  handleShape.moveTo(-.115, .79); handleShape.lineTo(-.12, 1.30); handleShape.bezierCurveTo(-.16, 1.40, -.34, 1.58, -.34, 1.79)
  handleShape.bezierCurveTo(-.34, 2.10, -.10, 2.12, 0, 1.92); handleShape.bezierCurveTo(.10, 2.12, .34, 2.10, .34, 1.79)
  handleShape.bezierCurveTo(.34, 1.58, .16, 1.40, .12, 1.30); handleShape.lineTo(.115, .79); handleShape.closePath()
  const hole = new THREE.Path(); hole.moveTo(0, 1.58); hole.bezierCurveTo(-.07, 1.66, -.23, 1.77, -.19, 1.87)
  hole.bezierCurveTo(-.15, 1.99, -.03, 1.87, 0, 1.81); hole.bezierCurveTo(.03, 1.87, .15, 1.99, .19, 1.87); hole.bezierCurveTo(.23, 1.77, .07, 1.66, 0, 1.58); handleShape.holes.push(hole)
  const handleGeometry = new THREE.ExtrudeGeometry(handleShape, { depth: .14, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 3, curveSegments: 24 }); handleGeometry.translate(0, 0, -.07); applyCarvedSpoonUVs(handleGeometry, 0)
  const handle = add('spoon-carved-handle', handleGeometry, carved, [0, 0, 0], spoon)
  // The small raised lozenge is part of the carved handle, not a transparent touch proxy.
  const grip = box('spoon-handle-grip', [.105, .105, .022], [0, 1.18, .096], grain, spoon); applyStandBoxWoodUVs(grip.geometry, [.105, .105, .022], 'y'); grip.rotation.z = Math.PI / 4
  const polished = new THREE.Group(); polished.name = 'spoon-polished-grain'; spoon.add(polished)
  for (const side of [-1, 1]) tube('spoon-grain-stroke', [[side * .065, .91, .087], [side * .074, 1.04, .087], [side * .068, 1.19, .087], [side * .08, 1.32, .087]].map(p => new THREE.Vector3(...p as [number, number, number])), .0035, grain, polished)
  const home = new THREE.Vector3(-.72, .80, .02)
  const cloth = new THREE.Group(); cloth.name = 'spoon-polishing-cloth'; world.add(cloth)
  const clothGrip = box('spoon-cloth-grip', [.52, .10, .30], [0, 0, 0], linen, cloth)
  box('spoon-cloth-fold', [.48, .018, .11], [0, .057, -.07], linen, cloth)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { spoon.position.copy(at >= 2 ? REST : home); cloth.position.copy(CLOTH_HOME); polished.visible = at >= 1; carved.clearcoat = at >= 1 ? .23 : .19; carved.clearcoatRoughness = at >= 1 ? .39 : .43; matrices() }
  const enabled = (step: number) => () => active() && !motion && at === step
  const bowlPoint = () => bowl.getWorldPosition(new THREE.Vector3())
  addInteractionCue(clothGrip, { kind: 'drag', label: '拿起软布', priority: 3, enabled: enabled(0), destination: bowl, targetLabel: '木勺凹面' })
  addInteractionCue(grip, { kind: 'drag', label: '握住木柄', priority: 3, enabled: enabled(1), destination: () => projectedGuide(seat.getWorldPosition(new THREE.Vector3()),grip.getWorldPosition(new THREE.Vector3()),spoon.getWorldPosition(new THREE.Vector3())), targetLabel: '木勺展托' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点木勺细看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const touch = createTouchTarget(canvas, camera, scene)
  const moving = () => at === 0 ? cloth : spoon
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || (held && belongsTo(object, held))) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (!materials.some(mat => mat.visible && (!mat.transparent || mat.opacity >= 1))) return
      meshes.push(object)
    })
    const first = ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
    return (Array.isArray(targets) ? targets : [targets]).some(target => belongsTo(first, target))
  }
  const automaticReady = (x: number, y: number) => {
    if (at >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, at === 0 ? clothGrip : spoon, [0,0,0])
    return !!contact && !touch.occluded(x,y,at === 0 ? bowl : seat,{ignore:moving()}) && touch.hit(contact.x, contact.y, at === 0 ? bowl : seat, { ignore: moving() })
  }
  const reset = () => { dragging = false; travel = 0; dropFeedback.clear(); if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return touch.hit(x, y, at === 0 ? cloth : spoon) },
    onStart(x, y) { feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices()
      dropFeedback.setReady(dragging && automaticReady(x, y))
    if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; dropFeedback.clear(); begin(true) }
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && automaticReady(x, y)
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && touch.hit(x, y, spoon)
      dragging = false
      dropFeedback.clear()
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: active, duration: 3, motion: 'glow', targets: () => [spoon], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.decorateAction : at === 1 ? COPY.hangAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.wiping : COPY.placing : at === 0 ? COPY.decorate : at === 1 ? COPY.hang : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  function settle() { if (!active() || !motion) return; at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync(); ctx.onProgress?.(at); if (!active()) return; feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' }) }
  function begin(placed = false) { if (!active() || (pointer.isBusy() && !placed) || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    // An accepted save and its checkpoint stay atomic across pause, but not disposal.
    if (disposed) return
    ctx.onProgress?.(3)
    if (!active()) return
    feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 })
    if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.35, 6.05 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.50, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true }; return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .8); const t = ease(motion.time)
        if (motion.step === 0) {
          const target = bowlPoint().add(new THREE.Vector3(0, 0, .24))
          if (t < .66) { cloth.position.lerpVectors(motion.from, target, Math.min(1, t / .3)); cloth.position.y += Math.sin(t / .66 * Math.PI * 2) * .065 }
          else cloth.position.lerpVectors(target, CLOTH_HOME, (t - .66) / .34)
          polished.visible = t > .35
          const sheen = THREE.MathUtils.clamp((t - .2) / .5, 0, 1)
          carved.clearcoat = THREE.MathUtils.lerp(.19, .23, sheen)
          carved.clearcoatRoughness = THREE.MathUtils.lerp(.43, .39, sheen)
        } else { spoon.position.lerpVectors(motion.from, REST, t); if (!reduced()) spoon.position.y += .14 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      ending.update(dt)
      if (!disposed && active()) { matrices(); style.render() }
    },
    dispose() { if (disposed) return; ending.dispose(); disposed = true; pointer.dispose(); dropFeedback.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); woodTextures.forEach(t => t.dispose()); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
