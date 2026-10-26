// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneInstance } from './contract'
import { loadScene } from './registry'

const rendered = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))
const instances: SceneInstance[] = []
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {}, fillText() {} } as unknown as CanvasRenderingContext2D)
})
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
type Point = [number, number]
function pointer(layer: HTMLElement, type: string, [clientX, clientY]: Point) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId: 1, pointerType: layer.dataset.pointerType ?? 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true })
  layer.dispatchEvent(event)
}
const placements = [
  'czech-bead-star', 'fijian-woven-fan', 'amazigh-woven-rug', 'slovak-wire-bird', 'hungarian-embroidery-hoop',
  'andalusian-ceramic-tile', 'sicilian-painted-cart', 'bai-indigo-cloth', 'ndebele-painted-house', 'purepecha-copper-bowl',
  'welsh-love-spoon', 'barcelos-clay-rooster', 'finnish-birch-basket', 'croatian-licitar-heart', 'catalan-festival-giant',
  'sorbian-painted-egg', 'basque-sunflower', 'breton-banner', 'lithuanian-straw-garden', 'dalarna-wooden-horse',
  'aland-votive-ship', 'blang-tea', 'minangkabau-spinning-top', 'chinese-incense', 'czech-pilgrim-journal',
  'omikuji', 'polish-blessing-basket', 'floating-lantern-loy-krathong', 'omamori-cycle', 'shrine-suzu-bell',
  'st-brigids-cross', 'bokjori', 'ema-votive-plaque', 'clootie-well-rag', 'votive-candle-catholic',
] as const
async function mount(id: string, width = 390, initialProgress = 0, reduced = true) {
  const module = await loadScene(id), height = 408, left = 17, top = 89
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), returning: true, isReducedMotion: () => reduced, isSoundEnabled: () => false })
  instances.push(instance); instance.start()
  const run = () => { for (let i = 0; i < 100; i++) instance.update(.05) }
  run()
  const scene = rendered.scene!, camera = rendered.camera!, layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  layer.dataset.pointerType = width < 600 ? 'touch' : 'mouse'
  layer.setPointerCapture = vi.fn(); layer.releasePointerCapture = vi.fn()
  const project = (world: THREE.Vector3): Point => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const p = world.project(camera); return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2] }
  const source = (object: THREE.Object3D, cue: InteractionCue) => { scene.updateMatrixWorld(true); return project(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0])))) }
  const cues = () => {
    const entries: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) entries.push({ object, cue }) })
    return entries.sort((a, b) => (b.cue.priority ?? 0) - (a.cue.priority ?? 0))
  }
  return { id, width, height, scene, camera, layer, overlay, instance, progress, complete, run, project, source, cues }
}
function destination(s: Awaited<ReturnType<typeof mount>>, cue: InteractionCue): Point {
  const d = cue.destination!
  return s.project(typeof d === 'function' ? d() : d.getWorldPosition(new THREE.Vector3()))
}
function operate(s: Awaited<ReturnType<typeof mount>>, mode: 'center' | 'sparse' = 'center') {
  const { object, cue } = s.cues()[0]!, a = s.source(object, cue)
  const b = cue.destination ? destination(s, cue) : cue.kind === 'rotate' ? [a[0] + Math.min(180, s.width * .2), a[1]] as Point : a
  pointer(s.layer, 'pointerdown', a)
  if (cue.kind !== 'tap') {
    const samples = mode === 'sparse' ? [.1] : [.25, .5, .75, 1]
    for (const f of samples) pointer(s.layer, 'pointermove', [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  pointer(s.layer, 'pointerup', b); s.run()
}
it.each(['andalusian-ceramic-tile', 'bai-indigo-cloth', 'croatian-licitar-heart', 'hungarian-embroidery-hoop'])(
  '%s cancels before arrival and automatically accepts a fresh placement at its target', async id => {
    for (const at of [0, 1]) {
      const s = await mount(id, 390, at), { object, cue } = s.cues()[0]!
      const from = s.source(object, cue), to = destination(s, cue)
      const away: Point = [from[0] - (to[0] - from[0]) * .2, from[1] - (to[1] - from[1]) * .2]
      pointer(s.layer, 'pointerdown', from); pointer(s.layer, 'pointermove', away)
      expect(s.progress).toEqual([])
      pointer(s.layer, 'pointercancel', away)
      expect(s.overlay.querySelector<HTMLElement>('.scene-hint')!.dataset.dropReady).toBeUndefined()
      expect(s.progress).toEqual([])
      pointer(s.layer, 'pointerdown', from); pointer(s.layer, 'pointermove', to); s.run()
      expect(s.progress).toEqual([at + 1])
      pointer(s.layer, 'pointerup', to); s.run(); expect(s.progress).toEqual([at + 1])
      expect(s.overlay.querySelector<HTMLElement>('.scene-hint')!.dataset.dropReady).toBeUndefined()
      s.instance.dispose()
    }
  },
)
it.each(placements)('%s completes from the scene cues at touch and mouse viewport sizes', async id => {
  for (const width of [390, 1280]) {
    const s = await mount(id, width)
    for (let at = 0; at < 3; at++) {
      expect(s.cues().length, `${id} step ${at}, ${width}`).toBeGreaterThan(0)
      for (let i = 0; i < (id === 'st-brigids-cross' && at === 0 ? 4 : 1); i++) operate(s)
      expect(s.progress, `${id} step ${at}, ${width}`).toEqual(Array.from({ length: at + 1 }, (_, i) => i + 1))
    }
    expect(s.complete).toHaveBeenCalledOnce(); s.instance.dispose()
  }
})

it.each(['andalusian-ceramic-tile', 'bai-indigo-cloth', 'croatian-licitar-heart', 'hungarian-embroidery-hoop'])(
  '%s cannot use an aligned grip to bypass a foreground object under the fingertip', async id => {
    const at = id === 'hungarian-embroidery-hoop' ? 0 : 1, s = await mount(id, 390, at)
    const entry = s.cues()[0]!, from = s.source(entry.object, entry.cue), target = destination(s, entry.cue)
    const end: Point = [target[0] + 12, target[1]]
    pointer(s.layer, 'pointerdown', [from[0] + 12, from[1]])
    expect(s.layer.setPointerCapture, 'the blocked test actually picks up the source').toHaveBeenCalledOnce()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2((end[0] - 17) / 390 * 2 - 1, 1 - (end[1] - 89) / 408 * 2), s.camera)
    const d = entry.cue.destination!, world = typeof d === 'function' ? d() : d.getWorldPosition(new THREE.Vector3())
    const blocker = new THREE.Mesh(new THREE.PlaneGeometry(.04, .04), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    blocker.position.copy(ray.ray.at(s.camera.getWorldPosition(new THREE.Vector3()).distanceTo(world) * .7, new THREE.Vector3()))
    blocker.quaternion.copy(s.camera.quaternion); s.scene.add(blocker); s.scene.updateMatrixWorld(true)
    try {
      expect(ray.intersectObject(blocker)).toHaveLength(1)
      pointer(s.layer, 'pointermove', end)
      pointer(s.layer, 'pointerup', end); s.run()
      expect(s.progress).toEqual([])
      expect(s.overlay.querySelector<HTMLElement>('.scene-hint')!.dataset.dropReady).toBeUndefined()
    } finally {
      blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose(); s.instance.dispose()
    }
  },
)

const complexPlacements = ['hongsheng-red-string', 'italian-ex-voto', 'navruz-sumalak', 'diya-oil-lamp', 'daruma-eye-painting', 'mizuhiki', 'milagros', 'phuang-malai', 'chinese-woodblock-print'] as const
it.each([...placements, ...complexPlacements])('%s restores its physical source after canceled input in every interactive checkpoint', async id => {
  for (const width of [390, 1280]) for (const at of [0, 1, 2]) for (const event of ['pointercancel', 'lostpointercapture']) {
    const s = await mount(id, width, at), entry = s.cues()[0]
    if (!entry) { s.instance.dispose(); continue } // Writing is represented by the real form, not a draggable object.
    const { object, cue } = entry, before = s.source(object, cue)
    let a = before
    if (id === 'phuang-malai') {
      const flowers = object as THREE.InstancedMesh, matrix = new THREE.Matrix4()
      flowers.getMatrixAt(0, matrix)
      a = s.project(new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(flowers.matrixWorld))
    }
    const b = cue.destination ? destination(s, cue) : [a[0] + 60, a[1] + 20] as Point
    pointer(s.layer, 'pointerdown', a)
    expect(s.layer.setPointerCapture, `${id} ${at} must actually claim the source`).toHaveBeenCalled()
    const away: Point = cue.destination ? [a[0] - (b[0] - a[0]) * .2, a[1] - (b[1] - a[1]) * .2] : [a[0] + 12, a[1]]
    pointer(s.layer, 'pointermove', away); pointer(s.layer, event, away); pointer(s.layer, 'pointerup', away); s.run()
    expect(s.progress, `${id} ${at} must not accept ${event}`).toEqual([])
    const after = s.source(object, cue)
    expect(Math.hypot(after[0] - before[0], after[1] - before[1]), `${id} ${at} must restore ${event}`).toBeLessThan(.01)
    s.instance.dispose()
  }
})

it.each(['czech-bead-star', 'fijian-woven-fan', 'finnish-birch-basket', 'basque-sunflower', 'aland-votive-ship', 'minangkabau-spinning-top', 'breton-banner'])('%s keeps placement destinations occluded by other solid objects invalid', async id => {
  const s = await mount(id), entry = s.cues()[0]!, a = s.source(entry.object, entry.cue), b = destination(s, entry.cue)
  pointer(s.layer, 'pointerdown', a)
  const d = entry.cue.destination!, target = typeof d === 'function' ? d() : d.getWorldPosition(new THREE.Vector3())
  const blocker = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  blocker.position.lerpVectors(target, s.camera.getWorldPosition(new THREE.Vector3()), .25); blocker.quaternion.copy(s.camera.quaternion)
  s.scene.add(blocker); s.scene.updateMatrixWorld(true)
  pointer(s.layer, 'pointermove', b)
  pointer(s.layer, 'pointerup', b); s.run()
  expect(s.progress).toEqual([])
  blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose()
  operate(s)
  expect(s.progress).toEqual([1])
})
it.each(placements)('%s accepts final pointerup coordinates after a sparse drag', async id => {
  for (const width of [390, 1280]) {
    const s = await mount(id, width)
    for (let at = 0; at < 3; at++) {
      for (let i = 0; i < (id === 'st-brigids-cross' && at === 0 ? 4 : 1); i++) operate(s, 'sparse')
      expect(s.progress, `${id} step ${at}, ${width}, sparse release`).toEqual(Array.from({ length: at + 1 }, (_, i) => i + 1))
    }
    expect(s.complete).toHaveBeenCalledOnce(); s.instance.dispose()
  }
})

it.each([390, 1280])('mizuhiki accepts the last ordered gate delivered only by pointerup at %ipx', async width => {
  const s = await mount('mizuhiki', width)
  for (let at = 0; at < 2; at++) {
    const points = s.scene.getObjectByName('mizuhiki-path-guide')!.children.filter(o => o.visible && o.name.startsWith('mizuhiki-waypoint-')).map(o => s.project(o.getWorldPosition(new THREE.Vector3())))
    pointer(s.layer, 'pointerdown', points[0]!)
    points.slice(1, -1).forEach(p => pointer(s.layer, 'pointermove', p))
    pointer(s.layer, 'pointerup', points.at(-1)!); s.run()
    expect(s.progress).toEqual(Array.from({ length: at + 1 }, (_, i) => i + 1))
  }
})
it.each(complexPlacements)('%s completes its full physical path at touch and mouse viewport sizes', async id => {
  for (const width of [390, 1280]) {
    const s = await mount(id, width)
    const point = (name: string, anchor: [number, number, number] = [0, 0, 0]) => {
      s.scene.updateMatrixWorld(true)
      return s.project(s.scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)))
    }
    const stroke = (a: Point, points: Point[]) => { pointer(s.layer, 'pointerdown', a); points.forEach(p => pointer(s.layer, 'pointermove', p)); pointer(s.layer, 'pointerup', points.at(-1)!); s.run() }
    for (let at = 0; at < 3; at++) {
      if (id === 'hongsheng-red-string' && at === 0 || id === 'navruz-sumalak' && at === 0) {
        const entry = s.cues()[0]!, a = s.source(entry.object, entry.cue)
        pointer(s.layer, 'pointerdown', a)
        let p = a
        for (let i = 0; i < (id === 'hongsheng-red-string' ? 12 : 8); i++) { p = destination(s, entry.cue); pointer(s.layer, 'pointermove', p) }
        pointer(s.layer, 'pointerup', p); s.run()
      } else if (id === 'italian-ex-voto' && at === 1) {
        const a = point('exvoto-brush-tip'), b = point('exvoto-window-end')
        stroke(a, Array.from({ length: 8 }, (_, i) => [a[0] + (b[0] - a[0]) * (i + 1) / 8, a[1] + (b[1] - a[1]) * (i + 1) / 8]))
      } else if (id === 'diya-oil-lamp' && at === 0) {
        for (let i = 0; i < 3; i++) operate(s)
      } else if (id === 'diya-oil-lamp' && at === 1) {
        stroke(point('diya-held-target'), s.scene.getObjectByName('diya-orbit-guide')!.children.filter(o => o.name.startsWith('diya-orbit-waypoint-')).map(o => point(o.name)))
      } else if (id === 'mizuhiki' && at < 2) {
        const points = s.scene.getObjectByName('mizuhiki-path-guide')!.children.filter(o => o.visible && o.name.startsWith('mizuhiki-waypoint-')).map(o => point(o.name))
        stroke(points[0]!, points.slice(1))
      } else if (id === 'mizuhiki' && at === 2 || id === 'phuang-malai' && at === 2) {
        if (s.cues().length) operate(s)
        const input = s.overlay.querySelector<HTMLInputElement>('input')!
        input.value = '愿一路平安'
        input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); s.run()
      } else if (id === 'phuang-malai') {
        for (let i = 0; i < (at === 0 ? 4 : 1); i++) {
          const entry = s.cues()[0]!, flowers = entry.object as THREE.InstancedMesh, matrix = new THREE.Matrix4()
          flowers.getMatrixAt(0, matrix); s.scene.updateMatrixWorld(true)
          const a = s.project(new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(flowers.matrixWorld))
          if (at < 2) {
            // Pick a visible bud off-centre, but align the cluster's contact
            // anchor rather than that fingertip with the empty ring segment.
            const goal = destination(s, entry.cue)
            let end = a
            pointer(s.layer, 'pointerdown', a)
            for (let n = 0; n < 5 && entry.cue.enabled(); n++) {
              const contact = s.source(entry.object, entry.cue)
              end = [end[0] + goal[0] - contact[0], end[1] + goal[1] - contact[1]]
              pointer(s.layer, 'pointermove', end)
            }
            pointer(s.layer, 'pointerup', end); s.run()
          } else stroke(a, [destination(s, entry.cue)])
        }
      } else if (id === 'chinese-woodblock-print' && at === 0) {
        stroke(point('woodblock-rubbing-grip'), [-.55, 0, .55, 0, -.55, 0, .55].map(x => point('woodblock-paper-back', [x, 0, 0])))
      } else if (id === 'chinese-woodblock-print' && at === 1) {
        const a = point('woodblock-paper-corner'); stroke(a, Array.from({ length: 8 }, (_, i) => [a[0], a[1] - (i + 1) * 8]))
      } else operate(s)
      expect(s.progress, `${id} step ${at}, ${width}`).toEqual(Array.from({ length: at + 1 }, (_, i) => i + 1))
    }
    expect(s.complete).toHaveBeenCalledOnce(); s.instance.dispose()
  }
})

it.each(placements.filter(id => !['omamori-cycle', 'shrine-suzu-bell', 'ema-votive-plaque', 'czech-pilgrim-journal', 'votive-candle-catholic'].includes(id)))('%s accepts a visibly aligned grip after an off-center pick', async id => {
  let exercised = 0
  for (const width of [390, 1280]) for (const at of [0, 1, 2]) {
    const s = await mount(id, width, at, false), entry = s.cues()[0]!
    if (!entry.cue.destination || at === 1 && ['blang-tea', 'hungarian-embroidery-hoop', 'welsh-love-spoon', 'barcelos-clay-rooster', 'sorbian-painted-egg', 'omikuji'].includes(id) || at === 0 && ['chinese-incense', 'bokjori'].includes(id)) { s.instance.dispose(); continue }
    const { object, cue } = entry, a = s.source(object, cue), target = destination(s, cue)
    let end: Point | undefined
    // Stay on the actual source surface, and prove the drag started by observing
    // the marked grip move before testing a drop. Narrow grips use smaller picks.
    for (const offset of [12, -12, 8, -8, 5, -5, 3, -3]) {
      const start: Point = [a[0] + offset, a[1]]
      pointer(s.layer, 'pointerdown', start)
      pointer(s.layer, 'pointermove', [start[0] + 2, start[1]])
      const moved = s.source(object, cue)
      if (Math.hypot(moved[0] - a[0], moved[1] - a[1]) > .5) {
        end = [start[0] + 2, start[1]]
        for (let n = 0; n < 5; n++) {
          if (vi.mocked(s.layer.releasePointerCapture).mock.calls.length) break
          const p = s.source(object, cue)
          end = [end[0] + target[0] - p[0], end[1] + target[1] - p[1]]
          pointer(s.layer, 'pointermove', end)
        }
        break
      }
      pointer(s.layer, 'pointercancel', start)
    }
    expect(end, `${id} ${at} must offer an off-center source`).toBeDefined()
    s.run()
    if (!(id === 'st-brigids-cross' && at === 0)) expect(s.progress, 'the held object arrives before pointerup').toEqual([at + 1])
    pointer(s.layer, 'pointerup', end!); s.run()
    if (id === 'st-brigids-cross' && at === 0) for (let i = 0; i < 3; i++) operate(s)
    expect(s.progress, `${id} step ${at}, ${width}, aligned grip`).toEqual([at + 1])
    exercised++; s.instance.dispose()
  }
  expect(exercised).toBeGreaterThan(0)
})
