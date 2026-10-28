import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createState, rituals } from '@wbr/core';
import { builtInScenes } from '@wbr/core/daily-scenes';
import { APP_STORE_URL, parseSceneShareUrl } from '@wbr/core/scene-share';
import { createContentClient } from '@wbr/content';
import { bundledWoodfish } from '@wbr/content/bundled';
import { validateWoodfishGLB } from '@wbr/content/glb';
import { createSoftSoundPlayer, type SoftSound } from '@wbr/shared';
import { configureLocale, getLocale, subscribeLocale, translate as tr, translateScene } from '@wbr/i18n';
import { Context, type AppContext } from './context';
import { assetUrl, fontStyles } from './assets';
import { ProceduralScene } from './scene-experience';
import { sceneSteps } from './scene-placement';
import { Woodfish } from './woodfish';

type ShareRequest = NonNullable<ReturnType<typeof parseSceneShareUrl>>;
const noop = () => {};

/** A public visit never opens, writes or restores an application save. */
export function PublicScenePage({ url = window.location.href }: { url?: string }) {
  const request = useMemo(() => parseSceneShareUrl(url), [url]);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useEffect(() => {
    configureLocale(request?.locale ?? 'system', navigator.languages ?? [navigator.language]);
  }, [request?.locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = tr('朋友分享的仪式');
  }, [locale]);
  return <div className="public-scene-page">
    <style>{fontStyles}</style>
    {request ? <PublicSceneVisit key={url} request={request}/> : <div className="public-scene-invalid">
      <h1>{tr('这个场景暂时无法打开')}</h1>
      <p>{tr('请检查分享链接，或前往 App Store 查看应用。')}</p>
      <StoreLink/>
    </div>}
  </div>;
}

function StoreLink() {
  return <a className="button primary public-scene-store" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">{tr('在 App Store 查看')}</a>;
}

function PublicSceneVisit({ request }: { request: ShareRequest }) {
  const entry = builtInScenes.find(scene => scene.id === request.sceneId)!;
  const [attempt, setAttempt] = useState(0), [progress, setProgress] = useState(0), [strikes, setStrikes] = useState(0);
  const [error, setError] = useState(false), [ready, setReady] = useState(false), [sound, setSound] = useState(false);
  const [reduced, setReduced] = useState(() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [active, setActive] = useState(() => !document.hidden);
  const [instruction, setInstruction] = useState(bundledWoodfish.copy.instruction);
  const stage = useRef<HTMLElement>(null), focused = useRef(true), mounted = useRef(true);
  const activeNow = useRef(active), soundNow = useRef(sound);
  activeNow.current = active; soundNow.current = sound;
  const audio = useRef<AudioContext | null>(null), sources = useRef(new Set<AudioBufferSourceNode>());
  const audioEnabled = () => mounted.current && activeNow.current && soundNow.current && !document.hidden;
  const ensureAudio = () => {
    const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    return audio.current ??= new Ctor();
  };
  const sounds = useMemo(() => createSoftSoundPlayer({ enabled: audioEnabled, context: () => audio.current }), []);
  const stopSound = useCallback(() => {
    sounds.stop();
    for (const source of sources.current) {
      try { source.stop(); source.disconnect(); } catch { /* A completed source is already detached. */ }
    }
    sources.current.clear();
  }, [sounds]);
  const prepareFeedback = () => {
    if (!audioEnabled()) return;
    try { void ensureAudio()?.resume().catch(() => {}); } catch { /* Device audio is optional. */ }
  };
  const feedback = (cue?: AudioBuffer | SoftSound) => {
    if (!audioEnabled()) return;
    prepareFeedback();
    if (!cue || typeof cue === 'string') { sounds.play(cue ?? 'woodfish'); return; }
    const context = audio.current;
    if (!context) return;
    try {
      const source = context.createBufferSource(); source.buffer = cue;
      source.connect(context.destination); sources.current.add(source);
      source.onended = () => { sources.current.delete(source); source.disconnect(); };
      source.start();
    } catch { /* Playback failure must not stop the scene. */ }
  };

  useEffect(() => {
    mounted.current = true;
    const visibility = () => setActive(!document.hidden && focused.current);
    const blur = () => { focused.current = false; visibility(); };
    const focus = () => { focused.current = true; visibility(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      stopSound(); void audio.current?.close().catch(() => {}); audio.current = null;
    };
  }, [stopSound]);
  useEffect(() => {
    if (!active) { stopSound(); void audio.current?.suspend().catch(() => {}); }
  }, [active, stopSound]);
  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    const element = stage.current;
    if (!element || error) return;
    const update = () => setReady(!!element.querySelector('[data-ready="true"]'));
    const observer = new MutationObserver(update);
    observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ready'] });
    update();
    return () => observer.disconnect();
  }, [attempt, error]);

  const state = useMemo(() => {
    const value = createState();
    value.settings = { ...value.settings, locale: request.locale, sound, reducedMotion: reduced, haptics: false };
    if (request.visual) value.visualStyles = { [entry.id]: request.visual };
    return value;
  }, [request, entry.id, sound, reduced]);
  const app: AppContext = {
    state, active, feedback, prepareFeedback, stopInteractionSound: stopSound,
    async decodeSound(bytes) {
      const context = ensureAudio();
      if (!context) throw Error('Audio decoding is unavailable');
      return context.decodeAudioData(bytes.slice(0));
    },
    haptic: noop, canHaptic: false, go: noop, back: noop, dispatch: () => false,
    fulfillmentDrafts: {}, setFulfillmentDraft: noop, launchReward: noop, arrival: null, announce: noop,
  };
  // This client reads only the bundled model. Its history lives in memory and
  // never consults the App's storage, downloaded candidates or saved wishes.
  const woodfishContent = useMemo(() => createContentClient({
    bundled: bundledWoodfish,
    bundledBase: new URL(assetUrl(''), window.location.href).href,
    io: {
      readHistory: async () => undefined, writeHistory: async () => {},
      readManifest: async () => bundledWoodfish, readCachedAsset: async () => undefined,
      readAsset: async (_asset, assetURL, signal) => {
        const response = await fetch(assetURL, { signal, credentials: 'omit' });
        if (!response.ok) throw Error('Scene asset unavailable');
        return response.arrayBuffer();
      },
    },
    validatePrepared: (pack, bytes) => validateWoodfishGLB(bytes, pack.bindings),
  }), []);
  const restart = () => { stopSound(); setReady(false); setError(false); setProgress(0); setStrikes(0); setAttempt(value => value + 1); };
  const done = progress >= sceneSteps(entry);
  const toggleSound = () => {
    const next = !soundNow.current;
    soundNow.current = next; setSound(next);
    if (next) prepareFeedback();
    else { stopSound(); void audio.current?.suspend().catch(() => {}); }
  };
  return <Context.Provider value={app}>
    <div className="app-shell public-scene-shell" data-immersive data-page="public-scene">
      <header className="public-scene-header">
        <div><p>{tr('朋友分享的仪式')}</p><h1>{translateScene(entry.title)}</h1></div>
        <StoreLink/>
      </header>
      <main className="app-content public-scene-main">
        <section className="scene-experience public-scene-experience" ref={stage} aria-label={translateScene(entry.title)} aria-busy={!ready && !error}>
          {error ? <div className="public-scene-error" role="alert">
            <h2>{tr('这个场景暂时无法打开')}</h2>
            <button type="button" className="button secondary" onClick={restart}>{tr('重试')}</button>
          </div> : <>
            {!ready && <p className="public-scene-loading" role="status">{tr('正在准备互动场景…')}</p>}
            {entry.engine === 'woodfish@1' ? <Woodfish key={attempt} sceneId={entry.id} contentClient={woodfishContent}
              active={active} reducedMotion={reduced} view="front" disabled={done} strikes={strikes} minimumStrikes={rituals.woodfish.steps}
              instruction={instruction} onInstruction={setInstruction} onFailure={() => setError(true)} onImpact={feedback}
              onStrike={() => { if (!active || done) return false; prepareFeedback(); setStrikes(value => value + 1); return true; }}
              onFinish={() => { if (active) setProgress(sceneSteps(entry)); }}/>
              : <ProceduralScene key={attempt} entry={entry} progress={0}
                checkpoint={next => { if (activeNow.current && Number.isInteger(next) && next >= 0 && next <= sceneSteps(entry)) setProgress(value => Math.max(value, next)); }}
                failed={() => setError(true)}/>}
            {done && <p className="public-scene-completed" role="status">{tr('已完成')}</p>}
          </>}
        </section>
      </main>
      <footer className="public-scene-controls">
        <button type="button" className="button secondary" aria-pressed={sound} onClick={toggleSound} disabled={!active}>{sound ? tr('关闭声音') : tr('开启声音')}</button>
        <button type="button" className="button outline" onClick={restart}>{tr('重新体验')}</button>
      </footer>
    </div>
  </Context.Provider>;
}
