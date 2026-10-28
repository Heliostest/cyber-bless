// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChimeAudio, createSceneFeedback } from './procedural-kit'

// Web Audio is the browser boundary; the real player and feedback remain in use.
function audioBoundary() {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const contexts: AudioBoundary[] = []
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} })
  class AudioBoundary {
    state = 'running'; currentTime = 0; sampleRate = 24000; destination = {}
    close = vi.fn(async () => {}); resume = vi.fn(async () => {})
    constructor() { contexts.push(this) }
    createBuffer(channels: number, length: number, sampleRate: number) {
      const data = Array.from({ length: channels }, () => new Float32Array(length))
      return { duration: length / sampleRate, length, sampleRate, numberOfChannels: channels, getChannelData: (i: number) => data[i]!, copyToChannel: (from: Float32Array, i: number) => data[i]!.set(from) }
    }
    createBufferSource() {
      const source = { buffer: null, playbackRate: param(), connect: (n: unknown) => n, disconnect() {}, start: vi.fn(), stop: vi.fn(), onended: null }
      sources.push(source); return source
    }
    createGain() { return { gain: param(), connect: (n: unknown) => n, disconnect() {} } }
    createBiquadFilter() { return { type: 'lowpass', frequency: param(), Q: param(), gain: param(), connect: (n: unknown) => n, disconnect() {} } }
    createOscillator() { return { type: 'sine', frequency: param(), connect: (n: unknown) => n, disconnect() {}, start() {}, stop() {} } }
  }
  vi.stubGlobal('AudioContext', AudioBoundary)
  return { sources, contexts, starts: () => sources.filter(s => s.start.mock.calls.length > 0).length }
}

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(f => f()); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('operation audio lifecycle', () => {
  it('shares the unlocked context with material sounds and keeps sound-only cues free of extra haptics', () => {
    const audio = audioBoundary(), haptic = vi.fn()
    const fx = createSceneFeedback({ haptic, isSoundEnabled: () => true })
    cleanups.push(() => fx.dispose())
    fx.prepare(); fx.sound('paper', { duration: .16 }); fx.impact()
    expect(audio.contexts).toHaveLength(1)
    expect(audio.starts()).toBeGreaterThan(0)
    expect(haptic).toHaveBeenCalledOnce()
  })

  it('stops on the live mute gate and does not replay a cue when unmuted', () => {
    const audio = audioBoundary(); let enabled = false
    const fx = createSceneFeedback({ isSoundEnabled: () => enabled })
    cleanups.push(() => fx.dispose())
    fx.sound('water', { duration: 1 }); expect(audio.starts()).toBe(0)
    enabled = true; fx.sound('water', { duration: 1 }); const starts = audio.starts()
    expect(starts).toBeGreaterThan(0)
    audio.sources.forEach(s => s.stop.mockClear())
    enabled = false; fx.update()
    expect(audio.sources.every(s => s.stop.mock.calls.length > 0)).toBe(true)
    enabled = true; fx.update(); expect(audio.starts()).toBe(starts)
  })

  it.each(['blur', 'visibility', 'pause'] as const)('stops on %s and never replays the interrupted sound', kind => {
    const audio = audioBoundary(); let active = true, hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const fx = createSceneFeedback({ isSoundEnabled: () => true, isActive: () => active })
    cleanups.push(() => fx.dispose())
    fx.sound('water', { duration: 1 }); const starts = audio.starts()
    expect(starts).toBeGreaterThan(0); audio.sources.forEach(s => s.stop.mockClear())
    if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else if (kind === 'visibility') { hidden = true; document.dispatchEvent(new Event('visibilitychange')) }
    else { active = false; fx.update() }
    expect(audio.sources.every(s => s.stop.mock.calls.length > 0)).toBe(true)
    fx.sound('water'); expect(audio.starts()).toBe(starts)
    active = true; hidden = false; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); fx.update()
    expect(audio.starts()).toBe(starts)
  })

  it('removes owned listeners and closes its one context once on repeated disposal', () => {
    const audio = audioBoundary(), added = vi.spyOn(EventTarget.prototype, 'addEventListener'), removed = vi.spyOn(EventTarget.prototype, 'removeEventListener')
    const fx = createSceneFeedback({ isSoundEnabled: () => true })
    fx.sound('paper'); fx.dispose(); fx.dispose(); fx.sound('paper')
    expect(audio.contexts[0]!.close).toHaveBeenCalledOnce()
    const listeners = added.mock.calls.map((args, i) => ({ args, target: added.mock.contexts[i] })).filter(({ args }) => ['visibilitychange', 'blur', 'focus'].includes(args[0]))
    expect(listeners.length).toBeGreaterThan(0)
    for (const { args: [type, listener], target } of listeners) expect(removed.mock.calls.filter(([t, l], i) => t === type && l === listener && removed.mock.contexts[i] === target)).toHaveLength(1)
  })

  it('retains the chime API when material buffer support is absent', () => {
    const starts = vi.fn()
    class OldAudioBoundary {
      state = 'running'; currentTime = 0; destination = {}; close = async () => {}
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n } }
      createOscillator() { return { frequency: { setValueAtTime() {} }, connect: (n: unknown) => n, start: starts, stop() {} } }
    }
    vi.stubGlobal('AudioContext', OldAudioBoundary)
    const audio = createChimeAudio(); cleanups.push(() => audio.dispose())
    expect(() => audio.sound('water')).not.toThrow()
    audio.unlock(); audio.play({ freqs: [440, 660], duration: .3 }); audio.stop()
    expect(starts).toHaveBeenCalledTimes(2)
  })

  it('resumes a material cue triggered directly from a gesture after context suspension', () => {
    const boundary = audioBoundary(), audio = createChimeAudio()
    cleanups.push(() => audio.dispose())
    audio.unlock(); const context = boundary.contexts[0]!
    context.state = 'suspended'; context.resume.mockClear()
    audio.sound('paper')
    expect(context.resume).toHaveBeenCalledOnce()
  })
})
