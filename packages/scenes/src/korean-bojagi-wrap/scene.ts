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
  title: '方巾裹礼', fold: '捏住近处的布角，向上轻拢，让柔软方巾包住小盒。',
  tighten: '握住右侧相连的系带，向右轻拉，让松松的结慢慢收拢。',
  quiet: '轻点包好的方巾静看，或写一句心意；点「写好了」才会保存。',
  returning: '轻点方巾，回看拼布与缝线留下的温度。', done: '用一方柔软布料，包好一份日常心意。',
  folding: '布角绕过盒沿，柔软的拼布渐渐贴合…', tying: '相连的系带缓缓收紧，留下自然的小结…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const ease = (t: number) => t * t * (3 - 2 * t)
const GRIP: XYZ = [0, .012, 0], EDGE: XYZ = [0, .012, 0], QUIET: XYZ = [.031098, .452587, .590862]
const CLOTH_SEGMENTS = 48

/** Original contemporary public craft appreciation of patchwork cloth wrapping a parcel. */
export function createKoreanBojagiWrap(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null, lifecycleVersion = 0, callbackVersion = 0
  let motion: { step: 0 | 1; time: number; fold: number; tie: number } | null = null
  let dragging = false, maxTravel = 0, maxCross = 0, moved = 0, maxAlong = 0, minAlong = 0, backtrack = 0
  let foldAmount = 0, tieAmount = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向上拢起布角' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'korean-bojagi-wrap', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xe8e4d5, ground: 0x877c68, key: 0xffe6bd, rim: 0xcae9ee, keyPosition: [-3, 6, 4], keyIntensity: 1.5, rimIntensity: .5 })
  const world = new THREE.Group(); world.name = 'bojagi-subject'; scene.add(world)
  const mat = (color: number, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const cream = mat(0xeacfa5), coral = mat(0xc96d5c), straw = mat(0xb58e55)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p)
    mesh.castShadow = mesh.receiveShadow = true; world.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.04, ...size.map(n => n / 3))), material, p)
  // Only a low woven floor mat supports the cloth and little rounded parcel.
  const floorMat = box('bojagi-woven-mat', [2.05, .055, 2.35], [0, .028, .1], straw)
  floorMat.userData.toonSurface = { outline: false }
  const weave = mat(0xb99b69)
  for (let n = 0; n < 19; n++) {
    const weft = box(`bojagi-weft-${n}`, [1.96, .006, .010], [0, .058, -1.02 + n * .125], weave)
    const warp = box(`bojagi-warp-${n}`, [.008, .005, 2.24], [-.97 + n * .108, .057, .1], weave)
    for (const strand of [weft, warp]) {
      strand.castShadow = false
      // Hidden outline edges would otherwise project the mat grid through
      // the cloth, whose organic surface intentionally has no ink outline.
      strand.userData.toonSurface = { outline: false }
    }
  }
  box('bojagi-parcel', [1, .58, 1], [0, .4, 0], cream)
  box('bojagi-parcel-lid', [1.015, .055, 1.015], [0, .672, 0], cream)

  // An original stitched patchwork, authored once in cloth UV space. The same
  // immutable map stays on one indexed surface throughout folding and tying.
  const textureSize = 256, pixels = new Uint8Array(textureSize * textureSize * 4)
  const palette = [[211, 116, 95], [244, 224, 181], [131, 161, 135], [211, 166, 82]]
  const cuts = [0, .21, .48, .73, 1], rows = [0, .29, .54, .78, 1]
  for (let y = 0; y < textureSize; y++) for (let x = 0; x < textureSize; x++) {
    const u = x / (textureSize - 1), v = y / (textureSize - 1)
    const column = Math.min(3, cuts.findIndex(edge => edge > u) - 1), row = Math.min(3, rows.findIndex(edge => edge > v) - 1)
    const color = palette[((column + row * 3) % 4 + 4) % 4]!, offset = (y * textureSize + x) * 4
    const seam = Math.min(...cuts.map(edge => Math.abs(u - edge)), ...rows.map(edge => Math.abs(v - edge)))
    const hem = Math.min(u, v, 1 - u, 1 - v) < .024
    const stitch = seam < .009 && (x + y) % 8 < 4
    const fiber = ((x * 7 + y * 11) % 5 - 2) * 1.1
    for (let c = 0; c < 3; c++) pixels[offset + c] = Math.max(0, Math.min(255, color[c]! * (hem ? .84 : seam < .005 ? .69 : 1) + (stitch ? 20 : 0) + fiber))
    pixels[offset + 3] = 255
  }
  const patchwork = new THREE.DataTexture(pixels, textureSize, textureSize, THREE.RGBAFormat)
  patchwork.colorSpace = THREE.SRGBColorSpace; patchwork.minFilter = patchwork.magFilter = THREE.LinearFilter; patchwork.generateMipmaps = false; patchwork.needsUpdate = true
  const clothMaterial = new THREE.MeshStandardMaterial({ map: patchwork, roughness: .96, side: THREE.DoubleSide })
  const clothGeometry = new THREE.PlaneGeometry(2, 2, CLOTH_SEGMENTS, CLOTH_SEGMENTS)
  const cloth = add('bojagi-cloth', clothGeometry, clothMaterial)
  cloth.receiveShadow = false
  cloth.userData.toonSurface = { outline: false, shading: 'smooth' }
  const clothPosition = clothGeometry.getAttribute('position'), clothUV = clothGeometry.getAttribute('uv')

  const clothPoint = (u: number, v: number) => {
    const x = (u - v) * 1.05, z = (u + v) * 1.05, radius = Math.max(Math.abs(x), Math.abs(z))
    if (radius <= .58) return new THREE.Vector3(x, .105, z)
    const length = (radius - .58) * 1.38, topLength = Math.max(0, length - .68)
    const shoulder = THREE.MathUtils.clamp((length - .46) / .22, 0, 1) * Math.PI / 2
    const finalRadius = Math.max(.11, .59 - .07 * (1 - Math.cos(shoulder)) - topLength * .70)
    const finalHeight = .105 + Math.min(length, .46) + .14 * Math.sin(shoulder) + topLength * .055
    // Three corners are already gathered. Only the near diamond corner opens
    // onto the mat; the angular blend keeps every shared edge connected.
    const near = THREE.MathUtils.smoothstep(z / radius, .58, .95)
    const fold = 1 - near * (1 - foldAmount)
    const openRadius = .58 + (radius - .58) * .65
    const r = THREE.MathUtils.lerp(openRadius, finalRadius, fold)
    const openHeight = .105 - .09 * THREE.MathUtils.smoothstep(z / radius * openRadius, 1.26, 1.55)
    let y = THREE.MathUtils.lerp(openHeight, finalHeight, fold) + Math.sin(fold * Math.PI) * Math.min(.84, length * .64)
    // Lift over the lid before moving inward. This is an authored cloth path,
    // with clearance against the complete rounded parcel rather than a clip.
    const angle = Math.atan2(z, x), roundness = Math.pow(Math.pow(Math.abs(x / radius), 8) + Math.pow(Math.abs(z / radius), 8), 1 / 8)
    const directionScale = THREE.MathUtils.lerp(1, 1 / roundness, fold)
    const pleat = .018 * Math.sin(angle * 11 + length * 8) * THREE.MathUtils.smoothstep(length, .25, .8) * fold
    const px = x / radius * (r + Math.abs(pleat)) * directionScale, pz = z / radius * (r + Math.abs(pleat)) * directionScale
    y += pleat + .009 * Math.sin(u * 17) * Math.sin(v * 19) * near * (1 - fold)
    // Include a wider shoulder margin: triangles between safe vertices must
    // also clear the rounded lid, including its curved outer lip.
    if (Math.max(Math.abs(px), Math.abs(pz)) < .54) y = Math.max(y, .727)
    return new THREE.Vector3(px, y, pz)
  }
  const cornerGeometry = new THREE.PlaneGeometry(.1, .1, 4, 4)
  const nearCorner = add('bojagi-near-corner', cornerGeometry, coral)
  nearCorner.material.side = THREE.DoubleSide
  nearCorner.receiveShadow = false
  nearCorner.userData.toonSurface = { outline: false, shading: 'smooth' }
  const cornerUV = cornerGeometry.getAttribute('uv'), cornerPosition = cornerGeometry.getAttribute('position')
  const bandMaterial = new THREE.MeshStandardMaterial({ color: 0xd6a052, roughness: .93, side: THREE.DoubleSide })
  const bandSegments = 40
  const ribbons = ['near', 'far', 'left', 'right'].map(name => {
    const geometry = new THREE.PlaneGeometry(1, 1, bandSegments, 1)
    const mesh = add(`bojagi-band-${name}`, geometry, bandMaterial)
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' }
    return { name, mesh, geometry, position: geometry.getAttribute('position'), uv: geometry.getAttribute('uv') }
  })
  const bandTip = box('bojagi-band-right-tip', [.25, .024, .11], [0, 0, 0], bandMaterial)
  bandTip.userData.toonSurface = { outline: false, shading: 'smooth' }
  const attachmentUV: Record<string, [number, number]> = { near: [1, 1], far: [-1, -1], left: [-1, 1], right: [1, -1] }
  const attachmentMarkers = Object.fromEntries(Object.keys(attachmentUV).map(name => {
    const marker = new THREE.Object3D(); marker.name = `bojagi-band-${name}-attachment`; world.add(marker); return [name, marker]
  })) as Record<string, THREE.Object3D>
  const updateGeometry = (geometry: THREE.BufferGeometry) => {
    geometry.getAttribute('position').needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  }
  const ribbonPath = (name: string) => {
    const start = clothPoint(...attachmentUV[name]!), height = .79 + (1 - tieAmount) * .09, radius = .09 + (1 - tieAmount) * .12
    if (name === 'near' && foldAmount < 1) {
      const open = [start, start.clone().add(new THREE.Vector3(0, .018, .12)), start.clone().add(new THREE.Vector3(.05, .008, .24))]
      const closed = [start, new THREE.Vector3(-.08, .82, .14), new THREE.Vector3(-.16, .75, .39)]
      return new THREE.CatmullRomCurve3(open.map((p, i) => p.lerp(closed[i]!, ease(foldAmount))))
    }
    if (name === 'near') return new THREE.CatmullRomCurve3([start, new THREE.Vector3(-.08, .82, .14), new THREE.Vector3(-.16, .75, .39)])
    if (name === 'far') return new THREE.CatmullRomCurve3([start, new THREE.Vector3(.02, .81, -.04), new THREE.Vector3(.11, .81, .23), new THREE.Vector3(.18, .735, .43)])
    const side = name === 'right' ? 1 : -1
    return new THREE.CatmullRomCurve3([
      start, new THREE.Vector3(side * .17, height, -.03),
      new THREE.Vector3(side * radius, height + .06, -.13), new THREE.Vector3(-side * radius * .6, height + .08, -.02),
      new THREE.Vector3(-side * radius * .5, height + .025, .13), new THREE.Vector3(side * .22, height, .13),
      new THREE.Vector3(side * .57, .735, .15), new THREE.Vector3(side * (.70 + tieAmount * .19), .57 - tieAmount * .14, .17),
    ])
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const setShape = () => {
    for (let i = 0; i < clothPosition.count; i++) {
      const p = clothPoint(clothUV.getX(i) * 2 - 1, clothUV.getY(i) * 2 - 1)
      clothPosition.setXYZ(i, p.x, p.y, p.z)
    }
    updateGeometry(clothGeometry)
    const corner = clothPoint(.94, .94); nearCorner.position.copy(corner)
    for (let i = 0; i < cornerPosition.count; i++) {
      const p = clothPoint(.94 + (cornerUV.getX(i) - .5) * .075, .94 + (cornerUV.getY(i) - .5) * .075).sub(corner)
      cornerPosition.setXYZ(i, p.x, p.y + .012, p.z)
    }
    updateGeometry(cornerGeometry)
    for (const ribbon of ribbons) {
      const path = ribbonPath(ribbon.name)
      attachmentMarkers[ribbon.name]!.position.copy(path.getPoint(0))
      for (let i = 0; i < ribbon.position.count; i++) {
        const t = ribbon.uv.getX(i), p = path.getPoint(t), tangent = path.getTangent(t)
        const across = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar((ribbon.uv.getY(i) - .5) * .105)
        p.add(across); ribbon.position.setXYZ(i, p.x, p.y + .008, p.z)
      }
      updateGeometry(ribbon.geometry)
      if (ribbon.name === 'right') {
        const tangent = path.getTangent(1)
        bandTip.position.copy(path.getPoint(1)).addScaledVector(tangent, .105).add(new THREE.Vector3(0, .008, 0))
        bandTip.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent)
      }
    }
    matrices()
  }
  const restore = () => { foldAmount = at > 0 ? 1 : 0; tieAmount = at >= 2 ? 1 : 0; setShape() }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(nearCorner, { kind: 'drag', direction: [0, -1], label: '向上拢起布角', anchor: GRIP, priority: 3, enabled: enabled(0) }),
    addInteractionCue(bandTip, { kind: 'drag', direction: [1, 0], label: '向右轻拉系带', anchor: EDGE, priority: 3, enabled: enabled(1) }),
    addInteractionCue(cloth, { kind: 'tap', label: '轻点方巾静看', anchor: QUIET, priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const target = () => at === 0 ? nearCorner : at === 1 ? bandTip : cloth
  const reset = () => { dragging = false; maxTravel = maxCross = moved = maxAlong = minAlong = backtrack = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return nearestHit(x, y) === target() },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; maxTravel = maxCross = moved = maxAlong = minAlong = backtrack = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { pointer.cancel(); return }
      const dx = x - down.x, dy = y - down.y
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dx : dy)); moved = at === 0 ? -dy : dx
      maxAlong = Math.max(maxAlong, moved); minAlong = Math.min(minAlong, moved); backtrack = Math.max(backtrack, maxAlong - moved)
      if (dragging && at === 0) foldAmount = THREE.MathUtils.clamp(moved / 75, 0, 1)
      else if (dragging && at === 1) tieAmount = THREE.MathUtils.clamp(moved / 75, 0, 1)
      setShape()
    },
    onRelease(x, y) {
      matrices(); const dx = x - down.x, dy = y - down.y, along = at === 0 ? -dy : dx, cross = at === 0 ? Math.abs(dx) : Math.abs(dy)
      const valid = Number.isFinite(x) && Number.isFinite(y) && (at < 2
        ? dragging && completesDirectionalDrag({ along: moved, end: along, maxAlong, minAlong, backtrack, maxCross, cross, travel: maxTravel }, 40, 75)
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && nearestHit(x, y) === cloth)
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '向上拢起布角' : at === 1 ? '向右轻拉系带' : '轻点方巾静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.folding : COPY.tying : at === 0 ? COPY.fold : at === 1 ? COPY.tighten : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const revision = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && revision === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (callbackActive()) feedback.impact({ freqs: [392, 523.25], duration: .12, gain: .007, type: 'sine' }) })
  }
  function begin() {
    if (!inputActive() || pointer.isBusy() || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, fold: foldAmount, tie: tieAmount }; sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    withHostCallbacks(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!callbackActive()) return
      feedback.impact({ freqs: [392, 587.33], duration: .20, gain: .008 }); if (!callbackActive()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), targetPoint = new THREE.Vector3(0, .48, .25), direction = new THREE.Vector3(.16, 1.12, 1.35).normalize()
    camera.position.copy(targetPoint).add(direction); camera.lookAt(targetPoint); camera.updateMatrixWorld(true)
    const inverseView = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3()
    const saved = [foldAmount, tieAmount]; let distance = 3.5
    for (const pose of [[0, 0], [.25, 0], [.5, 0], [.75, 0], [1, 0], [1, .5], [1, 1]]) {
      [foldAmount, tieAmount] = pose; setShape()
      world.traverse(o => {
        const mesh = o as THREE.Mesh; if (!mesh.geometry) return
        const vertices = mesh.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) {
          p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).sub(targetPoint).applyQuaternion(inverseView)
          distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .89), p.z + Math.abs(p.y) / (tangent * .89))
        }
      })
    }
    [foldAmount, tieAmount] = saved; setShape()
    camera.position.copy(targetPoint).addScaledVector(direction, distance); camera.lookAt(targetPoint); matrices()
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
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .88)
        if (motion.step === 0) foldAmount = THREE.MathUtils.lerp(motion.fold, 1, ease(motion.time))
        else tieAmount = THREE.MathUtils.lerp(motion.tie, 1, ease(motion.time))
        setShape(); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world)
      patchwork.dispose(); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
