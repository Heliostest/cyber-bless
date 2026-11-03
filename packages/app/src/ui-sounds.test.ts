import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUiSoundPlayer, type UiSound } from './ui-sounds';
import { UI_SOUND_FILES } from './ui-sound-assets';

type Cue = UiSound;
const cues = Object.keys(UI_SOUND_FILES) as Cue[];
const tick = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  void promise.catch(() => {});
  return { promise, resolve, reject };
}
class SourceBoundary {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connections: unknown[] = [];
  starts: number[] = [];
  stops: number[] = [];
  disconnected = false;
  connect(node: unknown) { this.connections.push(node); }
  disconnect() { this.disconnected = true; this.connections = []; }
  start(at: number) { this.starts.push(at); }
  stop(at: number) { this.stops.push(at); }
  end() { this.onended?.(); }
}
// Node has no Web Audio. These boundaries preserve the emitted graph, timing,
// and decoded buffer identity so the assertions exercise player behavior.
class AudioContextBoundary {
  state: AudioContextState = 'running';
  currentTime = 3;
  destination = {};
  sources: SourceBoundary[] = [];
  decoded: ArrayBuffer[] = [];
  close = vi.fn();
  resume = vi.fn();
  pendingDecode: ReturnType<typeof deferred<AudioBuffer>> | null = null;
  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
    this.decoded.push(bytes);
    return this.pendingDecode?.promise ?? Promise.resolve({ duration: .12, numberOfChannels: 1, id: new Uint8Array(bytes)[0] } as unknown as AudioBuffer);
  }
  createBufferSource() { const node = new SourceBoundary(); this.sources.push(node); return node; }
  asContext() { return this as unknown as AudioContext; }
}
function fixture() {
  const context = new AudioContextBoundary();
  let enabled = true;
  const getContext = vi.fn(() => context.asContext());
  const requests: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    requests.push(url);
    const name = url.split('/').at(-1)!.replace('.wav', '');
    return { ok: true, arrayBuffer: async () => new Uint8Array([cues.indexOf(name as Cue) + 1]).buffer };
  });
  const player = createUiSoundPlayer({ context: getContext, enabled: () => enabled });
  const ready = async () => { player.preload(); await tick(); player.prepare(); await tick(); };
  return { context, player, ready, requests, getContext, setEnabled(value: boolean) { enabled = value; } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('createUiSoundPlayer', () => {
  it('plays the full approved completion cue without rejecting its longer duration', async () => {
    const f = fixture(); f.context.pendingDecode = deferred<AudioBuffer>();
    f.player.preload(); await tick(); f.player.prepare();
    f.context.pendingDecode.resolve({ duration: .93, numberOfChannels: 1 } as AudioBuffer); await tick();
    expect(f.player.play('complete')).toBe('played');
    expect(f.context.sources[0].buffer?.duration).toBe(.93);
    f.context.currentTime += .65;
    expect(f.player.play('navigate')).toBe('busy');
    f.player.stop();
    expect(f.context.sources[0].stops).toEqual([3.65]);
  });
  it('reports whether an audition was actually scheduled without replaying an unready request', async () => {
    const f = fixture();
    expect(f.player.play('navigate')).toBe('unready');
    await f.ready();
    expect(f.context.sources).toHaveLength(0);
    expect(f.player.play('navigate')).toBe('played');
    expect(f.player.play('back')).toBe('busy');
    f.setEnabled(false);
    expect(f.player.play('navigate')).toBe('disabled');
  });
  it('preloads each local WAV once without creating or decoding a context', async () => {
    vi.stubEnv('EXPO_BASE_URL', './embedded/');
    const f = fixture();
    f.player.preload(); f.player.preload(); await tick();
    expect(f.requests).toEqual(cues.map(cue => `./embedded/${UI_SOUND_FILES[cue]}`));
    expect(f.getContext).not.toHaveBeenCalled();
    expect(f.context.decoded).toHaveLength(0);
    expect(f.context.sources).toHaveLength(0);
  });

  it('does not decode when preloading finishes after an earlier prepare', async () => {
    const f = fixture();
    f.player.prepare(); await tick();
    expect(f.context.decoded).toHaveLength(0);
    f.player.prepare(); await tick();
    expect(f.context.decoded).toHaveLength(cues.length);
    expect(f.context.sources).toHaveLength(0);
  });

  it('checks the live sound preference before obtaining a context', async () => {
    const f = fixture(); f.setEnabled(false);
    f.player.prepare(); f.player.play('navigate'); await tick();
    expect(f.getContext).not.toHaveBeenCalled();
    expect(f.context.sources).toHaveLength(0);
  });

  it('drops an unready cue without replaying it when decoding finishes', async () => {
    const f = fixture(); f.context.pendingDecode = deferred<AudioBuffer>();
    f.player.preload(); await tick(); f.player.play('navigate');
    expect(f.context.sources).toHaveLength(0);
    f.context.pendingDecode.resolve({ duration: .12, numberOfChannels: 1 } as AudioBuffer); await tick();
    expect(f.context.sources).toHaveLength(0);
    f.player.play('navigate');
    expect(f.context.sources).toHaveLength(1);
  });

  it.each(cues)('plays the prepared %s buffer immediately on the caller context', async cue => {
    const f = fixture(); await f.ready();
    f.player.play(cue);
    const source = f.context.sources[0];
    expect(source).toBeDefined();
    expect(source.buffer).toMatchObject({ id: cues.indexOf(cue === 'notice' ? 'select' : cue) + 1 });
    expect(source.connections).toEqual([f.context.destination]);
    expect(source.starts).toEqual([3]);
    expect(f.context.decoded).toHaveLength(cues.length);
    expect(f.context.close).not.toHaveBeenCalled();
    expect(f.context.resume).not.toHaveBeenCalled();
  });

  it('keeps one UI voice and drops overlapping cues', async () => {
    const f = fixture(); await f.ready();
    f.player.play('open'); f.player.play('close'); f.player.play('navigate');
    expect(f.context.sources).toHaveLength(1);
    f.context.currentTime += .2; f.player.play('close');
    expect(f.context.sources).toHaveLength(2);
    expect(f.context.sources[0].disconnected).toBe(true);
  });

  it('throttles a short repeated cue after its source has ended', async () => {
    const f = fixture(); await f.ready();
    f.player.play('select'); expect(f.context.sources).toHaveLength(1); f.context.sources[0].end();
    f.context.currentTime += .03; f.player.play('select');
    expect(f.context.sources).toHaveLength(1);
    f.context.currentTime += .04; f.player.play('select');
    expect(f.context.sources).toHaveLength(2);
  });

  it('limits notice repeats for eight hundred milliseconds', async () => {
    const f = fixture(); await f.ready();
    f.player.play('notice'); expect(f.context.sources).toHaveLength(1); f.context.sources[0].end();
    f.context.currentTime += .4; f.player.play('notice');
    expect(f.context.sources).toHaveLength(1);
    f.context.currentTime += .5; f.player.play('notice');
    expect(f.context.sources).toHaveLength(2);
  });

  it('stops and disconnects its voice while leaving the context owned by the caller', async () => {
    const f = fixture(); await f.ready(); f.player.play('navigate');
    const source = f.context.sources[0];
    expect(source).toBeDefined();
    f.player.stop(); f.player.stop();
    expect(source.stops).toEqual([3]);
    expect(source.disconnected).toBe(true);
    expect(source.onended).toBeNull();
    expect(f.context.close).not.toHaveBeenCalled();
    f.context.currentTime += .2; f.player.play('navigate');
    expect(f.context.sources).toHaveLength(2);
  });

  it('rejects a decode completed after stop and can prepare on the next gesture', async () => {
    const f = fixture(); f.context.pendingDecode = deferred<AudioBuffer>();
    f.player.preload(); await tick(); f.player.prepare(); f.player.stop();
    f.context.pendingDecode.resolve({ duration: .12, numberOfChannels: 1 } as AudioBuffer); await tick();
    f.context.pendingDecode = null;
    f.player.play('navigate');
    expect(f.context.sources).toHaveLength(0);
    await tick(); f.player.play('navigate');
    expect(f.context.sources).toHaveLength(1);
  });

  it('does not play in a suspended context or replay on resume', async () => {
    const f = fixture(); await f.ready(); f.context.state = 'suspended';
    f.player.play('navigate'); expect(f.context.sources).toHaveLength(0);
    f.context.state = 'running'; await tick(); expect(f.context.sources).toHaveLength(0);
    f.player.play('navigate'); expect(f.context.sources).toHaveLength(1);
  });

  it('rejects a prepared sound after muting without allocating a voice', async () => {
    const f = fixture(); await f.ready(); f.setEnabled(false);
    f.player.play('navigate');
    expect(f.context.sources).toHaveLength(0);
  });

  it('disposes pending work permanently and never takes ownership of the context', async () => {
    const f = fixture(); f.context.pendingDecode = deferred<AudioBuffer>();
    f.player.preload(); await tick(); f.player.prepare();
    f.player.dispose(); f.player.dispose();
    f.context.pendingDecode.resolve({ duration: .12, numberOfChannels: 1 } as AudioBuffer); await tick();
    const requests = f.getContext.mock.calls.length;
    f.player.preload(); f.player.prepare(); f.player.play('navigate');
    expect(f.getContext).toHaveBeenCalledTimes(requests);
    expect(f.context.sources).toHaveLength(0);
    expect(f.context.close).not.toHaveBeenCalled();
  });

  it('fails quietly on missing assets, rejected decoding, and unavailable audio', async () => {
    const f = fixture();
    vi.stubGlobal('fetch', async () => { throw Error('offline asset unavailable'); });
    f.player.preload(); await tick();
    expect(() => f.player.play('open')).not.toThrow();
    expect(f.context.sources).toHaveLength(0);
    const next = fixture(); next.context.pendingDecode = deferred<AudioBuffer>();
    next.player.preload(); await tick(); next.player.prepare();
    next.context.pendingDecode.reject(Error('unsupported')); await tick();
    expect(() => next.player.play('open')).not.toThrow();
    const absent = createUiSoundPlayer({ context: () => null, enabled: () => true });
    expect(() => { absent.prepare(); absent.play('open'); absent.stop(); absent.dispose(); }).not.toThrow();
  });

  it('fails quietly if the host throws while obtaining its audio context', () => {
    const player = createUiSoundPlayer({ context: () => { throw Error('host denied audio'); }, enabled: () => true });
    expect(() => player.prepare()).not.toThrow();
    expect(() => player.play('open')).not.toThrow();
  });

  it.each([{ duration: 1.21, numberOfChannels: 1 }, { duration: .93, numberOfChannels: 2 }])(
    'rejects oversized or multichannel result buffers: %j', async buffer => {
      const f = fixture(); f.context.pendingDecode = deferred<AudioBuffer>();
      f.player.preload(); await tick(); f.player.prepare();
      f.context.pendingDecode.resolve(buffer as AudioBuffer); await tick();
      expect(f.player.play('complete')).toBe('unready');
      expect(f.context.sources).toHaveLength(0);
    });
});
