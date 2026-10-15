import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

type XYZ = [number, number, number]
type Checkpoint = 0 | 1 | 2 | 3
const COPY = {
  title: '葫芦刻光', cut: '按住葫芦正面的刻纹起点，向右短拖，让细细的叶片与山丘线条显现。',
  polish: '按住葫芦上方的纹带，向下短拖，用软布擦亮刚刻好的线条。',
  quiet: '轻点葫芦静看，或写一句心意；点「写好了」才会保存。', returning: '轻点葫芦，静看暖色外壳上的叶片与山丘。',
  cutting: '刻刀沿着弧面轻轻走过，浅色细线一点点露出…', polishing: '软布沿着外壳擦过，叶片与山丘纹带渐渐清晰…',
  done: '愿日常的小事，也留下一点温暖的光。（当代葫芦刻纹手作欣赏练习结束）',
} as const
const ease = (t: number) => t * t * (3 - 2 * t)
const RADII = [0, .43, .69, .85, .94, .96, .92, .83, .68, .49, .32, .22, .17, .145, .11, 0]
function surfacePoint(theta: number, y: number) {
  const t = THREE.MathUtils.clamp((y - .15) / 2.35, 0, 1), q = t * (RADII.length - 1), i = Math.min(RADII.length - 2, Math.floor(q)), s = q - i
  const a = RADII[Math.max(0, i - 1)]!, b = RADII[i]!, c = RADII[i + 1]!, d = RADII[Math.min(RADII.length - 1, i + 2)]!
  const radius = Math.max(0, .5 * ((2 * b) + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s ** 3))
  const organic = 1 + .028 * Math.cos(3 * theta + .4) + .018 * Math.sin(5 * theta - 2 * t)
  return new THREE.Vector3(.11 * Math.sin(Math.PI * t * .85) + .11 * t ** 3 + Math.sin(theta) * radius * organic, y, Math.cos(theta) * radius * organic * .91)
}
const ANCHORS: XYZ[] = [surfacePoint(-.47, 1.05).toArray(), surfacePoint(.17, 1.55).toArray(), surfacePoint(0, 1.25).toArray()]

/** Original leaf and hill study on a dried gourd, inspired by public Peruvian mate burilado craft. */
export function createPeruvianEngravedGourd(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}, writer: GestureHandle | null = null
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let cutAmount = 0, polishAmount = 0, dragging = false, moved = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, callbackActive = () => active() && callbackVersion === lifecycleVersion, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向右刻出纹带' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'peruvian-engraved-gourd', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffedc8, ground: 0x8b7f59, key: 0xffe6b8, rim: 0xe6f1ce, keyPosition: [-3, 6, 5], keyIntensity: 1.8, rimIntensity: .55 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .014
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 15 })
  const subject = new THREE.Group(); subject.name = 'gourd-subject'; scene.add(subject)
  // Keep the complete gourd and its working tools together; local cue points
  // remain on the same shell while the bulb settles into its small cushion.
  const assembly = new THREE.Group(); assembly.name = 'gourd-assembly'; assembly.position.y = -.09; subject.add(assembly)
  const mat = (color: number, roughness = .84) => new THREE.MeshStandardMaterial({ color, roughness })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ = [0, 0, 0], parent: THREE.Object3D = subject) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const padding = mat(0x78958a), thread = mat(0xbfd1ad), stemMaterial = mat(0x75512b), toolWood = mat(0x8d5631), metal = mat(0x929588, .52), linen = mat(0xf1dcb5)
  const ring = add('gourd-padded-ring', new THREE.TorusGeometry(.43, .115, 16, 64), padding, [0, .115, 0]); ring.rotation.x = Math.PI / 2
  ring.userData.toonSurface = { outline: false }
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, stitch = add(`gourd-support-stitch-${i}`, new THREE.TorusGeometry(.12, .007, 4, 12, .9), thread, [Math.cos(a) * .43, .128, Math.sin(a) * .43])
    stitch.rotation.set(Math.PI / 2, a, a); stitch.castShadow = false; stitch.userData.toonSurface = { outline: false }
  }
  const top = surfacePoint(0, 2.5), root = top.clone().add(new THREE.Vector3(0, -.17, 0))
  const stemCurve = new THREE.CatmullRomCurve3([root, top.clone().add(new THREE.Vector3(-.025, .14, -.025)), top.clone().add(new THREE.Vector3(.05, .27, -.015)), top.clone().add(new THREE.Vector3(.13, .31, .01))])
  add('gourd-stem', new THREE.TubeGeometry(stemCurve, 24, .055, 10, false), stemMaterial, [0, 0, 0], assembly)
  add('gourd-stem-root-cap', new THREE.SphereGeometry(.055, 12, 8), stemMaterial, root.toArray(), assembly)
  const stemEnd = add('gourd-stem-cut', new THREE.SphereGeometry(.056, 12, 8), mat(0xb28b52), stemCurve.getPoint(1).toArray(), assembly); stemEnd.scale.set(1, .55, 1)

  // An asymmetrical, closed shell. A UV seam sits on the back; every visible
  // engraved mark lives in the shell texture and cannot intercept its hit.
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], around = 128, vertical = 96
  for (let y = 0; y <= vertical; y++) for (let x = 0; x <= around; x++) {
    const u = x / around, v = y / vertical, p = surfacePoint((u - .5) * Math.PI * 2, .15 + v * 2.35)
    positions.push(p.x, p.y, p.z); uvs.push(u, v)
    if (y < vertical && x < around) { const a = y * (around + 1) + x, b = a + 1, c = a + around + 1, d = c + 1; indices.push(a, b, c, b, d, c) }
  }
  const shellGeometry = new THREE.BufferGeometry(); shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); shellGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); shellGeometry.setIndex(indices); shellGeometry.computeVertexNormals()
  const width = 512, height = 256, base = new Uint8Array(width * height * 3), marks = new Uint8Array(width * height), highlights = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height, n = ((x * 17 + y * 23 + (x * y) % 29) % 17 - 8) * .48
    const grain = 3.4 * Math.sin(u * 157 + Math.sin(v * 31)) + 2.5 * Math.sin(u * 39 - v * 7), light = 11 * Math.sin(v * Math.PI) + grain + n
    const j = (y * width + x) * 3; base[j] = 173 + light; base[j + 1] = 100 + light * .73; base[j + 2] = 43 + light * .40
  }
  const stroke = (points: [number, number][], thickness = 1.4) => {
    for (let j = 1; j < points.length; j++) {
      const a = points[j - 1]!, b = points[j]!, ax = a[0] * width, ay = a[1] * height, bx = b[0] * width, by = b[1] * height
      const dx = bx - ax, dy = by - ay, squared = Math.max(.000001, dx * dx + dy * dy)
      // Distance coverage keeps both the cut and its offset warm edge smooth.
      // This replaces a binary neighbour test without a larger texture stack.
      const coverage = (x: number, y: number, radius: number) => {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / squared))
        return Math.round(255 * Math.max(0, Math.min(1, radius + .5 - Math.hypot(x - ax - t * dx, y - ay - t * dy))))
      }
      for (let y = Math.max(0, Math.floor(Math.min(ay, by) - 3)); y <= Math.min(height - 1, Math.ceil(Math.max(ay, by) + 3)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - 3)); x <= Math.min(width - 1, Math.ceil(Math.max(ax, bx) + 3)); x++) {
          const n = y * width + x
          marks[n] = Math.max(marks[n]!, coverage(x + .5, y + .5, thickness * .78))
          highlights[n] = Math.max(highlights[n]!, coverage(x + .25, y - .30, thickness * .45))
        }
      }
    }
  }
  const line = (fn: (t: number) => [number, number], thickness = 1.1) => stroke(Array.from({ length: 97 }, (_, i) => fn(i / 96)), thickness)
  // Original simple double borders, rolling hills and alternating leaves.
  for (const v of [.285, .305, .64, .66]) line(t => [.29 + .42 * t, v], .9)
  line(t => [.29 + .42 * t, .365 + .046 * Math.sin(t * Math.PI * 5.5)], 1.1)
  line(t => [.29 + .42 * t, .352 + .024 * Math.sin(t * Math.PI * 5.5 + 1.2)], .7)
  line(t => [.31 + .38 * t, .478 + .012 * Math.sin(t * Math.PI * 4)], .85)
  for (let i = 0; i < 7; i++) {
    const u = .326 + i * .058, tilt = i % 2 ? -.44 : .44, root = .48 + .012 * Math.sin((u - .31) / .38 * Math.PI * 4)
    const point = (t: number, side: number): [number, number] => [u + tilt * t * .046 + side * Math.sin(t * Math.PI) * .016, root + t * .104]
    line(t => point(t, 1), .9); line(t => point(1 - t, -1), .9); line(t => [u + tilt * t * .046, root + t * .104], .65)
  }
  const surfaces = new Map<number, THREE.MeshStandardMaterial>(), textures = new Set<THREE.Texture>()
  const rawDark = [129, 84, 39], polishedDark = [93, 53, 24], rawLight = [207, 163, 99], polishedLight = [231, 185, 112], plainLift = [0, 0, 0], polishedLift = [8, 7, 4]
  const surface = (cut: number, polish: number) => {
    const c = Math.round(cut * 12), p = Math.round(polish * 12), key = c * 13 + p
    const existing = surfaces.get(key); if (existing) return existing
    const pixels = new Uint8Array(width * height * 4), extent = .29 + .42 * c / 12, wipe = .66 - .375 * p / 12
    for (let y = 0; y < height; y++) {
      const clean = p > 0 && y / height >= wipe, dark = clean ? polishedDark : rawDark, light = clean ? polishedLight : rawLight, lift = clean ? polishedLift : plainLift
      for (let x = 0; x < width; x++) {
        const n = y * width + x, b = n * 3, out = n * 4, revealed = c > 0 && x / width <= extent
        const highlight = revealed ? highlights[n]! / 255 : 0, mark = revealed ? marks[n]! / 255 : 0
        for (let channel = 0; channel < 3; channel++) {
          const plain = base[b + channel]! + lift[channel]!
          const edge = (1 - highlight) * plain + highlight * light[channel]!
          pixels[out + channel] = (1 - mark) * edge + mark * dark[channel]!
        }
        pixels[out + 3] = 255
      }
    }
    const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat); texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true; textures.add(texture)
    // The toon adapter caches by source material; do not mutate an existing map.
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: p > 0 ? .69 : .9 }); surfaces.set(key, material); return material
  }
  const shell = add('gourd-shell', shellGeometry, surface(0, 0), [0, 0, 0], assembly); shell.userData.toonSurface = { shading: 'smooth', outline: false }
  const burin = new THREE.Group(); burin.name = 'gourd-burin'; assembly.add(burin)
  const handle = add('gourd-burin-handle', new THREE.SphereGeometry(1, 20, 14), toolWood, [0, .27, 0], burin); handle.scale.set(.055, .18, .055)
  add('gourd-burin-shaft', new THREE.CylinderGeometry(.018, .012, .16, 12), metal, [0, .085, 0], burin)
  const point = add('gourd-burin-point', new THREE.ConeGeometry(.018, .04, 8), metal, [0, -.005, 0], burin); point.rotation.z = Math.PI
  burin.rotation.set(.48, 0, -.62)
  const polishingCloth = new THREE.Group(); polishingCloth.name = 'gourd-polishing-cloth'; assembly.add(polishingCloth)
  const cloth = add('gourd-soft-cloth', new THREE.SphereGeometry(1, 24, 16), linen, [0, 0, .045], polishingCloth); cloth.scale.set(.20, .145, .065); cloth.userData.toonSurface = { outline: false }
  const clothFold = add('gourd-soft-cloth-fold', new THREE.SphereGeometry(1, 20, 12), mat(0xdcc49b), [.055, -.038, .087], polishingCloth); clothFold.scale.set(.105, .025, .018); clothFold.rotation.z = -.2; clothFold.userData.toonSurface = { outline: false }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const setShape = (toolStep?: 0 | 1, updateSurface = true) => {
    if (updateSurface) shell.material = surface(cutAmount, polishAmount)
    burin.visible = toolStep === 0; polishingCloth.visible = toolStep === 1
    burin.position.copy(surfacePoint(-.47 + cutAmount * 1.28, 1.05 + .08 * Math.sin(cutAmount * Math.PI))).add(new THREE.Vector3(0, 0, .025))
    polishingCloth.position.copy(surfacePoint(.17 + .13 * Math.sin(polishAmount * Math.PI), 1.55 - .77 * polishAmount)).add(new THREE.Vector3(0, 0, .04)); polishingCloth.rotation.z = -.15 + polishAmount * .3
    matrices()
  }
  const restore = () => { cutAmount = at > 0 ? 1 : 0; polishAmount = at >= 2 ? 1 : 0; setShape() }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(shell, { kind: 'drag', label: '向右刻出纹带', anchor: ANCHORS[0], priority: 3, enabled: enabled(0) }),
    addInteractionCue(shell, { kind: 'drag', label: '向下擦亮纹带', anchor: ANCHORS[1], priority: 3, enabled: enabled(1) }),
    addInteractionCue(shell, { kind: 'tap', label: '轻点葫芦静看', anchor: ANCHORS[2], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => { const m = object as THREE.Mesh; if (!m.isMesh) return
      const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(material => material.visible && (!material.transparent || material.opacity >= 1))) meshes.push(m)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const reset = () => { dragging = moved = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const sample = (x: number, y: number) => {
    const dx = x - down.x, dy = y - down.y
    pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
    along = at === 0 ? dx : dy; maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dy : dx))
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return nearestHit(x, y) === shell },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); previous.copy(down); dragging = at < 2; moved = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0
      // Native touchstart follows pointerdown and rechecks the shell hit.
      // Reveal the working tool on the first move so it cannot cover that hit.
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { pointer.cancel(); return }
      sample(x, y); moved ||= pathTravel > 0
      if (dragging) { if (at === 0) cutAmount = THREE.MathUtils.clamp(along / 75, 0, 1); else polishAmount = THREE.MathUtils.clamp(along / 75, 0, 1); setShape(at as 0 | 1) }
    },
    onRelease(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { reset(); return }
      const movedAlong = along; sample(x, y); matrices()
      const valid = at < 2 ? dragging && moved && movedAlong >= 40 && along >= 40 && along <= 84 && pathTravel <= 90 && maxCross <= 18 && minAlong >= -8 && backtrack <= 10
        : pathTravel < 12 && nearestHit(x, y) === shell
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '向右刻出纹带' : at === 1 ? '向下擦亮纹带' : '轻点葫芦静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.cutting : COPY.polishing : at === 0 ? COPY.cut : at === 1 ? COPY.polish : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const revision = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && revision === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (callbackActive()) feedback.impact({ freqs: [392, 523.25], duration: .13, gain: .006, type: 'sine' }) })
  }
  function begin() {
    if (!inputActive() || pointer.isBusy() || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, from: at === 0 ? cutAmount : polishAmount }; setShape(at as 0 | 1); sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    withHostCallbacks(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!callbackActive()) return
      feedback.impact({ freqs: [392, 587.33], duration: .2, gain: .007 }); if (!callbackActive()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(.06, 1.38, 0), direction = new THREE.Vector3(.15, .42, 1.65).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(), saved = [cutAmount, polishAmount]; let distance = 4.25
    for (const pose of [[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1]]) {
      [cutAmount, polishAmount] = pose; setShape(pose[0] < 1 ? 0 : 1, false)
      subject.traverse(o => { const mesh = o as THREE.Mesh; if (!mesh.geometry) return
        const vertices = mesh.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .87), p.z + Math.abs(p.y) / (tangent * .87)) }
      })
    }
    [cutAmount, polishAmount] = saved; setShape(motion?.step ?? (dragging ? at as 0 | 1 : undefined)); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
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
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .86)
        const amount = THREE.MathUtils.lerp(motion.from, 1, ease(motion.time)); if (motion.step === 0) cutAmount = amount; else polishAmount = amount
        setShape(motion.step); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose()
      // disposeTree reaches only the current shell material. The other immutable
      // surface stages and their textures are owned by this scene as well.
      const current = shell.material; disposeTree(subject); surfaces.forEach(material => { if (material !== current) material.dispose() }); textures.forEach(texture => texture.dispose())
      Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
