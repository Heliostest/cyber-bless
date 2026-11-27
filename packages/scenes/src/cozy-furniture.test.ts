import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getEnvironmentProfile, getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import {
  CRAFT_TABLE_SCENE_IDS,
  addContactShadow,
  addCraftTable,
  addObjectCradle,
  addOfferingTable,
  addRoundLowTable,
  addSteppedPedestal,
  type TimberFinish,
} from './cozy-furniture'

function assertFiniteGeometry(root: THREE.Object3D) {
  let meshCount = 0
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    meshCount++
    const pos = obj.geometry.getAttribute('position')
    expect(pos.count, obj.name).toBeGreaterThan(0)
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i)), `${obj.name}.x[${i}]`).toBe(true)
      expect(Number.isFinite(pos.getY(i)), `${obj.name}.y[${i}]`).toBe(true)
      expect(Number.isFinite(pos.getZ(i)), `${obj.name}.z[${i}]`).toBe(true)
    }
    const norm = obj.geometry.getAttribute('normal')
    if (norm) {
      for (let i = 0; i < norm.count; i++) {
        expect(Number.isFinite(norm.getX(i)), `${obj.name}.nx[${i}]`).toBe(true)
        expect(Number.isFinite(norm.getY(i)), `${obj.name}.ny[${i}]`).toBe(true)
        expect(Number.isFinite(norm.getZ(i)), `${obj.name}.nz[${i}]`).toBe(true)
      }
    }
  })
  expect(meshCount).toBeGreaterThan(0)
}

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    geometries.add(obj.geometry)
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach(mat => materials.add(mat))
  })
  geometries.forEach(g => g.dispose())
  materials.forEach(m => m.dispose())
}

describe('addCraftTable grounding and joined leg fix', () => {
  it('maps all 21 authored craft-table names to valid environment profiles', () => {
    const entries = Object.entries(CRAFT_TABLE_SCENE_IDS)
    expect(entries).toHaveLength(21)
    for (const [tableName, sceneId] of entries) {
      expect(getEnvironmentProfile(sceneId), `${tableName} -> ${sceneId}`).toBeDefined()
    }
  })

  it('resolves groundY in strict precedence: explicit groundY -> sceneId -> ancestor userData -> table-name map -> 0', () => {
    const scene = new THREE.Scene()
    scene.userData.environmentSurfaceY = -0.123
    const world = new THREE.Group()
    scene.add(world)

    // 1. Explicit groundY (including 0) wins over everything.
    const explicit = addCraftTable(world, {
      name: 'spoon-table',
      sceneId: 'croatian-licitar-heart',
      groundY: 0,
      width: 3.1,
      depth: 1.6,
      surfaceY: 0.76,
      thickness: 0.12,
    })
    expect(explicit.groundY).toBe(0)
    expect(explicit.root.position.y).toBe(0)

    // 2. sceneId wins over ancestor scene.userData and CRAFT_TABLE_SCENE_IDS.
    const bySceneId = addCraftTable(world, {
      name: 'spoon-table',
      sceneId: 'croatian-licitar-heart',
      width: 3.1,
      depth: 1.6,
      surfaceY: 0.76,
      thickness: 0.12,
    })
    expect(bySceneId.groundY).toBeCloseTo(-0.0225, 6)

    // 3. Ancestor scene.userData.environmentSurfaceY wins over table-name map.
    const byAncestor = addCraftTable(world, {
      name: 'spoon-table',
      width: 3.1,
      depth: 1.6,
      surfaceY: 0.76,
      thickness: 0.12,
    })
    expect(byAncestor.groundY).toBeCloseTo(-0.123, 6)

    // 4. Table-name map auto-grounds without scene environment (e.g. mocked unit tests).
    const orphan = new THREE.Group()
    const byMap = addCraftTable(orphan, {
      name: 'licitar-table',
      width: 3.24,
      depth: 1.66,
      surfaceY: 0.76,
      thickness: 0.12,
      support: 'joined',
      finish: 'birch',
    })
    expect(byMap.groundY).toBeCloseTo(getEnvironmentSurfaceY('croatian-licitar-heart'), 6)

    // 5. Unknown table name with no scene metadata falls back to 0.
    const fallback = addCraftTable(orphan, {
      name: 'custom-table',
      width: 2.4,
      depth: 1.4,
      surfaceY: 0.72,
      thickness: 0.1,
    })
    expect(fallback.groundY).toBe(0)

    disposeTree(scene)
    disposeTree(orphan)
  })

  it.each([
    ['trestle', 'spoon-table', 'welsh-love-spoon', 0.76],
    ['arched', 'rooster-table', 'barcelos-clay-rooster', 0.74],
    ['joined', 'licitar-table', 'croatian-licitar-heart', 0.76],
    ['joined', 'egg-table', 'sorbian-painted-egg', 0.74],
    ['joined', 'journal-table', 'czech-pilgrim-journal', 0.775],
  ] as const)('grounds %s craft table (%s) flush to environment surface without floating legs', (support, tableName, sceneId, surfaceY) => {
    const parent = new THREE.Group()
    const table = addCraftTable(parent, {
      name: tableName,
      topName: `${tableName}-top`,
      width: 3.2,
      depth: 1.7,
      surfaceY,
      thickness: 0.12,
      support,
      finish: 'birch',
    })
    parent.updateMatrixWorld(true)

    const expectedGround = getEnvironmentSurfaceY(sceneId)
    expect(table.groundY).toBeCloseTo(expectedGround, 6)
    expect(table.surfaceY).toBeCloseTo(surfaceY, 6)
    expect(table.top.name).toBe(`${tableName}-top`)

    const topBounds = new THREE.Box3().setFromObject(table.top)
    expect(topBounds.max.y).toBeCloseTo(surfaceY, 4)

    const fullBounds = new THREE.Box3().setFromObject(table.root)
    // Must touch or embed gently (joined splay corner <= 8mm) — never float above expectedGround.
    expect(fullBounds.min.y).toBeLessThanOrEqual(expectedGround + 0.001)
    expect(fullBounds.min.y).toBeGreaterThanOrEqual(expectedGround - 0.01)

    // Joined leg local origins stay centered on each mesh (no vertex offset shift).
    if (support === 'joined') {
      const legs: THREE.Mesh[] = []
      table.root.traverse(o => { if (o instanceof THREE.Mesh && o.name === `${tableName}-leg`) legs.push(o) })
      expect(legs).toHaveLength(4)
      for (const leg of legs) {
        leg.geometry.computeBoundingBox()
        const center = leg.geometry.boundingBox!.getCenter(new THREE.Vector3())
        expect(center.length()).toBeLessThan(1e-5)
      }
    }

    assertFiniteGeometry(table.root)
    disposeTree(parent)
  })
})

describe('shared chamfered stand primitives', () => {
  const finishes: readonly TimberFinish[] = ['honey', 'birch', 'chestnut', 'walnut', 'cedar', 'lacquerRed']

  it.each(finishes)('builds grounded addOfferingTable with vertical leg grain across finish=%s', finish => {
    const parent = new THREE.Group()
    const groundY = -0.0225
    const surfaceY = 0.74
    const result = addOfferingTable(parent, {
      name: `altar-${finish}`,
      topName: `altar-${finish}-surface`,
      width: 2.2,
      depth: 1.15,
      surfaceY,
      groundY,
      finish,
    })
    parent.updateMatrixWorld(true)

    expect(result.groundY).toBeCloseTo(groundY, 6)
    expect(result.surfaceY).toBeCloseTo(surfaceY, 6)
    expect(result.top.name).toBe(`altar-${finish}-surface`)
    expect(new THREE.Box3().setFromObject(result.root).min.y).toBeCloseTo(groundY, 4)
    expect(new THREE.Box3().setFromObject(result.top).max.y).toBeCloseTo(surfaceY, 4)

    const legs: THREE.Mesh[] = []
    result.root.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.name === `altar-${finish}-leg`) legs.push(obj)
    })
    expect(legs).toHaveLength(4)
    for (const leg of legs) {
      const mat = leg.material as THREE.MeshStandardMaterial
      expect(mat.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'y' })
      expect(new THREE.Box3().setFromObject(leg).min.y).toBeCloseTo(groundY, 4)
    }

    assertFiniteGeometry(result.root)
    disposeTree(parent)
  })

  it('adapts addOfferingTable cleanly for compact low footed stands (no stretcher collision)', () => {
    const parent = new THREE.Group()
    const groundY = -0.1025
    const surfaceY = 0.016
    const stand = addOfferingTable(parent, {
      name: 'low-wood-stand',
      width: 0.95,
      depth: 0.95,
      surfaceY,
      groundY,
      finish: 'cedar',
    })
    parent.updateMatrixWorld(true)

    expect(new THREE.Box3().setFromObject(stand.root).min.y).toBeCloseTo(groundY, 4)
    expect(new THREE.Box3().setFromObject(stand.top).max.y).toBeCloseTo(surfaceY, 4)
    expect(stand.root.getObjectByName('low-wood-stand-lower-stretcher')).toBeUndefined()

    assertFiniteGeometry(stand.root)
    disposeTree(parent)
  })

  it('builds round and oval addRoundLowTable with exact bounds and unstretched vertical-grain turned legs', () => {
    const parent = new THREE.Group()

    const round = addRoundLowTable(parent, {
      name: 'round-dining',
      radius: 1.2,
      surfaceY: 0.168,
      groundY: -0.112,
      finish: 'walnut',
    })
    const oval = addRoundLowTable(parent, {
      name: 'oval-board',
      radius: 0.92,
      radiusZ: 0.64,
      surfaceY: 0.08,
      groundY: -0.012,
      finish: 'honey',
      legCount: 4,
    })
    parent.updateMatrixWorld(true)

    expect(new THREE.Box3().setFromObject(round.root).min.y).toBeCloseTo(-0.112, 4)
    expect(new THREE.Box3().setFromObject(round.top).max.y).toBeCloseTo(0.168, 4)

    const ovalTopBounds = new THREE.Box3().setFromObject(oval.top)
    expect(ovalTopBounds.max.y).toBeCloseTo(0.08, 4)
    expect(ovalTopBounds.max.x - ovalTopBounds.min.x).toBeCloseTo(1.84, 2)
    expect(ovalTopBounds.max.z - ovalTopBounds.min.z).toBeCloseTo(1.28, 2)
    expect(new THREE.Box3().setFromObject(oval.root).min.y).toBeCloseTo(-0.012, 4)

    const ovalLegs: THREE.Mesh[] = []
    oval.root.traverse(obj => { if (obj instanceof THREE.Mesh && obj.name === 'oval-board-leg') ovalLegs.push(obj) })
    expect(ovalLegs).toHaveLength(4)
    for (const leg of ovalLegs) {
      expect(leg.scale.toArray()).toEqual([1, 1, 1])
      expect((leg.material as THREE.MeshStandardMaterial).userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'y' })
    }

    assertFiniteGeometry(parent)
    disposeTree(parent)
  })

  it('builds addObjectCradle pads, lipped trays, twin U-cradles, and grooved rests with exact seating Y', () => {
    const parent = new THREE.Group()

    // 1. Fabric pad
    const pad = addObjectCradle(parent, {
      name: 'felt-pad',
      style: 'pad',
      kind: 'fabric',
      width: 0.65,
      depth: 0.45,
      groundY: 0.0175,
      height: 0.024,
    })
    // 2. Lipped wooden tray with linen inset (e.g. mizuhiki veranda -0.035 -> +0.032)
    const tray = addObjectCradle(parent, {
      name: 'presentation-tray',
      lip: true,
      kind: 'wood',
      finish: 'birch',
      width: 0.88,
      depth: 0.62,
      groundY: -0.035,
      surfaceY: 0.032,
      insetColor: 0xe6dcc8,
      insetKind: 'fabric',
    })
    // 3. Continuous concave groove along X and Z
    const grooveX = addObjectCradle(parent, {
      name: 'mallet-groove-x',
      groove: true,
      grooveAxis: 'x',
      kind: 'wood',
      finish: 'cedar',
      width: 0.46,
      depth: 0.16,
      groundY: 0.0175,
      surfaceY: 0.055,
      grooveDepth: 0.018,
    })
    const grooveZ = addObjectCradle(parent, {
      name: 'slot-groove-z',
      style: 'groove',
      grooveAxis: 'z',
      kind: 'ceramic',
      width: 0.14,
      depth: 0.36,
      groundY: 0.72,
      surfaceY: 0.748,
      grooveDepth: 0.014,
    })
    // 4. Twin U-cradle
    const cradle = addObjectCradle(parent, {
      name: 'twin-cradle',
      style: 'cradle',
      grooveAxis: 'x',
      kind: 'wood',
      finish: 'walnut',
      width: 0.54,
      depth: 0.22,
      groundY: 0.0175,
      surfaceY: 0.12,
      grooveDepth: 0.026,
    })
    // 5. Neutral matte pad (applySurface: false)
    const neutral = addObjectCradle(parent, {
      name: 'neutral-pad',
      style: 'pad',
      kind: 'stone',
      width: 0.4,
      depth: 0.4,
      groundY: 0,
      height: 0.03,
      applySurface: false,
    })

    parent.updateMatrixWorld(true)

    expect(new THREE.Box3().setFromObject(pad.root).min.y).toBeCloseTo(0.0175, 4)
    expect(new THREE.Box3().setFromObject(pad.top).max.y).toBeCloseTo(0.0415, 4)
    expect((pad.root.getObjectByName('felt-pad-bed') as THREE.Mesh).material).toMatchObject({
      userData: { craftSurface: { kind: 'fabric' } },
    })

    expect(new THREE.Box3().setFromObject(tray.root).min.y).toBeCloseTo(-0.035, 4)
    expect(new THREE.Box3().setFromObject(tray.top).max.y).toBeCloseTo(0.032, 4)
    expect(new THREE.Box3().setFromObject(tray.root).max.y).toBeGreaterThan(0.042)

    expect(new THREE.Box3().setFromObject(grooveX.root).min.y).toBeCloseTo(0.0175, 4)
    const hitX = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)).intersectObject(grooveX.top, true)
    expect(hitX[0]!.point.y).toBeCloseTo(0.055, 3)
    expect(new THREE.Box3().setFromObject(grooveX.top).max.y).toBeCloseTo(0.055 + 0.018, 3)

    expect(new THREE.Box3().setFromObject(grooveZ.root).min.y).toBeCloseTo(0.72, 4)
    const hitZ = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0)).intersectObject(grooveZ.top, true)
    expect(hitZ[0]!.point.y).toBeCloseTo(0.748, 3)

    expect(new THREE.Box3().setFromObject(cradle.root).min.y).toBeCloseTo(0.0175, 4)
    const saddleOffset = 0.54 * 0.34
    const hitCradle = new THREE.Raycaster(new THREE.Vector3(saddleOffset, 1, 0), new THREE.Vector3(0, -1, 0)).intersectObject(cradle.top, true)
    expect(hitCradle[0]!.point.y).toBeCloseTo(0.12, 3)

    expect(((neutral.root.getObjectByName('neutral-pad-bed') as THREE.Mesh).material as THREE.MeshStandardMaterial).userData.craftSurface).toBeUndefined()

    assertFiniteGeometry(parent)
    disposeTree(parent)
  })

  it('builds rectangular multi-tier and turned round/oval addSteppedPedestal with exact grounding and cap height', () => {
    const parent = new THREE.Group()

    const shrine = addSteppedPedestal(parent, {
      name: 'shrine-plinth',
      shape: 'rect',
      kind: 'stone',
      width: 1.8,
      depth: 1.4,
      groundY: -0.0475,
      surfaceY: 0.42,
      tiers: 5,
    })
    const customTiers = addSteppedPedestal(parent, {
      name: 'custom-plinth',
      kind: 'stone',
      groundY: -0.004,
      surfaceY: 0.35,
      tiers: [
        { width: 2.2, depth: 1.3, height: 0.2 },
        { width: 1.9, depth: 1.1, height: 0.154 },
      ],
    })
    const turnedRound = addSteppedPedestal(parent, {
      name: 'round-wood-base',
      shape: 'round',
      kind: 'wood',
      finish: 'walnut',
      radius: 0.42,
      groundY: -0.012,
      surfaceY: 0.18,
      tiers: 3,
    })
    const turnedOvalNeutral = addSteppedPedestal(parent, {
      name: 'oval-neutral-base',
      shape: 'oval',
      kind: 'ceramic',
      radius: 0.55,
      radiusZ: 0.38,
      groundY: -0.032,
      surfaceY: 0.22,
      applySurface: false,
    })

    parent.updateMatrixWorld(true)

    expect(new THREE.Box3().setFromObject(shrine.root).min.y).toBeCloseTo(-0.0475, 4)
    expect(new THREE.Box3().setFromObject(shrine.top).max.y).toBeCloseTo(0.42, 4)
    expect((shrine.root.getObjectByName('shrine-plinth-cap') as THREE.Mesh).material).toMatchObject({
      userData: { craftSurface: { kind: 'stone' } },
    })

    expect(new THREE.Box3().setFromObject(customTiers.root).min.y).toBeCloseTo(-0.004, 4)
    expect(new THREE.Box3().setFromObject(customTiers.top).max.y).toBeCloseTo(0.35, 4)

    expect(new THREE.Box3().setFromObject(turnedRound.root).min.y).toBeCloseTo(-0.012, 4)
    expect(new THREE.Box3().setFromObject(turnedRound.top).max.y).toBeCloseTo(0.18, 4)
    expect((turnedRound.root.getObjectByName('round-wood-base-shaft') as THREE.Mesh).material).toMatchObject({
      userData: { craftSurface: { kind: 'wood', axis: 'y' } },
    })

    const ovalBounds = new THREE.Box3().setFromObject(turnedOvalNeutral.root)
    expect(ovalBounds.min.y).toBeCloseTo(-0.032, 4)
    expect(new THREE.Box3().setFromObject(turnedOvalNeutral.top).max.y).toBeCloseTo(0.22, 4)
    expect(ovalBounds.max.x - ovalBounds.min.x).toBeCloseTo(1.1, 2)
    expect(ovalBounds.max.z - ovalBounds.min.z).toBeCloseTo(0.76, 2)
    expect(((turnedOvalNeutral.root.getObjectByName('oval-neutral-base-shaft') as THREE.Mesh).material as THREE.MeshStandardMaterial).userData.craftSurface).toBeUndefined()

    assertFiniteGeometry(parent)
    disposeTree(parent)
  })
})

describe('warm purple-umber contact AO grounding', () => {
  it('builds cached 64x64 procedural contact shadow textures with non-blocking flags and zero raycast hits', () => {
    const parent = new THREE.Group()
    const a = addContactShadow(parent, { prefix: 'bowl', width: 0.6, depth: 0.6, shape: 'ellipse' })
    const b = addContactShadow(parent, { prefix: 'tray', width: 0.8, depth: 0.5, shape: 'rounded-rect' })
    const c = addContactShadow(parent, { prefix: 'bowl-2', width: 0.4, depth: 0.4, shape: 'ellipse' })

    expect(a.name).toBe('bowl-contact-ao')
    expect(b.name).toBe('tray-contact-ao')
    expect(a.position.y).toBeCloseTo(0.0018, 6)

    const matA = a.material as THREE.MeshBasicMaterial
    const matB = b.material as THREE.MeshBasicMaterial
    const matC = c.material as THREE.MeshBasicMaterial
    expect(matA).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect(matA.color.getHex()).toBe(0x3f2f2b)
    expect(matA.transparent).toBe(true)
    expect(matA.depthWrite).toBe(false)
    expect(matA.polygonOffset).toBe(true)
    expect(matA.toneMapped).toBe(false)
    // Shared immutable pixel buffers per shape, wrapped in per-material disposable DataTextures
    expect(matA.map).not.toBe(matC.map)
    expect((matA.map as THREE.DataTexture).image.data).toBe((matC.map as THREE.DataTexture).image.data)
    expect((matA.map as THREE.DataTexture).image.data).not.toBe((matB.map as THREE.DataTexture).image.data)

    for (const shadow of [a, b]) {
      expect(shadow.userData.effect).toBe(true)
      expect(shadow.userData.keepInOutdoorEnvironment).toBe(true)
      expect(shadow.userData.toonSurface).toEqual({ outline: false })
      expect(shadow.castShadow).toBe(false)
      expect(shadow.receiveShadow).toBe(false)

      const tex = (shadow.material as THREE.MeshBasicMaterial).map as THREE.DataTexture
      const { width, height, data } = tex.image as { width: number; height: number; data: Uint8Array }
      expect(width).toBe(64)
      expect(height).toBe(64)
      const centerAlpha = data[(32 * 64 + 32) * 4 + 3]!
      const cornerAlpha = data[3]!
      expect(centerAlpha).toBeGreaterThan(200)
      expect(cornerAlpha).toBe(0)
    }

    // Contact shadows must never intercept pointer or grounding raycasts.
    parent.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0))
    expect(ray.intersectObjects([a, b, c], true)).toHaveLength(0)

    assertFiniteGeometry(parent)
    disposeTree(parent)
  })

  it('automatically attaches non-blocking contact AO planes across all five furniture builders', () => {
    const parent = new THREE.Group()
    const builds = [
      addCraftTable(parent, { name: 'ao-trestle', width: 3.1, depth: 1.6, surfaceY: 0.74, thickness: 0.12, support: 'trestle', groundY: 0 }),
      addCraftTable(parent, { name: 'ao-arched', width: 3.1, depth: 1.6, surfaceY: 0.74, thickness: 0.12, support: 'arched', groundY: 0 }),
      addCraftTable(parent, { name: 'ao-joined', width: 3.1, depth: 1.6, surfaceY: 0.74, thickness: 0.12, support: 'joined', groundY: 0 }),
      addOfferingTable(parent, { name: 'ao-offering', width: 2.0, depth: 1.1, surfaceY: 0.72, groundY: -0.02 }),
      addRoundLowTable(parent, { name: 'ao-round', radius: 0.9, surfaceY: 0.24, groundY: -0.03 }),
      addObjectCradle(parent, { name: 'ao-cradle', width: 0.6, depth: 0.4, groundY: 0.01, height: 0.03 }),
      addSteppedPedestal(parent, { name: 'ao-rect-ped', shape: 'rect', width: 1.2, depth: 0.9, groundY: -0.04, surfaceY: 0.32 }),
      addSteppedPedestal(parent, { name: 'ao-round-ped', shape: 'round', radius: 0.45, groundY: -0.02, surfaceY: 0.22 }),
    ]
    parent.updateMatrixWorld(true)

    for (const build of builds) {
      const shadows: THREE.Mesh[] = []
      build.root.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.name.endsWith('-contact-ao')) shadows.push(obj)
      })
      expect(shadows.length, build.root.name).toBeGreaterThan(0)
      for (const shadow of shadows) {
        expect(shadow.position.y).toBeGreaterThan(0)
        expect(shadow.userData.effect).toBe(true)
        expect(shadow.userData.keepInOutdoorEnvironment).toBe(true)
        expect(shadow.userData.toonSurface).toEqual({ outline: false })
        const mat = shadow.material as THREE.MeshBasicMaterial
        expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial)
        expect(mat.transparent).toBe(true)
        expect(mat.depthWrite).toBe(false)
      }
    }

    disposeTree(parent)
  })
})
