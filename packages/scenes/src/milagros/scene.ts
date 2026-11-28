import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createQuietEnding } from '../quiet-ending'
import { bindSceneAttribute, bindSceneText, sceneProductCopy, sceneTemplate } from '../scene-localization'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import { placementHit } from '../placement-hit'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost,
  setSafeText, sizeStage,
} from '../procedural-kit'

const LABELS = ['心形', '手形', '小屋', '花形']
const VARIANTS = ['heart', 'hand', 'home', 'flower']
const COPY = {
  title: '留一枚感谢', choose: '选好这枚', hang: '挂上小符', leave: '留在这里',
  returning: '回看这枚小符与当时的祈求或谢意，再轻点它结束静看。',
  hints: ['想一件要向圣者祈求或谢恩的事，轻点选一枚金属小符。', '把选好的小符拖到眼前木架的挂点。',
    '把向圣者的祈求或谢意留在心里，静看小符，再点「留在这里」。', '小符已挂在木架上，这一刻的祈求或谢意已留下。'],
  wishLabel: '写下祈求或谢意', wishPlaceholder: '为一件事祈求，或为蒙恩道谢…',
}

function charmShape(kind: number) {
  const shape = new THREE.Shape()
  if (kind === 0) {
    // Soft hand-forged heart ex-voto silhouette.
    shape.moveTo(0, -0.27)
    shape.bezierCurveTo(-0.095, -0.155, -0.315, 0.015, -0.252, 0.182)
    shape.bezierCurveTo(-0.185, 0.342, -0.042, 0.295, 0, 0.174)
    shape.bezierCurveTo(0.042, 0.295, 0.185, 0.342, 0.252, 0.182)
    shape.bezierCurveTo(0.315, 0.015, 0.095, -0.155, 0, -0.27)
  } else if (kind === 1) {
    // Hand-forged repoussé silver ex-voto hand: smooth cubic Bézier palm, natural opposable thumb,
    // softly rounded U-webs and graceful five-finger proportions meeting the top bail cleanly at (0, 0.338).
    shape.moveTo(0, -0.254)
    // Soft flared wrist cuff -> rounded outer hypothenar palm edge
    shape.bezierCurveTo(0.068, -0.254, 0.114, -0.236, 0.132, -0.194)
    shape.bezierCurveTo(0.152, -0.140, 0.172, -0.052, 0.178, 0.036)
    // Little finger (pinky): dainty gentle splay & rounded fingertip
    shape.bezierCurveTo(0.190, 0.108, 0.206, 0.174, 0.196, 0.204)
    shape.bezierCurveTo(0.188, 0.228, 0.156, 0.228, 0.148, 0.200)
    shape.bezierCurveTo(0.140, 0.170, 0.132, 0.120, 0.126, 0.084)
    // Smooth interdigital U-web (pinky -> ring)
    shape.bezierCurveTo(0.122, 0.066, 0.106, 0.066, 0.102, 0.088)
    // Ring finger
    shape.bezierCurveTo(0.108, 0.166, 0.116, 0.244, 0.110, 0.282)
    shape.bezierCurveTo(0.104, 0.310, 0.072, 0.312, 0.064, 0.282)
    shape.bezierCurveTo(0.056, 0.244, 0.050, 0.166, 0.046, 0.108)
    // Smooth interdigital U-web (ring -> middle)
    shape.bezierCurveTo(0.044, 0.090, 0.030, 0.090, 0.028, 0.112)
    // Middle finger: tallest, centered at x = 0 reaching y = 0.338 cleanly into the hanging ring
    shape.bezierCurveTo(0.028, 0.190, 0.028, 0.278, 0.023, 0.318)
    shape.bezierCurveTo(0.018, 0.344, -0.018, 0.344, -0.023, 0.318)
    shape.bezierCurveTo(-0.028, 0.278, -0.030, 0.188, -0.034, 0.110)
    // Smooth interdigital U-web (middle -> index)
    shape.bezierCurveTo(-0.036, 0.090, -0.052, 0.090, -0.056, 0.108)
    // Index finger
    shape.bezierCurveTo(-0.064, 0.170, -0.070, 0.242, -0.078, 0.276)
    shape.bezierCurveTo(-0.086, 0.304, -0.118, 0.300, -0.124, 0.270)
    shape.bezierCurveTo(-0.132, 0.230, -0.134, 0.144, -0.136, 0.064)
    // Graceful thumb saddle (purlicue)
    shape.bezierCurveTo(-0.138, 0.026, -0.152, 0.012, -0.170, 0.032)
    // Natural opposable thumb with warm rounded pad
    shape.bezierCurveTo(-0.190, 0.056, -0.212, 0.088, -0.228, 0.102)
    shape.bezierCurveTo(-0.252, 0.118, -0.272, 0.094, -0.258, 0.064)
    shape.bezierCurveTo(-0.242, 0.024, -0.210, -0.026, -0.186, -0.074)
    // Plump thenar heel returning smoothly to the rounded wrist base
    shape.bezierCurveTo(-0.164, -0.124, -0.146, -0.188, -0.124, -0.222)
    shape.bezierCurveTo(-0.100, -0.248, -0.062, -0.254, 0, -0.254)
  } else if (kind === 2) {
    // Cozy cottage silhouette with gently chamfered eaves and pitched roof.
    shape.moveTo(-0.226, -0.24)
    shape.lineTo(0.226, -0.24)
    shape.quadraticCurveTo(0.234, -0.24, 0.234, -0.232)
    shape.lineTo(0.234, 0.076)
    shape.lineTo(0.284, 0.076)
    shape.quadraticCurveTo(0.296, 0.076, 0.286, 0.088)
    shape.lineTo(0.012, 0.334)
    shape.quadraticCurveTo(0, 0.344, -0.012, 0.334)
    shape.lineTo(-0.286, 0.088)
    shape.quadraticCurveTo(-0.296, 0.076, -0.284, 0.076)
    shape.lineTo(-0.234, 0.076)
    shape.lineTo(-0.234, -0.232)
    shape.quadraticCurveTo(-0.234, -0.24, -0.226, -0.24)
  } else {
    for (let i = 0; i <= 80; i++) {
      const angle = i / 80 * Math.PI * 2, radius = 0.21 + Math.cos(angle * 5) * 0.06
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
    }
  }
  return shape
}

/**
 * Adds gentle hand-forged repoussé dome relief to the silver hand milagro geometry:
 * softly pillows the palm center, thenar/hypothenar pads, and individual finger ridges
 * while keeping the perimeter edges crisp and the base strictly finite.
 */
function applyHandRepousseRelief(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    if (z <= 0.014) continue
    // Front face pillow: soft palm dome + warm thenar pad + subtle finger/thumb ridge fullness.
    const palmDome = Math.exp(-(Math.pow(x / 0.145, 2) + Math.pow((y + 0.045) / 0.145, 2))) * 0.0145
    const thenarPad = Math.exp(-(Math.pow((x + 0.095) / 0.075, 2) + Math.pow((y + 0.10) / 0.095, 2))) * 0.0085
    const hypoPad = Math.exp(-(Math.pow((x - 0.092) / 0.070, 2) + Math.pow((y + 0.09) / 0.10, 2))) * 0.0065
    const fingerRidge = y > 0.06
      ? Math.exp(-Math.pow((y - 0.19) / 0.13, 2)) * 0.0055 * (0.55 + 0.45 * Math.cos(x * 36))
      : 0
    // Gentle embossed palm lifeline crease to catch soft specular highlights.
    const creaseDist = Math.abs((y + 0.01) - 0.55 * (x + 0.04) * (x + 0.04) * 4.5 + 0.03)
    const creaseMask = Math.exp(-Math.pow(x / 0.095, 2)) * Math.exp(-Math.pow(creaseDist / 0.018, 2))
    const frontFactor = THREE.MathUtils.smoothstep(z, 0.014, 0.034)
    pos.setZ(i, z + frontFactor * (palmDome + thenarPad + hypoPad + fingerRidge - creaseMask * 0.0045))
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

export function createMilagros(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const safe = shared.assertSafeCopy
  for (const text of [COPY.title, COPY.choose, COPY.hang, COPY.leave, COPY.returning, COPY.wishLabel, COPY.wishPlaceholder, ...COPY.hints]) safe(text)
  let step = Math.max(0, Math.min(3, Math.floor(ctx.initialProgress ?? 0)))
  let selected = Math.max(0, VARIANTS.indexOf(ctx.initialVariant ?? 'heart'))
  let started = false, disposed = false, elapsed = 1, clock = 0
  let drag: { id: number; stage: number; x: number; y: number } | null = null
  let blocked = false
  const pointers = new Set<number>()
  const canAct = () => started && !disposed && (ctx.isActive?.() ?? true)
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
  const home = new THREE.Vector3(0.12, 1.72, 4.75)
  const look = new THREE.Vector3(0, 1.08, 0)
  camera.position.copy(home); camera.lookAt(look)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'milagros', label: COPY.title })
  style.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, { sky: 0xfff5e9, ground: 0xc7bca2, key: 0xffe7c1, rim: 0xd7ecdf })
  const world = new THREE.Group(); scene.add(world)
  const material = (color: number, metalness = 0, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, metalness, roughness })
  const wood = material(0xbe9169), paper = material(0xf8e8c9), darkWood = material(0x987355)
  applyCraftSurface(wood, { kind: 'wood', strength: .4 })
  applyCraftSurface(darkWood, { kind: 'wood', axis: 'y', strength: .4 })
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); parent.add(mesh); return mesh
  }
  const groundY = getEnvironmentSurfaceY('milagros')
  const footTop = 0.595
  const footH = footTop - groundY
  const trayTop = 0.227
  const trayH = trayTop - groundY
  const linerTopY = 0.24 + 0.027 / 2
  add(new RoundedBoxGeometry(2.08, 1.65, 0.17, 3, 0.085), wood, 0, 1.32, -0.1)
  const panel = add(new RoundedBoxGeometry(1.87, 1.43, 0.05, 2, 0.055), paper, 0, 1.32, 0.01)
  panel.userData.toonSurface = { outline: false }
  for (const x of [-0.71, 0.71]) {
    add(new RoundedBoxGeometry(0.16, footH, 0.28, 2, 0.03), darkWood, x, (groundY + footTop) / 2, -0.04).name = 'milagros-board-foot'
  }
  add(new RoundedBoxGeometry(2.35, trayH, 0.86, 3, 0.045), wood, 0, (groundY + trayTop) / 2, 0.43).name = 'milagros-tray-base'
  const liner = add(new RoundedBoxGeometry(2.17, 0.027, 0.71, 2, 0.02), paper, 0, 0.24, 0.45)
  liner.name = 'milagros-tray-liner'
  liner.userData.toonSurface = { outline: false }
  const pinMat = applyCraftSurface(material(0xc49b50, 0.45, 0.42),{kind:'metal',strength:.45})
  const pinCollar = add(new THREE.CylinderGeometry(0.042, 0.048, 0.018, 16), pinMat, 0, 1.69, 0.038)
  pinCollar.rotation.x = Math.PI / 2; pinCollar.name = 'milagros-pin-collar'
  const pinShaft = add(new THREE.CylinderGeometry(0.020, 0.022, 0.135, 14), pinMat, 0, 1.69, 0.0975)
  pinShaft.rotation.x = Math.PI / 2; pinShaft.name = 'milagros-pin-shaft'
  const pin = add(new THREE.SphereGeometry(0.048, 12, 8), pinMat, 0, 1.69, 0.16)
  pin.name = 'milagros-pin'
  const pinTarget = add(new THREE.SphereGeometry(0.24, 16, 8), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.65, 0.20)
  pinTarget.name = 'milagros-pin-target'
  const guide = add(new THREE.TorusGeometry(0.15, 0.008, 6, 32),
    new THREE.MeshBasicMaterial({ color: 0xebce82, transparent: true, opacity: 0.65, depthWrite: false }), 0, 1.65, 0.14)
  const suspensions: THREE.Group[] = []
  const charmGroups: THREE.Group[] = [], charmMeshes: THREE.Mesh[] = []
  const starts: THREE.Vector3[] = [], charmMaterials: THREE.MeshStandardMaterial[] = []
  const colors = [0xe8bd75, 0xb7c5c3, 0xdab48a, 0xedcf87]
  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group(); group.name = `milagros-charm-${i}`
    const isHand = i === 1
    const charmGeometry = new THREE.ExtrudeGeometry(charmShape(i), {
      depth: 0.028,
      bevelEnabled: true,
      bevelSegments: isHand ? 4 : 3,
      steps: 1,
      // Hand interdigital webs stay crisp and non-overlapping with a forged 0.007 bevel.
      bevelSize: isHand ? 0.007 : 0.015,
      bevelThickness: isHand ? 0.012 : 0.014,
      curveSegments: 24,
    })
    if (isHand) applyHandRepousseRelief(charmGeometry)
    charmGeometry.computeBoundingBox()
    const startY = linerTopY - charmGeometry.boundingBox!.min.y * 0.73
    const start = new THREE.Vector3(-0.81 + i * 0.54, startY, 0.72)
    group.position.copy(start); group.scale.setScalar(0.73)
    const suspension = new THREE.Group(); suspension.name = `milagros-suspension-${i}`; world.add(suspension)
    suspension.add(group); suspensions.push(suspension); charmGroups.push(group); starts.push(start)
    const mat = applyCraftSurface(material(colors[i], 0.55, 0.35), { kind: 'metal', strength: .45 }); charmMaterials.push(mat)
    const mesh = add(charmGeometry, mat, 0, 0, 0, group)
    mesh.name = `milagros-symbol-${i}`; mesh.userData.choice = i
    mesh.userData.toonSurface = { metalness: 0.55, roughness: 0.35 }
    charmMeshes.push(mesh)
    const ring = add(new THREE.TorusGeometry(0.047, 0.010, 8, 24), mat, 0, 0.37, 0.025, group)
    ring.userData.toonSurface = { metalness: 0.55, roughness: 0.35 }
    if (isHand) {
      // Subtle forged wrist cuff band & center palm repoussé dimple catch warm metallic highlights.
      const cuffBar = add(new RoundedBoxGeometry(0.185, 0.024, 0.014, 2, 0.006), mat, 0, -0.212, 0.036, group)
      cuffBar.userData.toonSurface = { metalness: 0.55, roughness: 0.35 }
      const palmBoss = add(new THREE.SphereGeometry(0.024, 12, 8), mat, -0.005, -0.035, 0.046, group)
      palmBoss.scale.set(1.1, 1.0, 0.28)
      palmBoss.userData.toonSurface = { metalness: 0.55, roughness: 0.35 }
    } else {
      // Two tiny pressed marks catch light and give the metal a handmade face.
      for (const x of [-0.07, 0.07]) add(new THREE.SphereGeometry(0.017, 8, 6), mat, x, 0.02, 0.055, group).scale.z = 0.25
    }
  }
  // Small original ornaments suggest accumulated thanks without copying a sacred site.
  const decorativeCharmMaterial=applyCraftSurface(material(0xcbb48f,0.35,0.6),{kind:'metal',strength:.45})
  for (let i = 0; i < 3; i++) {
    const isHand = i === 1
    const decoGeo = new THREE.ExtrudeGeometry(charmShape(i), {
      depth: 0.025,
      bevelEnabled: true,
      bevelSize: isHand ? 0.006 : 0.012,
      bevelThickness: 0.01,
      bevelSegments: isHand ? 3 : 2,
      curveSegments: 20,
    })
    if (isHand) applyHandRepousseRelief(decoGeo)
    const mesh = add(decoGeo, decorativeCharmMaterial, i === 1 ? 0.65 : -0.64, i === 2 ? 0.89 : 1.42, 0.065)
    mesh.scale.setScalar(0.34); mesh.rotation.z = i === 1 ? 0.1 : -0.12
  }
  const held = new THREE.Vector3(0.62, 1.04, 0.62)
  const hangAnchor = new THREE.Vector3(0, 0.37, 0.025)
  // The loop center stays on the pin while its scaled body swings below it.
  function suspend() {
    const group = charmGroups[selected], suspension = suspensions[selected]
    suspension.position.copy(pin.position); suspension.rotation.set(0, 0, 0)
    group.position.copy(hangAnchor).multiplyScalar(-1.15); group.scale.setScalar(1.15); group.rotation.set(0, 0, 0)
  }
  charmMeshes.forEach((mesh, index) => {
    addInteractionCue(mesh, {
      kind: 'tap', label: '轻点选择小符',
      get priority() { return selected === index ? 2 : 1 },
      get compact() { return selected !== index },
      enabled: () => canAct() && !blocked && step === 0,
    })
    addInteractionCue(mesh, {
      kind: 'drag', label: '拖小符到挂点', priority: 2,
      enabled: () => canAct() && !blocked && selected === index && step === 1 && elapsed >= 1,
      destination: pinTarget, targetLabel: '木架挂点',
    })
    addInteractionCue(mesh, {
      kind: 'tap', label: '轻点小符静看', priority: 2,
      enabled: () => canAct() && !blocked && selected === index && step === 2 && ctx.returning === true,
    })
  })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.choose }, safe)
  const choices = document.createElement('div'); choices.className = 'scene-wish-slot'
  const row = document.createElement('div'); row.className = 'scene-craft-choices'; row.setAttribute('role', 'group'); bindSceneAttribute(row, 'aria-label', '选择小符')
  const buttons = LABELS.map((label, i) => {
    const button = document.createElement('button'); button.type = 'button'; bindSceneText(button, label)
    bindSceneAttribute(button, 'aria-label', sceneTemplate("选择{p0}小符", { p0: sceneProductCopy(label) }))
    button.addEventListener('click', () => { if (canAct() && step === 0 && !blocked && !drag && !pointers.size) select(i, true) })
    row.append(button); return button
  })
  choices.append(row); overlay.append(choices)
  const wish = document.createElement('div'); wish.className = 'scene-wish-slot'; overlay.append(wish)
  const writer = gestures.createWishWrite({ maxLen: 40, saves: Boolean(ctx.saveWish) && !ctx.returning, onSubmit: text => finish(text) })
  writer.mount(wish, {})
  const input = wish.querySelector('input')
  if (input) { bindSceneAttribute(input, 'aria-label', COPY.wishLabel); bindSceneAttribute(input, "placeholder", COPY.wishPlaceholder) }
  const feedback = createSceneFeedback(ctx)
  const ray = createPointerRay(canvas, camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.62), point = new THREE.Vector3()
  const dragOffset = new THREE.Vector3()
  const selectedHits = (x: number, y: number) => ray.hits(x, y, [charmMeshes[selected]])
  const onObject = (x: number, y: number) => canAct() && (step === 0 ? ray.hits(x, y, charmMeshes) : (step === 1 || step === 2 && ctx.returning === true) && selectedHits(x, y))
  const stopClaim = claimObjectTouches(ui.hitLayer, onObject)
  let unobserve = () => {}
  function select(index: number, remember = false) {
    selected = index
    if (remember) ctx.onVariantChange?.(VARIANTS[index])
    charmMaterials.forEach((mat, i) => { mat.emissive.set(i === index ? 0x7b481c : 0); mat.emissiveIntensity = i === index ? 0.16 : 0 })
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
  }
  const ending = createQuietEnding(ctx, { ui: ui, isActive: () => started && !disposed && canAct(),
    duration: 3, motion: 'sway', targets: () => [suspensions[selected]], cancelInput: () => { resetDrag() }, complete: () => finish(),
  })
  function sync() {
    ui.renderDots(step, 3); choices.hidden = step !== 0; wish.hidden = step !== 2 || Boolean(ctx.returning)
    ui.actionBtn.hidden = step === 3
    setSafeText(ui.hintEl, step === 2 && ctx.returning ? COPY.returning : COPY.hints[step], safe)
    setSafeText(ui.actionBtn, step === 0 ? COPY.choose : step === 1 ? COPY.hang : COPY.leave, safe)
    guide.visible = step === 1
    writer.setEnabled(step === 2 && canAct() && !ctx.returning)
    charmGroups.forEach((group, i) => {
      if (i !== selected) { group.position.copy(starts[i]); group.scale.setScalar(0.73) }
    })
    ending.sync(step === 2)
  }
  function choose() {
    if (!canAct() || step !== 0) return
    step = 1; elapsed = ctx.isReducedMotion?.() ? 1 : 0
    ctx.onProgress?.(1); feedback.impact({ freqs: [523, 784], duration: 0.3, gain: 0.055 }); sync()
  }
  function hang() {
    if (!canAct() || step !== 1) return
    step = 2; drag = null; elapsed = 1
    suspend()
    ctx.onProgress?.(2); feedback.impact({ freqs: [659, 988], duration: 0.45, gain: 0.06 }); sync()
  }
  function finish(text = '') {
    if (!text.trim() && !ending.completing) return
    if (!canAct() || step !== 2) return
    const line = text.trim()
    step = 3; drag = null
    if (line && !ctx.returning) { ctx.saveWish?.(line); if (disposed || !canAct()) return }
    ctx.onProgress?.(3); if (disposed || !canAct()) return; sync()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => {
    if (!canAct() || blocked || drag || pointers.size) return
    feedback.prepare()
    if (step === 0) choose(); else if (step === 1) hang(); else if (step === 2) finish()
  }
  const resetDrag = () => { drag = null; if (step === 1) charmGroups[selected].position.copy(held) }
  const down = (event: PointerEvent) => {
    if (!canAct() || (event.button ?? 0) !== 0 || step > 1 && !(step === 2 && ctx.returning)) return
    pointers.add(event.pointerId)
    if (pointers.size > 1 || event.isPrimary === false) { blocked = true; resetDrag(); return }
    if (blocked || !onObject(event.clientX, event.clientY)) return
    if (step === 0) {
      const hit = ray.aim(event.clientX, event.clientY).intersectObjects(charmMeshes, false)[0]
      if (hit) select(hit.object.userData.choice, true)
    }
    feedback.prepare(); drag = { id: event.pointerId, stage: step, x: event.clientX, y: event.clientY }
    if (step === 1) {
      const group = charmGroups[selected], origin = group.getWorldPosition(new THREE.Vector3())
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), charmMeshes[selected].getWorldPosition(new THREE.Vector3()))
      if (ray.aim(event.clientX, event.clientY).ray.intersectPlane(plane, point)) dragOffset.copy(origin).sub(point)
    }
    try { ui.hitLayer.setPointerCapture?.(event.pointerId) } catch { /* Capture may be absent in an embedded surface. */ }
  }
  const move = (event: PointerEvent) => {
    if (!canAct()) { resetDrag(); return }
    if (!drag || blocked || drag.id !== event.pointerId || drag.stage !== 1) return
    if (ray.aim(event.clientX, event.clientY).ray.intersectPlane(plane, point)) {
      point.add(dragOffset); world.worldToLocal(point); charmGroups[selected].position.copy(point)
      world.updateMatrixWorld(true)
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 0
        && placementHit(canvas, camera, charmMeshes[selected], event.clientX, event.clientY, (x, y) => ray.hits(x, y, [pinTarget]))) hang()
    }
  }
  const up = (event: PointerEvent) => {
    const previous = drag, multi = blocked
    // A sparse native stream can carry its only destination sample in up.
    // Move and test the same physical anchor before releasing its ownership.
    if (previous?.stage === 1 && previous.id === event.pointerId && !multi && canAct()) move(event)
    pointers.delete(event.pointerId)
    if (previous?.id === event.pointerId) drag = null
    if (pointers.size === 0) blocked = false
    if (!previous || previous.id !== event.pointerId || multi || !canAct()) { resetDrag(); return }
    if (previous.stage === 0 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 9) choose()
    else if (previous.stage === 1) { if (step === 1) resetDrag() }
    else if (previous.stage === 2 && ctx.returning && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 9 && selectedHits(event.clientX, event.clientY)) finish()
    else resetDrag()
  }
  const cancel = (event: PointerEvent) => { pointers.delete(event.pointerId); resetDrag(); if (!pointers.size) blocked = false }
  const otherDown = (event: PointerEvent) => {
    if (!canAct() || step > 1 && !(step === 2 && ctx.returning) || (event.button ?? 0) !== 0) return
    pointers.add(event.pointerId)
    if (pointers.size > 1 || event.isPrimary === false) { blocked = true; resetDrag() }
  }
  const windowEnd = (event: PointerEvent) => {
    if (!ui.hitLayer.contains(event.target as Node) && drag?.id === event.pointerId) resetDrag()
    pointers.delete(event.pointerId)
    if (!pointers.size) blocked = false
  }
  const blur = () => { pointers.clear(); blocked = false; resetDrag() }
  const lostCapture = (event: PointerEvent) => { if (drag?.id === event.pointerId) cancel(event) }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); home.z = 4.75 + portraitBoost(aspect, 3); camera.position.copy(home); camera.lookAt(look) }
  select(selected); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; resize(); unobserve = observeCanvasResize(canvas, resize)
      ui.actionBtn.addEventListener('click', action)
      ui.hitLayer.addEventListener('pointerdown', down); ui.hitLayer.addEventListener('pointermove', move)
      ui.hitLayer.addEventListener('pointerup', up); ui.hitLayer.addEventListener('pointercancel', cancel)
      ui.hitLayer.addEventListener('lostpointercapture', lostCapture)
      window.addEventListener('pointerdown', otherDown, true)
      window.addEventListener('pointerup', windowEnd); window.addEventListener('pointercancel', windowEnd)
      window.addEventListener('blur', blur)
      if (step === 1) { charmGroups[selected].position.copy(held); charmGroups[selected].scale.setScalar(1.1) }
      if (step >= 2) { suspend() }
      sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!(ctx.isActive?.() ?? true)) { pointers.clear(); blocked = false; resetDrag(); writer.setEnabled(false); return }
      writer.setEnabled(step === 2 && !ctx.returning)
      elapsed = Math.min(1, elapsed + Math.max(0, dt) / 0.6)
      const reduced = ctx.isReducedMotion?.() ?? false
      if (!reduced) clock += Math.max(0, dt)
      if (step === 1 && !drag) {
        const t = reduced ? 1 : elapsed, eased = 1 - Math.pow(1 - t, 3)
        charmGroups[selected].position.lerpVectors(starts[selected], held, eased)
        charmGroups[selected].scale.setScalar(0.73 + eased * 0.37)
      }
      if (step >= 2) suspensions[selected].rotation.z = reduced ? 0 : Math.sin(clock * 1.3) * Math.exp(-clock * 0.08) * 0.035
      ending.update(dt)
      if (disposed || !(canAct())) return
      style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true; pointers.clear(); drag = null; unobserve(); stopClaim(); writer.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action)
      ui.hitLayer.removeEventListener('pointerdown', down); ui.hitLayer.removeEventListener('pointermove', move)
      ui.hitLayer.removeEventListener('pointerup', up); ui.hitLayer.removeEventListener('pointercancel', cancel)
      ui.hitLayer.removeEventListener('lostpointercapture', lostCapture)
      window.removeEventListener('pointerdown', otherDown, true)
      window.removeEventListener('pointerup', windowEnd); window.removeEventListener('pointercancel', windowEnd)
      window.removeEventListener('blur', blur)
      style.dispose(); disposeTree(world); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
