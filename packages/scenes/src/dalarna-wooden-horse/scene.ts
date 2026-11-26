import { createQuietEnding } from '../quiet-ending'
import { placementHit } from '../placement-hit'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'
import { createWoodTextures, projectWoodBlockUVs, type WoodTextureSpec } from './wood-grain'

const COPY = {
  title: '木马安放', polish: '拿起桌前的软布，轻拭木马侧面的彩鞍。',
  place: '轻托木马彩鞍，把它安放到右侧木座。四只木蹄稳稳落下。',
  rest: '轻点木马，静看彩鞍与木纹。',
  polishing: '软布拂过木纹，彩鞍露出温润的光泽…', placing: '木马缓缓落上木座…',
  done: '让手作陪伴平常的一天。',
} as const
const HORSE_HOME = new THREE.Vector3(-.68, .72, -.1), HORSE_REST = new THREE.Vector3(.72, .842, -.1)
const CLOTH_HOME = new THREE.Vector3(-1.12, .746, .58)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original carving and paint, inspired by a public craft tradition rather than a magical rite. */
export function createDalarnaWoodenHorse(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '轻拭木马' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'dalarna-wooden-horse', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff0d8, ground: 0xb3b7a2, key: 0xffdfb8, rim: 0xd8e7d8, keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .022
  const world = new THREE.Group(); world.name = 'horse-workbench'; scene.add(world)
  const ownedTextures: THREE.DataTexture[] = []
  const attachOrganicWood = (material: THREE.MeshStandardMaterial, spec: WoodTextureSpec, bumpScale: number) => {
    const { map, bumpMap } = createWoodTextures(spec)
    ownedTextures.push(map, bumpMap)
    material.map = map
    material.bumpMap = bumpMap
    material.bumpScale = bumpScale
    material.needsUpdate = true
  }
  const paintedWood = (
    color: number,
    options: {
      roughness?: number; clearcoat?: number; clearcoatRoughness?: number
      grain?: number; scale?: number; texture?: WoodTextureSpec; bumpScale?: number
    } = {},
  ) => {
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: options.roughness ?? .60,
      clearcoat: options.clearcoat ?? .32,
      clearcoatRoughness: options.clearcoatRoughness ?? .33,
    })
    if (options.texture) attachOrganicWood(material, options.texture, options.bumpScale ?? .0024)
    if (options.grain) applyCraftSurface(material, { kind: 'wood', axis: 'y', scale: options.scale ?? .62, strength: options.grain })
    return material
  }
  const bareWood = (
    color: number,
    axis: 'x' | 'y' | 'z',
    scale: number,
    strength: number,
    roughness = .76,
    texture?: WoodTextureSpec,
    bumpScale = .0052,
  ) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness })
    if (texture) attachOrganicWood(material, texture, bumpScale)
    return applyCraftSurface(material, { kind: 'wood', axis, scale, strength })
  }
  // Restrained flowing wood grain under soft satin lacquer keeps the folk-painted Dalarna horse
  // crisp and charming without mechanical striping or distracting paint smudges.
  const red = paintedWood(0xc4533e, {
    roughness: .56, clearcoat: .33, clearcoatRoughness: .32, grain: .11, scale: .52, bumpScale: .0024,
    texture: {
      id: 'dalarna-horse-body-v2', aspect: 0.88, ringFreq: 6.4, archSlope: 0.48, pithV: 0.34, pithU: 0.44,
      pithDepth: 0.32, flowAmp: 0.20, contrast: 0.125, warmth: 0.62, toneVariation: 0.04, fiberStrength: 0.018, seed: 11.3,
    },
  })
  const legRedFront = paintedWood(0xc2513d, {
    roughness: .57, clearcoat: .33, clearcoatRoughness: .32, grain: .11, scale: .64, bumpScale: .0022,
    texture: {
      id: 'dalarna-horse-leg-front-v2', aspect: 2.1, ringFreq: 7.4, archSlope: 0.26, pithV: 0.74, pithU: 0.28,
      pithDepth: 0.40, flowAmp: 0.16, contrast: 0.115, warmth: 0.60, toneVariation: 0.038, fiberStrength: 0.018, seed: 19.7,
    },
  })
  const legRedBack = paintedWood(0xbd4e3a, {
    roughness: .58, clearcoat: .32, clearcoatRoughness: .33, grain: .11, scale: .72, bumpScale: .0022,
    texture: {
      id: 'dalarna-horse-leg-back-v2', aspect: 2.1, ringFreq: 6.6, archSlope: 0.32, pithV: 0.24, pithU: 0.62,
      pithDepth: 0.36, flowAmp: 0.18, contrast: 0.115, warmth: 0.60, toneVariation: 0.038, fiberStrength: 0.018, seed: 27.1,
    },
  })
  const darkRed = paintedWood(0xa4493e, {
    roughness: .59, clearcoat: .30, clearcoatRoughness: .34, grain: .10, scale: .74, bumpScale: .0018,
    texture: {
      id: 'dalarna-horse-dark-red-v2', aspect: 1.4, ringFreq: 7.0, archSlope: 0.22, pithV: 0.62, pithU: 0.5,
      pithDepth: 0.44, flowAmp: 0.14, contrast: 0.095, warmth: 0.55, toneVariation: 0.035, fiberStrength: 0.016, seed: 33.4,
    },
  })
  const saddleCream = paintedWood(0xede0b9, {
    roughness: .68, clearcoat: .26, clearcoatRoughness: .36, grain: .08, scale: .70, bumpScale: .0012,
    texture: {
      id: 'dalarna-horse-saddle-v2', aspect: 0.68, ringFreq: 5.8, archSlope: 0.16, pithV: 0.2, pithU: 0.5,
      pithDepth: 0.52, flowAmp: 0.12, contrast: 0.042, warmth: 0.48, toneVariation: 0.022, fiberStrength: 0.012, seed: 41.2,
    },
  })
  const blue = paintedWood(0x809c9c, { roughness: .58, clearcoat: .30, clearcoatRoughness: .33 })
  const gold = paintedWood(0xc6a467, { roughness: .54, clearcoat: .32, clearcoatRoughness: .32 })
  const ink = paintedWood(0x5e594d, { roughness: .52, clearcoat: .34, clearcoatRoughness: .30 })
  // Right-side display plaque: richer tight-grained oak rim + warm honey-maple inset with flowing cathedral arches & one crisp wood eye.
  const darkOak = bareWood(0xb58a5f, 'x', .86, .13, .74, {
    id: 'dalarna-plinth-oak-v2', aspect: 1.75, ringFreq: 8.4, archSlope: 0.30, pithV: 0.72, pithU: 0.34,
    pithDepth: 0.36, flowAmp: 0.16, contrast: 0.22, warmth: 0.86, toneVariation: 0.05, fiberStrength: 0.028, seed: 53.6,
    knots: [{ u: 0.26, v: 0.52, radius: 0.040, elongation: 2.3, deflect: 0.78, depth: 0.76, rings: 2.8 }],
  }, .0056)
  const plinthInset = bareWood(0xe6d19f, 'x', .64, .11, .75, {
    id: 'dalarna-plinth-plaque-v2', width: 512, height: 256, aspect: 1.65, ringFreq: 6.4, archSlope: 0.58, pithV: 0.44, pithU: 0.30,
    pithDepth: 0.24, flowAmp: 0.21, contrast: 0.205, warmth: 0.88, toneVariation: 0.05, fiberStrength: 0.022, seed: 61.9,
    knots: [
      { u: 0.72, v: 0.66, radius: 0.056, elongation: 2.2, deflect: 0.85, depth: 0.86, rings: 3.1 },
      { u: 0.22, v: 0.32, radius: 0.034, elongation: 2.3, deflect: 0.70, depth: 0.62, rings: 2.4 },
    ],
  }, .0048)
  const accessoryOak = bareWood(0xa98057, 'x', .96, .14, .76, {
    id: 'dalarna-bench-block-v1', aspect: 2.0, ringFreq: 6.6, archSlope: 0.28, pithV: 0.38, pithU: 0.6,
    pithDepth: 0.40, flowAmp: 0.16, contrast: 0.19, warmth: 0.82, toneVariation: 0.05, fiberStrength: 0.026, seed: 73.2,
  }, .0048)
  const brushWood = bareWood(0xcfa973, 'y', .92, .13, .76, {
    id: 'dalarna-brush-handle-v1', aspect: 5.5, ringFreq: 6.4, archSlope: 0.22, pithV: 0.55, pithU: 0.4,
    pithDepth: 0.42, flowAmp: 0.15, contrast: 0.16, warmth: 0.78, toneVariation: 0.045, fiberStrength: 0.024, seed: 81.5,
  }, .0040)
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x8ca797, roughness: .88 })
  const clothStripe = new THREE.MeshStandardMaterial({ color: 0xeee2bd, roughness: .90 })
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world, uvAxis?: 'x' | 'y' | 'z', uvTilt?: number) => {
    const geo = new RoundedBoxGeometry(w, h, d, 3, Math.min(.035, h / 3, d / 3))
    if (uvAxis) projectWoodBlockUVs(geo, uvAxis, { tilt: uvTilt })
    return add(geo, material, xyz, name, parent)
  }
  const tube = (points: number[][], radius: number, material: THREE.Material, parent: THREE.Object3D = world) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 24, radius, 7, false), material, [0, 0, 0], '', parent)
  const table = addCraftTable(world, { name: 'horse-table', topName: 'horse-table', width: 3.25, depth: 1.7, surfaceY: .72, thickness: .12, center: [0,0], support: 'arched', finish: 'birch' })
  // Author per-plank organic birch grain, subtle warm board-to-board tone variation, and sparse knots
  // while keeping accurate craftSurface wood axes for every workbench part.
  const boardPalette = [0xdcc29a, 0xd4b689, 0xd9bd93, 0xd2b487, 0xdac096]
  const boardSpecs: WoodTextureSpec[] = [
    {
      id: 'dalarna-table-plank-0-v1', aspect: 7.4, ringFreq: 4.8, archSlope: 0.46, pithV: 0.26, pithU: 0.62,
      pithDepth: 0.34, flowAmp: 0.20, contrast: 0.16, warmth: 0.78, toneVariation: 0.055, fiberStrength: 0.022, seed: 101.4,
    },
    {
      id: 'dalarna-table-plank-1-v1', aspect: 7.4, ringFreq: 6.1, archSlope: 0.34, pithV: 0.72, pithU: 0.25,
      pithDepth: 0.38, flowAmp: 0.18, contrast: 0.17, warmth: 0.82, toneVariation: 0.055, fiberStrength: 0.024, seed: 113.8,
      knots: [{ u: 0.82, v: 0.44, radius: 0.036, elongation: 2.3, deflect: 0.80, depth: 0.78, rings: 2.8 }],
    },
    {
      id: 'dalarna-table-plank-2-v1', aspect: 7.4, ringFreq: 5.3, archSlope: 0.54, pithV: 0.48, pithU: 0.48,
      pithDepth: 0.28, flowAmp: 0.22, contrast: 0.175, warmth: 0.80, toneVariation: 0.06, fiberStrength: 0.022, seed: 127.2,
      knots: [{ u: 0.16, v: 0.58, radius: 0.038, elongation: 2.2, deflect: 0.82, depth: 0.80, rings: 3.0 }],
    },
    {
      id: 'dalarna-table-plank-3-v1', aspect: 7.4, ringFreq: 6.7, archSlope: 0.30, pithV: 0.30, pithU: 0.74,
      pithDepth: 0.40, flowAmp: 0.19, contrast: 0.165, warmth: 0.82, toneVariation: 0.055, fiberStrength: 0.024, seed: 139.6,
    },
    {
      id: 'dalarna-table-plank-4-v2', width: 512, height: 256, aspect: 7.4, ringFreq: 5.8, archSlope: 0.58, pithV: 0.56, pithU: 0.36,
      pithDepth: 0.25, flowAmp: 0.22, contrast: 0.195, warmth: 0.85, toneVariation: 0.055, fiberStrength: 0.024, seed: 151.1,
      knots: [{ u: 0.62, v: 0.48, radius: 0.038, elongation: 2.25, deflect: 0.84, depth: 0.85, rings: 3.0 }],
    },
  ]
  const tableUsedMaterials = new Set<THREE.MeshStandardMaterial>()
  const ensureUniqueTableMat = (mesh: THREE.Mesh, base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial => {
    if (!tableUsedMaterials.has(base)) {
      tableUsedMaterials.add(base)
      return base
    }
    const cloned = base.clone()
    cloned.map = null
    cloned.bumpMap = null
    delete cloned.userData.craftSurface
    mesh.material = cloned
    tableUsedMaterials.add(cloned)
    return cloned
  }
  const tableMeshes: THREE.Mesh[] = []
  table.root.traverse(object => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) tableMeshes.push(object)
  })
  let boardIdx = 0, breadboardIdx = 0, legIdx = 0, wedgeIdx = 0
  const projectedGeos = new Set<THREE.BufferGeometry>()
  for (const mesh of tableMeshes) {
    const origMat = mesh.material as THREE.MeshStandardMaterial
    if (mesh.name === 'horse-table-quiet-grain') {
      origMat.color.setHex(0xcfb48b)
      continue
    }
    if (mesh.name === 'horse-table-top-board') {
      const idx = boardIdx++
      const mat = ensureUniqueTableMat(mesh, origMat)
      mat.color.setHex(boardPalette[idx % boardPalette.length]!)
      mat.roughness = .77
      if (!projectedGeos.has(mesh.geometry)) {
        projectWoodBlockUVs(mesh.geometry, 'x', { tilt: 0.34 })
        projectedGeos.add(mesh.geometry)
      }
      if (!mat.map) attachOrganicWood(mat, boardSpecs[idx % boardSpecs.length]!, .0044)
      if (!mat.userData.craftSurface) applyCraftSurface(mat, { kind: 'wood', axis: 'x', scale: .62 + (idx % 5) * .08, strength: .13 })
    } else if (mesh.name === 'horse-table-breadboard-end') {
      const idx = breadboardIdx++
      const mat = ensureUniqueTableMat(mesh, origMat)
      mat.color.setHex(idx === 0 ? 0xd0ae83 : 0xcba87d)
      mat.roughness = .76
      if (!projectedGeos.has(mesh.geometry)) {
        projectWoodBlockUVs(mesh.geometry, 'z', { tilt: 0.42 })
        projectedGeos.add(mesh.geometry)
      }
      if (!mat.map) attachOrganicWood(mat, {
        id: `dalarna-table-breadboard-${idx}-v1`, aspect: 6.5, ringFreq: 5.8 + idx * 1.1, archSlope: 0.42,
        pithV: idx === 0 ? 0.36 : 0.64, pithU: idx === 0 ? 0.34 : 0.66, pithDepth: 0.32, flowAmp: 0.20,
        contrast: 0.18, warmth: 0.84, toneVariation: 0.055, fiberStrength: 0.025, seed: 167.3 + idx * 23.5,
        knots: idx === 1 ? [{ u: 0.72, v: 0.52, radius: 0.040, elongation: 2.3, deflect: 0.78, depth: 0.78, rings: 2.8 }] : [],
      }, .0048)
      if (!mat.userData.craftSurface) applyCraftSurface(mat, { kind: 'wood', axis: 'z', scale: .76 + idx * .12, strength: .14 })
    } else if (mesh.name === 'horse-table-leg') {
      const idx = legIdx++
      const mat = ensureUniqueTableMat(mesh, origMat)
      mat.color.setHex(idx === 0 ? 0xbd9c70 : 0xb59469)
      mat.roughness = .76
      if (!projectedGeos.has(mesh.geometry)) {
        projectWoodBlockUVs(mesh.geometry, 'y', { tilt: 0.72 })
        projectedGeos.add(mesh.geometry)
      }
      if (!mat.map) attachOrganicWood(mat, {
        id: `dalarna-table-leg-${idx}-v1`, aspect: 1.35, ringFreq: 5.4 + idx * 1.3, archSlope: 0.44,
        pithV: idx === 0 ? 0.62 : 0.34, pithU: idx === 0 ? 0.42 : 0.58, pithDepth: 0.32, flowAmp: 0.20,
        contrast: 0.19, warmth: 0.84, toneVariation: 0.06, fiberStrength: 0.026, seed: 199.1 + idx * 29.3,
        knots: idx === 0 ? [{ u: 0.54, v: 0.42, radius: 0.068, elongation: 2.1, deflect: 0.80, depth: 0.80, rings: 2.8 }] : [],
      }, .0050)
      if (!mat.userData.craftSurface) applyCraftSurface(mat, { kind: 'wood', axis: 'y', scale: .68 + idx * .14, strength: .15 })
    } else if (mesh.name === 'horse-table-through-stretcher') {
      const mat = ensureUniqueTableMat(mesh, origMat)
      mat.color.setHex(0xb49368)
      mat.roughness = .76
      if (!projectedGeos.has(mesh.geometry)) {
        projectWoodBlockUVs(mesh.geometry, 'x', { tilt: 0.55 })
        projectedGeos.add(mesh.geometry)
      }
      if (!mat.map) attachOrganicWood(mat, {
        id: 'dalarna-table-stretcher-v1', aspect: 9.0, ringFreq: 6.4, archSlope: 0.26, pithV: 0.44, pithU: 0.5,
        pithDepth: 0.38, flowAmp: 0.16, contrast: 0.18, warmth: 0.82, toneVariation: 0.05, fiberStrength: 0.026, seed: 233.7,
      }, .0048)
      if (!mat.userData.craftSurface) applyCraftSurface(mat, { kind: 'wood', axis: 'x', scale: .90, strength: .15 })
    } else if (mesh.name === 'horse-table-stretcher-wedge') {
      const idx = wedgeIdx++
      const mat = ensureUniqueTableMat(mesh, origMat)
      mat.color.setHex(0xc8a479)
      mat.roughness = .76
      if (!projectedGeos.has(mesh.geometry)) {
        projectWoodBlockUVs(mesh.geometry, 'y', { tilt: 0.52 })
        projectedGeos.add(mesh.geometry)
      }
      if (!mat.map) attachOrganicWood(mat, {
        id: `dalarna-table-wedge-${idx}-v1`, aspect: 1.3, ringFreq: 6.8 + idx * 0.8, archSlope: 0.24, pithV: 0.5, pithU: 0.45,
        pithDepth: 0.42, flowAmp: 0.15, contrast: 0.17, warmth: 0.82, toneVariation: 0.045, fiberStrength: 0.025, seed: 257.4 + idx * 17.2,
      }, .0044)
      if (!mat.userData.craftSurface) applyCraftSurface(mat, { kind: 'wood', axis: 'y', scale: 1.02 + idx * .08, strength: .14 })
    }
  }
  const shadow = add(new THREE.PlaneGeometry(3.8, 2.5), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box(1.45, .10, .90, darkOak, [.72, .77, -.1], 'horse-plinth', world, 'x', .62)
  const plinth = box(1.39, .022, .84, plinthInset, [.72, .831, -.1], 'horse-plinth-inset', world, 'x', .28)
  // Four distinct legs and an extruded carved silhouette retain a wooden toy's broad planes.
  const horse = new THREE.Group(); horse.name = 'dalarna-horse'; world.add(horse)
  const profile = new THREE.Shape()
  profile.moveTo(-.52, .48); profile.bezierCurveTo(-.69, .63, -.64, .94, -.40, 1.00)
  profile.quadraticCurveTo(-.12, 1.04, .17, 1.00); profile.bezierCurveTo(.23, 1.16, .21, 1.40, .34, 1.54)
  profile.lineTo(.46, 1.42); profile.lineTo(.56, 1.52); profile.lineTo(.59, 1.33)
  profile.bezierCurveTo(.71, 1.29, .91, 1.20, .88, 1.08); profile.quadraticCurveTo(.82, 1.01, .71, 1.09)
  profile.lineTo(.52, 1.15); profile.bezierCurveTo(.48, .98, .58, .68, .46, .49)
  profile.quadraticCurveTo(.03, .40, -.52, .48)
  const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: .36, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .034, bevelThickness: .034, curveSegments: 12 }); bodyGeo.translate(0, 0, -.18)
  projectWoodBlockUVs(bodyGeo, 'y', { tilt: .34 })
  add(bodyGeo, red, [0, 0, 0], 'horse-carved-body', horse)
  let i = 0
  for (const x of [-.40, .36]) for (const z of [-.145, .145]) {
    const legGeo = new THREE.CylinderGeometry(.10, .13, .55, 8)
    projectWoodBlockUVs(legGeo, 'y', { tilt: .40 + i * .72, flipU: i % 2 === 1 })
    const legMat = x > 0 ? legRedFront : legRedBack
    add(legGeo, legMat, [x, .275, z], `horse-leg-${i++}`, horse)
    box(.19, .07, .19, darkRed, [x, .05, z], '', horse, 'y', .35)
  }
  const saddle = box(.46, .28, .022, saddleCream, [-.12, .83, .229], 'horse-painted-saddle', horse, 'y', .24)
  box(.46, .28, .022, saddleCream, [-.12, .83, -.229], '', horse, 'y', .24)
  // Simple invented leaf strokes avoid copying a maker's decorative pattern.
  for (const z of [-.247, .247]) {
    for (const x of [-.27, .03]) {
      const leaf = add(new THREE.SphereGeometry(1, 14, 10), blue, [x, .87, z], '', horse); leaf.scale.set(.035, .07, .008); leaf.rotation.z = x < 0 ? -.35 : .35
    }
    tube([[-.27, .75, z], [-.12, .73, z], [.03, .75, z]], .012, gold, horse)
    const eye = add(new THREE.SphereGeometry(.017, 12, 8), ink, [.59, 1.27, z > 0 ? .218 : -.218], '', horse); eye.scale.z = .4
  }
  tube([[.23, 1.05, -.21], [.29, 1.27, -.21], [.38, 1.39, -.21]], .035, darkRed, horse)
  tube([[-.56, .85, 0], [-.73, .74, 0], [-.68, .56, 0]], .045, darkRed, horse)
  tube([[.50, 1.18, .218], [.64, 1.14, .218], [.78, 1.09, .218]], .012, gold, horse)
  const cloth = box(.34, .036, .26, clothMat, [0, 0, 0], 'horse-polishing-cloth')
  for (const z of [-.085, .085]) box(.28, .006, .008, clothStripe, [0, .020, z], '', cloth)
  cloth.rotation.y = -.12
  // Small bench accessories are ordinary workshop objects, not ritual apparatus.
  box(.44, .038, .22, accessoryOak, [-1.06, .741, -.63], '', world, 'x', .45)
  const brushGeo = new THREE.CylinderGeometry(.023, .023, .40, 12)
  projectWoodBlockUVs(brushGeo, 'y', { tilt: .45 })
  const brush = add(brushGeo, brushWood, [-1.06, .79, -.63]); brush.rotation.z = Math.PI / 2
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    horse.position.copy(checkpoint >= 2 ? HORSE_REST : HORSE_HOME); cloth.position.copy(CLOTH_HOME)
    const polished = checkpoint >= 1
    saddleCream.roughness = polished ? .48 : .68
    saddleCream.clearcoat = polished ? .37 : .26
    saddleCream.clearcoatRoughness = polished ? .28 : .36
    for (const coat of [red, legRedFront, legRedBack]) {
      coat.clearcoat = polished ? .37 : .33
      coat.clearcoatRoughness = polished ? .29 : .32
    }
    matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  const seatGripGoal = () => {
    matrices()
    const goal = plinth.getWorldPosition(new THREE.Vector3()).project(camera), grip = saddle.getWorldPosition(new THREE.Vector3()).project(camera), foot = horse.getWorldPosition(new THREE.Vector3()).project(camera)
    goal.x += grip.x - foot.x; goal.y += grip.y - foot.y
    return goal.unproject(camera)
  }
  addInteractionCue(cloth, { kind: 'drag', label: '轻拭木马彩鞍', priority: 3, enabled: enabled(0), destination: saddle, targetLabel: '彩鞍侧面' })
  addInteractionCue(saddle, { kind: 'drag', label: '安放木马', priority: 3, enabled: enabled(1), destination: seatGripGoal, targetLabel: '四蹄落在右侧木座' })
  addInteractionCue(saddle, { kind: 'tap', label: '轻点木马静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? cloth : horse
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === held) return
      meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object === target
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const placementReady = (x: number, y: number) => checkpoint < 2 && maxTravel > 0
    && placementHit(canvas, camera, checkpoint === 0 ? cloth : horse, x, y, (px, py) => hitsVisible(px, py, checkpoint === 0 ? saddle : plinth, moving()))
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return hitsVisible(x, y, checkpoint === 0 ? cloth : saddle) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (checkpoint === 0 ? cloth : saddle).getWorldPosition(new THREE.Vector3())); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices();
      if (dragging && placementReady(x, y) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && placementReady(x, y) : maxTravel < 12 && hitsVisible(x, y, saddle)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active(), duration: 3, motion: 'glow',
    targets: () => [horse], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '轻拭木马' : checkpoint === 1 ? '安放木马' : '轻点木马静看', safe)
    setSafeText(ui.hintEl, transition ? transition.step === 0 ? COPY.polishing : COPY.placing : checkpoint === 0 ? COPY.polish : checkpoint === 1 ? COPY.place : checkpoint === 2 ? COPY.rest : COPY.done, safe)
    ending.sync(checkpoint === 2 && !transition)
  }
  function settle() { if (!active() || !transition) return; checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .013 }) }
  function advance(arrived = false) {
    if (checkpoint === 2 && !ending.completing) return
    if (!active() || (pointer.isBusy() && !arrived) || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(); sync(); ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .013 }); if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.3 + boost * .4, 5.6 + boost); camera.lookAt(0, 1.0, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        if (transition.step === 0) {
          const surface = saddle.getWorldPosition(new THREE.Vector3()); surface.z += .10
          if (t < .65) { cloth.position.lerpVectors(transition.from, surface, Math.min(1, t / .28)); cloth.position.x += Math.sin(t / .65 * Math.PI * 2) * .08 }
          else cloth.position.lerpVectors(surface, CLOTH_HOME, (t - .65) / .35)
        } else { horse.position.lerpVectors(transition.from, HORSE_REST, t); if (!ctx.isReducedMotion?.()) horse.position.y += Math.sin(t * Math.PI) * .22 }
        if (transition.time === 1) settle()
      }
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() { if (disposed) return; ending.dispose(); disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); ownedTextures.forEach(tex => tex.dispose()); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
