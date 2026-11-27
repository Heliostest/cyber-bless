// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import { sceneStepCount } from '@wbr/core'
import { APP_HIDDEN_SCENE_IDS, builtInScenes, isSceneVisibleInApp } from '@wbr/core/daily-scenes'
import {
  getEnvironmentProfile,
  getEnvironmentRiverbedY,
  getEnvironmentSurfaceY,
} from '@wbr/scene-runtime'
import type { SceneContext, SceneInstance } from './contract'
import { isSceneImplemented, loadScene } from './registry'

const rendered = vi.hoisted(() => ({ scene: null as THREE.Scene | null }))

vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    constructor(options?: { canvas?: HTMLCanvasElement }) {
      this.domElement = options?.canvas ?? document.createElement('canvas')
    }
    setSize() {}
    setPixelRatio() {}
    setClearColor() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})

vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene
    return {
      setStyle() {},
      resize() {},
      dispose() {},
      render() {
        scene.updateMatrixWorld(true)
        camera.updateMatrixWorld(true)
      },
    }
  },
}))

const instances: SceneInstance[] = []

function createMock2dContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} }
  const noop = () => {}
  return {
    fillStyle: '#000',
    strokeStyle: '#000',
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    setTransform: noop,
    resetTransform: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    rect: noop,
    roundRect: noop,
    clip: noop,
    fill: noop,
    stroke: noop,
    setLineDash: noop,
    drawImage: noop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText(text: string) {
      return { width: Array.from(text).length * 20 }
    },
    getImageData(_x: number, _y: number, w: number, h: number) {
      return { data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4), width: w, height: h }
    },
    putImageData: noop,
  } as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  const context = createMock2dContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    ((kind: string) => (kind === '2d' ? context : null)) as HTMLCanvasElement['getContext'],
  )
})

afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren()
  rendered.scene = null
  vi.restoreAllMocks()
})

async function mountScene(id: string, initialProgress = 0, overrides: Partial<SceneContext> = {}) {
  const host = document.createElement('div')
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  overlay.className = 'scene-overlay-host'
  host.append(canvas, overlay)
  document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 560 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 560 }) as DOMRect

  const module = await loadScene(id)
  const instance = module.create({
    canvas,
    overlay,
    gestures: Gestures,
    shared: Shared,
    sceneId: id,
    initialProgress,
    isActive: () => true,
    isReducedMotion: () => true,
    isSoundEnabled: () => false,
    ...overrides,
  })
  instances.push(instance)
  instance.start()
  instance.update(0)
  const scene = rendered.scene!
  expect(scene, `${id} should mount a THREE.Scene`).toBeTruthy()
  scene.updateMatrixWorld(true)
  return { instance, scene, overlay }
}

function isEffectivelyVisible(object: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = object
  while (cur) {
    if (!cur.visible) return false
    cur = cur.parent
  }
  return true
}

function isEffectSubtree(object: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = object
  while (cur) {
    if (cur.userData?.effect === true) return true
    cur = cur.parent
  }
  return false
}

function isGroundedSupportCandidate(mesh: THREE.Mesh): boolean {
  if (!isEffectivelyVisible(mesh)) return false
  if (isEffectSubtree(mesh)) return false
  if (mesh.name === 'stylized-water-surface' || mesh.name === 'stylized-water-caustic-bed') return false
  const pos = mesh.geometry?.getAttribute('position')
  if (!pos || pos.count === 0) return false
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (materials.length === 0) return false
  if (materials.every(mat => mat instanceof THREE.ShadowMaterial)) return false
  if (materials.every(mat => mat.visible === false)) return false
  if (materials.every(mat => mat.transparent && mat.opacity <= 0.05)) return false
  if (materials.every(mat => (mat instanceof THREE.ShaderMaterial || mat instanceof THREE.RawShaderMaterial) && mat.transparent && mat.depthWrite === false)) {
    return false
  }
  if (materials.every(mat => mat.userData?.waterRendering === true)) return false
  if (materials.every(mat => mat instanceof THREE.MeshBasicMaterial && mat.transparent && mat.depthWrite === false)) {
    return false
  }
  return true
}

const _vertex = new THREE.Vector3()
const _instanceMatrix = new THREE.Matrix4()
const _worldMatrix = new THREE.Matrix4()

/** Exact world-space bounding box of a single mesh's own geometry (ignoring children). */
function ownMeshWorldBox(mesh: THREE.Mesh): THREE.Box3 {
  const box = new THREE.Box3()
  const pos = mesh.geometry.getAttribute('position')
  if (!pos || pos.count === 0) return box

  if (mesh instanceof THREE.InstancedMesh) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const localBox = mesh.geometry.boundingBox!
    const tmpBox = new THREE.Box3()
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, _instanceMatrix)
      _worldMatrix.multiplyMatrices(mesh.matrixWorld, _instanceMatrix)
      tmpBox.copy(localBox).applyMatrix4(_worldMatrix)
      box.union(tmpBox)
    }
    return box
  }

  for (let i = 0; i < pos.count; i++) {
    _vertex.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    box.expandByPoint(_vertex)
  }
  return box
}

/** Exact world-space union of all visible non-effect meshes inside an Object3D subtree. */
function visibleSubtreeBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3()
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh && isGroundedSupportCandidate(obj)) {
      box.union(ownMeshWorldBox(obj))
    }
  })
  return box
}

function measureLowestGroundedSupport(scene: THREE.Scene) {
  let minY = Infinity
  let lowestMesh = ''
  let count = 0
  scene.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) || !isGroundedSupportCandidate(obj)) return
    const box = ownMeshWorldBox(obj)
    if (box.isEmpty() || !Number.isFinite(box.min.y)) return
    count++
    if (box.min.y < minY) {
      minY = box.min.y
      lowestMesh = obj.name || obj.parent?.name || obj.geometry.type
    }
  })
  return { minY, lowestMesh, count }
}

const MAX_FLOATING_GAP_M = 0.01

/**
 * Tiny explicit airborne / river-environment whitelist (Audit §二.8 & §四.P2 #7):
 * - `crane`: intentionally folds in mid-air above the shared `table` surface (-0.665).
 * - `slavic-wreath`: river bank bonfire + wide water surface spanning between `|x| = 2.5` banks.
 * - `floating-lantern-loy-krathong`: wooden dock pilings anchored into riverbed (`floor - 0.30`).
 * - `udo-undama`: coastal rock and pickup ledge anchored below sea level (`floor = -0.04`).
 */
const GROUNDING_SPECIAL_CASES = new Set([
  'crane',
  'slavic-wreath',
  'floating-lantern-loy-krathong',
  'udo-undama',
])

/**
 * Scenes whose completed state hangs strictly from an overhead architectural eave
 * after the grounded floor preparation stand is retired (initial checkpoint `0` still
 * enforces the strict `<= 1.0 cm` floor grounding gate).
 */
const OVERHEAD_COMPLETED_SCENES = new Set(['furin-wind-chime'])

const visibleEntries = builtInScenes.filter(isSceneVisibleInApp)
const proceduralVisibleEntries = visibleEntries.filter(entry => entry.engine !== 'woodfish@1')
const standardGroundedEntries = proceduralVisibleEntries.filter(entry => !GROUNDING_SPECIAL_CASES.has(entry.id))

/**
 * Hidden-scene stand remediation tracker (Audit §四.P2 #6 & §五):
 * Before promoting any hidden scene out of `APP_HIDDEN_SCENE_IDS`, its stand gap below must be
 * remediated (and once removed from `APP_HIDDEN_SCENE_IDS`, it automatically enters the 91-scene
 * `<= 1.0 cm` grounding sweep above).
 */
const HIDDEN_FLOATING_OVERHEAD_BOARDS = [
  'faroese-wool-knit',
  'niue-shell-necklace',
  'polish-paper-cut',
] as const

const HIDDEN_MIDAIR_PROPS = [
  'chinese-diabolo',
  'chinese-rattle-drum',
  'chinese-steelyard',
  'czech-wooden-ratchet',
  'indonesian-angklung',
  'japanese-daruma-otoshi',
  'paper-pinwheel',
  'puerto-rican-guiro',
  'valencian-folding-fan',
  'weifang-paper-kite',
  'welsh-drop-spindle',
] as const

const HIDDEN_BARE_SAND_INDOOR_TOOLS = [
  'chinese-suanpan',
  'english-hearth-bellows',
  'finnish-kantele',
  'french-coffee-mill',
  'ghanaian-oware',
  'indian-charkha',
  'irish-bodhran',
  'japanese-wagasa',
  'malawi-sansi',
  'mexican-molinillo',
  'mexican-tortilla-press',
  'scottish-plunge-churn',
  'spanish-castanets',
] as const

describe('ritual stands grounding catalog coverage', () => {
  it('covers all 91 App-visible scenes (90 procedural + woodfish) and all 67 hidden scenes', () => {
    expect(builtInScenes).toHaveLength(158)
    expect(visibleEntries).toHaveLength(91)
    expect(proceduralVisibleEntries).toHaveLength(90)
    expect(visibleEntries.filter(entry => entry.engine === 'woodfish@1').map(e => e.id)).toEqual(['woodfish'])
    expect(APP_HIDDEN_SCENE_IDS).toHaveLength(67)

    for (const entry of visibleEntries) {
      expect(getEnvironmentProfile(entry.id), `missing environment profile for ${entry.id}`).toBeDefined()
      if (entry.engine !== 'woodfish@1') {
        expect(isSceneImplemented(entry.id), `unimplemented visible scene ${entry.id}`).toBe(true)
      }
    }
    expect(getEnvironmentSurfaceY('woodfish')).toBeCloseTo(-0.945, 6)
  })
})

describe('strict <= 1.0 cm grounding sweep across all standard App-visible procedural scenes', () => {
  it.each(
    standardGroundedEntries.map(entry => ({
      id: entry.id,
      completedCheckpoint: sceneStepCount(entry),
    })),
  )('grounds $id within <= 1.0 cm of getEnvironmentSurfaceY at initial (0) and completed ($completedCheckpoint)', async ({
    id,
    completedCheckpoint,
  }) => {
    const profile = getEnvironmentProfile(id)!
    const surfaceY = getEnvironmentSurfaceY(id)

    const checkpoints = OVERHEAD_COMPLETED_SCENES.has(id) ? [0] : [0, completedCheckpoint]
    for (const checkpoint of checkpoints) {
      const { scene } = await mountScene(id, checkpoint)
      const { minY, lowestMesh, count } = measureLowestGroundedSupport(scene)
      expect(count, `${id}@${checkpoint} must contain visible support meshes`).toBeGreaterThan(0)

      const floatingGap = minY - surfaceY
      expect(
        floatingGap,
        `${id}@${checkpoint} floats ${(floatingGap * 100).toFixed(2)} cm above ${profile.kind} surfaceY=${surfaceY.toFixed(4)} (minY=${minY.toFixed(4)}, lowest=${lowestMesh})`,
      ).toBeLessThanOrEqual(MAX_FLOATING_GAP_M)

      // Never hover at legacy y = 0 when the authored environment sits deeper than -2.5 cm.
      if (profile.floor < -0.025 && profile.kind !== 'river') {
        expect(
          minY,
          `${id}@${checkpoint} still hovers near legacy y=0 (minY=${minY.toFixed(4)}, floor=${profile.floor})`,
        ).toBeLessThan(-0.005)
      }

      instances.splice(0).forEach(instance => instance.dispose())
      document.body.replaceChildren()
      rendered.scene = null
    }

    if (id === 'furin-wind-chime') {
      // Completed checkpoint hangs from the framed overhead eave beam (floor prep stand intentionally hidden).
      const { scene } = await mountScene(id, completedCheckpoint)
      expect(scene.getObjectByName('furin-eave-fascia')).toBeTruthy()
      expect(scene.getObjectByName('furin-eave-end-left')).toBeTruthy()
      expect(scene.getObjectByName('furin-eave-end-right')).toBeTruthy()
      expect(scene.getObjectByName('furin-pivot')).toBeTruthy()
      const { minY, count } = measureLowestGroundedSupport(scene)
      expect(count).toBeGreaterThan(0)
      expect(minY).toBeGreaterThan(0.8)
    }
  })
})

describe('whitelisted airborne and river/coastal visible scenes', () => {
  it('crane keeps airborne folding origami intentionally above the shared table surface', async () => {
    const tableSurfaceY = getEnvironmentSurfaceY('crane')
    expect(tableSurfaceY).toBeCloseTo(-0.665, 6)
    for (const checkpoint of [0, 3]) {
      const { scene } = await mountScene('crane', checkpoint)
      const { minY, count } = measureLowestGroundedSupport(scene)
      expect(count).toBeGreaterThan(0)
      expect(minY).toBeGreaterThan(tableSurfaceY + 0.5)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }
  })

  it('slavic-wreath spans >= 5.0 m across the river banks and grounds the riverside bonfire mound', async () => {
    const bankSurfaceY = getEnvironmentSurfaceY('slavic-wreath')
    for (const checkpoint of [0, 3]) {
      const { scene } = await mountScene('slavic-wreath', checkpoint)
      const water = scene.getObjectByName('stylized-water-surface') as THREE.Mesh
      expect(water).toBeTruthy()
      const waterBox = ownMeshWorldBox(water)
      expect(waterBox.max.x - waterBox.min.x).toBeGreaterThanOrEqual(5.0)
      expect(waterBox.min.x).toBeLessThanOrEqual(-2.5)
      expect(waterBox.max.x).toBeGreaterThanOrEqual(2.5)

      const { minY } = measureLowestGroundedSupport(scene)
      expect(minY).toBeLessThanOrEqual(bankSurfaceY + MAX_FLOATING_GAP_M)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }
  })

  it('floating-lantern-loy-krathong anchors dock pilings into riverbed, joins left bank, and seats boat on dock', async () => {
    const riverbedY = getEnvironmentRiverbedY('floating-lantern-loy-krathong')
    const { scene } = await mountScene('floating-lantern-loy-krathong', 0)

    const posts: THREE.Mesh[] = []
    const boards: THREE.Mesh[] = []
    scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj.name === 'krathong-dock-post') posts.push(obj)
      if (obj.name === 'krathong-dock-board') boards.push(obj)
    })
    expect(posts.length).toBeGreaterThanOrEqual(4)
    expect(boards.length).toBeGreaterThanOrEqual(4)

    for (const post of posts) {
      expect(ownMeshWorldBox(post).min.y).toBeLessThanOrEqual(riverbedY + MAX_FLOATING_GAP_M)
    }

    const dockBox = new THREE.Box3()
    for (const board of boards) dockBox.union(ownMeshWorldBox(board))
    // Left river bank edge begins at x = -2.5; dock planking must reach into it.
    expect(dockBox.min.x).toBeLessThanOrEqual(-2.5)

    const boat = scene.getObjectByName('krathong-boat')!
    const boatBox = visibleSubtreeBox(boat)
    expect(Math.abs(boatBox.min.y - dockBox.max.y)).toBeLessThanOrEqual(MAX_FLOATING_GAP_M)
  })

  it('udo-undama anchors coastal turtle rock and pickup ledge below sea level', async () => {
    const seaSurfaceY = getEnvironmentSurfaceY('udo-undama')
    const { scene } = await mountScene('udo-undama', 0)
    const rock = scene.getObjectByName('undama-rock') as THREE.Mesh
    const ledge = scene.getObjectByName('undama-ledge') as THREE.Mesh
    expect(rock).toBeTruthy()
    expect(ledge).toBeTruthy()
    expect(ownMeshWorldBox(rock).min.y).toBeLessThanOrEqual(seaSurfaceY - 0.2)
    expect(ownMeshWorldBox(ledge).min.y).toBeLessThanOrEqual(seaSurfaceY - 0.2)
  })
})

describe('Top-15 formerly broken prop-to-stand contacts and P2 ritual stands', () => {
  it('tibetan-wheel grounds all prayer-wheel posts, sills, and feet <= -0.025', async () => {
    const { scene } = await mountScene('tibetan-wheel', 0)
    const posts: THREE.Mesh[] = []
    const feet: THREE.Mesh[] = []
    scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj.name === 'tibetan-wheel-post') posts.push(obj)
      if (obj.name === 'tibetan-wheel-foot') feet.push(obj)
    })
    expect(posts).toHaveLength(6)
    expect(feet).toHaveLength(6)
    for (const mesh of [...posts, ...feet]) {
      expect(ownMeshWorldBox(mesh).min.y).toBeLessThanOrEqual(-0.025)
    }
  })

  it('milagros grounds board feet and tray <= -0.030, bridges pin shaft to wall, and seats charms on liner', async () => {
    const { scene } = await mountScene('milagros', 0)
    const feet: THREE.Mesh[] = []
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.name === 'milagros-board-foot') feet.push(obj)
    })
    expect(feet).toHaveLength(2)
    for (const foot of feet) {
      expect(ownMeshWorldBox(foot).min.y).toBeLessThanOrEqual(-0.030)
    }

    const trayBase = scene.getObjectByName('milagros-tray-base') as THREE.Mesh
    const liner = scene.getObjectByName('milagros-tray-liner') as THREE.Mesh
    const pinShaft = scene.getObjectByName('milagros-pin-shaft') as THREE.Mesh
    const pin = scene.getObjectByName('milagros-pin') as THREE.Mesh
    expect(trayBase).toBeTruthy()
    expect(liner).toBeTruthy()
    expect(pinShaft).toBeTruthy()
    expect(pin).toBeTruthy()

    expect(ownMeshWorldBox(trayBase).min.y).toBeLessThanOrEqual(-0.030)
    const shaftBox = ownMeshWorldBox(pinShaft)
    const pinBox = ownMeshWorldBox(pin)
    // Shaft connects panel face (z <= 0.035) all the way to the hanging pin sphere.
    expect(shaftBox.min.z).toBeLessThanOrEqual(0.036)
    expect(shaftBox.max.z).toBeGreaterThanOrEqual(pinBox.min.z - 0.002)

    const linerTopY = ownMeshWorldBox(liner).max.y
    for (let i = 0; i < 4; i++) {
      const charm = scene.getObjectByName(`milagros-charm-${i}`)!
      const charmMinY = visibleSubtreeBox(charm).min.y
      expect(charmMinY).toBeGreaterThanOrEqual(linerTopY - 0.003)
      expect(charmMinY).toBeLessThanOrEqual(linerTopY + 0.005)
    }
  })

  it('bokjori grounds timber wall and stand feet <= -0.030 and seats peg into wall', async () => {
    const { scene } = await mountScene('bokjori', 0)
    const wall = scene.getObjectByName('bokjori-timber-wall')!
    const peg = scene.getObjectByName('bokjori-wall-peg') as THREE.Mesh
    const tray = scene.getObjectByName('bokjori-rice-tray')!
    expect(wall).toBeTruthy()
    expect(peg).toBeTruthy()
    expect(tray).toBeTruthy()

    const wallBox = visibleSubtreeBox(wall)
    expect(wallBox.min.y).toBeLessThanOrEqual(-0.030)

    const standFeet: THREE.Mesh[] = []
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.name === 'bokjori-stand-foot') standFeet.push(obj)
    })
    expect(standFeet).toHaveLength(2)
    for (const foot of standFeet) expect(ownMeshWorldBox(foot).min.y).toBeLessThanOrEqual(-0.030)

    // Wall peg must penetrate back into the timber wall face (no 13.25 cm mid-air gap).
    const pegBox = ownMeshWorldBox(peg)
    expect(pegBox.min.z).toBeLessThanOrEqual(wallBox.max.z + 0.005)
    expect(visibleSubtreeBox(tray).min.y).toBeLessThanOrEqual(0.305)
  })

  it('italian-ex-voto keeps easel rear leg tilted backward (rotation.x > 0) and grounded on tabletop', async () => {
    const { scene } = await mountScene('italian-ex-voto', 0)
    const backLeg = scene.getObjectByName('exvoto-easel-back-leg') as THREE.Mesh
    const tableTop = scene.getObjectByName('exvoto-table-top')!
    expect(backLeg).toBeTruthy()
    expect(tableTop).toBeTruthy()
    expect(backLeg.rotation.x).toBeGreaterThan(0)
    const legBox = ownMeshWorldBox(backLeg)
    const tableTopY = visibleSubtreeBox(tableTop).max.y
    expect(Math.abs(legBox.min.y - tableTopY)).toBeLessThanOrEqual(0.025)
  })

  it('diya-oil-lamp seats all 3 clay diyas on the tray inner floor within <= 3 mm', async () => {
    const trayInnerFloorY = 0.073
    const groundY = getEnvironmentSurfaceY('diya-oil-lamp')
    for (const checkpoint of [0, 3]) {
      const { scene } = await mountScene('diya-oil-lamp', checkpoint)
      const plateBody = scene.getObjectByName('diya-plate-body') as THREE.Mesh
      expect(plateBody).toBeTruthy()
      expect(ownMeshWorldBox(plateBody).min.y).toBeLessThanOrEqual(groundY + 0.003)
      for (let i = 0; i < 3; i++) {
        const dish = scene.getObjectByName(`diya-dish-${i}`) as THREE.Mesh
        expect(dish).toBeTruthy()
        expect(Math.abs(ownMeshWorldBox(dish).min.y - trayInnerFloorY)).toBeLessThanOrEqual(0.003)
      }
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }
  })

  it('votive-candle-catholic keeps lower candle flames clear of upper steel shelf and hero candle inside shelf', async () => {
    const { scene } = await mountScene('votive-candle-catholic', 3)
    const lowerShelf = scene.getObjectByName('votive-lower-shelf') as THREE.Mesh
    const upperShelf = scene.getObjectByName('votive-upper-shelf') as THREE.Mesh
    const mainCandle = scene.getObjectByName('votive-main-candle')!
    expect(lowerShelf).toBeTruthy()
    expect(upperShelf).toBeTruthy()
    expect(mainCandle).toBeTruthy()

    const upperBox = ownMeshWorldBox(upperShelf)
    const lowerBox = ownMeshWorldBox(lowerShelf)
    // Lower tier is stepped forward clear of upper steel plate so flames rise into open air.
    expect(lowerBox.min.z).toBeGreaterThanOrEqual(upperBox.max.z - 0.02)

    // Verify all 4 background lower candles (direct Group children of world with scale < 1) never intersect upperBox.
    let lowerCandlesChecked = 0
    scene.traverse(obj => {
      if (obj instanceof THREE.Group && obj.name === '' && obj.scale.x > 0.4 && obj.scale.x < 0.7 && obj.position.y > 0.35 && obj.position.y < 0.45) {
        lowerCandlesChecked++
        const candleBox = visibleSubtreeBox(obj)
        expect(candleBox.intersectsBox(upperBox), `lower candle at x=${obj.position.x} intersects upper shelf`).toBe(false)
      }
    })
    expect(lowerCandlesChecked).toBe(4)

    // Hero placed candle must rest inside upper shelf's Z bounds without overhanging the front lip.
    const mainBox = visibleSubtreeBox(mainCandle)
    expect(mainBox.max.z).toBeLessThanOrEqual(upperBox.max.z)
    expect(mainBox.min.z).toBeGreaterThanOrEqual(upperBox.min.z)
  })

  it('lanna-sand-pagoda keeps preparation flag holder strictly inside the widened sand bed radius', async () => {
    const { scene } = await mountScene('lanna-sand-pagoda', 0)
    const sandBed = scene.getObjectByName('lanna-sand-bed') as THREE.Mesh
    const holderBase = scene.getObjectByName('lanna-holder-base') as THREE.Mesh
    const pole = scene.getObjectByName('lanna-pole') as THREE.Mesh
    expect(sandBed).toBeTruthy()
    expect(holderBase).toBeTruthy()
    expect(pole).toBeTruthy()

    const bedParams = (sandBed.geometry as THREE.CylinderGeometry).parameters
    const sandTopRadius = bedParams.radiusTop
    const holderBox = ownMeshWorldBox(holderBase)
    const holderCenter = holderBox.getCenter(new THREE.Vector3())
    const holderRadius = Math.max(holderBox.max.x - holderBox.min.x, holderBox.max.z - holderBox.min.z) * 0.5
    const maxRadialExtent = Math.hypot(holderCenter.x, holderCenter.z) + holderRadius
    expect(maxRadialExtent).toBeLessThan(sandTopRadius)

    // Pole seats cleanly atop holder base without hovering.
    expect(Math.abs(ownMeshWorldBox(pole).min.y - holderBox.max.y)).toBeLessThanOrEqual(0.005)
  })

  it('st-brigids-cross grounds frame/table and extends lintel peg forward to contact the hung cross loop', async () => {
    const { scene } = await mountScene('st-brigids-cross', 3)
    const peg = scene.getObjectByName('brigid-lintel-peg') as THREE.Mesh
    const pegTip = scene.getObjectByName('brigid-peg-tip') as THREE.Mesh
    expect(peg).toBeTruthy()
    expect(pegTip).toBeTruthy()
    const pegBox = ownMeshWorldBox(peg).union(ownMeshWorldBox(pegTip))
    // Hung rush cross loop hangs at z = 0.2656; peg must extend cleanly to/past it.
    expect(pegBox.max.z).toBeGreaterThanOrEqual(0.265)
    expect(pegBox.min.z).toBeLessThanOrEqual(0.025)
  })

  it('polish-blessing-basket grounds oak table and seats basket, saucer, and board flush on tabletop', async () => {
    const { scene } = await mountScene('polish-blessing-basket', 0)
    const table = scene.getObjectByName('basket-table')!
    const basket = scene.getObjectByName('basket-woven')!
    const saucer = scene.getObjectByName('basket-egg-saucer') as THREE.Mesh
    const board = scene.getObjectByName('basket-bread-board') as THREE.Mesh
    const tableBox = visibleSubtreeBox(table)
    expect(tableBox.min.y).toBeLessThanOrEqual(-0.030)
    const tableTopY = tableBox.max.y
    expect(Math.abs(visibleSubtreeBox(basket).min.y - tableTopY)).toBeLessThanOrEqual(0.005)
    expect(Math.abs(ownMeshWorldBox(saucer).min.y - tableTopY)).toBeLessThanOrEqual(0.005)
    expect(Math.abs(ownMeshWorldBox(board).min.y - tableTopY)).toBeLessThanOrEqual(0.005)
  })

  it('korean-bojagi-wrap grounds woven mat and seats gift box flush atop it', async () => {
    const { scene } = await mountScene('korean-bojagi-wrap', 0)
    const mat = scene.getObjectByName('bojagi-woven-mat') as THREE.Mesh
    const parcel = scene.getObjectByName('bojagi-parcel') as THREE.Mesh
    const matBox = ownMeshWorldBox(mat)
    const parcelBox = ownMeshWorldBox(parcel)
    expect(matBox.min.y).toBeLessThanOrEqual(-0.030)
    expect(parcelBox.min.y - matBox.max.y).toBeLessThanOrEqual(0.015)
  })

  it('phuang-malai grounds pedestal and provides raised garland cradle above pedestal top', async () => {
    const { scene } = await mountScene('phuang-malai', 3)
    const pedestalTop = scene.getObjectByName('pedestal-top') as THREE.Mesh
    const displayStand = scene.getObjectByName('garland-display-stand')!
    expect(pedestalTop).toBeTruthy()
    expect(displayStand).toBeTruthy()
    const { minY } = measureLowestGroundedSupport(scene)
    expect(minY).toBeLessThanOrEqual(getEnvironmentSurfaceY('phuang-malai') + 0.003)
    const topMaxY = ownMeshWorldBox(pedestalTop).max.y
    const standBox = visibleSubtreeBox(displayStand)
    expect(standBox.min.y).toBeLessThanOrEqual(topMaxY + 0.003)
    expect(standBox.max.y).toBeGreaterThan(topMaxY + 0.4)
  })

  it('clootie-well-rag grounds stone well and old tree roots and seats tie target on low branch surface', async () => {
    const { scene } = await mountScene('clootie-well-rag', 3)
    const groundY = getEnvironmentSurfaceY('clootie-well-rag')
    const well = scene.getObjectByName('clootie-stone-well')!
    const tree = scene.getObjectByName('clootie-old-tree')!
    const target = scene.getObjectByName('clootie-branch-target')!
    expect(well).toBeTruthy()
    expect(tree).toBeTruthy()
    expect(target).toBeTruthy()
    expect(visibleSubtreeBox(well).min.y).toBeLessThanOrEqual(groundY + 0.005)
    expect(visibleSubtreeBox(tree).min.y).toBeLessThanOrEqual(groundY + 0.005)
    // Branch front face near x=0.12 lies around z=0.097..0.111 (fixing old +4.6 cm z=0.158 detachment).
    expect(target.getWorldPosition(new THREE.Vector3()).z).toBeLessThanOrEqual(0.115)
  })

  it('P2 ritual stands (mizuhiki, kagami-mochi-offering, kagami-biraki-sake, persian-esfand, polish-oplatek-sharing, bulgarian-survakane) ground cleanly', async () => {
    // mizuhiki: wooden tray bridges veranda (-0.035) to washi packet (0.032).
    {
      const { scene } = await mountScene('mizuhiki', 0)
      const stand = scene.getObjectByName('mizuhiki-stand-cradle')!
      expect(stand).toBeTruthy()
      const standBox = visibleSubtreeBox(stand)
      expect(standBox.min.y).toBeLessThanOrEqual(getEnvironmentSurfaceY('mizuhiki') + 0.003)
      expect(standBox.max.y).toBeGreaterThanOrEqual(0.032)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }

    // kagami-mochi-offering: footed low wooden stand grounded at -0.1025 with top at y = 0.
    {
      const { scene } = await mountScene('kagami-mochi-offering', 0)
      const stand = scene.getObjectByName('kagami-low-wood-base-furniture')!
      expect(stand).toBeTruthy()
      const standBox = visibleSubtreeBox(stand)
      expect(standBox.min.y).toBeLessThanOrEqual(getEnvironmentSurfaceY('kagami-mochi-offering') + 0.003)
      expect(Math.abs(standBox.max.y)).toBeLessThanOrEqual(0.005)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }

    // kagami-biraki-sake: cask stand & mallet tray grounded at -0.012; mallet rests on tray at step 3.
    {
      const { scene } = await mountScene('kagami-biraki-sake', 3)
      const surfaceY = getEnvironmentSurfaceY('kagami-biraki-sake')
      const caskStand = scene.getObjectByName('cask-stand-furniture')!
      const malletTray = scene.getObjectByName('mallet-tray-cradle')!
      const malletHead = scene.getObjectByName('mallet-head') as THREE.Mesh
      expect(caskStand).toBeTruthy()
      expect(malletTray).toBeTruthy()
      expect(visibleSubtreeBox(caskStand).min.y).toBeLessThanOrEqual(surfaceY + 0.003)
      const trayBox = visibleSubtreeBox(malletTray)
      expect(trayBox.min.y).toBeLessThanOrEqual(surfaceY + 0.003)
      const headBox = ownMeshWorldBox(malletHead)
      expect(headBox.min.y).toBeGreaterThanOrEqual(trayBox.min.y)
      expect(headBox.min.y).toBeLessThanOrEqual(trayBox.max.y + 0.005)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }

    // persian-esfand: hearth table grounded at +0.0175.
    {
      const { scene } = await mountScene('persian-esfand', 0)
      const table = scene.getObjectByName('esfand-hearth-table-furniture')!
      expect(table).toBeTruthy()
      expect(visibleSubtreeBox(table).min.y).toBeLessThanOrEqual(getEnvironmentSurfaceY('persian-esfand') + 0.003)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }

    // polish-oplatek-sharing: festive dining table grounded at +0.0175.
    {
      const { scene } = await mountScene('polish-oplatek-sharing', 0)
      const table = scene.getObjectByName('oplatek-table-furniture')!
      expect(table).toBeTruthy()
      expect(visibleSubtreeBox(table).min.y).toBeLessThanOrEqual(getEnvironmentSurfaceY('polish-oplatek-sharing') + 0.003)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }

    // bulgarian-survakane: branch side stand grounded at -0.0475 supporting branch at steps 0 and 3.
    for (const checkpoint of [0, 3]) {
      const { scene } = await mountScene('bulgarian-survakane', checkpoint)
      const stand = scene.getObjectByName('surva-branch-stand-pedestal')!
      const branch = scene.getObjectByName('surva-branch-root')!
      expect(stand).toBeTruthy()
      expect(branch).toBeTruthy()
      const standBox = visibleSubtreeBox(stand)
      expect(standBox.min.y).toBeLessThanOrEqual(getEnvironmentSurfaceY('bulgarian-survakane') + 0.003)
      const branchBox = visibleSubtreeBox(branch)
      // Branch base rests seated in the stand socket (y = 0.16), overlapping the upright rest cradle.
      expect(branchBox.min.y).toBeLessThanOrEqual(standBox.max.y)
      expect(branchBox.min.y).toBeGreaterThanOrEqual(standBox.min.y)
      instances.splice(0).forEach(i => i.dispose())
      document.body.replaceChildren()
    }
  })
})

describe('hidden-scene re-enablement gate (Audit P2 #6)', () => {
  it('keeps all 3 unremediated hidden-scene stand categories gated inside APP_HIDDEN_SCENE_IDS', () => {
    const hiddenSet = new Set<string>(APP_HIDDEN_SCENE_IDS)
    const builtInSet = new Set(builtInScenes.map(entry => entry.id))

    const categories: readonly [string, readonly string[]][] = [
      ['9x7 legless floating overhead boards (3 scenes)', HIDDEN_FLOATING_OVERHEAD_BOARDS],
      ['mid-air floating props without stand or hand (11 scenes)', HIDDEN_MIDAIR_PROPS],
      ['indoor tools/instruments bare on outdoor garden sand (13 scenes)', HIDDEN_BARE_SAND_INDOOR_TOOLS],
    ]

    expect(HIDDEN_FLOATING_OVERHEAD_BOARDS).toHaveLength(3)
    expect(HIDDEN_MIDAIR_PROPS).toHaveLength(11)
    expect(HIDDEN_BARE_SAND_INDOOR_TOOLS).toHaveLength(13)

    const seen = new Set<string>()
    for (const [label, ids] of categories) {
      for (const id of ids) {
        expect(seen.has(id), `duplicate hidden remediation entry: ${id}`).toBe(false)
        seen.add(id)
        expect(builtInSet.has(id), `${id} (${label}) must exist in builtInScenes`).toBe(true)
        expect(
          hiddenSet.has(id),
          `${id} belongs to "${label}" — remediate its stand and remove it from this gate before promoting out of APP_HIDDEN_SCENE_IDS`,
        ).toBe(true)
      }
    }
  })
})
