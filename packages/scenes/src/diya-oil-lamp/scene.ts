import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPathSweep } from '../path-sweep'
import { createTouchTarget } from '../touch-target'
import {
  addStageLights, CEL_STYLE, createLampHalo, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize,
  portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '灯旋一瞥', steps: '步骤',
  light: '印度教献光礼以灯光表达礼敬。依次点按棉芯，点亮三盏陶灯；也可从一盏轻拖到另一盏。',
  spin: '看看献光灯移动的姿态：拖住前方的小灯，沿浅金圆弧慢慢旋一圈。',
  place: '把小灯轻轻拖回盘上亮起的空位。',
  done: '小灯已归盘。静看献光所用的灯盏与光，记住这份礼敬的来处。',
  lightAction: '点亮一盏', spinAction: '轻旋一圈', placeAction: '放回盘上',
  spinning: '小灯沿圆弧缓缓转过…', placing: '小灯正轻轻落回盘上…',
} as const
const ORBIT_RADIUS = 0.60
const ORBIT_Y = 0.84
const ORBIT_START = Math.PI / 2
const HELD = new THREE.Vector3(0, 0.72, ORBIT_RADIUS)
const HOMES = [new THREE.Vector3(-0.44, 0.105, -0.29), new THREE.Vector3(0.44, 0.105, -0.29), new THREE.Vector3(0, 0.105, 0.36)]
const smooth = (t: number) => t * t * (3 - 2 * t)
type Checkpoint = 0 | 1 | 2 | 3
type Drag = { kind: 'light'; visited: Set<number> } | { kind: 'spin' } | { kind: 'place' }
type Motion = { kind: 'spin' | 'place'; elapsed: number; from: THREE.Vector3 }

/** A spouted plan outline; the open cross-section is constructed separately. */
function outline(a: number, scale = 1) {
  const r = (0.29 + 0.13 * Math.max(0, Math.cos(a)) ** 8) * scale
  return new THREE.Vector3(Math.sin(a) * r * 0.96, 0, Math.cos(a) * r)
}

/** Solid clay base and walls, descending inside to an open, shallow oil well. */
function dishGeometry() {
  const rings = [[0.05, 0.014], [0.44, 0.018], [0.73, 0.07], [1, 0.195], [0.92, 0.195], [0.74, 0.105], [0.26, 0.043], [0.05, 0.042]]
  const segments = 64, positions: number[] = [], indices: number[] = []
  rings.forEach(([scale, y]) => {
    for (let i = 0; i <= segments; i++) {
      const p = outline(i / segments * Math.PI * 2, scale)
      positions.push(p.x, y, p.z)
    }
  })
  for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < segments; i++) {
    const a = ring * (segments + 1) + i, b = a + segments + 1
    indices.push(a, a + 1, b, a + 1, b + 1, b)
  }
  // Both tiny central holes are capped; no plane crosses the open upper rim.
  for (const [ring, y, reverse] of [[0, 0.014, 1], [rings.length - 1, 0.042, 0]]) {
    const center = positions.length / 3
    positions.push(0, y, 0)
    for (let i = 0; i < segments; i++) {
      const a = ring * (segments + 1) + i
      indices.push(...(reverse ? [center, a + 1, a] : [center, a, a + 1]))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function horizontalShape(scale: number, material: THREE.Material) {
  const shape = new THREE.Shape()
  for (let i = 0; i <= 64; i++) {
    const p = outline(i / 64 * Math.PI * 2, scale)
    if (i === 0) shape.moveTo(p.x, -p.z)
    else shape.lineTo(p.x, -p.z)
  }
  shape.closePath()
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

export function createDiyaOilLamp(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  let started = false, disposed = false, focused = true, suspended = false, checkpoint: Checkpoint = 0
  let drag: Drag | null = null, motion: Motion | null = null
  let clock = 0, stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.lightAction }, assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60)
  const lookAt = new THREE.Vector3(0, 0.36, 0)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'diya-oil-lamp', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, {
    sky: 0xffefde, ground: 0x76584b, key: 0xffe1be, rim: 0xe6beab,
    keyIntensity: 0.95, keyPosition: [-2.5, 4, 3], ambientIntensity: 0.24,
  })
  const world = new THREE.Group()
  world.name = 'diya-world'
  scene.add(world)
  const clay = new THREE.MeshStandardMaterial({ color: 0xb55f3d, roughness: 0.93, side: THREE.DoubleSide })
  const rimClay = new THREE.MeshStandardMaterial({ color: 0xcc7850, roughness: 0.93 })
  const cotton = new THREE.MeshStandardMaterial({ color: 0xf1dec0, roughness: 1 })
  const burnt = new THREE.MeshStandardMaterial({ color: 0x443128, roughness: 1 })
  const amber = new THREE.MeshStandardMaterial({ color: 0x98631f, roughness: 0.26, metalness: 0.08, side: THREE.DoubleSide })
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x987b60, roughness: 0.76, metalness: 0.25 })
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xbe9b70, roughness: 0.86, metalness: 0.12, side: THREE.DoubleSide })
  const hidden = new THREE.MeshBasicMaterial({ visible: false })
  const plate = new THREE.Group()
  plate.name = 'diya-plate'
  world.add(plate)
  const plateBody = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 0.96, 0.07, 64), plateMat)
  plateBody.position.y = 0.038
  plate.add(plateBody)
  const plateRim = new THREE.Mesh(new THREE.TorusGeometry(1.00, 0.028, 8, 64), plateMat)
  plateRim.rotation.x = Math.PI / 2
  plateRim.position.y = 0.082
  plate.add(plateRim)
  // A product-original ring of small petals, with no named sacred motif.
  const petalShape = new THREE.Shape()
  petalShape.moveTo(0, 0.075)
  petalShape.bezierCurveTo(-0.038, 0.025, -0.038, -0.04, 0, -0.075)
  petalShape.bezierCurveTo(0.038, -0.04, 0.038, 0.025, 0, 0.075)
  const petalGeometry = new THREE.ShapeGeometry(petalShape)
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2
    const petal = new THREE.Mesh(petalGeometry, petalMat)
    petal.position.set(Math.sin(a) * 0.88, 0.075, Math.cos(a) * 0.88)
    petal.rotation.set(-Math.PI / 2, 0, -a)
    plate.add(petal)
  }

  const bowlGeometry = dishGeometry()
  const rimCurve = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => {
    const p = outline(i / 64 * Math.PI * 2)
    p.y = 0.195
    return p
  }), true)
  const rimGeometry = new THREE.TubeGeometry(rimCurve, 96, 0.018, 8, true)
  const wickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.04, 0.115, 0.04), new THREE.Vector3(-0.07, 0.12, 0.18),
    new THREE.Vector3(-0.025, 0.155, 0.30), new THREE.Vector3(0, 0.212, 0.40),
  ])
  const wickGeometry = new THREE.TubeGeometry(wickCurve, 28, 0.019, 8, false)
  const flameGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.027, 0.015), new THREE.Vector2(0.043, 0.055),
    new THREE.Vector2(0.033, 0.12), new THREE.Vector2(0.013, 0.185), new THREE.Vector2(0, 0.23),
  ], 20)
  const lamps = HOMES.map((home, i) => {
    const group = new THREE.Group()
    group.name = `diya-lamp-${i}`
    group.position.copy(home)
    world.add(group)
    const dish = new THREE.Mesh(bowlGeometry, clay)
    dish.name = `diya-dish-${i}`
    group.add(dish)
    const rim = new THREE.Mesh(rimGeometry, rimClay)
    rim.name = `diya-rim-${i}`
    group.add(rim)
    const oil = horizontalShape(0.76, amber)
    oil.position.y = 0.11
    oil.name = `diya-oil-${i}`
    group.add(oil)
    const wick = new THREE.Mesh(wickGeometry, cotton)
    wick.name = `diya-wick-${i}`
    group.add(wick)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 6), burnt)
    tip.position.set(0, 0.212, 0.40)
    group.add(tip)
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), hidden)
    target.name = `diya-wick-target-${i}`
    target.position.copy(tip.position)
    group.add(target)
    const flame = new THREE.Mesh(flameGeometry, new THREE.MeshBasicMaterial({ color: 0xffd58b }))
    flame.position.copy(tip.position)
    flame.name = `diya-flame-${i}`
    flame.visible = false
    flame.userData.toonSurface = { outline: false }
    group.add(flame)
    const core = new THREE.Mesh(flameGeometry, new THREE.MeshBasicMaterial({ color: 0xfff3cc }))
    core.scale.set(0.55, 0.74, 0.55)
    core.position.y = 0.013
    flame.add(core)
    const glow = new THREE.PointLight(0xffb458, 0, 1.55, 2)
    glow.position.set(0, 0.28, 0.40)
    glow.name = `diya-light-${i}`
    group.add(glow)
    const halo = createLampHalo(0xffae50, 0.44)
    halo.sprite.name = `diya-halo-${i}`
    halo.sprite.position.set(0, 0.32, 0.40)
    group.add(halo.sprite)
    return { group, target, wick, tip, flame, glow, halo, lit: false, glowT: 0 }
  })
  const heldLamp = lamps[2]
  const heldTarget = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 10), hidden)
  heldTarget.name = 'diya-held-target'
  heldTarget.position.set(0, 0.12, 0)
  heldLamp.group.add(heldTarget)
  const plateTarget = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 10), hidden)
  plateTarget.name = 'diya-plate-target'
  plateTarget.position.copy(HOMES[2]).add(new THREE.Vector3(0, 0.12, 0))
  world.add(plateTarget)
  lamps.forEach(lamp => addInteractionCue(lamp.target, {
    kind: 'tap', label: '轻点棉芯点灯', priority: 2,
    enabled: () => active() && !motion && checkpoint === 0 && !lamp.lit,
  }))
  addInteractionCue(heldTarget, {
    kind: 'rotate', label: '沿圆弧旋一圈', priority: 2,
    enabled: () => active() && !motion && checkpoint === 1,
  })
  addInteractionCue(heldTarget, {
    kind: 'drag', label: '拖小灯回盘上', priority: 2,
    enabled: () => active() && !motion && checkpoint === 2,
    destination: plateTarget, targetLabel: '盘上空位',
  })
  const orbitGuide = new THREE.Group()
  orbitGuide.name = 'diya-orbit-guide'
  world.add(orbitGuide)
  const guideMat = new THREE.MeshBasicMaterial({ color: 0xe7bd73, transparent: true, opacity: 0.48, depthWrite: false })
  const waypointGeometry = new THREE.SphereGeometry(0.017, 8, 6)
  const orbitPoints = Array.from({ length: 17 }, (_, i) => {
    const a = ORBIT_START + i / 16 * Math.PI * 2
    const point = new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, ORBIT_Y, Math.sin(a) * ORBIT_RADIUS)
    const waypoint = new THREE.Mesh(waypointGeometry, guideMat.clone())
    waypoint.name = `diya-orbit-waypoint-${i}`
    waypoint.position.copy(point)
    orbitGuide.add(waypoint)
    return point
  })
  const orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(orbitPoints).getPoints(96)),
    new THREE.LineDashedMaterial({ color: 0xe7bd73, transparent: true, opacity: 0.40, dashSize: 0.05, gapSize: 0.048, depthWrite: false }))
  orbitLine.computeLineDistances()
  orbitGuide.add(orbitLine)
  const returnGuide = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.013, 8, 48), guideMat)
  returnGuide.name = 'diya-return-guide'
  returnGuide.position.copy(HOMES[2]).add(new THREE.Vector3(0, 0.008, 0))
  returnGuide.rotation.x = -Math.PI / 2
  world.add(returnGuide)

  const orbitSweeps = [1, -1].map(direction => createPathSweep(Array.from({ length: 17 }, (_, i) => { const a = ORBIT_START + direction * i / 16 * Math.PI * 2; return [Math.cos(a) * ORBIT_RADIUS, Math.sin(a) * ORBIT_RADIUS] as const }), .12))
  const ray = createPointerRay(canvas, camera)
  const touch = createTouchTarget(canvas, camera, scene)
  const orbitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ORBIT_Y)
  const placePlane = new THREE.Plane(), point = new THREE.Vector3()
  const updateMatrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const wickAt = (x: number, y: number) => {
    updateMatrices()
    return lamps.findIndex((lamp) => touch.hit(x, y, [lamp.wick, lamp.tip]))
  }
  const syncUI = () => {
    delete hintEl.dataset.progress
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3
    actionBtn.disabled = !active() || motion !== null
    actionBtn.setAttribute('aria-disabled', String(actionBtn.disabled))
    const hints = [COPY.light, COPY.spin, COPY.place, COPY.done]
    setSafeText(hintEl, motion ? motion.kind === 'spin' ? COPY.spinning : COPY.placing : hints[checkpoint], assertSafeCopy)
    if (checkpoint < 3) setSafeText(actionBtn, [COPY.lightAction, COPY.spinAction, COPY.placeAction][checkpoint], assertSafeCopy)
    orbitGuide.visible = checkpoint === 1 && motion === null
    returnGuide.visible = checkpoint === 2 && motion === null
    hitLayer.style.pointerEvents = active() && checkpoint < 3 ? 'auto' : 'none'
    updateMatrices()
  }
  const restorePose = () => {
    orbitSweeps.forEach(path => path.reset())
    orbitGuide.children.forEach(object => { if ((object as THREE.Mesh).isMesh) ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(0xe7bd73) })
    if (!motion) heldLamp.group.position.copy(checkpoint === 1 || checkpoint === 2 ? HELD : HOMES[2])
    heldLamp.group.rotation.y = 0
    updateMatrices()
  }
  const advance = (next: Checkpoint) => {
    if (!active() || checkpoint >= next) return
    checkpoint = next
    motion = null
    drag = null
    restorePose()
    syncUI()
    ctx.onProgress?.(next)
    if (next === 3) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const light = (indices: Iterable<number>) => {
    if (!active() || checkpoint !== 0) return
    let changed = false
    for (const i of indices) if (i >= 0 && !lamps[i].lit) {
      const lamp = lamps[i]
      lamp.lit = lamp.flame.visible = true
      if (ctx.isReducedMotion?.()) lamp.glowT = 1
      changed = true
    }
    if (!changed) return
    feedback.impact({ freqs: [659.25, 987.77], duration: 0.22, gain: 0.024 })
    if (lamps.every((lamp) => lamp.lit)) advance(1)
  }
  const beginMotion = (kind: Motion['kind']) => {
    if (!active() || motion || checkpoint !== (kind === 'spin' ? 1 : 2)) return
    motion = { kind, elapsed: 0, from: heldLamp.group.position.clone() }
    feedback.impact({ freqs: kind === 'spin' ? [523.25, 784] : [440, 659.25], duration: 0.35, gain: 0.028 })
    if (ctx.isReducedMotion?.()) advance(kind === 'spin' ? 2 : 3)
    else syncUI()
  }
  const cancelDrag = () => { drag = null; restorePose(); syncUI() }
  const pointer = createObjectPointer(hitLayer, {
    isActive: active,
    canStart(x, y) {
      if (!active() || motion || checkpoint === 3) return false
      updateMatrices()
      return checkpoint === 0 ? wickAt(x, y) >= 0 : touch.hit(x, y, heldLamp.group)
    },
    onStart(x, y) {
      feedback.prepare()
      if (checkpoint === 0) drag = { kind: 'light', visited: new Set([wickAt(x, y)]) }
      else if (checkpoint === 1) { orbitSweeps.forEach(path => path.reset()); drag = { kind: 'spin' } }
      else {
        drag = { kind: 'place' }
        const normal = camera.getWorldDirection(new THREE.Vector3())
        placePlane.setFromNormalAndCoplanarPoint(normal, heldTarget.getWorldPosition(new THREE.Vector3()))
      }
    },
    onMove(x, y) {
      if (!drag) return
      if (drag.kind === 'light') {
        const i = wickAt(x, y)
        if (i >= 0) drag.visited.add(i)
      } else if (drag.kind === 'spin') {
        if (!ray.aim(x, y).ray.intersectPlane(orbitPlane, point)) return
        const angle = Math.atan2(point.z, point.x)
        orbitSweeps.forEach(path => path.sample([point.x, point.z]))
        const direction = orbitSweeps[0]!.progress >= orbitSweeps[1]!.progress ? 0 : 1, path = orbitSweeps[direction]!
        orbitGuide.children.forEach((object, i) => {
          if (!(object as THREE.Mesh).isMesh) return
          const gate = direction === 0 ? i : 16 - i
          ;((object as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(gate < path.next ? 0x79ac82 : 0xe7bd73)
        })
        hintEl.dataset.progress = 'true'
        setSafeText(hintEl, path.complete() ? '圆弧已走完，松手即可。' : '已沿圆弧行进 ' + Math.round(path.progress * 100) + '%，沿浅金圆弧继续。', assertSafeCopy)
        heldLamp.group.position.set(Math.cos(angle) * ORBIT_RADIUS, HELD.y, Math.sin(angle) * ORBIT_RADIUS)
        heldLamp.group.rotation.y = ORBIT_START - angle
        updateMatrices()
      } else if (ray.aim(x, y).ray.intersectPlane(placePlane, point)) {
        heldLamp.group.position.copy(point)
        heldLamp.group.position.y = Math.max(0.10, heldLamp.group.position.y - 0.12)
        updateMatrices()
      }
    },
    onRelease(x, y) {
      const current = drag
      drag = null
      if (!current || !active()) { restorePose(); return }
      if (current.kind === 'light') {
        if (wickAt(x, y) >= 0) light(current.visited)
        restorePose()
      } else if (current.kind === 'spin') {
        const end = ray.aim(x, y).ray.intersectPlane(orbitPlane, point)
        const closed = end && orbitSweeps.some(path => path.complete([point.x, point.z]))
        if (closed) advance(2)
        else restorePose()
      } else {
        updateMatrices()
        if (ray.hits(x, y, [plateTarget])) beginMotion('place')
        else restorePose()
      }
      syncUI()
    },
    onCancel: cancelDrag,
  })
  const onAction = () => {
    if (!active() || pointer.isBusy() || motion || checkpoint === 3) return
    feedback.prepare()
    if (checkpoint === 0) light([lamps.findIndex((lamp) => !lamp.lit)])
    else beginMotion(checkpoint === 1 ? 'spin' : 'place')
  }
  const blur = () => { focused = false; pointer.cancel(); syncUI() }
  const focus = () => { focused = true; if (!disposed) syncUI() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    camera.position.set(0, 2.8, 3.55 + portraitBoost(aspect, 2.5))
    camera.lookAt(lookAt)
    updateMatrices()
  }
  syncUI()
  return {
    start() {
      if (started || disposed) return
      started = true
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      actionBtn.addEventListener('click', onAction)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      lamps.forEach((lamp) => {
        lamp.lit = lamp.flame.visible = checkpoint > 0
        lamp.glowT = checkpoint > 0 ? 1 : 0
      })
      restorePose()
      syncUI()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { suspended = true; pointer.cancel(); syncUI(); styleRenderer.render(); return }
      if (suspended) { suspended = false; syncUI() }
      const reduced = ctx.isReducedMotion?.() ?? false
      const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0
      clock += elapsed
      if (motion) {
        motion.elapsed += elapsed
        const t = reduced ? 1 : Math.min(1, motion.elapsed / (motion.kind === 'spin' ? 1.5 : 0.7))
        const k = smooth(t)
        if (motion.kind === 'spin') {
          const angle = ORBIT_START + Math.PI * 2 * k
          heldLamp.group.position.set(Math.cos(angle) * ORBIT_RADIUS, HELD.y, Math.sin(angle) * ORBIT_RADIUS)
          heldLamp.group.rotation.y = -Math.PI * 2 * k
        } else heldLamp.group.position.lerpVectors(motion.from, HOMES[2], k)
        if (t === 1) advance(motion.kind === 'spin' ? 2 : 3)
      }
      lamps.forEach((lamp, i) => {
        lamp.glowT = reduced ? Number(lamp.lit) : Math.min(Number(lamp.lit), lamp.glowT + elapsed / 0.45)
        const shimmer = reduced ? 1 : 1 + Math.sin(clock * 2.2 + i) * 0.026
        lamp.flame.scale.set(1, shimmer, 1)
        lamp.glow.intensity = 0.34 * lamp.glowT * shimmer
        lamp.halo.material.opacity = (ctx.stage === 'night' ? 0.26 : 0.12) * lamp.glowT
      })
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      pointer.dispose()
      motion = null
      stopResize()
      actionBtn.removeEventListener('click', onAction)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      feedback.dispose()
      styleRenderer.dispose()
      scene.traverse((o) => { if (o instanceof THREE.Light) o.dispose() })
      disposeTree(scene)
      // Tree disposal includes the shared sprite plane and its materials;
      // textures are separate allocations, so release only each halo map here.
      lamps.forEach((lamp) => lamp.halo.material.map?.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      scene.clear()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
