import { describe, expect, it } from 'vitest'
import { createContinuousBed, createSoftSoundPlayer, type ContinuousBedKind, type SoftSound } from './soft-audio'

type Automation = { kind: 'set' | 'linear' | 'exponential'; value: number; time: number }
class AudioParamBoundary {
  value = 0
  events: Automation[] = []
  setValueAtTime(value: number, time: number) { this.events.push({ kind: 'set', value, time }); return this }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'linear', value, time }); return this }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'exponential', value, time }); return this }
}
class NodeBoundary {
  connections: unknown[] = []
  disconnected = false
  connect(node: unknown) { this.connections.push(node); return node }
  disconnect() { this.disconnected = true; this.connections = [] }
}
class SourceBoundary extends NodeBoundary {
  starts: number[] = []
  stops: number[] = []
  onended: (() => void) | null = null
  start(time: number) { this.starts.push(time) }
  stop(time: number) { this.stops.push(time) }
  end() { this.onended?.() }
}
class OscillatorBoundary extends SourceBoundary {
  type = 'sine'
  frequency = new AudioParamBoundary()
}
class BufferSourceBoundary extends SourceBoundary {
  buffer: unknown = null
  loop = false
}
class GainBoundary extends NodeBoundary { gain = new AudioParamBoundary() }
class FilterBoundary extends NodeBoundary {
  type = 'lowpass'
  frequency = new AudioParamBoundary()
  Q = new AudioParamBoundary()
}
// Web Audio is absent in Node. These boundaries retain the emitted graph and
// automation so assertions exercise the player's actual audio scheduling.
class AudioContextBoundary {
  currentTime = 3
  state = 'running'
  sampleRate = 48000
  destination = new NodeBoundary()
  sources: SourceBoundary[] = []
  gains: GainBoundary[] = []
  filters: FilterBoundary[] = []
  buffers: Float32Array[] = []
  closeCalls = 0
  close() { this.closeCalls++; return Promise.resolve() }
  createOscillator() { const node = new OscillatorBoundary(); this.sources.push(node); return node }
  createBufferSource() { const node = new BufferSourceBoundary(); this.sources.push(node); return node }
  createGain() { const node = new GainBoundary(); this.gains.push(node); return node }
  createBiquadFilter() { const node = new FilterBoundary(); this.filters.push(node); return node }
  createBuffer(_channels: number, length: number) {
    const samples = new Float32Array(length); this.buffers.push(samples)
    return { getChannelData: () => samples }
  }
  asContext() { return this as unknown as BaseAudioContext }
}
const sounds: SoftSound[] = ['complete', 'collect', 'saved', 'woodfish', 'paper', 'water', 'woodTap', 'beans', 'chime', 'glass', 'ceramic', 'fabric', 'metal', 'stone', 'hollow', 'air']
const playerFor = (context: AudioContextBoundary) => createSoftSoundPlayer({ context: () => context.asContext(), enabled: () => true })

describe('createSoftSoundPlayer', () => {
  it('reads the sound preference before obtaining a context on every play', () => {
    const context = new AudioContextBoundary()
    let enabled = false, requests = 0
    const player = createSoftSoundPlayer({ enabled: () => enabled, context: () => { requests++; return context.asContext() } })
    player.play('complete')
    expect(requests).toBe(0)
    enabled = true
    player.play('complete')
    expect(context.sources.length).toBeGreaterThan(0)
    const playing = context.sources.length
    enabled = false
    player.play('saved')
    expect(requests).toBe(1)
    expect(context.sources).toHaveLength(playing)
  })

  it.each(sounds)('schedules %s with a quiet attack and release inside a short window', sound => {
    const context = new AudioContextBoundary()
    playerFor(context).play(sound)
    expect(context.sources.length).toBeGreaterThan(0)
    for (const source of context.sources) {
      expect(source.starts[0]).toBeGreaterThanOrEqual(3)
      expect(source.stops[0]).toBeGreaterThan(source.starts[0])
      expect(source.stops[0]).toBeLessThanOrEqual(4.5)
    }
    expect(context.gains.length).toBeGreaterThan(0)
    for (const { gain } of context.gains) {
      expect(gain.events[0].value).toBe(0)
      expect(gain.events.at(-1)!.value).toBe(0)
      expect(gain.events.some(event => event.value > 0 && event.time > gain.events[0].time)).toBe(true)
      expect(Math.max(...gain.events.map(event => event.value))).toBeLessThanOrEqual(.08)
    }
  })

  it('uses filtered friction and flow noise for paper and water', () => {
    for (const sound of ['paper', 'water'] as const) {
      const context = new AudioContextBoundary()
      playerFor(context).play(sound)
      expect(context.sources.some(source => source instanceof BufferSourceBoundary)).toBe(true)
      expect(context.filters.some(filter => filter.type === 'bandpass')).toBe(true)
      expect(context.buffers[0].some(sample => sample !== 0)).toBe(true)
      expect(context.buffers[0].every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true)
    }
  })

  it.each([
    ['chime', .95, 1480], ['glass', .36, 1880], ['ceramic', .28, 780],
    ['metal', .42, 1080], ['stone', .2, 240], ['hollow', .24, 260],
  ] as const)('gives %s its own resonant pitch, duration and silent buffer edges', (sound, duration, frequency) => {
    const context = new AudioContextBoundary()
    playerFor(context).play(sound)
    const samples = context.buffers[0]
    expect(samples).toHaveLength(Math.ceil(duration * 48000))
    expect(Math.abs(samples[0])).toBe(0)
    expect(Math.abs(samples.at(-1)!)).toBeLessThan(.001)
    const energyAt = (pitch: number) => {
      let real = 0, imaginary = 0
      for (let index = 0; index < samples.length; index++) {
        const phase = Math.PI * 2 * pitch * index / 48000
        real += samples[index] * Math.cos(phase)
        imaginary += samples[index] * Math.sin(phase)
      }
      return Math.hypot(real, imaginary)
    }
    expect(energyAt(frequency)).toBeGreaterThan(energyAt(frequency + 270) * 5)
    expect(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true)
  })

  it('lets a chime ring longer than the short ceramic knock', () => {
    const chime = new AudioContextBoundary(), ceramic = new AudioContextBoundary()
    playerFor(chime).play('chime'); playerFor(ceramic).play('ceramic')
    const tailEnergy = (samples: Float32Array) => {
      const tail = samples.slice(4800, 9600)
      return tail.reduce((sum, sample) => sum + sample * sample, 0) / tail.length
    }
    expect(tailEnergy(chime.buffers[0])).toBeGreaterThan(tailEnergy(ceramic.buffers[0]) * 5)
    expect(chime.sources[0].stops[0]).toBeGreaterThan(ceramic.sources[0].stops[0] + .5)
  })

  it('softens fabric and air friction below the sharper paper rustle', () => {
    const roughness = (sound: SoftSound) => {
      const context = new AudioContextBoundary()
      playerFor(context).play(sound)
      const samples = context.buffers[0]
      expect(samples.length).toBeGreaterThan(1000)
      let energy = 0, change = 0
      for (let index = 1; index < samples.length; index++) {
        energy += samples[index] ** 2
        change += (samples[index] - samples[index - 1]) ** 2
      }
      expect(energy).toBeGreaterThan(0)
      expect(Math.abs(samples[0])).toBe(0)
      expect(Math.abs(samples.at(-1)!)).toBeLessThan(.001)
      return Math.sqrt(change / energy)
    }
    const paper = roughness('paper'), fabric = roughness('fabric'), air = roughness('air')
    expect(fabric).toBeLessThan(paper * .8)
    expect(air).toBeLessThan(fabric * .9)
  })

  it('stops scheduled notes, disconnects owned nodes, and can play again after stop', () => {
    const context = new AudioContextBoundary(), player = playerFor(context)
    player.play('complete')
    const sources = [...context.sources]
    player.stop(); player.stop()
    expect(sources.some(source => source.starts[0] > context.currentTime)).toBe(true)
    for (const source of sources) {
      expect(source.stops.at(-1)).toBe(context.currentTime)
      expect(source.disconnected).toBe(true)
      expect(source.onended).toBeNull()
    }
    expect(context.gains.every(gain => gain.disconnected)).toBe(true)
    player.play('saved')
    expect(context.sources.length).toBeGreaterThan(sources.length)
    expect(context.closeCalls).toBe(0)
  })

  it('releases a finished voice and frees its concurrency slot', () => {
    const context = new AudioContextBoundary(), player = playerFor(context)
    player.play('water')
    const first = [...context.sources]
    for (const source of first) source.end()
    expect(first.every(source => source.disconnected && source.onended === null)).toBe(true)
    expect([...context.gains, ...context.filters].every(node => node.disconnected)).toBe(true)
    player.play('water')
    expect(context.sources.length).toBeGreaterThan(first.length)
  })

  it('bounds rapid playback and accepts new sounds after those voices finish', () => {
    const context = new AudioContextBoundary(), player = playerFor(context)
    player.play('woodTap')
    const perPlay = context.sources.length
    expect(perPlay).toBeGreaterThan(0)
    for (let index = 0; index < 100; index++) player.play('woodTap')
    const limited = context.sources.length
    expect(limited).toBeLessThanOrEqual(perPlay * 4)
    for (const source of [...context.sources]) source.end()
    player.play('woodTap')
    expect(context.sources.length).toBe(limited + perPlay)
  })

  it('reclaims expired voices when a minimal audio host omits ended events', () => {
    const context = new AudioContextBoundary(), player = playerFor(context)
    for (let index = 0; index < 4; index++) player.play('woodTap')
    const sources = [...context.sources]
    context.currentTime = 5
    player.play('woodTap')
    expect(sources.every(source => source.disconnected)).toBe(true)
    expect(context.sources.length).toBeGreaterThan(sources.length)
  })

  it('makes disposal permanent and idempotent without closing its caller-owned context', () => {
    const context = new AudioContextBoundary()
    let requests = 0
    const player = createSoftSoundPlayer({ enabled: () => true, context: () => { requests++; return context.asContext() } })
    player.play('beans')
    const count = context.sources.length
    player.dispose(); player.dispose(); player.stop(); player.play('complete')
    expect(context.sources.every(source => source.disconnected)).toBe(true)
    expect(context.sources).toHaveLength(count)
    expect(requests).toBe(1)
    expect(context.closeCalls).toBe(0)
  })

  it.each([
    { duration: NaN, strength: Infinity },
    { duration: Infinity, strength: NaN },
    { duration: -1, strength: 1e100 },
    { duration: 1e100, strength: 1e100 },
  ])('keeps malformed or excessive options finite and bounded: %o', options => {
    const context = new AudioContextBoundary()
    playerFor(context).play('water', options)
    expect(context.sources.length).toBeGreaterThan(0)
    for (const source of context.sources) {
      expect(source.starts.every(Number.isFinite)).toBe(true)
      expect(source.stops.every(time => Number.isFinite(time) && time <= 4.5)).toBe(true)
    }
    for (const gain of context.gains) {
      expect(gain.gain.events.every(event => Number.isFinite(event.time) && Number.isFinite(event.value) && event.value <= .08)).toBe(true)
    }
  })

  it('treats zero strength as silence before requesting the context', () => {
    let requests = 0
    const player = createSoftSoundPlayer({ enabled: () => true, context: () => { requests++; return null } })
    player.play('paper', { strength: 0 })
    expect(requests).toBe(0)
  })

  it.each(['__proto__', 'constructor', 'unknown'])('ignores unknown runtime sound %s before obtaining a context', sound => {
    let requests = 0
    const player = createSoftSoundPlayer({ enabled: () => true, context: () => { requests++; return null } })
    player.play(sound as SoftSound)
    expect(requests).toBe(0)
  })

  it('degrades gracefully without buffer, filter, linear-ramp, or disconnect support', () => {
    const context = new AudioContextBoundary()
    const legacy = {
      state: 'running', currentTime: 0, destination: {},
      createGain: () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
      createOscillator: () => {
        const source = context.createOscillator()
        return { type: 'sine', frequency: { setValueAtTime() {} }, start: source.start.bind(source), stop: source.stop.bind(source), connect() {} }
      },
    }
    const player = createSoftSoundPlayer({ enabled: () => true, context: () => legacy as unknown as BaseAudioContext })
    for (const sound of sounds) { expect(() => player.play(sound)).not.toThrow(); player.stop() }
    // Legacy hosts still get the three UI cues; material sounds need buffers.
    expect(context.sources.length).toBeGreaterThanOrEqual(3)
    expect(() => player.dispose()).not.toThrow()
  })

  it('keeps unavailable or failing contexts from breaking the interaction', () => {
    const context = new AudioContextBoundary()
    context.state = 'closed'
    for (const getContext of [() => null, () => { throw Error('unavailable') }, () => context.asContext()]) {
      const player = createSoftSoundPlayer({ enabled: () => true, context: getContext })
      expect(() => player.play('complete')).not.toThrow()
    }
    expect(context.sources).toHaveLength(0)
  })

  it('synthesizes 4-mode modal overtones and courtyard micro-reflections inside resonant buffers', () => {
    const context = new AudioContextBoundary()
    playerFor(context).play('chime')
    const samples = context.buffers[0]
    const energyAt = (pitch: number) => {
      let real = 0, imaginary = 0
      for (let index = 0; index < samples.length; index++) {
        const phase = Math.PI * 2 * pitch * index / 48000
        real += samples[index] * Math.cos(phase)
        imaginary += samples[index] * Math.sin(phase)
      }
      return Math.hypot(real, imaginary)
    }
    // 2.756 and 4.18 modal shimmer partials carry distinct energy over off-mode frequencies.
    expect(energyAt(1480 * 2.756)).toBeGreaterThan(energyAt(1480 * 2.756 + 270) * 3)
    expect(energyAt(1480 * 4.18)).toBeGreaterThan(energyAt(1480 * 4.18 + 270) * 2)
    // Short ceramic knock retains a gentle low-passed courtyard early reflection around ~47-79ms.
    const ceramicCtx = new AudioContextBoundary()
    playerFor(ceramicCtx).play('ceramic')
    const ceramicSamples = ceramicCtx.buffers[0]
    const echoWindow = ceramicSamples.slice(Math.round(.045 * 48000), Math.round(.095 * 48000))
    const echoEnergy = echoWindow.reduce((sum, s) => sum + s * s, 0) / echoWindow.length
    expect(echoEnergy).toBeGreaterThan(1e-5)
    expect(Math.abs(ceramicSamples.at(-1)!)).toBeLessThan(.001)
  })
})

describe('createContinuousBed and player.bed', () => {
  const bedKinds: ContinuousBedKind[] = ['paper', 'water', 'fabric', 'woodRub']

  it.each(bedKinds)('lazily starts %s bed above 0.02 speed, modulates cutoff/gain <= 0.045, and disconnects cleanly', kind => {
    const context = new AudioContextBoundary()
    let requests = 0
    const bed = createContinuousBed({
      context: () => { requests++; return context.asContext() },
      enabled: () => true,
      kind,
    })

    // Below threshold: silent no-op without touching AudioContext.
    bed.setSpeed(0)
    bed.setSpeed(0.02)
    expect(requests).toBe(0)
    expect(context.sources).toHaveLength(0)

    // Above threshold: lazily creates one looped buffer source + bandpass filter + quiet gain.
    bed.setSpeed(0.25)
    expect(requests).toBe(1)
    expect(context.sources).toHaveLength(1)
    const source = context.sources[0] as BufferSourceBoundary
    expect(source.loop).toBe(true)
    expect(context.filters).toHaveLength(1)
    expect(context.filters[0].type).toBe('bandpass')
    expect(context.gains).toHaveLength(1)
    const gain = context.gains[0]
    expect(gain.gain.events[0].value).toBe(0)
    const slowFreq = context.filters[0].frequency.events.at(-1)!.value
    const slowGain = gain.gain.events.at(-1)!.value
    expect(slowGain).toBeGreaterThan(0)
    expect(slowGain).toBeLessThanOrEqual(.045)

    // Higher speed raises both cutoff frequency and quiet gain (bounded <= 0.045) without creating new nodes.
    context.currentTime = 3.2
    bed.setSpeed(1)
    expect(context.sources).toHaveLength(1)
    const fastFreq = context.filters[0].frequency.events.at(-1)!.value
    const fastGain = gain.gain.events.at(-1)!.value
    expect(fastFreq).toBeGreaterThan(slowFreq)
    expect(fastGain).toBeGreaterThan(slowGain)
    expect(fastGain).toBeLessThanOrEqual(.045)

    // Setting speed to 0 fades to 0 and disconnects all owned nodes cleanly.
    context.currentTime = 3.4
    bed.setSpeed(0)
    expect(gain.gain.events.at(-1)!.value).toBe(0)
    expect(source.disconnected).toBe(true)
    expect(context.filters[0].disconnected).toBe(true)
    expect(gain.disconnected).toBe(true)

    // Can restart cleanly before disposal, and becomes inert after dispose.
    context.currentTime = 3.6
    bed.setSpeed(0.6)
    expect(context.sources).toHaveLength(2)
    bed.dispose()
    bed.dispose()
    bed.setSpeed(0.8)
    expect(context.sources).toHaveLength(2)
    expect(context.gains.every(g => g.disconnected)).toBe(true)
  })

  it('automatically stops and disposes player.bed handles with the parent player', () => {
    const context = new AudioContextBoundary()
    const player = playerFor(context)
    const bed = player.bed('water')
    bed.setSpeed(0.5)
    expect(context.sources).toHaveLength(1)

    player.stop()
    expect(context.sources[0].disconnected).toBe(true)
    expect(context.gains[0].disconnected).toBe(true)

    // Restarting works after player.stop(), then player.dispose() permanently releases it.
    bed.setSpeed(0.7)
    expect(context.sources).toHaveLength(2)
    player.dispose()
    expect(context.sources.every(s => s.disconnected)).toBe(true)
    bed.setSpeed(0.9)
    expect(context.sources).toHaveLength(2)
  })
})
