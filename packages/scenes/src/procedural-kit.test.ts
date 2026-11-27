// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const renderer = vi.hoisted(() => ({
  options: undefined as unknown,
  setClearColor: vi.fn(),
  setPixelRatio: vi.fn(),
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    constructor(options: unknown) {
      renderer.options = options
    }
    setClearColor = renderer.setClearColor
    setPixelRatio = renderer.setPixelRatio
  }
  return { ...actual, WebGLRenderer }
})

import * as THREE from 'three'
import {
  addStageLights,
  claimObjectTouches,
  createChimeAudio,
  createLampHalo,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
  dampedRing,
  observeCanvasResize,
  springSettleEase,
} from './procedural-kit'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it('resizes the camera when the canvas changes inside an unchanged host', () => {
  let notify = (_element: Element) => {}
  vi.stubGlobal('ResizeObserver', class {
    private targets = new Set<Element>()
    constructor(private callback: () => void) {
      notify = element => { if (this.targets.has(element)) this.callback() }
    }
    observe(element: Element) { this.targets.add(element) }
    disconnect() { this.targets.clear() }
  })
  const host = document.createElement('div'), canvas = document.createElement('canvas')
  host.append(canvas)
  let height = 400
  Object.defineProperties(canvas, { clientWidth: { get: () => 320 }, clientHeight: { get: () => height } })
  const sizes: number[][] = []
  const stop = observeCanvasResize(canvas, () => sizes.push([canvas.clientWidth, canvas.clientHeight]))
  height = 280 // A tray changes the canvas, while the host's outer box stays fixed.
  notify(canvas)
  expect(sizes).toEqual([[320, 280]])
  stop()
  height = 360
  notify(canvas)
  expect(sizes).toEqual([[320, 280]])
})

describe('createStepOverlay', () => {
  it('marks its overlay as an island-stage one, the class the App styles it by', () => {
    // packages/app/src/style.css keys canvas gesture ownership and the wish
    // note's ink on scene-overlay--stage.
    const overlay = document.createElement('div')
    createStepOverlay(overlay, { title: 't', stepsAria: 's', action: 'a' }, () => {})
    expect(Array.from(overlay.classList)).toEqual(['scene-overlay', 'scene-overlay--stage'])
  })
})

describe('createWarmStage', () => {
  it('clears transparent over the page like the woodfish, with no painted bg or fog', () => {
    const { scene } = createWarmStage(document.createElement('canvas'))
    expect(renderer.options).toMatchObject({ alpha: true })
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0)
    expect(scene.background).toBeNull()
    expect(scene.fog).toBeNull()
  })
})

describe('addStageLights', () => {
  const day = { sky: 0xfff0dc, ground: 0xd8bea0, key: 0xffd6a4, rim: 0xffd2c0 }

  it('keeps the warm day rig, and swaps in dim moonlight on the night stage', () => {
    const byDay = addStageLights(new THREE.Scene(), undefined, day)
    const atNight = addStageLights(new THREE.Scene(), 'night', day)
    expect(byDay.key.color.getHex()).toBe(0xffd6a4)
    const bounce = (rig: typeof byDay) => rig.ambient.intensity + rig.hemi.intensity
    expect(bounce(atNight)).toBeLessThan(bounce(byDay) / 2)
    expect(atNight.key.intensity).toBeLessThan(byDay.key.intensity)
    // Cool moonlight, not the honey sun.
    expect(atNight.key.color.b).toBeGreaterThan(atNight.key.color.r)
    expect(atNight.hemi.color.b).toBeGreaterThan(atNight.hemi.color.r)
  })
})

describe('createLampHalo', () => {
  it('is an additive, see-through glow that starts dark and frees its texture', () => {
    const halo = createLampHalo(0xffb45e, 2)
    const { material } = halo
    expect(halo.sprite).toBeInstanceOf(THREE.Sprite)
    expect(halo.sprite.scale.x).toBe(2)
    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.AdditiveBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.opacity).toBe(0)
    const freed = vi.fn()
    material.map!.addEventListener('dispose', freed)
    halo.dispose()
    expect(freed).toHaveBeenCalledOnce()
  })

  it('builds a 128x128 silky Gaussian-cubic aureole with zero border ringing', () => {
    const halo = createLampHalo(0xffd296, 1.8)
    const map = halo.material.map as THREE.DataTexture
    const { width, height, data } = map.image as { width: number; height: number; data: Uint8Array }
    expect(width).toBe(128)
    expect(height).toBe(128)
    const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3]!
    const center = alphaAt(64, 64)
    const mid = alphaAt(96, 64)
    const corner = alphaAt(0, 0)
    const edge = alphaAt(127, 64)
    expect(center).toBeGreaterThan(240)
    expect(mid).toBeGreaterThan(15)
    expect(mid).toBeLessThan(center * 0.45)
    expect(corner).toBe(0)
    expect(edge).toBeLessThanOrEqual(2)
    halo.dispose()
  })
})

describe('physical spring helpers', () => {
  it('evaluates dampedRing as zero for non-positive time and decays smoothly for t > 0', () => {
    expect(dampedRing(0)).toBe(0)
    expect(dampedRing(-0.5)).toBe(0)
    expect(dampedRing(Number.NaN)).toBe(0)
    const earlyPeak = Math.abs(dampedRing(0.08))
    const lateTail = Math.abs(dampedRing(0.75))
    expect(earlyPeak).toBeGreaterThan(0.3)
    expect(lateTail).toBeLessThan(earlyPeak * 0.05)
  })

  it('evaluates springSettleEase with exact endpoints, C1 smoothness, and ~3.6% overshoot near t=0.72', () => {
    expect(springSettleEase(0)).toBe(0)
    expect(springSettleEase(-1)).toBe(0)
    expect(springSettleEase(1)).toBe(1)
    expect(springSettleEase(2)).toBe(1)

    let peak = -Infinity
    let peakT = 0
    for (let i = 0; i <= 200; i++) {
      const t = i / 200
      const v = springSettleEase(t)
      if (v > peak) { peak = v; peakT = t }
    }
    expect(peakT).toBeGreaterThanOrEqual(0.65)
    expect(peakT).toBeLessThanOrEqual(0.78)
    expect(peak).toBeGreaterThan(1.028)
    expect(peak).toBeLessThan(1.044)
    // Monotonic with zero overshoot when overshoot = 0.
    for (let i = 1; i <= 50; i++) {
      expect(springSettleEase(i / 50, 0)).toBeGreaterThanOrEqual(springSettleEase((i - 1) / 50, 0))
      expect(springSettleEase(i / 50, 0)).toBeLessThanOrEqual(1)
    }
  })
})

describe('createSceneFeedback', () => {
  const stubAudio = () => {
    const oscillators: unknown[] = []
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    })
    class FakeAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume = vi.fn(async () => {})
      close = vi.fn(async () => {})
      createGain() {
        return { gain: param(), connect: (n: unknown) => n }
      }
      createOscillator() {
        const osc = {
          type: 'sine',
          frequency: param(),
          connect: (n: unknown) => n,
          start: vi.fn(),
          stop: vi.fn(),
        }
        oscillators.push(osc)
        return osc
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
    return oscillators
  }
  const tone = { freqs: [440, 660], duration: 0.3 }

  it('plays the chime and fires the App haptic when sound is on', () => {
    const oscillators = stubAudio()
    const haptic = vi.fn()
    const prepareFeedback = vi.fn()
    const fx = createSceneFeedback({ haptic, prepareFeedback, isSoundEnabled: () => true })
    fx.prepare()
    fx.impact(tone)
    expect(prepareFeedback).toHaveBeenCalledOnce()
    expect(haptic).toHaveBeenCalledOnce()
    expect(oscillators).toHaveLength(2)
    fx.dispose()
  })

  it('stays silent but still reaches haptics when the sound toggle is off', () => {
    const oscillators = stubAudio()
    const haptic = vi.fn()
    let sound = false
    const fx = createSceneFeedback({ haptic, isSoundEnabled: () => sound })
    fx.prepare()
    fx.impact(tone)
    expect(oscillators).toHaveLength(0)
    expect(haptic).toHaveBeenCalledOnce()
    // Toggles are read live, so flipping 音效 mid-scene takes effect.
    sound = true
    fx.impact(tone)
    expect(oscillators).toHaveLength(2)
    fx.dispose()
  })

  it('shapes freqs chords through a sweeping warm lowpass filter, supports cue impacts, and manages continuous beds', () => {
    const oscillators: { type: string; frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; onended: (() => void) | null }[] = []
    const filters: { type: string; frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; disconnect: ReturnType<typeof vi.fn> }[] = []
    const bufferSources: { loop: boolean; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = []
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    })
    class RichAudioContext {
      state = 'running'
      currentTime = 1
      sampleRate = 48000
      destination = {}
      resume = vi.fn(async () => {})
      close = vi.fn(async () => {})
      createGain() { return { gain: param(), connect: (n: unknown) => n, disconnect: vi.fn() } }
      createBiquadFilter() {
        const f = { type: 'lowpass', frequency: param(), Q: param(), connect: (n: unknown) => n, disconnect: vi.fn() }
        filters.push(f)
        return f
      }
      createOscillator() {
        const osc = {
          type: 'sine',
          frequency: param(),
          connect: (n: unknown) => n,
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null as (() => void) | null,
        }
        oscillators.push(osc)
        return osc
      }
      createBuffer(_ch: number, len: number) {
        const data = new Float32Array(len)
        return { getChannelData: () => data }
      }
      createBufferSource() {
        const s = { buffer: null, loop: false, connect: (n: unknown) => n, disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }
        bufferSources.push(s)
        return s
      }
    }
    vi.stubGlobal('AudioContext', RichAudioContext)

    const fx = createSceneFeedback({ isSoundEnabled: () => true })
    // 1. Existing freqs calls still create 1 oscillator per frequency, now shaped with a sweeping lowpass filter.
    fx.impact({ freqs: [440, 660], duration: 0.3 })
    expect(oscillators).toHaveLength(2)
    expect(oscillators[0]!.type).toBe('triangle')
    expect(filters).toHaveLength(1)
    expect(filters[0]!.type).toBe('lowpass')
    expect(filters[0]!.frequency.setValueAtTime).toHaveBeenCalled()
    expect(filters[0]!.frequency.exponentialRampToValueAtTime).toHaveBeenCalled()

    // 2. Cue-only impact plays material buffer without spawning extra oscillators.
    fx.impact({ cue: 'ceramic', cueStrength: 0.8 })
    expect(oscillators).toHaveLength(2)
    expect(bufferSources).toHaveLength(1)

    // 3. Continuous bed is exposed on both createSceneFeedback and createChimeAudio and stops on dispose.
    const bed = fx.bed('paper')
    bed.setSpeed(0.6)
    expect(bufferSources).toHaveLength(2)
    expect(bufferSources[1]!.loop).toBe(true)
    fx.dispose()
    expect(bufferSources[1]!.disconnect).toHaveBeenCalled()

    const direct = createChimeAudio(() => true)
    const directBed = direct.bed('woodRub')
    directBed.setSpeed(0.5)
    expect(bufferSources).toHaveLength(3)
    direct.dispose()
    expect(bufferSources[2]!.disconnect).toHaveBeenCalled()
  })
})

describe('claimObjectTouches', () => {
  const touchStart = (el: HTMLElement, clientX: number, clientY: number) => {
    const e = new Event('touchstart', { cancelable: true })
    Object.assign(e, { changedTouches: [{ clientX, clientY }] })
    el.dispatchEvent(e)
    return e.defaultPrevented
  }

  it('prevents default only for object starts in the legacy touch fallback', () => {
    const el = document.createElement('div')
    const stop = claimObjectTouches(el, (x) => x < 50)
    expect(touchStart(el, 10, 10)).toBe(true)
    expect(touchStart(el, 80, 10)).toBe(false)
    stop()
    expect(touchStart(el, 10, 10)).toBe(false)
  })
})
