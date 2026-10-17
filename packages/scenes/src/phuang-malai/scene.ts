import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay,
  createSceneFeedback, createStepOverlay, createWarmStage, disposeTree,
  observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '串花寄意', stepsAria: '步骤',
  string: '把托盘上亮起的一簇茉莉拖到花环的浅金标记处。',
  stringing: '这一簇茉莉正轻轻落入花环…',
  tie: '花环已串好。拖住花朵，把花环向上轻拖到顶端绳结。',
  tying: '把小绳结轻轻收拢…',
  place: '拖住花朵，把花环捧放到奶油色小台上，再写一句感谢。',
  placed: '花环已放好。留一句谢谢，把心意送给你想感谢的人。',
  placing: '花环正轻轻落到小台上…',
  done: '花环与这句感谢一起留在这里。',
  stringTap: '串上一簇', tieTap: '系好花环', placeTap: '捧放并致谢', thanksTap: '留下致谢',
  thanksLabel: '写一句感谢', thanksPlaceholder: '谢谢你…',
} as const

const HELD = new THREE.Vector3(0, 1.38, 0.05)
const REST = new THREE.Vector3(0, 1.15, 0.08)
const RADIUS = 0.425
const CLUSTERS = 4
const smooth = (t: number) => t * t * (3 - 2 * t)

type Cluster = {
  group: THREE.Group
  flowers: THREE.InstancedMesh
  home: THREE.Vector3
  ring: THREE.Vector3
  trayRotation: number
}
type Drag = { id: number; kind: 'cluster' | 'tie' | 'garland'; x: number; y: number }
type Motion = {
  kind: 'cluster' | 'tie' | 'place'
  elapsed: number
  duration: number
  from: THREE.Vector3
  scale: number
  rotation: number
  thanks?: string
  complete?: boolean
}

export function createPhuangMalai(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  let disposed = false
  let started = false
  let checkpoint = 0
  let assembled = 0
  let tied = 0
  let placed = false
  let completed = false
  let clock = 0
  let drag: Drag | null = null
  let motion: Motion | null = null
  const pointers = new Set<number>()
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, {
    title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.stringTap,
  }, assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
  const cameraHome = new THREE.Vector3(0, 1.8, 3.35)
  const lookAt = new THREE.Vector3(0, 1.06, 0.05)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'phuang-malai', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, {
    sky: 0xfff5e3, ground: 0xd7c8ad, key: 0xffe1b9, rim: 0xffe5e4,
    keyIntensity: 1.1, keyPosition: [-2.5, 4.2, 3],
  })
  const world = new THREE.Group()
  scene.add(world)
  const garland = new THREE.Group()
  garland.name = 'garland'
  garland.position.copy(HELD)
  world.add(garland)

  const cream = new THREE.MeshStandardMaterial({ color: 0xfff7e4, roughness: 0.94 })
  const rose = new THREE.MeshStandardMaterial({ color: 0xd98a9b, roughness: 0.96 })
  const thread = new THREE.MeshStandardMaterial({ color: 0xd7c897, roughness: 1 })
  const paleGold = new THREE.MeshStandardMaterial({ color: 0xe5c885, roughness: 0.9 })
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xf5dfbf, roughness: 0.94 })
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xbd956d, roughness: 1 })
  // A tapered, closed jasmine bud, with three very subtle petal ridges. The
  // same geometry is instanced for the dense ring, loose clusters and tassels.
  const budGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.043), new THREE.Vector2(0.013, -0.04),
    new THREE.Vector2(0.025, -0.026), new THREE.Vector2(0.03, -0.005),
    new THREE.Vector2(0.026, 0.023), new THREE.Vector2(0.015, 0.047),
    new THREE.Vector2(0.004, 0.055), new THREE.Vector2(0, 0.056),
  ], 12)
  const positions = budGeo.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const a = Math.atan2(positions.getZ(i), positions.getX(i))
    const ridge = 1 + Math.cos(a * 3) * 0.07
    positions.setX(i, positions.getX(i) * ridge)
    positions.setZ(i, positions.getZ(i) * ridge)
  }
  budGeo.computeVertexNormals()
  const dummy = new THREE.Object3D()
  const instances: THREE.InstancedMesh[] = []
  const yAxis = new THREE.Vector3(0, 1, 0)
  const whiteColors = [0xfffae9, 0xf5efd5, 0xfff5df].map((color) => new THREE.Color(color))
  const flowers = (count: number, material: THREE.Material, name: string) => {
    const mesh = new THREE.InstancedMesh(budGeo, material, count)
    mesh.name = name
    // Hundreds of buds need a soft shared silhouette, not a contour around
    // every petal. Toon shading still preserves the small rounded forms.
    mesh.userData.toonSurface = { outline: false }
    instances.push(mesh)
    return mesh
  }
  const setBud = (mesh: THREE.InstancedMesh, index: number, position: THREE.Vector3, direction: THREE.Vector3, scale = 1) => {
    dummy.position.copy(position)
    dummy.quaternion.setFromUnitVectors(yAxis, direction.normalize())
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    if (mesh.material === cream) mesh.setColorAt(index, whiteColors[index % whiteColors.length])
  }
  const segmentPoint = (a: number) => new THREE.Vector3(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0)
  const buildSegment = (segment: number, name: string) => {
    const centerAngle = (segment + 0.5) * Math.PI / 3
    const center = segmentPoint(centerAngle)
    const group = new THREE.Group()
    group.position.copy(center)
    const mesh = flowers(72, cream, name)
    for (let column = 0; column < 9; column++) {
      const a = (segment + (column + 0.5) / 9) * Math.PI / 3
      const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
      for (let row = 0; row < 8; row++) {
        // Stagger adjacent rows so the buds overlap like threaded jasmine.
        const b = (row / 8) * Math.PI * 2 + (column % 2) * 0.16
        const outward = radial.clone().multiplyScalar(Math.cos(b))
        outward.z = Math.sin(b)
        const p = segmentPoint(a).addScaledVector(outward, 0.069).sub(center)
        setBud(mesh, column * 8 + row, p, outward, 0.88 + (column % 3) * 0.04)
      }
    }
    group.add(mesh)
    // Only two narrow rose bands on the ring: a restrained accent, not lei
    // petals or a foliage wreath. They are threaded with their own segment.
    if (segment === 0 || segment === 2) {
      const band = flowers(8, rose, `rose-band-${segment}`)
      for (let i = 0; i < 8; i++) {
        const b = i * Math.PI / 4
        const radial = new THREE.Vector3(Math.cos(centerAngle), Math.sin(centerAngle), 0)
        const direction = radial.multiplyScalar(Math.cos(b))
        direction.z = Math.sin(b)
        setBud(band, i, direction.clone().multiplyScalar(0.079), direction, 0.94)
      }
      group.add(band)
    }
    garland.add(group)
    return { group, flowers: mesh, ring: center }
  }

  // Two already threaded arcs establish the craft; four loose clusters fill
  // the remaining segments one at a time. All use one shared bud geometry.
  const firstRing = buildSegment(0, 'ring-flowers-0')
  buildSegment(2, 'ring-flowers-2')
  const clusters: Cluster[] = [1, 3, 4, 5].map((segment, i) => {
    const cluster = buildSegment(segment, `tray-flowers-${i}`)
    cluster.group.name = `cluster-${i}`
    const home = new THREE.Vector3(-0.36 + i * 0.24, 0.34, 0.68).sub(HELD)
    const trayRotation = Math.PI / 2 - (segment + 0.5) * Math.PI / 3
    cluster.group.position.copy(home)
    cluster.group.scale.setScalar(0.52)
    cluster.group.rotation.z = trayRotation
    return { ...cluster, home, trayRotation }
  })
  const core = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, 0.008, 6, 72), thread)
  garland.add(core)
  const nextSegment = new THREE.Group()
  nextSegment.name = 'next-segment'
  const guide = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 24), paleGold)
  guide.userData.toonSurface = { outline: false }
  nextSegment.add(guide)
  garland.add(nextSegment)

  const tassels = [-1, 1].map((side) => {
    const tassel = new THREE.Group()
    tassel.name = `flower-tassel-${side < 0 ? 'left' : 'right'}`
    tassel.position.set(side * 0.23, -0.335, 0.045)
    const buds = flowers(56, cream, `tassel-buds-${side}`)
    for (let row = 0; row < 7; row++) for (let column = 0; column < 8; column++) {
      const a = (column / 8) * Math.PI * 2 + (row % 2) * 0.25
      const width = row < 2 ? 0.047 : row > 4 ? 0.065 : 0.037
      const direction = new THREE.Vector3(Math.cos(a) * 0.7, -0.6, Math.sin(a) * 0.7)
      const position = new THREE.Vector3(Math.cos(a) * width, -0.05 - row * 0.07, Math.sin(a) * width)
      setBud(buds, row * 8 + column, position, direction, row > 4 ? 0.92 : 0.76)
    }
    const accent = flowers(16, rose, `tassel-rose-${side}`)
    for (let row = 0; row < 2; row++) for (let column = 0; column < 8; column++) {
      const a = column * Math.PI / 4
      const direction = new THREE.Vector3(Math.cos(a), -0.45, Math.sin(a))
      setBud(accent, row * 8 + column, new THREE.Vector3(Math.cos(a) * 0.055, -0.12 - row * 0.39, Math.sin(a) * 0.055), direction, row ? 0.85 : 0.72)
    }
    tassel.add(buds, accent)
    garland.add(tassel)
    return tassel
  })

  const tie = new THREE.Group()
  tie.name = 'top-tie'
  tie.position.set(0, 0.545, 0.02)
  garland.add(tie)
  const loopGeo = new THREE.TorusGeometry(0.041, 0.007, 6, 24)
  const loops = [-1, 1].map((side) => {
    const loop = new THREE.Mesh(loopGeo, thread)
    loop.position.set(side * 0.039, 0.025, 0)
    loop.rotation.z = side * 0.35
    tie.add(loop)
    return loop
  })
  const cordGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.13, 6)
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(cordGeo, thread)
    tail.position.set(side * 0.028, -0.067, 0)
    tail.rotation.z = side * -0.25
    tie.add(tail)
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), thread)
  knot.scale.set(1.2, 0.75, 0.8)
  tie.add(knot)

  // A plain display pedestal keeps this adaptation about social gratitude.
  const pedestal = new THREE.Group()
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.59, 0.16, 40), pedestalMat)
  foot.position.y = 0.08
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.63, 0.07, 48), pedestalMat)
  top.name = 'pedestal-top'
  top.position.y = 0.195
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.014, 6, 48), paleGold)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.233
  pedestal.add(foot, top, rim)
  world.add(pedestal)
  const tray = new THREE.Group()
  const trayBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.045, 32), trayMat)
  trayBase.scale.set(1.25, 1, 0.4)
  trayBase.position.set(0, 0.27, 0.68)
  tray.add(trayBase)
  world.add(tray)

  const ray = createPointerRay(canvas, camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -HELD.z)
  const point = new THREE.Vector3()
  const ringFlowers = () => {
    const meshes: THREE.Object3D[] = []
    garland.traverse((object) => {
      if (object instanceof THREE.InstancedMesh && object !== clusters[assembled]?.flowers) meshes.push(object)
    })
    return meshes
  }
  const active = () => !disposed && started && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const cueActive = () => active() && !motion && !completed && !placed && pointers.size <= 1
  clusters.forEach((cluster, index) => addInteractionCue(cluster.flowers, {
    kind: 'drag', label: '拖茉莉到花环', anchor: [0, 0, 0.095], priority: 2,
    enabled: () => cueActive() && checkpoint === 0 && assembled === index,
    destination: nextSegment, targetLabel: '花环空段',
  }))
  addInteractionCue(firstRing.flowers, {
    kind: 'drag', label: '向上拖花环系结', anchor: [0, 0, 0.095], priority: 2,
    enabled: () => cueActive() && checkpoint === 1,
    destination: tie, targetLabel: '顶端绳结',
  })
  addInteractionCue(firstRing.flowers, {
    kind: 'drag', label: '拖花环到小台', anchor: [0, 0, 0.095], priority: 2,
    enabled: () => cueActive() && checkpoint === 2,
    destination: top, targetLabel: '奶油色小台',
  })
  const updateMatrices = () => { world.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const onFlowers = (x: number, y: number) => {
    if (!active() || motion || completed || placed) return false
    updateMatrices()
    return ray.hits(x, y, checkpoint === 0 ? [clusters[assembled].flowers] : ringFlowers())
  }
  const nearNextSegment = (x: number, y: number) => {
    updateMatrices()
    if (!ray.aim(x, y).ray.intersectPlane(plane, point)) return false
    const destination = nextSegment.getWorldPosition(new THREE.Vector3())
    return point.distanceTo(destination) < 0.155
  }
  const onPedestal = (x: number, y: number) => {
    updateMatrices()
    return ray.hits(x, y, [top])
  }
  const nearTie = (x: number, y: number) => {
    updateMatrices()
    if (!ray.aim(x, y).ray.intersectPlane(plane, point)) return false
    return point.distanceTo(tie.getWorldPosition(new THREE.Vector3())) < 0.19
  }

  const sync = () => {
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = completed
    actionBtn.disabled = Boolean(motion)
    actionBtn.setAttribute('aria-disabled', String(Boolean(motion)))
    wishSlot.hidden = checkpoint !== 2 || completed
    wishHandle?.setEnabled(checkpoint === 2 && !completed && !motion)
    hitLayer.style.pointerEvents = completed || placed ? 'none' : 'auto'
    tray.visible = checkpoint === 0
    nextSegment.visible = checkpoint === 0
    if (checkpoint === 0) nextSegment.position.copy(clusters[assembled].ring).setZ(0.13)
    const label = checkpoint === 0 ? COPY.stringTap : checkpoint === 1 ? COPY.tieTap : placed ? COPY.thanksTap : COPY.placeTap
    const hint = motion ? motion.kind === 'cluster' ? COPY.stringing : motion.kind === 'tie' ? COPY.tying : COPY.placing
      : completed ? COPY.done : checkpoint === 0 ? COPY.string : checkpoint === 1 ? COPY.tie : placed ? COPY.placed : COPY.place
    setSafeText(actionBtn, label, assertSafeCopy)
    setSafeText(hintEl, hint, assertSafeCopy)
  }
  const setTie = () => {
    loops.forEach((loop) => loop.scale.set(1 + (1 - tied) * 0.6, 1 + (1 - tied) * 0.5, 1))
    tie.position.y = 0.545 - tied * 0.045
  }
  const checkpointReached = (next: number) => {
    if (checkpoint >= next) return
    checkpoint = next
    sync()
    ctx.onProgress?.(next)
  }
  const finish = (thanks?: string) => {
    if (!active() || completed || checkpoint !== 2 || !placed) return
    // Guard before invoking host callbacks, including a reentrant save handler.
    completed = true
    checkpoint = 3
    sync()
    if (thanks) ctx.saveWish?.(thanks)
    ctx.onProgress?.(3)
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const finishMotion = () => {
    if (!motion) return
    const ended = motion
    motion = null
    if (ended.kind === 'cluster') {
      const cluster = clusters[assembled]
      cluster.group.position.copy(cluster.ring)
      cluster.group.rotation.z = 0
      cluster.group.scale.setScalar(1)
      assembled++
      if (assembled === CLUSTERS) checkpointReached(1)
    } else if (ended.kind === 'tie') {
      tied = 1
      setTie()
      checkpointReached(2)
    } else {
      garland.position.copy(REST)
      garland.rotation.x = -0.04
      placed = true
    }
    sync()
    if (ended.complete) finish(ended.thanks)
  }
  const placeCluster = () => {
    if (!active() || motion || checkpoint !== 0 || assembled >= CLUSTERS) return
    const cluster = clusters[assembled]
    motion = { kind: 'cluster', elapsed: 0, duration: 0.52, from: cluster.group.position.clone(), scale: cluster.group.scale.x, rotation: cluster.group.rotation.z }
    fx.impact({ freqs: [659.25, 987.77], duration: 0.22, gain: 0.025 })
    sync()
    if (reduced()) finishMotion()
  }
  const closeTie = () => {
    if (!active() || motion || checkpoint !== 1) return
    motion = { kind: 'tie', elapsed: 0, duration: 0.6, from: garland.position.clone(), scale: 1, rotation: 0 }
    fx.impact({ freqs: [783.99, 1174.66], duration: 0.3, gain: 0.025 })
    sync()
    if (reduced()) finishMotion()
  }
  const placeGarland = (thanks?: string, complete = false) => {
    if (!active() || motion || checkpoint !== 2 || completed) return
    if (placed) { if (complete) finish(thanks); return }
    motion = { kind: 'place', elapsed: 0, duration: 0.7, from: garland.position.clone(), scale: 1, rotation: garland.rotation.x, thanks, complete }
    fx.impact({ freqs: [523.25, 783.99], duration: 0.42, gain: 0.035 })
    sync()
    if (reduced()) finishMotion()
  }
  const submitThanks = (text: string) => {
    const thanks = text.trim()
    if (!active() || checkpoint !== 2 || motion || completed || !thanks || thanks.length > 40) return
    fx.prepare()
    placeGarland(thanks, true)
  }
  const onAction = () => {
    if (!active() || motion || completed || pointers.size > 0) return
    fx.prepare()
    if (checkpoint === 0) placeCluster()
    else if (checkpoint === 1) closeTie()
    else {
      const input = wishSlot.querySelector<HTMLInputElement>('input')
      const thanks = input?.value.trim()
      if (thanks) submitThanks(thanks)
      else placeGarland(undefined, true)
    }
  }
  const releaseCapture = (id: number) => {
    try { if (hitLayer.hasPointerCapture?.(id)) hitLayer.releasePointerCapture(id) } catch { /* A canceled pointer already lost capture. */ }
  }
  const cancelDrag = () => {
    const abandoned = drag
    drag = null
    if (!abandoned) return
    if (abandoned.kind === 'cluster' && checkpoint === 0) {
      const cluster = clusters[assembled]
      cluster.group.position.copy(cluster.home)
      cluster.group.rotation.z = cluster.trayRotation
      cluster.group.scale.setScalar(0.52)
    } else if (abandoned.kind === 'garland') garland.position.copy(HELD)
    releaseCapture(abandoned.id)
  }
  const onDown = (event: PointerEvent) => {
    if (pointers.size > 0) { pointers.add(event.pointerId); cancelDrag(); return }
    if (event.isPrimary === false || event.button !== 0 || !onFlowers(event.clientX, event.clientY)) return
    pointers.add(event.pointerId)
    drag = { id: event.pointerId, kind: checkpoint === 0 ? 'cluster' : checkpoint === 1 ? 'tie' : 'garland', x: event.clientX, y: event.clientY }
    fx.prepare()
    event.preventDefault()
    try { hitLayer.setPointerCapture(event.pointerId) } catch { /* Older embedded browsers can still use the button. */ }
  }
  const onMove = (event: PointerEvent) => {
    if (!drag) return
    if (drag.id !== event.pointerId || !active() || event.buttons === 0) { cancelDrag(); return }
    if (drag.kind === 'tie') return
    updateMatrices()
    if (!ray.aim(event.clientX, event.clientY).ray.intersectPlane(plane, point)) return
    if (drag.kind === 'cluster') {
      clusters[assembled].group.position.set(
        THREE.MathUtils.clamp(point.x, -0.8, 0.8),
        THREE.MathUtils.clamp(point.y, 0.25, 2.05) - HELD.y, 0.11,
      )
    } else {
      garland.position.set(THREE.MathUtils.clamp(point.x, -0.6, 0.6), THREE.MathUtils.clamp(point.y, 0.85, 1.65), HELD.z)
    }
  }
  const onUp = (event: PointerEvent) => {
    const ending = drag
    if (!ending || ending.id !== event.pointerId || pointers.size !== 1 || !active()) {
      cancelDrag(); pointers.delete(event.pointerId); return
    }
    const distance = Math.hypot(event.clientX - ending.x, event.clientY - ending.y)
    const hit = ending.kind === 'cluster' ? nearNextSegment(event.clientX, event.clientY)
      : ending.kind === 'tie' ? distance > 12 && nearTie(event.clientX, event.clientY)
      : distance > 12 && onPedestal(event.clientX, event.clientY)
    // Clear ownership before release: lostpointercapture must not cancel a
    // successfully released gesture or the animation it starts.
    if (hit) {
      drag = null
      pointers.delete(event.pointerId)
      releaseCapture(event.pointerId)
      if (ending.kind === 'cluster') placeCluster()
      else if (ending.kind === 'tie') closeTie()
      else placeGarland()
    } else { cancelDrag(); pointers.delete(event.pointerId) }
  }
  const onCancel = (event: PointerEvent) => { cancelDrag(); pointers.delete(event.pointerId) }
  const onLostCapture = (event: PointerEvent) => {
    if (drag?.id === event.pointerId) cancelDrag()
    pointers.delete(event.pointerId)
  }
  const onOtherDown = (event: PointerEvent) => {
    if (drag && event.pointerId !== drag.id) {
      pointers.add(event.pointerId)
      cancelDrag()
    }
  }
  const onWindowEnd = (event: PointerEvent) => {
    if (!hitLayer.contains(event.target as Node) && drag?.id === event.pointerId) cancelDrag()
    pointers.delete(event.pointerId)
  }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.35 + portraitBoost(aspect, 3.1)
    camera.position.copy(cameraHome)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld(true)
  }
  setTie()

  return {
    start() {
      if (disposed || started) return
      started = true
      // Restoration applies state directly; no action handlers or callbacks.
      checkpoint = Math.min(3, Math.max(0, Math.floor(ctx.initialProgress ?? 0)))
      if (checkpoint >= 1) {
        assembled = CLUSTERS
        for (const cluster of clusters) {
          cluster.group.position.copy(cluster.ring)
          cluster.group.scale.setScalar(1)
          cluster.group.rotation.z = 0
        }
      }
      tied = checkpoint >= 2 ? 1 : 0
      if (checkpoint === 3) {
        completed = true
        placed = true
        garland.position.copy(REST)
        garland.rotation.x = -0.04
      }
      setTie()
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      wishHandle = ctx.gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: submitThanks })
      wishHandle.mount(wishSlot, {})
      const input = wishSlot.querySelector('input')
      if (input) {
        input.setAttribute('aria-label', COPY.thanksLabel)
        input.placeholder = COPY.thanksPlaceholder
      }
      stopClaim = claimObjectTouches(hitLayer, onFlowers)
      hitLayer.addEventListener('pointerdown', onDown)
      hitLayer.addEventListener('pointermove', onMove)
      hitLayer.addEventListener('pointerup', onUp)
      hitLayer.addEventListener('pointercancel', onCancel)
      hitLayer.addEventListener('lostpointercapture', onLostCapture)
      window.addEventListener('pointerdown', onOtherDown, true)
      window.addEventListener('pointerup', onWindowEnd)
      window.addEventListener('pointercancel', onWindowEnd)
      actionBtn.addEventListener('click', onAction)
      sync()
    },
    update(dt) {
      if (disposed || !started) return
      if (!active()) { cancelDrag(); pointers.clear(); return }
      const delta = Math.max(0, Math.min(dt, 0.1))
      const less = reduced()
      clock += less ? 0 : delta
      wishHandle?.update(delta)
      if (motion) {
        motion.elapsed += delta
        const t = less ? 1 : Math.min(1, motion.elapsed / motion.duration)
        const ease = smooth(t)
        if (motion.kind === 'cluster') {
          const cluster = clusters[assembled]
          cluster.group.position.lerpVectors(motion.from, cluster.ring, ease)
          cluster.group.position.y += less ? 0 : Math.sin(t * Math.PI) * 0.085
          cluster.group.scale.setScalar(THREE.MathUtils.lerp(motion.scale, 1, ease))
          cluster.group.rotation.z = THREE.MathUtils.lerp(motion.rotation, 0, ease)
        } else if (motion.kind === 'tie') {
          tied = ease
          setTie()
        } else {
          garland.position.lerpVectors(motion.from, REST, ease)
          garland.rotation.x = THREE.MathUtils.lerp(motion.rotation, -0.04, ease)
        }
        if (t === 1) finishMotion()
      }
      // A little delayed weight in the two hanging strands after tying. It
      // stops completely with reduced motion and while the host is paused.
      tassels.forEach((tassel, i) => {
        const target = less || checkpoint < 2 ? 0 : Math.sin(clock * 1.3 - i * 0.45) * 0.022
        tassel.rotation.z = less ? 0 : THREE.MathUtils.lerp(tassel.rotation.z, target, 1 - Math.exp(-delta * 5))
      })
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelDrag()
      pointers.clear()
      motion = null
      stopResize()
      stopClaim()
      hitLayer.removeEventListener('pointerdown', onDown)
      hitLayer.removeEventListener('pointermove', onMove)
      hitLayer.removeEventListener('pointerup', onUp)
      hitLayer.removeEventListener('pointercancel', onCancel)
      hitLayer.removeEventListener('lostpointercapture', onLostCapture)
      window.removeEventListener('pointerdown', onOtherDown, true)
      window.removeEventListener('pointerup', onWindowEnd)
      window.removeEventListener('pointercancel', onWindowEnd)
      actionBtn.removeEventListener('click', onAction)
      wishHandle?.dispose()
      wishHandle = null
      fx.dispose()
      styleRenderer.dispose()
      instances.forEach((mesh) => mesh.dispose())
      disposeTree(world)
      lights.key.dispose()
      lights.rim.dispose()
      scene.remove(world, lights.ambient, lights.hemi, lights.key, lights.rim)
      world.clear()
      renderer.dispose()
      renderer.forceContextLoss()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
