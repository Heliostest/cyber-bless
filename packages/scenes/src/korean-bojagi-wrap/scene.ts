import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue, type InteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '方巾裹礼',
  done: '方巾已经包好，心意安稳地留在这份礼物里。',
  finish: '布结已经收紧。可以再看看，准备好后轻点「完成裹礼」。',
  settling: '布料顺着盒沿落下，褶皱慢慢安定…',
} as const
const LABELS = ['折过近角', '覆上远角', '收拢左角', '收拢右角', '交叉打松结', '拉紧布结']
const HINTS = ['捏住近处布角，覆盖盒顶亮起的区域，到位后自然落定。', '拿起远处布角，覆到盒顶亮起的区域，到位后自然落定。', '拢起左边布角，覆盖盒顶亮起的区域，到位后自然落定。', '拢起右边布角，覆盖盒顶亮起的区域，到位后自然落定。', '把左侧系带搭过右侧系带，在盒顶交叠后自然留成松结。', '握住右侧带端向外拉，看着布结逐渐收小；提示收紧后松手。']
const READY = ['已覆盖，正在落定', '已覆盖，正在落定', '已覆盖，正在落定', '已覆盖，正在落定', '系带已交叠，正在成结', '布结已收紧，松手落定']
const DESTINATIONS = ['覆盖亮起区域', '覆盖亮起区域', '覆盖亮起区域', '覆盖亮起区域', '搭过右侧系带', '向外拉至布结收紧']
type XYZ = [number, number, number]
const ease = (t: number) => t * t * (3 - 2 * t)
const GRIP: XYZ = [0, .012, 0]
const NAMES = ['near', 'far', 'left', 'right'] as const
const CORNERS: [number, number][] = [[.94, .94], [-.94, -.94], [-.94, .94], [.94, -.94]]
const checkpoint = (step: number) => step < 4 ? 0 : step < 6 ? 1 : step === 6 ? 2 : 3
const CLOTH_SEGMENTS = 48

/** Original contemporary public craft appreciation of patchwork cloth wrapping a parcel. */
export function createKoreanBojagiWrap(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...Object.values(COPY), ...LABELS, ...HINTS, ...READY, ...DESTINATIONS].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at = 0
  let stopResize = () => {}, lifecycleVersion = 0, callbackVersion = 0
  let motion: { step: number; time: number; amount: number; offset: THREE.Vector3 } | null = null
  let dragging = false, moved = false, invalid = false
  const amounts = [0, 0, 0, 0], heldOffset = new THREE.Vector3()
  let looseAmount = 0, tieAmount = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, haptic: undefined, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: LABELS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
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
    // Every corner starts open. Angular weights share vertices across four
    // flaps, so folding one corner cannot split the connected square sheet.
    const weights = [z, -z, -x, x].map(n => THREE.MathUtils.smoothstep(n / radius, .28, .95))
    const total = weights.reduce((sum, n) => sum + n, 0)
    const fold = weights.reduce((sum, n, i) => sum + n * amounts[i]!, 0) / Math.max(total, .001)
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
    y += pleat + .009 * Math.sin(u * 17) * Math.sin(v * 19) * (1 - fold)
    // Include a wider shoulder margin: triangles between safe vertices must
    // also clear the rounded lid, including its curved outer lip.
    if (Math.max(Math.abs(px), Math.abs(pz)) < .54) y = Math.max(y, .727)
    const p = new THREE.Vector3(px, y, pz)
    if (at < 4 && heldOffset.lengthSq()) p.addScaledVector(heldOffset, weights[at]! * THREE.MathUtils.smoothstep(radius, .65, 1.8))
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) < .54 && p.y > .11) p.y = Math.max(p.y, .727)
    return p
  }
  const corners = NAMES.map((name, n) => {
    const geometry = new THREE.PlaneGeometry(.1, .1, 4, 4), mesh = add(`bojagi-${name}-corner`, geometry, coral)
    mesh.material.side = THREE.DoubleSide; mesh.receiveShadow = false; mesh.userData.toonSurface = { outline: false, shading: 'smooth' }
    return { mesh, geometry, uv: geometry.getAttribute('uv'), position: geometry.getAttribute('position'), at: CORNERS[n]! }
  })
  const bandMaterial = new THREE.MeshStandardMaterial({ color: 0xd6a052, roughness: .93, side: THREE.DoubleSide })
  const bandSegments = 40
  const ribbons = ['near', 'far', 'left', 'right'].map(name => {
    const geometry = new THREE.PlaneGeometry(1, 1, bandSegments, 1)
    const mesh = add(`bojagi-band-${name}`, geometry, bandMaterial)
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' }
    return { name, mesh, geometry, position: geometry.getAttribute('position'), uv: geometry.getAttribute('uv') }
  })
  const tips = ['left', 'right'].map(name => {
    const mesh = box(`bojagi-band-${name}-tip`, [.25, .024, .12], [0, 0, 0], bandMaterial)
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' }; return mesh
  })
  const attachmentUV: Record<string, [number, number]> = { near: [1, 1], far: [-1, -1], left: [-1, 1], right: [1, -1] }
  const attachmentMarkers = Object.fromEntries(Object.keys(attachmentUV).map(name => {
    const marker = new THREE.Object3D(); marker.name = `bojagi-band-${name}-attachment`; world.add(marker); return [name, marker]
  })) as Record<string, THREE.Object3D>
  const updateGeometry = (geometry: THREE.BufferGeometry) => {
    geometry.getAttribute('position').needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  }
  const ribbonPath = (name: string) => {
    const n = NAMES.indexOf(name as typeof NAMES[number]), start = clothPoint(...attachmentUV[name]!), f = amounts[n]!
    const side = name === 'right' ? 1 : -1, height = .79 + (1 - tieAmount) * .09, radius = .09 + (1 - tieAmount) * .12
    const direction = new THREE.Vector3(name === 'left' ? -1 : name === 'right' ? 1 : 0, 0, name === 'near' ? 1 : name === 'far' ? -1 : 0)
    const opened = [start, start.clone().addScaledVector(direction, .10).add(new THREE.Vector3(0, .018, 0)), start.clone().addScaledVector(direction, .23)]
    let closed: THREE.Vector3[]
    if (name === 'near') closed = [start, new THREE.Vector3(-.08, .82, .14), new THREE.Vector3(-.16, .75, .39)]
    else if (name === 'far') closed = [start, new THREE.Vector3(.02, .84, -.04), new THREE.Vector3(.11, .82, .23), new THREE.Vector3(.18, .75, .43)]
    else {
      const flat = [start, new THREE.Vector3(side * .34, .82, .05), new THREE.Vector3(side * .59, .75, .11), new THREE.Vector3(side * .78, .59, .17)]
      const knotted = [start, new THREE.Vector3(side * .17, height, -.03), new THREE.Vector3(side * radius, height + .06, -.13), new THREE.Vector3(-side * radius * .6, height + .08, -.02), new THREE.Vector3(-side * radius * .5, height + .025, .13), new THREE.Vector3(side * .22, height, .13), new THREE.Vector3(side * .57, .735, .15), new THREE.Vector3(side * (.70 + tieAmount * .19), .57 - tieAmount * .14, .17)]
      const a = new THREE.CatmullRomCurve3(flat), b = new THREE.CatmullRomCurve3(knotted)
      closed = Array.from({ length: 9 }, (_, i) => a.getPoint(i / 8).lerp(b.getPoint(i / 8), looseAmount))
    }
    const a = new THREE.CatmullRomCurve3(opened), b = new THREE.CatmullRomCurve3(closed)
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 15 }, (_, i) => a.getPoint(i / 14).lerp(b.getPoint(i / 14), f)))
    if (n >= 2 && at === (n === 2 ? 4 : 5) && heldOffset.lengthSq()) {
      const shift = heldOffset
      // Pulling changes the loop itself through tieAmount. Only the free tail
      // follows the hand; translating the whole knot would fake tightening.
      return new THREE.CatmullRomCurve3(Array.from({ length: 20 }, (_, i) => path.getPoint(i / 19).addScaledVector(shift, at === 5 ? ease(THREE.MathUtils.clamp((i / 19 - .65) / .35, 0, 1)) : ease(i / 19))))
    }
    return path
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const setShape = () => {
    for (let i = 0; i < clothPosition.count; i++) {
      const p = clothPoint(clothUV.getX(i) * 2 - 1, clothUV.getY(i) * 2 - 1)
      clothPosition.setXYZ(i, p.x, p.y, p.z)
    }
    updateGeometry(clothGeometry)
    for (const corner of corners) {
      const home = clothPoint(...corner.at); corner.mesh.position.copy(home)
      for (let i = 0; i < corner.position.count; i++) {
        const p = clothPoint(corner.at[0] + (corner.uv.getX(i) - .5) * .075, corner.at[1] + (corner.uv.getY(i) - .5) * .075).sub(home)
        corner.position.setXYZ(i, p.x, p.y + .012, p.z)
      }
      updateGeometry(corner.geometry)
    }
    for (const ribbon of ribbons) {
      const path = ribbonPath(ribbon.name)
      attachmentMarkers[ribbon.name]!.position.copy(path.getPoint(0))
      for (let i = 0; i < ribbon.position.count; i++) {
        const t = ribbon.uv.getX(i), p = path.getPoint(t), tangent = path.getTangent(t)
        const across = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar((ribbon.uv.getY(i) - .5) * .105)
        p.add(across); ribbon.position.setXYZ(i, p.x, p.y + .008, p.z)
      }
      updateGeometry(ribbon.geometry)
      if (ribbon.name === 'right' || ribbon.name === 'left') {
        const bandTip = tips[ribbon.name === 'left' ? 0 : 1]!
        const tangent = path.getTangent(1)
        bandTip.position.copy(path.getPoint(1)).addScaledVector(tangent, .105).add(new THREE.Vector3(0, .008, 0))
        bandTip.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent)
      }
    }
    matrices()
  }
  const pose = (step: number, amount = 0) => {
    for (let i = 0; i < 4; i++) amounts[i] = step > i ? 1 : step === i ? amount : 0
    looseAmount = step > 4 ? 1 : step === 4 ? amount : 0
    tieAmount = step > 5 ? 1 : step === 5 ? amount : 0
  }
  const restore = () => { heldOffset.set(0, 0, 0); pose(at); setShape() }
  const targets = [...corners.map(c => c.mesh), ...tips]
  const dropPositions: XYZ[] = [[0, .85, .10], [0, .85, -.10], [-.10, .85, 0], [.10, .85, 0], [.38, .85, .08], [1.08, .51, .17]]
  const coverageSizes = [[.82, .60], [.82, .60], [.60, .82], [.60, .82]] as const
  const coverageOutlines: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = []
  const drops = dropPositions.map((p, n) => {
    // Area guides describe where cloth can cover the lid. The final pull has
    // only an arrow cue: its endpoint is a suggestion, never a success test.
    const geometry = n < 4 ? new THREE.PlaneGeometry(...coverageSizes[n]!) : new THREE.PlaneGeometry(.32, .16)
    const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xf4c55b, transparent: true, opacity: n === 5 ? 0 : .30, depthWrite: false, side: THREE.DoubleSide }))
    if (n < 4) {
      const [width, depth] = coverageSizes[n]!, border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]].map(([x, y]) => new THREE.Vector3(x, y, .002))), new THREE.LineBasicMaterial({ color: 0xc58a32, transparent: true, opacity: .9 }))
      border.name = `bojagi-coverage-outline-${n}`; marker.add(border); coverageOutlines.push(border)
    }
    marker.name = `bojagi-drop-${n}`; marker.position.set(...p); marker.rotation.x = -Math.PI / 2; marker.userData.toonSurface = { outline: false }; world.add(marker); return marker
  })
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const cues: InteractionCue[] = targets.map((_, n) => ({ kind: 'drag', label: LABELS[n]!, targetLabel: DESTINATIONS[n], anchor: GRIP, destination: drops[n], priority: 3, enabled: enabled(n) }))
  const removeCues = targets.map((object, n) => addInteractionCue(object, cues[n]!))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), from = new THREE.Vector2(), to = new THREE.Vector2(), plane = new THREE.Plane(), held = new THREE.Vector3()
  const oppositeTail = new THREE.Vector3(), pullOrigin = new THREE.Vector3(), pullAxis = new THREE.Vector3()
  let restSpan = 0
  const project = (p: THREE.Vector3) => { const r = canvas.getBoundingClientRect(), q = p.clone().project(camera); return new THREE.Vector2(r.left + (q.x + 1) * r.width / 2, r.top + (1 - q.y) * r.height / 2) }
  const inside = (x: number, y: number) => { const r = canvas.getBoundingClientRect(); return x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height }
  const bandPoint = (band: number, index: number) => {
    const ribbon = ribbons[band]!, p = ribbon.position
    return ribbon.mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p, index).add(new THREE.Vector3().fromBufferAttribute(p, index + bandSegments + 1)).multiplyScalar(.5))
  }
  const clothCovered = () => {
    const corner = corners[at]!, center = drops[at]!.position, [width, depth] = coverageSizes[at]!
    let covered = 0
    // Count the real reinforced patch, not the pointer or a screen-space radius.
    for (let i = 0; i < corner.position.count; i++) {
      const p = corner.mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(corner.position, i))
      if (Math.abs(p.x - center.x) <= width / 2 && Math.abs(p.z - center.z) <= depth / 2 && p.y >= .73 && p.y <= 1.02) covered++
    }
    return covered / corner.position.count >= .6
  }
  const bandsCrossed = () => {
    // The two rendered strips must overlap on the lid, with enough height
    // clearance to be laid over one another, rather than touching the mat.
    const right = Array.from({ length: bandSegments + 1 }, (_, i) => bandPoint(3, i))
    for (let i = 3; i <= bandSegments; i++) {
      const p = bandPoint(2, i)
      if (p.x < .045 || p.x > .48 || Math.abs(p.z) > .45 || p.y < .735 || p.y > 1.04) continue
      if (right.some(q => Math.hypot(p.x - q.x, p.z - q.z) < .085 && Math.abs(p.y - q.y) < .12)) return true
    }
    return false
  }
  const knotTight = () => {
    // These vertices lie at the opposing bends of the visible inner loop.
    // The free tail's offset cannot reduce this measured width.
    return Math.abs(bandPoint(2, 11).x - bandPoint(3, 11).x) <= .24
  }
  const readyToRelease = () => at < 4 ? clothCovered() : at === 4 ? bandsCrossed() : knotTight()
  const moveShape = (x: number, y: number) => {
    const path = to.clone().sub(from), fraction = new THREE.Vector2(x - down.x, y - down.y).dot(path) / Math.max(path.lengthSq(), 1)
    heldOffset.set(0, 0, 0)
    if (!ray.aim(x, y).ray.intersectPlane(plane, held)) return false
    // Only folding uses the authored lift path. A band crossing stays open
    // until accepted; tightening responds to tension against the other tail.
    const outward = held.clone().sub(pullOrigin).dot(pullAxis) > 0
    const tension = at === 5 && outward ? THREE.MathUtils.clamp((held.distanceTo(oppositeTail) - restSpan) / .30, 0, 1) : 0
    pose(at, at < 4 ? THREE.MathUtils.clamp(fraction, 0, 1) : tension); setShape()
    heldOffset.copy(held).sub(targets[at]!.localToWorld(new THREE.Vector3(...GRIP))); setShape()
    return true
  }
  const showReadiness = (ready: boolean) => {
    drops[at]!.material.color.setHex(ready ? 0xa7d0a0 : 0xf4c55b)
    coverageOutlines[at]?.material.color.setHex(ready ? 0x5d9d69 : 0xc58a32)
    cues[at]!.label = ready ? READY[at]! : LABELS[at]!
    cues[at]!.targetLabel = ready ? undefined : DESTINATIONS[at]
    setSafeText(ui.hintEl, ready ? READY[at]! : HINTS[at]!, safe)
  }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const canPickUp = (x: number, y: number) => {
    const object = nearestHit(x, y), target = targets[at]!
    if (object === target) return true
    const anchor = project(target.localToWorld(new THREE.Vector3(...GRIP)))
    const band = ribbons[at < 4 ? at : at === 4 ? 2 : 3]!.mesh
    // The 44px cue also accepts the visible adjoining cloth or sewn band.
    // An opaque object over it, another corner, or empty space still rejects.
    return Math.hypot(x - anchor.x, y - anchor.y) <= 22 && (object === cloth || object === band)
  }
  const reset = () => { dragging = moved = invalid = false; if (!motion && !disposed) { restore(); sync() } }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at >= 6 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return canPickUp(x, y) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = true; moved = invalid = false
      const source = targets[at]!.localToWorld(new THREE.Vector3(...GRIP))
      from.copy(project(source)); to.copy(project(drops[at]!.getWorldPosition(new THREE.Vector3())))
      if (at < 5) plane.set(new THREE.Vector3(0, 1, 0), -.85)
      else {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), source)
        oppositeTail.copy(tips[0]!.localToWorld(new THREE.Vector3(...GRIP))); restSpan = source.distanceTo(oppositeTail)
        pullOrigin.copy(source); pullAxis.copy(source).sub(oppositeTail).normalize()
      }
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; pointer.cancel(); return }
      moved ||= Math.hypot(x - down.x, y - down.y) > 2
      showReadiness(moveShape(x, y) && moved && !invalid && inside(x, y) && readyToRelease())
          if (at < 5 && moved && !invalid && inside(x, y) && readyToRelease() && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      const valid = dragging && moved && !invalid && Number.isFinite(x) && Number.isFinite(y) && inside(x, y) && moveShape(x, y) && readyToRelease()
      dragging = false; if (valid) begin(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 7); ui.actionBtn.hidden = at === 7; ui.actionBtn.disabled = !inputActive() || !!motion || at === 7
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 6 ? 'auto' : 'none'
    drops.forEach((drop, n) => { drop.visible = active() && !motion && at === n; drop.material.color.setHex(0xf4c55b); coverageOutlines[n]?.material.color.setHex(0xc58a32) })
    cues.forEach((cue, n) => { cue.label = LABELS[n]!; cue.targetLabel = DESTINATIONS[n] })
    setSafeText(ui.actionBtn, at < 6 ? LABELS[at]! : '完成裹礼', safe)
    setSafeText(ui.hintEl, motion ? COPY.settling : at < 6 ? HINTS[at]! : at === 6 ? COPY.finish : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const revision = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && revision === lifecycleVersion }
  function reportStep() {
    ctx.onVariantChange?.(`bojagi-step-${at}`)
    if (disposed) return
    if (at === 4 || at === 6 || at === 7) ctx.onProgress?.(checkpoint(at))
  }
  function settle() {
    if (!inputActive() || !motion) return
    const step = motion.step; at = step + 1; motion = null; restore()
    if (at === 4) resize()
    withHostCallbacks(() => {
      reportStep(); if (!callbackActive()) return
      ctx.haptic?.(step === 5 ? 'heavy' : 'medium'); if (!callbackActive()) return
      feedback.impact({ freqs: step === 5 ? [294, 392] : step === 4 ? [329.63, 440] : [392, 523.25], duration: step === 5 ? .19 : step === 4 ? .14 : .10, gain: .009, type: 'sine' })
    })
  }
  function begin(arrived = false) {
    if (!inputActive() || (pointer.isBusy() && !arrived) || motion || at >= 6) return
    const amount = at < 4 ? amounts[at]! : at === 4 ? looseAmount : tieAmount
    motion = { step: at, time: 0, amount, offset: heldOffset.clone() }; sync(); if (reduced()) settle()
  }
  function finish() {
    if (!inputActive() || pointer.isBusy() || motion || at !== 6) return
    withHostCallbacks(() => {
      at = 7; restore(); sync(); reportStep(); if (!callbackActive()) return
      ctx.haptic?.('light'); if (!callbackActive()) return
      feedback.impact({ freqs: [392, 587.33], duration: .20, gain: .008 }); if (!callbackActive()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 7 || !prepareInput()) return; if (at < 6) begin(); else finish() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), targetPoint = new THREE.Vector3(0, .48, .25), direction = new THREE.Vector3(.16, 2.6, 1.2).normalize()
    camera.position.copy(targetPoint).add(direction); camera.lookAt(targetPoint); camera.updateMatrixWorld(true)
    const inverseView = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3()
    const saved = { step: at, amounts: [...amounts], looseAmount, tieAmount, heldOffset: heldOffset.clone() }
    heldOffset.set(0, 0, 0)
    const close = saved.step >= 4, stages = close ? [4, 5, 6] : [0, 1, 2, 3, 4, 5, 6]
    let distance = close ? 2 : 3.5
    for (const step of stages) {
      at = step; pose(step); setShape()
      world.traverse(o => {
        const mesh = o as THREE.Mesh; if (!mesh.geometry || close && /^bojagi-(woven-mat|weft-|warp-)/.test(mesh.name)) return
        const vertices = mesh.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) {
          p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).sub(targetPoint).applyQuaternion(inverseView)
          distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .89), p.z + Math.abs(p.y) / (tangent * .89))
        }
      })
    }
    at = saved.step; amounts.splice(0, 4, ...saved.amounts); looseAmount = saved.looseAmount; tieAmount = saved.tieAmount; heldOffset.copy(saved.heldOffset); setShape()
    camera.position.copy(targetPoint).addScaledVector(direction, distance); camera.lookAt(targetPoint); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0, progress = Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0
      const match = /^bojagi-step-([0-7])$/.exec(ctx.initialVariant ?? ''), saved = match ? Number(match[1]) : -1
      at = saved >= 0 && checkpoint(saved) === progress ? saved : [0, 4, 6, 7][progress]!
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
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .62)
        const t = ease(motion.time); pose(motion.step, THREE.MathUtils.lerp(motion.amount, 1, t)); heldOffset.copy(motion.offset).multiplyScalar(1 - t)
        setShape(); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world)
      patchwork.dispose(); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
