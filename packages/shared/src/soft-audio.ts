export type SoftSound = 'complete' | 'collect' | 'saved' | 'woodfish' | 'paper' | 'water' | 'woodTap' | 'beans'
  | 'chime' | 'glass' | 'ceramic' | 'fabric' | 'metal' | 'stone' | 'hollow' | 'air'
/** Duration is in seconds; strength is a relative level between zero and one. */
export type SoftSoundOptions = { duration?: number; strength?: number }
export type ContinuousBedKind = 'paper' | 'water' | 'fabric' | 'woodRub'
export type ContinuousBed = {
  setSpeed(speed01: number): void
  stop(): void
  dispose(): void
}

type MaterialSound = Exclude<SoftSound, 'complete' | 'collect' | 'saved'>
type Voice = {
  context: BaseAudioContext
  sources: Set<AudioScheduledSourceNode>
  nodes: Set<AudioNode>
  endsAt: number
}
type ResonanceSpec = {
  frequency: number
  decay: number
  modes: readonly (readonly [ratio: number, level: number, decayMul: number])[]
  beatHz: number
  beatAmp: number
  transientDecay: number
  transientAmp: number
  transientSmooth: number
  thudFreq: number
  thudAmp: number
}
type BedSpec = {
  minFreq: number
  maxFreq: number
  q: number
  maxGain: number
  smoothing: number
  modHz: number
  modDepth: number
  woodBodyHz: number
}

const durations: Record<SoftSound, number> = {
  complete: .58, collect: .46, saved: .42,
  woodfish: .3, paper: .38, water: .8, woodTap: .16, beans: .46,
  chime: .95, glass: .36, ceramic: .28, fabric: .42, metal: .42, stone: .2, hollow: .24, air: .48,
}
const tau = Math.PI * 2
const waterDrops = [
  [.10, 680, 1200],
  [.27, 940, 1500],
  [.44, 820, 1350],
  [.63, 1020, 1600],
  [.78, 740, 1150],
] as const
const beanTaps = [[0, 370], [.18, 490], [.39, 330], [.63, 560], [.82, 420]] as const

// 4-mode inharmonic physical modal parameters + contact transient. These cues
// suggest the displayed surfaces; they are synthesized product feedback, not recordings.
const resonances: Record<'chime' | 'glass' | 'ceramic' | 'metal' | 'stone' | 'hollow', ResonanceSpec> = {
  chime: {
    frequency: 1480,
    decay: 5,
    modes: [[1, 1, 1], [2.756, .24, 1.65], [4.18, .11, 2.35], [5.41, .055, 3.1]],
    beatHz: 1.5,
    beatAmp: .10,
    transientDecay: 400,
    transientAmp: .10,
    transientSmooth: .36,
    thudFreq: 0,
    thudAmp: 0,
  },
  glass: {
    frequency: 1880,
    decay: 17,
    modes: [[1, 1, 1], [1.53, .20, 1.45], [2.38, .12, 2.05], [3.12, .06, 2.8]],
    beatHz: 0,
    beatAmp: 0,
    transientDecay: 420,
    transientAmp: .13,
    transientSmooth: .46,
    thudFreq: 0,
    thudAmp: 0,
  },
  ceramic: {
    frequency: 780,
    decay: 31,
    modes: [[1, 1, 1], [1.43, .22, 1.55], [2.19, .13, 2.25], [2.94, .065, 3.0]],
    beatHz: 0,
    beatAmp: 0,
    transientDecay: 300,
    transientAmp: .13,
    transientSmooth: .22,
    thudFreq: 190,
    thudAmp: .11,
  },
  metal: {
    frequency: 1080,
    decay: 16,
    modes: [[1, 1, 1], [2.71, .26, 1.55], [3.86, .14, 2.2], [5.12, .07, 2.9]],
    beatHz: 2.1,
    beatAmp: .10,
    transientDecay: 360,
    transientAmp: .12,
    transientSmooth: .38,
    thudFreq: 0,
    thudAmp: 0,
  },
  stone: {
    frequency: 240,
    decay: 52,
    modes: [[1, 1, 1], [1.47, .22, 1.55], [2.11, .08, 2.6], [2.89, .055, 3.2]],
    beatHz: 0,
    beatAmp: 0,
    transientDecay: 320,
    transientAmp: .10,
    transientSmooth: .18,
    thudFreq: 120,
    thudAmp: .08,
  },
  hollow: {
    frequency: 260,
    decay: 27,
    modes: [[1, 1, 1], [1.9, .18, 1.5], [2.86, .10, 2.2], [3.92, .05, 3.0]],
    beatHz: 0,
    beatAmp: 0,
    transientDecay: 240,
    transientAmp: .13,
    transientSmooth: .15,
    thudFreq: 140,
    thudAmp: .10,
  },
}

const woodModes = [
  [1, 1, 1],
  [1.63, .28, 1.45],
  [2.47, .14, 2.15],
  [3.38, .06, 2.95],
] as const

const courtyardReflections = [
  [.023, .11],
  [.047, .065],
  [.079, .035],
] as const

const bedSpecs: Record<ContinuousBedKind, BedSpec> = {
  paper: { minFreq: 850, maxFreq: 2100, q: .85, maxGain: .036, smoothing: .22, modHz: 14, modDepth: .12, woodBodyHz: 0 },
  water: { minFreq: 480, maxFreq: 1350, q: .90, maxGain: .042, smoothing: .12, modHz: 5.5, modDepth: .16, woodBodyHz: 0 },
  fabric: { minFreq: 520, maxFreq: 1250, q: .75, maxGain: .034, smoothing: .08, modHz: 7.5, modDepth: .11, woodBodyHz: 0 },
  woodRub: { minFreq: 320, maxFreq: 860, q: 1.05, maxGain: .038, smoothing: .06, modHz: 4.2, modDepth: .10, woodBodyHz: 245 },
}

const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

let noiseCounter = 0x51a7c3d1
function createNoise() {
  noiseCounter = (Math.imul(noiseCounter, 1664525) + 1013904223) | 0
  let state = noiseCounter || 9781
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    return state * 4.656612873077393e-10
  }
}

/** A warm carved-cavity wooden resonance with 4 inharmonic modes and a soft mallet skin impulse. */
function woodenPulse(time: number, frequency: number, decay: number, skinNoise: number) {
  if (time < 0) return 0
  let modal = 0
  for (const [ratio, level, decayMul] of woodModes) {
    modal += level * Math.sin(tau * frequency * ratio * time) * Math.exp(-decay * decayMul * time)
  }
  const skin = skinNoise * .16 * Math.exp(-260 * time)
    + .12 * Math.sin(tau * frequency * .54 * time) * Math.exp(-150 * time)
  return (modal + skin) * Math.min(1, time / .003)
}

/** Synthesize short material cues locally; these are product sound design. */
function materialBuffer(context: BaseAudioContext, sound: MaterialSound, duration: number) {
  const sampleRate = bounded(context.sampleRate, 44100, 8000, 96000)
  const length = Math.ceil(duration * sampleRate)
  const buffer = context.createBuffer(1, length, sampleRate)
  const samples = buffer.getChannelData(0)
  const dry = new Float32Array(length)
  const nextNoise = createNoise()
  let smoothed = 0, smoothed2 = 0, transientLp = 0

  const isFriction = sound === 'paper' || sound === 'fabric' || sound === 'air'
  const isResonance = Object.hasOwn(resonances, sound)
  const spec = isResonance ? resonances[sound as keyof typeof resonances] : undefined

  for (let index = 0; index < length; index++) {
    const time = index / sampleRate, progress = time / duration
    const rawNoise = nextNoise()
    let sample = 0
    if (sound === 'paper' || sound === 'water' || sound === 'fabric' || sound === 'air') {
      // Remove the harsh, highest frequencies even when a host has no filters,
      // preserving the roughness ordering air < fabric < paper.
      if (sound === 'paper') {
        smoothed += (rawNoise - smoothed) * .24
        smoothed2 += (rawNoise - smoothed2) * .36
        const weave = .60 + .15 * Math.sin(tau * 17 * time) + .08 * Math.sin(tau * 29 * time + 1.1)
        sample = (smoothed * .80 + smoothed2 * .26) * weave
      } else if (sound === 'fabric') {
        smoothed += (rawNoise - smoothed) * .085
        smoothed2 += (smoothed - smoothed2) * .16
        const brush = .52 + .14 * Math.sin(tau * 6 * time) + .07 * Math.sin(tau * 11.5 * time + .7)
        sample = (smoothed * .65 + smoothed2 * .40) * brush
      } else if (sound === 'air') {
        smoothed += (rawNoise - smoothed) * .038
        smoothed2 += (smoothed - smoothed2) * .075
        const breath = Math.sin(Math.PI * progress) * (.86 + .14 * Math.sin(tau * 3.5 * time))
        sample = smoothed2 * .56 * breath
      } else {
        smoothed += (rawNoise - smoothed) * .12
        smoothed2 += (smoothed - smoothed2) * .05
        sample = (smoothed * .68 + smoothed2 * .26) * (.72 + .12 * Math.sin(tau * 4.2 * time))
        for (const [offset, frequency, sweep] of waterDrops) {
          const dropTime = time - offset * duration
          if (dropTime >= 0) {
            const pitchPhase = frequency * dropTime + sweep * dropTime * dropTime
            sample += .11 * Math.sin(tau * pitchPhase) * Math.exp(-52 * dropTime) * Math.min(1, dropTime / .004)
          }
        }
      }
    } else if (sound === 'woodfish') {
      transientLp += (rawNoise - transientLp) * .18
      sample = woodenPulse(time, 390, 18, transientLp) * .64
    } else if (sound === 'woodTap') {
      transientLp += (rawNoise - transientLp) * .22
      sample = woodenPulse(time, 310, 38, transientLp) * .54
    } else if (spec) {
      transientLp += (rawNoise - transientLp) * spec.transientSmooth
      let modal = 0
      for (const [ratio, level, decayMul] of spec.modes) {
        const modeFreq = spec.frequency * ratio
        if (modeFreq >= sampleRate * .46) continue
        modal += level * Math.sin(tau * modeFreq * time) * Math.exp(-spec.decay * decayMul * time)
      }
      if (spec.beatHz > 0 && spec.beatAmp > 0) {
        modal += spec.beatAmp * Math.sin(tau * (spec.frequency + spec.beatHz) * time) * Math.exp(-spec.decay * 1.06 * time)
      }
      const contact = transientLp * spec.transientAmp * Math.exp(-spec.transientDecay * time)
        + (spec.thudAmp > 0 ? spec.thudAmp * Math.sin(tau * spec.thudFreq * time) * Math.exp(-180 * time) : 0)
      sample = .54 * (modal + contact) * Math.min(1, time / .0025)
    } else {
      transientLp += (rawNoise - transientLp) * .24
      for (const [offset, frequency] of beanTaps) {
        sample += woodenPulse(time - offset * duration, frequency, 75, transientLp) * .28
      }
    }
    dry[index] = sample
  }

  // Subtle low-passed courtyard early-reflection micro-echoes baked directly into
  // the cue buffer so resonant/wooden impacts breathe without extra gain buses.
  if (!isFriction) {
    const warmLp = new Float32Array(length)
    let lp = 0
    for (let index = 0; index < length; index++) {
      lp += (dry[index]! - lp) * .24
      warmLp[index] = lp
    }
    const echoScale = sound === 'water' ? .65 : 1
    const tapDelays = courtyardReflections.map(([sec, gain]) => [Math.round(sec * sampleRate), gain * echoScale] as const)
    for (let index = 0; index < length; index++) {
      let value = dry[index]!
      for (const [delay, gain] of tapDelays) {
        if (index >= delay) value += warmLp[index - delay]! * gain
      }
      const time = index / sampleRate
      const remaining = (length - 1 - index) / sampleRate
      const edge = Math.min(1, time / .004, remaining / .018)
      samples[index] = Math.max(-1, Math.min(1, value * Math.max(0, edge)))
    }
  } else {
    for (let index = 0; index < length; index++) {
      const time = index / sampleRate
      const remaining = (length - 1 - index) / sampleRate
      const edge = Math.min(1, time / .006, remaining / .018)
      samples[index] = Math.max(-1, Math.min(1, dry[index]! * Math.max(0, edge)))
    }
  }
  return buffer
}

function continuousBedBuffer(context: BaseAudioContext, kind: ContinuousBedKind) {
  const spec = bedSpecs[kind]
  const sampleRate = bounded(context.sampleRate, 44100, 8000, 96000)
  const duration = 1.2
  const length = Math.ceil(duration * sampleRate)
  const fade = Math.min(Math.floor(length / 4), Math.round(.04 * sampleRate))
  const buffer = context.createBuffer(1, length, sampleRate)
  const samples = buffer.getChannelData(0)
  const raw = new Float32Array(length + fade)
  const nextNoise = createNoise()
  let lp = 0, lp2 = 0
  for (let index = 0; index < raw.length; index++) {
    const time = index / sampleRate
    lp += (nextNoise() - lp) * spec.smoothing
    lp2 += (lp - lp2) * Math.min(1, spec.smoothing * 1.4)
    const mod = 1 + spec.modDepth * Math.sin(tau * spec.modHz * time)
    let value = (lp * .65 + lp2 * .35) * mod
    if (spec.woodBodyHz > 0) {
      value += .08 * Math.sin(tau * spec.woodBodyHz * time) * (.5 + .5 * Math.sin(tau * 2.3 * time))
    }
    raw[index] = value
  }
  // Crossfade loop seam so continuous playback repeats without clicks.
  for (let index = 0; index < length; index++) {
    let value = raw[index]!
    if (index < fade) {
      const blend = index / Math.max(1, fade)
      value = raw[index]! * blend + raw[length + index]! * (1 - blend)
    }
    samples[index] = Math.max(-1, Math.min(1, value))
  }
  return buffer
}

function disconnect(node: AudioNode) {
  try { node.disconnect?.() } catch { /* The context may already be closed. */ }
}

function rampParam(param: AudioParam, target: number, now: number, rampSeconds: number) {
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(target, now + rampSeconds)
  } else if (typeof param.setTargetAtTime === 'function') {
    param.setTargetAtTime(target, now, Math.max(.005, rampSeconds / 3))
  } else if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(target, now)
  } else {
    param.value = target
  }
}

/**
 * Continuous velocity-modulated friction/flow sound bed for interactive drag,
 * rub, and pour gestures. Starts lazily when speed exceeds 0.02 and releases
 * cleanly on stop, silence, or disposal.
 */
export function createContinuousBed(options: {
  context: () => BaseAudioContext | null
  enabled: () => boolean
  kind: ContinuousBedKind
}): ContinuousBed {
  const spec = Object.hasOwn(bedSpecs, options.kind) ? bedSpecs[options.kind] : bedSpecs.paper
  let disposed = false
  let active: {
    context: BaseAudioContext
    source: AudioBufferSourceNode
    filter?: BiquadFilterNode
    gain: GainNode
  } | null = null

  function stop(): void {
    const current = active
    if (!current) return
    active = null
    try {
      const now = Number.isFinite(current.context.currentTime) && current.context.currentTime >= 0
        ? current.context.currentTime
        : 0
      rampParam(current.gain.gain, 0, now, .015)
      try { current.source.stop(now) } catch { /* Already ended. */ }
    } catch {
      // Ignore failures from closed contexts.
    }
    disconnect(current.source)
    if (current.filter) disconnect(current.filter)
    disconnect(current.gain)
  }

  function setSpeed(speed01: number): void {
    if (disposed) return
    const speed = bounded(speed01, 0, 0, 1)
    if (!options.enabled() || speed <= .02) {
      stop()
      return
    }
    try {
      const context = options.context()
      if (!context || context.state === 'closed' || !Number.isFinite(context.currentTime) || context.currentTime < 0) {
        stop()
        return
      }
      if (active && active.context !== context) stop()
      const now = context.currentTime
      if (!active) {
        if (typeof context.createBuffer !== 'function' || typeof context.createBufferSource !== 'function') return
        const source = context.createBufferSource()
        const gain = context.createGain()
        let filter: BiquadFilterNode | undefined
        try {
          source.buffer = continuousBedBuffer(context, Object.hasOwn(bedSpecs, options.kind) ? options.kind : 'paper')
          source.loop = true
          if (typeof context.createBiquadFilter === 'function') {
            filter = context.createBiquadFilter()
            filter.type = 'bandpass'
            filter.frequency.setValueAtTime(spec.minFreq, now)
            filter.Q.setValueAtTime(spec.q, now)
            source.connect(filter)
            filter.connect(gain)
          } else {
            source.connect(gain)
          }
          gain.connect(context.destination)
          gain.gain.setValueAtTime(0, now)
          source.start(now)
          active = { context, source, filter, gain }
        } catch {
          disconnect(source)
          if (filter) disconnect(filter)
          disconnect(gain)
          return
        }
      }
      const targetFreq = spec.minFreq + (spec.maxFreq - spec.minFreq) * speed
      const targetGain = Math.min(.045, spec.maxGain * Math.pow(speed, .85))
      if (active.filter) rampParam(active.filter.frequency, targetFreq, now, .045)
      rampParam(active.gain.gain, targetGain, now, .045)
    } catch {
      stop()
    }
  }

  return {
    setSpeed,
    stop,
    dispose(): void {
      if (disposed) return
      disposed = true
      stop()
    },
  }
}

/**
 * Schedule optional, quiet cues on a caller-owned audio context. The caller owns
 * context creation, unlocking and closing; this player only owns its nodes.
 */
export function createSoftSoundPlayer(options: { context: () => BaseAudioContext | null; enabled: () => boolean }) {
  const voices = new Set<Voice>()
  const beds = new Set<ContinuousBed>()
  let disposed = false

  function release(voice: Voice, stopSources = false) {
    voices.delete(voice)
    for (const source of voice.sources) {
      source.onended = null
      if (stopSources) {
        try { source.stop(voice.context.currentTime) } catch { /* Already ended. */ }
      }
    }
    for (const node of voice.nodes) disconnect(node)
    voice.sources.clear()
    voice.nodes.clear()
  }

  function schedule(voice: Voice, source: AudioScheduledSourceNode, start: number, length: number, peak: number, filter?: BiquadFilterNode, sustain = false) {
    voice.sources.add(source)
    voice.nodes.add(source)
    const gain = voice.context.createGain()
    voice.nodes.add(gain)
    if (filter) {
      voice.nodes.add(filter)
      source.connect(filter)
      filter.connect(gain)
    } else source.connect(gain)
    gain.connect(voice.context.destination)
    const end = start + length, attack = Math.min(.018, length * .2), tail = Math.min(.018, length * .15)
    gain.gain.setValueAtTime(0, start)
    if (typeof gain.gain.linearRampToValueAtTime === 'function') {
      gain.gain.linearRampToValueAtTime(peak, start + attack)
      if (sustain) gain.gain.setValueAtTime(peak, start + length * .65)
      if (!sustain && typeof gain.gain.exponentialRampToValueAtTime === 'function') {
        gain.gain.exponentialRampToValueAtTime(.0001, end - tail)
      }
      gain.gain.linearRampToValueAtTime(0, end)
    } else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
      // Older embedded contexts may expose only exponential automation.
      gain.gain.setValueAtTime(.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + attack)
      gain.gain.exponentialRampToValueAtTime(.0001, end)
      gain.gain.setValueAtTime(0, end)
    } else {
      gain.gain.setValueAtTime(peak, start + attack)
      gain.gain.setValueAtTime(0, end)
    }
    voice.endsAt = Math.max(voice.endsAt, end)
    source.onended = () => {
      source.onended = null
      voice.sources.delete(source)
      disconnect(source)
      if (voice.sources.size === 0) release(voice)
    }
    source.start(start)
    source.stop(end)
  }

  function play(sound: SoftSound, settings: SoftSoundOptions = {}): void {
    let voice: Voice | undefined
    try {
      if (disposed || !options.enabled() || !Object.hasOwn(durations, sound)) return
      const strength = bounded(settings.strength, .75, 0, 1)
      if (strength === 0) return
      const context = options.context()
      if (!context || context.state === 'closed' || !Number.isFinite(context.currentTime) || context.currentTime < 0) return
      for (const active of voices) {
        if (active.context.state === 'closed' || active.context.currentTime >= active.endsAt) release(active, true)
      }
      // Dropping excess cues keeps rapid repeated taps from building up volume.
      if (voices.size >= 4) return
      const duration = bounded(settings.duration, durations[sound], .06, 1.2)
      const now = context.currentTime
      voice = { context, sources: new Set(), nodes: new Set(), endsAt: now }
      voices.add(voice)
      if (sound === 'complete' || sound === 'collect' || sound === 'saved') {
        const notes = sound === 'complete'
          ? [[440, 0, .65, .55], [554.37, .18, .68, .65], [659.25, .35, .65, .75]]
          : sound === 'collect'
            ? [[659.25, 0, .36, .35], [523.25, .15, .45, .5], [440, .32, .68, .65]]
            : [[523.25, 0, .63, .7], [659.25, .25, .75, .65]]
        for (const [frequency, offset, length, level] of notes) {
          const source = context.createOscillator()
          // Register before configuration so a partial host failure is cleaned up.
          voice.nodes.add(source)
          source.type = 'sine'
          source.frequency.setValueAtTime(frequency, now + offset * duration)
          schedule(voice, source, now + offset * duration, length * duration, .034 * strength * level)
        }
      } else if (typeof context.createBuffer === 'function' && typeof context.createBufferSource === 'function') {
        const source = context.createBufferSource()
        voice.nodes.add(source)
        source.buffer = materialBuffer(context, sound, duration)
        let filter: BiquadFilterNode | undefined
        if (typeof context.createBiquadFilter === 'function') {
          filter = context.createBiquadFilter()
          voice.nodes.add(filter)
          filter.type = sound === 'paper' || sound === 'water' || sound === 'fabric' || sound === 'air' ? 'bandpass' : 'lowpass'
          filter.frequency.setValueAtTime(sound === 'paper' ? 1250 : sound === 'water' ? 760
            : sound === 'fabric' ? 850 : sound === 'air' ? 520
              : sound === 'chime' || sound === 'glass' || sound === 'metal' ? 4600 : 1950, now)
          filter.Q.setValueAtTime(.65, now)
        }
        const friction = sound === 'paper' || sound === 'water' || sound === 'fabric' || sound === 'air'
        schedule(voice, source, now, duration, (friction ? .06 : .052) * strength, filter, friction)
      }
      if (voice.sources.size === 0) release(voice)
    } catch {
      // Optional sound must never prevent a gesture, save, or completion.
      if (voice) release(voice, true)
    }
  }

  function bed(kind: ContinuousBedKind): ContinuousBed {
    if (disposed) return { setSpeed() {}, stop() {}, dispose() {} }
    const inner = createContinuousBed({
      context: options.context,
      enabled: () => !disposed && options.enabled(),
      kind,
    })
    const handle: ContinuousBed = {
      setSpeed(speed01: number) { if (!disposed) inner.setSpeed(speed01) },
      stop() { inner.stop() },
      dispose() { beds.delete(handle); inner.dispose() },
    }
    beds.add(handle)
    return handle
  }

  function stop(): void {
    for (const voice of voices) release(voice, true)
    for (const activeBed of beds) activeBed.stop()
  }

  return {
    play,
    bed,
    stop,
    dispose(): void {
      if (disposed) return
      disposed = true
      stop()
      for (const activeBed of [...beds]) activeBed.dispose()
      beds.clear()
    },
  }
}
