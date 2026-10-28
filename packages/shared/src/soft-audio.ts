export type SoftSound = 'complete' | 'collect' | 'saved' | 'woodfish' | 'paper' | 'water' | 'woodTap' | 'beans'
  | 'chime' | 'glass' | 'ceramic' | 'fabric' | 'metal' | 'stone' | 'hollow' | 'air'
/** Duration is in seconds; strength is a relative level between zero and one. */
export type SoftSoundOptions = { duration?: number; strength?: number }

type MaterialSound = Exclude<SoftSound, 'complete' | 'collect' | 'saved'>
type Voice = {
  context: BaseAudioContext
  sources: Set<AudioScheduledSourceNode>
  nodes: Set<AudioNode>
  endsAt: number
}
const durations: Record<SoftSound, number> = {
  complete: .58, collect: .46, saved: .42,
  woodfish: .3, paper: .38, water: .8, woodTap: .16, beans: .46,
  chime: .95, glass: .36, ceramic: .28, fabric: .42, metal: .42, stone: .2, hollow: .24, air: .48,
}
const tau = Math.PI * 2
const waterDrops = [[.12, 680], [.43, 890], [.72, 760]] as const
const beanTaps = [[0, 370], [.18, 490], [.39, 330], [.63, 560], [.82, 420]] as const
// Fundamental, inharmonic ratio, overtone level and decay. These cues suggest
// the displayed surfaces; they are synthesized product feedback, not recordings.
const resonances = {
  chime: [1480, 2.756, .2, 5],
  glass: [1880, 1.53, .16, 17],
  ceramic: [780, 1.43, .23, 31],
  metal: [1080, 2.71, .28, 16],
  stone: [240, 1.47, .25, 52],
  hollow: [260, 1.9, .12, 27],
} as const
const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

/** A muted wooden resonance with an inharmonic overtone rather than a sharp click. */
function woodenPulse(time: number, frequency: number, decay: number) {
  if (time < 0) return 0
  return (Math.sin(tau * frequency * time) * Math.exp(-decay * time)
    + .28 * Math.sin(tau * frequency * 1.63 * time) * Math.exp(-decay * 1.5 * time))
    * Math.min(1, time / .003)
}

/** Synthesize short material cues locally; these are product sound design. */
function materialBuffer(context: BaseAudioContext, sound: MaterialSound, duration: number) {
  const sampleRate = bounded(context.sampleRate, 44100, 8000, 96000)
  const buffer = context.createBuffer(1, Math.ceil(duration * sampleRate), sampleRate)
  const samples = buffer.getChannelData(0)
  let smoothed = 0
  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate, progress = time / duration
    let sample = 0
    if (sound === 'paper' || sound === 'water' || sound === 'fabric' || sound === 'air') {
      const noise = Math.random() * 2 - 1
      // Remove the harsh, highest frequencies even when a host has no filters.
      const smoothing = sound === 'paper' ? .22 : sound === 'fabric' ? .09 : sound === 'air' ? .045 : .12
      smoothed += (noise - smoothed) * smoothing
      sample = smoothed * (sound === 'paper' ? .65 + .18 * Math.sin(tau * 17 * time)
        : sound === 'fabric' ? .52 + .16 * Math.sin(tau * 6 * time)
          : sound === 'air' ? .48 * Math.sin(Math.PI * progress) : .75)
      if (sound === 'water') {
        for (const [offset, frequency] of waterDrops) {
          const dropTime = time - offset * duration
          if (dropTime >= 0) sample += .12 * Math.sin(tau * frequency * dropTime) * Math.exp(-50 * dropTime) * Math.min(1, dropTime / .004)
        }
      }
    } else if (sound === 'woodfish') {
      sample = woodenPulse(time, 390, 18) * .7
    } else if (sound === 'woodTap') {
      sample = woodenPulse(time, 310, 38) * .58
    } else if (Object.hasOwn(resonances, sound)) {
      const [frequency, ratio, overtone, decay] = resonances[sound as keyof typeof resonances]
      sample = .58 * (Math.sin(tau * frequency * time) * Math.exp(-decay * time)
        + overtone * Math.sin(tau * frequency * ratio * time) * Math.exp(-decay * 1.6 * time))
    } else {
      for (const [offset, frequency] of beanTaps) {
        sample += woodenPulse(time - offset * duration, frequency, 75) * .32
      }
    }
    // Each buffer also reaches silence smoothly if its gain envelope is absent.
    const edge = Math.min(1, time / .006, (1 - progress) * duration / .018)
    samples[index] = Math.max(-1, Math.min(1, sample * Math.max(0, edge)))
  }
  return buffer
}

function disconnect(node: AudioNode) {
  try { node.disconnect?.() } catch { /* The context may already be closed. */ }
}

/**
 * Schedule optional, quiet cues on a caller-owned audio context. The caller owns
 * context creation, unlocking and closing; this player only owns its nodes.
 */
export function createSoftSoundPlayer(options: { context: () => BaseAudioContext | null; enabled: () => boolean }) {
  const voices = new Set<Voice>()
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
              : sound === 'chime' || sound === 'glass' || sound === 'metal' ? 4200 : 1800, now)
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

  function stop(): void {
    for (const voice of voices) release(voice, true)
  }

  return { play, stop, dispose(): void { if (disposed) return; disposed = true; stop() } }
}
