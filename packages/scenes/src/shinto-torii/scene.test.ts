// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneInstance } from '../contract'

vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0; toneMappingExposure = 1; outputColorSpace = ''
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const rendered = vi.hoisted(() => ({ scene: null as THREE.Scene | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene) => {
    rendered.scene = scene
    return { setStyle() {}, resize() {}, render() {}, dispose() {} }
  },
}))
import { createShintoTorii } from './scene'

const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren()
  rendered.scene = null
})

function mount() {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 360 }, clientHeight: { value: 360 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360 }) as DOMRect
  const instance = createShintoTorii({ canvas, overlay, gestures: Gestures, shared: Shared, isSoundEnabled: () => false })
  instances.push(instance)
  instance.start()
  return { instance, scene: rendered.scene! }
}

describe('shinto-torii lacquered timber finish', () => {
  it('applies subtle lacquered wood grain along each vermilion pillar/beam axis and splits rack grain axes', () => {
    const { scene } = mount()
    const mesh = (name: string) => scene.getObjectByName(name) as THREE.Mesh
    for (const [name, axis] of [
      ['torii-pillar-left', 'y'],
      ['torii-pillar-right', 'y'],
      ['torii-gakuzuka', 'y'],
      ['torii-nuki', 'x'],
      ['torii-shimaki', 'x'],
      ['torii-kasagi', 'x'],
    ] as const) {
      const mat = mesh(name).material as THREE.MeshPhysicalMaterial
      expect(mat, name).toBeInstanceOf(THREE.MeshPhysicalMaterial)
      expect(mat.clearcoat).toBeGreaterThanOrEqual(0.28)
      expect(mat.clearcoat).toBeLessThanOrEqual(0.4)
      expect(mat.clearcoatRoughness).toBeGreaterThanOrEqual(0.25)
      expect(mat.clearcoatRoughness).toBeLessThanOrEqual(0.36)
      expect(mat.userData.craftSurface).toMatchObject({ kind: 'wood', axis })
    }
    expect((mesh('torii-rack-post-left').material as THREE.Material).userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'y' })
    expect((mesh('torii-rack-bar-top').material as THREE.Material).userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'x' })
    expect((mesh('torii-rack-ema-0').material as THREE.Material).userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'x' })
    // Adjacent pillars, beams and hanging rack plaques carry distinct materials and flowing wood textures.
    expect(mesh('torii-pillar-left').material).not.toBe(mesh('torii-pillar-right').material)
    expect(mesh('torii-nuki').material).not.toBe(mesh('torii-kasagi').material)
    expect(mesh('torii-shimaki').material).not.toBe(mesh('torii-nuki').material)
    expect(mesh('torii-rack-post-left').material).not.toBe(mesh('torii-rack-post-right').material)
    expect(mesh('torii-rack-bar-top').material).not.toBe(mesh('torii-rack-bar-bottom').material)
    const emaMats = new Set([0, 1, 2, 3, 4].map(i => mesh(`torii-rack-ema-${i}`).material))
    expect(emaMats.size).toBe(5)
    expect((mesh('torii-pillar-left').material as THREE.MeshPhysicalMaterial).map).toBeInstanceOf(THREE.DataTexture)
    expect((mesh('torii-rack-ema-0').material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture)
  })

  it('disposes all generated wood DataTextures cleanly once', () => {
    const { instance, scene } = mount()
    const maps = new Set<THREE.Texture>()
    scene.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m?.map) maps.add(m.map)
    })
    expect(maps.size).toBeGreaterThan(5)
    const spies = [...maps].map(t => vi.spyOn(t, 'dispose'))
    instance.dispose()
    instance.dispose()
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce())
  })

  it('grounds the torii plinths and side ema rack and connects all six rack plaques with pegs and cords', () => {
    const { scene } = mount()
    scene.updateMatrixWorld(true)
    for (const name of ['torii-base-left', 'torii-base-right', 'torii-rack-post-left', 'torii-rack-post-right', 'torii-rack-foot-left', 'torii-rack-foot-right']) {
      expect(new THREE.Box3().setFromObject(scene.getObjectByName(name)!).min.y, name).toBeCloseTo(-0.035, 4)
    }
    for (let i = 0; i < 5; i++) {
      expect(scene.getObjectByName(`torii-rack-ema-peg-${i}`)).toBeInstanceOf(THREE.Mesh)
      expect(scene.getObjectByName(`torii-rack-ema-cord-${i}`)).toBeInstanceOf(THREE.Mesh)
    }
    expect(scene.getObjectByName('torii-own-ema-peg')).toBeInstanceOf(THREE.Mesh)
    expect(scene.getObjectByName('torii-own-ema-cord')).toBeInstanceOf(THREE.Mesh)
    // Shared courtyard flagstone path handles the approach without redundant overlapping stepping stones.
    let approachStones = 0
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && (obj.material as THREE.Material).userData.craftSurface?.kind === 'stone') approachStones++
    })
    expect(approachStones).toBe(0)
  })
})
