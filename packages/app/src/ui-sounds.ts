import { assetUrl } from './assets';
import { UI_SOUND_FILES } from './ui-sound-assets';

export type UiSound = keyof typeof UI_SOUND_FILES;
type Cue = UiSound;
export type UiPlaybackResult = 'played' | 'disabled' | 'unready' | 'busy' | 'unavailable';
type Voice = { source: AudioBufferSourceNode; context: AudioContext; endsAt: number };

/** Optional UI feedback. The caller owns context creation, unlocking and closing.
 * preload only fetches local bytes; prepare must be called in a user gesture.
 * A missing or unprepared cue is dropped: async completions never schedule sound.
 */
export function createUiSoundPlayer(options: { context: () => AudioContext | null; enabled: () => boolean }) {
  const bytes = new Map<Cue, ArrayBuffer>();
  const requested = new Set<Cue>();
  const buffers = new Map<Cue, AudioBuffer>();
  const decoding = new Set<Cue>();
  const lastPlayed = new Map<Cue, number>();
  let context: AudioContext | null = null;
  let voice: Voice | null = null;
  let generation = 0;
  let disposed = false;

  function release(active: Voice, stop = false): void {
    if (voice === active) voice = null;
    active.source.onended = null;
    if (stop) {
      try { active.source.stop(active.context.currentTime); } catch { /* Already ended. */ }
    }
    try { active.source.disconnect(); } catch { /* Host may already be closed. */ }
  }

  function preload(): void {
    if (disposed) return;
    for (const sound of Object.keys(UI_SOUND_FILES) as Cue[]) {
      if (requested.has(sound)) continue;
      requested.add(sound);
      void (async () => {
        const response = await fetch(assetUrl(UI_SOUND_FILES[sound]));
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        if (!disposed) bytes.set(sound, data);
      })().catch(() => { /* Missing local audio is an optional enhancement. */ });
    }
  }

  function stop(): void {
    generation++;
    decoding.clear();
    if (voice) release(voice, true);
  }

  function prepareContext(): AudioContext | null {
    if (disposed || !options.enabled()) return null;
    preload();
    const next = options.context();
    if (!next || next.state === 'closed') return null;
    if (context !== next) {
      stop();
      buffers.clear();
      lastPlayed.clear();
      context = next;
    }
    const currentGeneration = generation;
    for (const [sound, data] of bytes) {
      if (buffers.has(sound) || decoding.has(sound)) continue;
      decoding.add(sound);
      try {
        // decodeAudioData may detach its input. Keep the preloaded bytes for a
        // later gesture after stop or after a caller replaces its context.
        void next.decodeAudioData(data.slice(0)).then(buffer => {
          if (disposed || generation !== currentGeneration || context !== next || !options.enabled()) return;
          if (Number.isFinite(buffer.duration) && buffer.duration > 0 && buffer.duration <= 1.2 && buffer.numberOfChannels === 1)
            buffers.set(sound, buffer);
        }).catch(() => { /* Unsupported or corrupt audio stays quiet. */ }).finally(() => {
          if (generation === currentGeneration) decoding.delete(sound);
        });
      } catch { decoding.delete(sound); }
    }
    return next;
  }

  function prepare(): void {
    try { prepareContext(); } catch { /* Optional audio must not block a gesture. */ }
  }

  function play(sound: Cue): UiPlaybackResult {
    let source: AudioBufferSourceNode | undefined;
    try {
      if (disposed || !options.enabled()) return 'disabled';
      if (!Object.hasOwn(UI_SOUND_FILES, sound)) return 'unavailable';
      const ctx = prepareContext();
      if (!ctx || ctx.state !== 'running' || !Number.isFinite(ctx.currentTime) || ctx.currentTime < 0) return 'unavailable';
      const buffer = buffers.get(sound);
      if (!buffer) return 'unready';
      if (voice && (voice.context.state === 'closed' || voice.context.currentTime >= voice.endsAt)) release(voice, true);
      // One voice prevents volume buildup; neither overlap nor throttled cues
      // are queued. Notice has a longer interval to keep repeated failures mild.
      if (voice || ctx.currentTime - (lastPlayed.get(sound) ?? -Infinity) < (sound === 'notice' ? .8 : .06)) return 'busy';
      source = ctx.createBufferSource();
      source.buffer = buffer;
      const active = { source, context: ctx, endsAt: ctx.currentTime + buffer.duration };
      voice = active;
      source.connect(ctx.destination);
      source.onended = () => release(active);
      source.start(ctx.currentTime);
      lastPlayed.set(sound, ctx.currentTime);
      return 'played';
    } catch {
      if (voice && voice.source === source) release(voice, true);
      else if (source) { try { source.disconnect(); } catch { /* Best effort. */ } }
      return 'unavailable';
    }
  }

  return { preload, prepare, play, stop, dispose(): void {
    if (disposed) return;
    disposed = true;
    stop();
    bytes.clear(); buffers.clear(); requested.clear(); lastPlayed.clear();
    context = null;
  } };
}
