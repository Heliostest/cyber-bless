// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as gestures from '@wbr/gestures'
import * as shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from './contract'
import { createTibetanWaterBowls } from './tibetan-water-bowls/scene'
import { createSongkran } from './thai-songkran-elders/scene'
import { createZeniaraiCoinWashing } from './zeniarai-coin-washing/scene'
import { createKagamiBirakiSake } from './kagami-biraki-sake/scene'
import { createSetsubunMamemaki } from './setsubun-mamemaki/scene'
import { createCrane } from './crane/scene'

const gpu = vi.hoisted(() => ({ scene: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }; domElement: HTMLCanvasElement
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({ createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene) {
  gpu.scene = scene; return { setStyle() {}, resize() {}, render() {}, dispose() {} }
} }))

function audioBoundary() {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} })
  class AudioBoundary {
    state = 'running'; currentTime = 0; sampleRate = 24000; destination = {}; close = async () => {}; resume = async () => {}
    createBuffer(channels: number, length: number, sampleRate: number) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { duration: length / sampleRate, sampleRate, length, numberOfChannels: channels, getChannelData: (i: number) => data[i]!, copyToChannel: (from: Float32Array, i: number) => data[i]!.set(from) } }
    createBufferSource() { const source = { buffer: null, playbackRate: param(), connect: (n: unknown) => n, disconnect() {}, start: vi.fn(), stop: vi.fn(), onended: null }; sources.push(source); return source }
    createGain() { return { gain: param(), connect: (n: unknown) => n, disconnect() {} } }
    createBiquadFilter() { return { type: 'lowpass', frequency: param(), Q: param(), gain: param(), connect: (n: unknown) => n, disconnect() {} } }
    createOscillator() { return { type: 'sine', frequency: param(), connect: (n: unknown) => n, disconnect() {}, start() {}, stop() {} } }
  }
  vi.stubGlobal('AudioContext', AudioBoundary)
  return { sources, starts: () => sources.filter(s => s.start.mock.calls.length > 0).length }
}
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mount(create: (ctx: SceneContext) => SceneInstance, at: number, extra: Partial<SceneContext> = {}) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 408 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 408 }) as DOMRect
  const progress: number[] = [], haptic = vi.fn()
  const instance = create({ canvas, overlay, gestures, shared, initialProgress: at, onProgress: n => progress.push(n), haptic, isSoundEnabled: () => true, ...extra })
  instances.push(instance); instance.start()
  return { instance, overlay, scene: gpu.scene as THREE.Scene, button: overlay.querySelector<HTMLButtonElement>('button')!, hit: overlay.querySelector<HTMLElement>('.scene-hit-layer')!, progress, haptic }
}

describe('material sounds at accepted motion', () => {
  it.each([
    ['seven water bowls', createTibetanWaterBowls, 1, 'water-stream'],
    ['pouring for elders', createSongkran, 2, 'songkran-pour-stream'],
    ['coin washing', createZeniaraiCoinWashing, 1, 'wash-pour'],
  ] as const)('starts %s water during the actual stream and stops before settlement', (_name, create, at, streamName) => {
    const audio = audioBoundary(), s = mount(create, at), stream = s.scene.getObjectByName(streamName)!
    expect(audio.starts()).toBe(0); s.button.click(); expect(audio.starts()).toBe(0)
    for (let i = 0; i < 200 && !stream.visible; i++) { expect(audio.starts()).toBe(0); s.instance.update(.025) }
    expect(stream.visible).toBe(true); expect(audio.starts()).toBeGreaterThan(0); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
    const count = audio.starts(); audio.sources.forEach(source => source.stop.mockClear())
    for (let i = 0; i < 200 && stream.visible; i++) s.instance.update(.025)
    expect(audio.starts()).toBe(count); expect(audio.sources.every(source => source.stop.mock.calls.length > 0)).toBe(true)
    for (let i = 0; i < 100; i++) s.instance.update(.025)
    expect(s.progress).toEqual([at + 1]); expect(s.haptic).toHaveBeenCalledOnce()
  })

  it.each(['mute', 'pause', 'blur', 'hidden'] as const)('interrupts a water cue on %s without replaying on resume', kind => {
    const audio = audioBoundary(); let enabled = true, active = true, hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const s = mount(createTibetanWaterBowls, 1, { isSoundEnabled: () => enabled, isActive: () => active })
    s.button.click(); for (let i = 0; i < 200 && audio.starts() === 0; i++) s.instance.update(.025)
    const count = audio.starts(); expect(count).toBeGreaterThan(0); audio.sources.forEach(source => source.stop.mockClear())
    if (kind === 'mute') enabled = false
    if (kind === 'pause') active = false
    if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    if (kind === 'hidden') { hidden = true; document.dispatchEvent(new Event('visibilitychange')) }
    s.instance.update(.025); expect(audio.sources.every(source => source.stop.mock.calls.length > 0)).toBe(true)
    enabled = active = true; hidden = false; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'))
    for (let i = 0; i < 100; i++) s.instance.update(.025)
    expect(audio.starts()).toBe(count); expect(s.progress).toEqual([2])
  })

  it.each([
    ['wooden mallet contact', createKagamiBirakiSake, 1],
    ['outward beans', createSetsubunMamemaki, 1],
    ['inward beans', createSetsubunMamemaki, 2],
  ] as const)('sounds %s once before the step acceptance chime', (_name, create, at) => {
    const audio = audioBoundary(), s = mount(create, at)
    s.button.click(); expect(audio.starts()).toBe(0)
    for (let i = 0; i < 200 && audio.starts() === 0; i++) s.instance.update(.025)
    expect(audio.starts()).toBeGreaterThan(0); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
    const count = audio.starts(); for (let i = 0; i < 140; i++) s.instance.update(.025)
    expect(audio.starts()).toBe(count); expect(s.progress).toEqual([at + 1]); expect(s.haptic).toHaveBeenCalledOnce()
  })

  it.each([createTibetanWaterBowls, createSongkran, createZeniaraiCoinWashing, createKagamiBirakiSake, createSetsubunMamemaki])('keeps invalid and cancelled object input silent', create => {
    const audio = audioBoundary(), s = mount(create, 1)
    for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup']) { const event = new Event(type, { bubbles: true }); Object.assign(event, { clientX: 1, clientY: 1, pointerId: 1, button: 0 }); s.hit.dispatchEvent(event) }
    for (let i = 0; i < 60; i++) s.instance.update(.025)
    expect(audio.starts()).toBe(0); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
  })

  it.each([false, true])('creases paper once per accepted fold with one haptic, reduced=%s', reduced => {
    const audio = audioBoundary(), s = mount(createCrane, 0, { isReducedMotion: () => reduced })
    s.button.click(); expect(audio.starts()).toBeGreaterThan(0); expect(s.haptic).toHaveBeenCalledOnce()
    if (!reduced) { const count = audio.starts(); s.button.click(); expect(audio.starts()).toBe(count); expect(s.haptic).toHaveBeenCalledOnce() }
  })

  it.each([
    [createTibetanWaterBowls, 1], [createSongkran, 2], [createZeniaraiCoinWashing, 1], [createKagamiBirakiSake, 1], [createSetsubunMamemaki, 1],
  ] as const)('offers a brief equivalent operation cue for reduced motion', (create, at) => {
    const audio = audioBoundary(), s = mount(create, at, { isReducedMotion: () => true })
    s.button.click(); expect(audio.starts()).toBeGreaterThan(0); expect(s.progress).toEqual([at + 1]); expect(s.haptic).toHaveBeenCalledOnce()
  })
})
