import { translate as tr } from '@wbr/i18n';
import { INTERNAL_TOOLS_ENABLED } from './internal-tools-config';
import { configureLocale, getLocale, getFormatLocale, localePreferenceFromSave, subscribeLocale, ProductError, message, hasProductCopy } from '@wbr/i18n';
import { localizedTitle } from './localization';
import { catalogData } from '@wbr/i18n/catalogs';
import { configureHour12, getHour12 } from '@wbr/i18n';
import { IntlProvider } from 'react-intl';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, } from "react";
import { createStore, type Host, type HapticStrength } from "@wbr/runtime";
import { rituals, sceneProgress, sceneStepCount } from "@wbr/core";
import { createSoftSoundPlayer, type SoftSound } from "@wbr/shared";
import { createUiSoundPlayer, type UiSound } from './ui-sounds';
import { UI_SOUND_FILES, RESULT_SOUND_DURATIONS } from './ui-sound-assets';
import type { AudioInspector } from './context';
import { Context, type Route, type FulfillmentDraft } from "./context";
import { Icon } from "./art";
import { CollectionDetail, History, Me, Wishes, World } from "./pages";
import { Today, ritualTitle } from "./home";
import { NewWish, WishDetail, WishNote, FulfillWish } from "./wishes";
import { fontStyles } from "./assets";
import { Complete, Ritual } from "./ritual";
import { LegalInformation } from './legal';
import { ContentContext, type ContentEnvironment } from "./content";
import { InvalidContentError } from "@wbr/content";
import { SceneLibraryProvider, SceneCatalog, CacheManager, bundledSceneEntry } from "./scene-library";
import { SceneExperience } from "./scene-experience";
import { TestFeedbackProvider } from './test-feedback-provider';
import { FeedbackControls, dismissFeedbackMenu } from "./feedback-controls";
import { dismissVisualStyleMenu } from "./visual-style-menu";
import { dismissRitualShare } from "./ritual-share";
import { dismissLanguageSetting } from "./language-setting";
import { PageTitle, useAppLayout } from "./page-heading";
import { Opening } from "./opening";
import { followSystemReducedMotion, initialSettings } from "./reduced-motion";
import { useLocalDay } from "./local-day";
import { WidgetNavigation } from './widget-navigation';
import type { WidgetNavigationRequest } from '@wbr/core/widgets';
import { RewardFlightLayer } from "./reward-flight-layer";
import { useSceneViewport } from "./scene-viewport";
import { ARRIVAL_LINGER_MS, rewardOriginOf, shouldReduceMotion, type RewardFlight, type RewardArrival, } from "./reward-flight";
const isInternalRoute = (route: Route) => route.page === 'scenes' || route.page === 'cache';
const permittedRoute = (route: Route, internalToolsEnabled: boolean): Route =>
    !internalToolsEnabled && isInternalRoute(route) ? { page: 'me' } : route;
export function BlessingApp({ host, active = true, backRequest = 0, onCanGoBack, content, navigationRequest, onNavigationConsumed, initialRoute, systemLocales, systemHour12, internalToolsEnabled = INTERNAL_TOOLS_ENABLED, debugOverlay, }: {
    host: Host;
    active?: boolean;
    backRequest?: number;
    onCanGoBack?: (value: boolean) => void;
    content?: ContentEnvironment;
    navigationRequest?: WidgetNavigationRequest;
    onNavigationConsumed?: (requestId: number) => Promise<void>;
    /** Initial entry for a host preview; subsequent navigation stays inside the App. */
    initialRoute?: Route;
    systemLocales?: readonly string[];
    systemHour12?: boolean;
    /** The host owns this runtime distribution decision; saves and URLs cannot enable it. */
    internalToolsEnabled?: boolean;
    /** Optional developer UI. The production and native hosts never supply it. */
    debugOverlay?: ReactNode;
}) {
    const preferred = useRef(systemLocales);
    preferred.current = systemLocales;
    const localeOwner = useRef<object | null>(null);
    const mounted = useRef(true);
    const systemLanguages = () => preferred.current ?? (typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);
    const store = useMemo(() => {
        const owner = {};
        localeOwner.current = owner;
        configureLocale(host.initialLocalePreference ?? 'system', systemLanguages());
        return createStore({ ...host, read: async () => {
                const raw = await host.read();
                if (mounted.current && localeOwner.current === owner)
                    configureLocale(localePreferenceFromSave(raw), systemLanguages());
                return raw;
            } }, initialSettings);
    }, [host]);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, [store]);
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const formatLocale = useSyncExternalStore(subscribeLocale, getFormatLocale, getFormatLocale);
    useSyncExternalStore(subscribeLocale, getHour12, getHour12);
    useEffect(() => configureHour12(systemHour12), [systemHour12]);
    const locale = getLocale();
    const languageSignature = systemLocales?.join('|');
    useEffect(() => {
        const follow = () => configureLocale(snapshot.state?.settings.locale ?? host.initialLocalePreference ?? 'system', systemLanguages());
        follow();
        window.addEventListener('languagechange', follow);
        return () => window.removeEventListener('languagechange', follow);
    }, [snapshot.state?.settings.locale, languageSignature, active, host]);
    useEffect(() => {
        document.documentElement.lang = locale; document.documentElement.dir = 'ltr';
        document.title = tr('一日一念');
    }, [locale]);
    const [routes, setRoutes] = useState<Route[]>(() => [permittedRoute(initialRoute ?? { page: "today" }, internalToolsEnabled)]);
    useEffect(() => {
        if (!internalToolsEnabled)
            setRoutes(old => old.some(isInternalRoute) ? [permittedRoute(old.at(-1)!, false)] : old);
    }, [internalToolsEnabled]);
    const [error, setError] = useState<string | ProductError>("");
    const [fulfillmentDrafts, setFulfillmentDrafts] = useState<Record<string, FulfillmentDraft>>({});
    // One reward's trip home, and what shows once it lands. The flight lives
    // outside <main>, so the per-route remount never interrupts it.
    const [flight, setFlight] = useState<RewardFlight | null>(null);
    const [arrival, setArrival] = useState<RewardArrival | null>(null);
    const [announcement, setAnnouncement] = useState<{
        text: string;
        n: number;
    } | null>(null);
    const flightRef = useRef<RewardFlight | null>(null);
    // The navigation a reward arrives on skips page-in: the ghost carries it.
    const skipNextPageIn = useRef(false);
    const skippedRoute = useRef<string | null>(null);
    // The woodfish scene's idle signal, handed to the Ritual page.
    const woodfishIdle = useRef<(() => Promise<void>) | null>(null);
    // 今日 is rebuilt only when the date changes, so focus and scroll survive.
    const day = useLocalDay(active);
    const audio = useRef<AudioContext | null>(null);
    const activeNow = useRef(active);
    activeNow.current = active;
    const focused = useRef(true);
    const pendingSaveSound = useRef(false);
    const sampledSounds = useRef(new Set<AudioBufferSourceNode>());
    const soundOptions = useMemo(() => ({
        context: () => {
            if (!audio.current) {
                const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!Ctor) return null;
                audio.current = new Ctor();
            }
            void audio.current.resume().catch(() => {});
            return audio.current;
        },
        enabled: () => mounted.current && activeNow.current && focused.current && !document.hidden && !!store.getSnapshot().state?.settings.sound,
    }), [store]);
    const sounds = useMemo(() => createSoftSoundPlayer(soundOptions), [soundOptions]);
    const interactionSounds = useMemo(() => createSoftSoundPlayer(soundOptions), [soundOptions]);
    const uiSounds = useMemo(() => createUiSoundPlayer({ ...soundOptions, readBase64: host.readUiSound }), [soundOptions, host]);
    const audition = useRef<'ui' | 'soft' | null>(null);
    const audioInspector = useMemo<AudioInspector>(() => ({
        prepare: () => uiSounds.prepare(),
        play(sound) {
            if (!soundOptions.enabled()) return 'disabled';
            uiSounds.stop(); sounds.stop();
            if (Object.hasOwn(UI_SOUND_FILES, sound)) {
                audition.current = 'ui';
                return uiSounds.play(sound as keyof typeof UI_SOUND_FILES);
            }
            audition.current = 'soft';
            sounds.play(sound as SoftSound);
            // The synthesis service has no scheduling receipt; do not claim audibility.
            return 'requested';
        },
        stop() {
            if (audition.current === 'ui') uiSounds.stop();
            if (audition.current === 'soft') sounds.stop();
            audition.current = null;
        },
    }), [uiSounds, sounds, soundOptions]);
    const hasDebugOverlay = !!debugOverlay;
    useEffect(() => () => audioInspector.stop(), [audioInspector, hasDebugOverlay]);
    const quietUiUntil = useRef(0);
    const resultSound = useCallback((sound: 'saved' | 'collect' | 'complete') => {
        audioInspector.stop();
        if (!soundOptions.enabled()) return;
        uiSounds.stop();
        quietUiUntil.current = performance.now() + RESULT_SOUND_DURATIONS[sound] * 1000;
        uiSounds.play(sound);
    }, [soundOptions, uiSounds, audioInspector]);
    const uiSound = useCallback((sound: UiSound) => {
        audioInspector.stop();
        if (!soundOptions.enabled()) return;
        if (sound === 'saved' || sound === 'collect' || sound === 'complete') { resultSound(sound); return; }
        if (performance.now() < quietUiUntil.current) return;
        uiSounds.play(sound);
    }, [soundOptions, uiSounds, resultSound, audioInspector]);
    const prepareUiFeedback = useCallback(() => {
        if (!soundOptions.enabled()) return;
        uiSounds.prepare();
    }, [soundOptions, uiSounds]);
    useEffect(() => {
        if (snapshot.state?.settings.sound) uiSounds.preload();
    }, [uiSounds, snapshot.state?.settings.sound]);
    const stopInteractionSound = useCallback(() => {
        interactionSounds.stop();
        for (const source of sampledSounds.current) {
            try { source.stop(); source.disconnect(); } catch { /* Already ended. */ }
        }
        sampledSounds.current.clear();
    }, [interactionSounds]);
    const stopFeedback = useCallback(() => {
        pendingSaveSound.current = false;
        sounds.stop();
        uiSounds.stop();
        stopInteractionSound();
    }, [sounds, uiSounds, stopInteractionSound]);
    const shell = useRef<HTMLDivElement>(null);
    const route = permittedRoute(routes[routes.length - 1], internalToolsEnabled);
    const state = snapshot.state;
    const immersive = !!state && ["scene", "ritual", "complete"].includes(route.page);
    useSceneViewport(shell, immersive);
    useAppLayout(shell);
    const openingActive = !!state?.opening && state.opening.status !== 'complete';
    const roots = ["today", "wishes", "world", "me"];
    const canBack = routes.length > 1 || route.page !== "today";
    function go(next: Route, options?: { sound?: 'navigate' | 'back' | false }) {
        if (!internalToolsEnabled && isInternalRoute(next)) return;
        const same = route.page === next.page && route.id === next.id && route.entry?.id === next.entry?.id
            && route.wishId === next.wishId && route.vessel === next.vessel && route.daily === next.daily
            && route.replay === next.replay && route.opening === next.opening;
        if (!same && options?.sound) uiSound(options.sound);
        setError("");
        setRoutes((old) => {
            if (roots.includes(next.page))
                return [next];
            const existing = old.findIndex((r) => r.page === next.page && r.id === next.id);
            // Back to a page already open: what was above it goes, and the new
            // route stands in for the old one, so a 还愿 wishId is not dropped.
            if (existing >= 0)
                return [...old.slice(0, existing), next];
            if ((old.at(-1)?.page === "new" && next.page === "wish") ||
                next.page === "complete")
                return [...old.slice(0, -1), next];
            return [...old, next];
        });
        // A new page opens at the top: phones scroll the window, the desktop
        // device frame scrolls the shell itself.
        shell.current?.scrollTo?.(0, 0);
        window.scrollTo?.(0, 0);
    }
    function back(options?: { sound?: boolean }) {
        const feedbackClose = shell.current?.querySelector<HTMLButtonElement>('.test-feedback-dialog[open] [data-feedback-close]');
        if (feedbackClose) { feedbackClose.click(); return; }
        if (dismissLanguageSetting(shell.current))
            return;
        if (dismissRitualShare(shell.current))
            return;
        if (dismissVisualStyleMenu(shell.current))
            return;
        if (dismissFeedbackMenu(shell.current))
            return;
        if (options?.sound && canBack) uiSound('back');
        setError("");
        setRoutes((old) => old.length > 1 ? old.slice(0, -1) : [{ page: "today" }]);
    }
    function launchReward(next: RewardFlight) {
        if (flightRef.current) return;
        flightRef.current = next;
        resultSound("collect");
        skipNextPageIn.current = true;
        setArrival({
            key: Date.now(),
            collectibleId: next.collectibleId,
            wishId: next.wishId,
            tab: next.tab,
            phase: "flying",
        });
        setFlight(next);
    }
    const announce = useCallback((status: string) => {
        setAnnouncement((old) => ({ text: status, n: (old?.n ?? 0) + 1 }));
    }, []);
    const onRewardLand = useCallback(() => {
        const landed = flightRef.current;
        flightRef.current = null;
        setFlight(null);
        setArrival((a) => (a ? { ...a, phase: "landed" } : a));
        if (landed)
            announce(landed.announce);
    }, [announce]);
    // The 新 mark, tab badge and hop linger a moment, then rest.
    useEffect(() => {
        if (!arrival || arrival.phase !== "landed")
            return;
        const timer = window.setTimeout(() => setArrival(null), ARRIVAL_LINGER_MS);
        return () => window.clearTimeout(timer);
    }, [arrival]);
    // ✕ on the reward card (and Android back, below): the data is already
    // settled, so nothing is lost — the sticker still flies, into the 小天地
    // tab, and 今日 opens with its +1.
    function closeComplete() {
        const session = state?.sessions.find((s) => s.id === route.id);
        if (session)
            launchReward({
                kind: session.ritual,
                from: rewardOriginOf(shell.current?.querySelector("[data-reward-origin]")),
                tab: "world",
                announce: tr("{p0}\u5DF2\u653E\u8FDB\u5C0F\u5929\u5730", { p0: tr(rituals[session.ritual].object) }),
            });
        go({ page: "today" });
    }
    useEffect(() => {
        void store.load();
    }, [store]);
    useEffect(() => followSystemReducedMotion(store), [store]);
    useEffect(() => {
        onCanGoBack?.(canBack);
    }, [canBack, onCanGoBack]);
    const lastBack = useRef(backRequest);
    useEffect(() => {
        if (lastBack.current !== backRequest) {
            lastBack.current = backRequest;
            if (dismissRitualShare(shell.current))
                return;
            // On the reward card, Android back leaves like ✕ does, not like a
            // stack pop: the exits agree, and the sticker still flies to the tab.
            if (route.page === "complete")
                closeComplete();
            else
                back({ sound: true });
        }
    }, [backRequest, route.page]);
    useEffect(() => {
        const blur = () => { focused.current = false; stopFeedback(); };
        const focus = () => { focused.current = true; };
        const hidden = () => {
            if (document.hidden) {
                stopFeedback();
                void store.flush();
                void audio.current?.suspend();
            }
        };
        const beforeUnload = (e: BeforeUnloadEvent) => {
            const status = store.getSnapshot().status;
            if (status === "saving" || status === "save-error") {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        document.addEventListener("visibilitychange", hidden);
        window.addEventListener("blur", blur);
        window.addEventListener("focus", focus);
        window.addEventListener("beforeunload", beforeUnload);
        return () => {
            document.removeEventListener("visibilitychange", hidden);
            window.removeEventListener("blur", blur);
            window.removeEventListener("focus", focus);
            window.removeEventListener("beforeunload", beforeUnload);
            stopFeedback();
            // StrictMode replays this effect with the same memoized player.
            // stop frees its nodes; mounted/active gate late callbacks.
            void audio.current?.close();
            audio.current = null;
        };
    }, [store, sounds, stopFeedback]);
    useEffect(() => store.subscribe(() => {
        const current = store.getSnapshot();
        if (!current.state?.settings.sound) {
            stopFeedback();
        } else if (current.status === "saved" && pendingSaveSound.current) {
            pendingSaveSound.current = false;
            resultSound("saved");
        }
    }), [store, sounds, stopFeedback]);
    useEffect(() => {
        if (!active) {
            stopFeedback();
            void store.flush();
            void audio.current?.suspend();
        }
    }, [active, store, stopFeedback]);
    function prepareFeedback() {
        if (!activeNow.current || !focused.current || document.hidden || !store.getSnapshot().state?.settings.sound)
            return;
        try {
            const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctor) return;
            const ctx = (audio.current ??= new Ctor());
            void ctx.resume().catch(() => { });
        }
        catch {
            /* Hosts may disallow audio. */
        }
    }
    async function decodeSound(bytes: ArrayBuffer) {
        const ctx = (audio.current ??= new AudioContext());
        const sound = await ctx.decodeAudioData(bytes.slice(0));
        if (sound.duration > 3 || sound.numberOfChannels > 2)
            throw new InvalidContentError("Scene sound exceeds budget");
        return sound;
    }
    function haptic(strength?: HapticStrength) {
        if (store.getSnapshot().state?.settings.haptics)
            void host.haptic?.(strength).catch(() => { });
    }
    function feedback(sound?: AudioBuffer | SoftSound) {
        audioInspector.stop();
        haptic();
        if (!mounted.current || !activeNow.current || !focused.current || document.hidden || !store.getSnapshot().state?.settings.sound)
            return;
        try {
            if (!sound || typeof sound === "string") {
                interactionSounds.play(sound ?? "woodfish");
                return;
            }
            prepareFeedback();
            const ctx = audio.current;
            if (!ctx) return;
            if (sound) {
                const source = ctx.createBufferSource();
                source.buffer = sound;
                source.connect(ctx.destination);
                sampledSounds.current.add(source);
                source.onended = () => { source.disconnect(); sampledSounds.current.delete(source); };
                source.start();
                return;
            }
        }
        catch {
            /* Sound is optional if the host disallows Web Audio. */
        }
    }
    if (!state)
        return (<div className="bless-app">
        <style>{fontStyles}</style>
        <div className="loading-screen">
          <Icon name="leaf"/>
          <p className="eyebrow">{tr("\u4E00\u65E5\u4E00\u5FF5 \u00B7 \u8D5B\u535A\u7948\u798F")}</p>
          <h1>
            {snapshot.status === "load-error"
                ? tr("\u5148\u628A\u56DE\u5FC6\u627E\u56DE\u6765\u3002") : tr("\u4E3A\u4ECA\u5929\uFF0C\u7559\u4E00\u70B9\u6E29\u67D4\u3002")}
          </h1>
          <p>{snapshot.errorCode ? message(snapshot.errorCode) : snapshot.error ? tr(snapshot.error) : tr("\u6B63\u5728\u5C55\u5F00\u4F60\u7684\u5C0F\u5929\u5730\u2026")}</p>
          {snapshot.status === "load-error" && (<button className="button primary" onClick={() => void store.load()}>{tr("\u91CD\u65B0\u8BFB\u53D6")}</button>)}
        </div>
      </div>);
    const section = route.page === "wish" || route.page === "new"
        ? "wishes"
        : route.page === "collection"
            ? "world"
            : route.page === "history"
                ? "world"
                : roots.includes(route.page)
                    ? route.page
                    : "today";
    // Scene titles share the page ribbon; their canvas has no second heading.
    const offeredRibbonEntry = route.entry ?? state.sceneRecords.find(r => r.id === route.id);
    const ribbonEntry = bundledSceneEntry(offeredRibbonEntry) ?? offeredRibbonEntry;
    const ribbon = ({
        scene: ribbonEntry ? localizedTitle(ribbonEntry) : '',
        ritual: ritualTitle[state.activeSession?.ritual ??
            (route.id === "crane"
                ? "crane"
                : route.id === "lantern"
                    ? "lantern"
                    : "woodfish")],
    } as Record<string, string>)[route.page];
    // Latch the skipped page-in onto the route it was launched for, so the
    // inline style stays for that <main>'s lifetime (removing it later would
    // restart the animation) and only the next visit to another route, or an
    // unlatched return to this one, gets its page-in back.
    const routeKey = route.page + (route.id ?? "");
    if (skippedRoute.current && skippedRoute.current !== routeKey)
        skippedRoute.current = null;
    if (skipNextPageIn.current) {
        skippedRoute.current = routeKey;
        skipNextPageIn.current = false;
    }
    const skipPageIn = skippedRoute.current === routeKey;
    // What shows at landing: a hop on the tab the reward belongs to, and a
    // butter +1 on 心愿 (a note) or, when nothing landed in the room itself,
    // on 小天地 (the ✕ / back flight).
    const landed = arrival?.phase === "landed";
    const hopTab = !landed
        ? null
        : arrival!.collectibleId || arrival!.tab !== "wishes"
            ? "world"
            : "wishes";
    const tabBadge = (id: string) => {
        if (!landed)
            return "";
        if (id === "wishes")
            return arrival!.wishId ? "+1" : "";
        return !arrival!.collectibleId && id === (arrival!.tab ?? "world")
            ? "+1"
            : "";
    };
    const page = route.page === 'privacy' || route.page === 'support' ? <LegalInformation kind={route.page}/> :
        route.page === "scenes" ? <SceneCatalog /> : route.page === "cache" ? <CacheManager /> : route.page === "scene" ? <SceneExperience entry={route.entry ?? state.sceneRecords.find(r => r.id === route.id)} wishId={route.wishId} daily={route.daily} vessel={route.vessel} replay={route.replay} opening={route.opening} feedbackSession={route.feedbackSession}/> : route.page === "today" ? (openingActive ? <Opening /> : <Today key={day} day={day}/>) : route.page === "wishes" ? (<Wishes />) : route.page === "world" ? (<World />) : route.page === "me" ? (<Me />) : route.page === "new" ? (<NewWish />) : route.page === "wish" ? (<WishDetail key={route.id} id={route.id!}/>) : route.page === "fulfill" ? (<FulfillWish key={route.id} id={route.id!}/>) : route.page === "note" ? (<WishNote key={route.id} id={route.id!}/>) : route.page === "ritual" ? (<Ritual id={route.id} wishId={route.wishId} whenIdleRef={woodfishIdle}/>) : route.page === "complete" ? (<Complete id={route.id!} revealReward={route.revealReward} shareSnapshot={route.shareSnapshot}/>) : route.page === "collection" ? (<CollectionDetail id={route.id!}/>) : (<History />);
    return (<IntlProvider locale={formatLocale} defaultLocale="zh-Hans" messages={catalogData[locale]}><ContentContext.Provider value={content ?? {}}>
      <Context.Provider value={{
            state,
            internalToolsEnabled,
            go,
            back,
            active,
            feedback,
            uiSound,
            audioInspector: hasDebugOverlay ? audioInspector : undefined,
            haptic,
            canHaptic: typeof host.haptic === "function",
            shareImage: host.shareImage,
            shareLink: host.shareLink,
            publicShareBaseUrl: host.publicShareBaseUrl,
            decodeSound,
            prepareFeedback,
            stopInteractionSound,
            fulfillmentDrafts,
            setFulfillmentDraft: (id, draft) => setFulfillmentDrafts((old) => {
                const next = { ...old };
                if (draft)
                    next[id] = draft;
                else
                    delete next[id];
                return next;
            }),
            dispatch: (action) => {
                try {
                    const before = store.getSnapshot().state;
                    const savesWish = ["wish.create", "wish.note", "wish.realize", "wish.fulfill", "scene.visual", "scene.visual.all"].includes(action.type);
                    if (savesWish) prepareFeedback();
                    store.dispatch(action);
                    setError("");
                    const after = store.getSnapshot().state;
                    if (after === before) return false;
                    if (savesWish) pendingSaveSound.current = true;
                    if (action.type === 'settings' && before?.settings[action.key] !== after?.settings[action.key]) {
                        // The new setting is already live; muting therefore stays completely quiet.
                        uiSound(action.value ? 'toggleOn' : 'toggleOff');
                    } else if (action.type === 'scene.favorite') {
                        if (before?.sceneRecords.find(record => record.id === action.id)?.favorite !==
                            after?.sceneRecords.find(record => record.id === action.id)?.favorite)
                            uiSound(action.favorite ? 'toggleOn' : 'toggleOff');
                    } else if (action.type === 'wish.archive') {
                        if (!!before?.wishes.find(wish => wish.id === action.id)?.archived !==
                            !!after?.wishes.find(wish => wish.id === action.id)?.archived)
                            uiSound(action.archived ? 'toggleOff' : 'toggleOn');
                    }
                    if (action.type === "scene.progress") {
                        const prior = before?.sceneRecords.find(record => record.id === action.id);
                        const next = after?.sceneRecords.find(record => record.id === action.id);
                        if (prior && next && sceneProgress(prior) < sceneStepCount(prior) && sceneProgress(next) >= sceneStepCount(next))
                            resultSound("complete");
                    } else if (action.type === "opening.collect") {
                        resultSound("collect");
                    } else if (action.type === "ritual.finish" || action.type === "opening.finish") {
                        if (action.type === "ritual.finish") haptic();
                        resultSound("complete");
                    }
                    return true;
                }
                catch (e) {
                    setError(e instanceof ProductError ? e : e instanceof Error && hasProductCopy(e.message)
                        ? e.message : '这一步暂时没有完成，请再试一次');
                    return false;
                }
            },
            launchReward,
            arrival,
            announce,
        }}>
        <TestFeedbackProvider host={host.testFeedback} enabled={internalToolsEnabled} active={active}><SceneLibraryProvider><div className={`bless-app${state.settings.reducedMotion ? " reduce-motion" : ""}`}>
          <style>{fontStyles}</style>
          <div className="desktop-note">
            <span className="brand-mark">{tr("\u5FF5")}</span>
            <strong>{tr("\u4E00\u65E5\u4E00\u5FF5")}</strong>
            <p>{tr("\u628A\u5C0F\u5C0F\u7684\u4EEA\u5F0F\uFF0C")}<br />{tr("\u8FC7\u6210\u6E29\u67D4\u7684\u65E5\u5E38\u3002")}</p>
            <span>CYBER BLESS · A LITTLE EVERY DAY</span>
          </div>
          <div className="app-shell" data-page={route.page} data-immersive={immersive ? '' : undefined} data-opening={openingActive ? '' : undefined} ref={shell}
            onPointerDownCapture={prepareUiFeedback} onKeyDownCapture={event => {
                if (event.key === 'Enter' || event.key === ' ') prepareUiFeedback();
            }}>
            <WidgetNavigation request={navigationRequest} route={route} saved={snapshot.status === 'saved'} busy={!!flight} onConsumed={onNavigationConsumed}/>
            {!roots.includes(route.page) && (<header className={`app-topbar${route.page === "complete" ? " completion-topbar" : ""}${route.page === "scene" || route.page === "ritual" ? " scene-topbar" : " page-topbar"}`}>
                <button data-audio-cue={route.page === 'complete' ? state.sessions.some(session => session.id === route.id) ? 'collect' : undefined : canBack ? 'back' : undefined} className="back-button" aria-label={route.page === "complete" ? tr("\u5173\u95ED\u5B8C\u6210\u9875") : tr("\u8FD4\u56DE")} onClick={route.page === "complete"
                ? closeComplete
                : () => back({ sound: true })}>
                  <Icon name={route.page === "complete" ? "close" : "back"}/>
                </button>
                {ribbon && <PageTitle title={route.page === 'ritual' ? tr(ribbon) : ribbon}/>}
                {(route.page === "scene" || route.page === "ritual") && <FeedbackControls sceneId={route.page === "scene" ? route.entry?.id ?? route.id : state.activeSession?.ritual ?? route.id ?? "woodfish"}/>}
              </header>)}
            <span className={snapshot.status === "saved" ? "sr-only" : "save-status"} role="status">
              {snapshot.status === "saving"
            ? tr("\u6B63\u5728\u4FDD\u5B58\u2026") : snapshot.status === "save-error"
            ? tr("\u5C1A\u672A\u4FDD\u5B58") : tr("\u672C\u673A\u73CD\u85CF")}
            </span>
            {snapshot.status === "save-error" && (<div className="error-banner" role="alert">
                <span>{snapshot.errorCode ? message(snapshot.errorCode) : snapshot.error ? tr(snapshot.error) : ''}</span>
                <button data-audio-cue="select" onClick={() => { uiSound('select'); store.retry(); }}>{tr("\u91CD\u8BD5\u4FDD\u5B58")}</button>
              </div>)}
            {error && (<div className="error-banner" role="alert">
                <span>{error instanceof ProductError ? message(error.code, error.values) : tr(error)}</span>
                <button data-audio-cue="close" onClick={() => { uiSound('close'); setError(""); }}>{tr("\u77E5\u9053\u4E86")}</button>
              </div>)}
            <main className="app-content" key={route.page + (route.id ?? "")} style={skipPageIn ? { animation: "none" } : undefined}>
              {page}
            </main>
            {flight && (<RewardFlightLayer flight={flight} reducedMotion={shouldReduceMotion(state.settings.reducedMotion)} onLand={onRewardLand}/>)}
            {roots.includes(route.page) && !openingActive && (<nav className="bottom-nav" aria-label={tr("\u4E3B\u5BFC\u822A")}>
                {[
                ["today", message('app.nav.today'), tr("\u4ECA\u65E5")],
                ["wishes", message('app.nav.wishes'), tr("\u5FC3\u613F")],
                ["world", message('app.nav.world'), tr("\u5C0F\u5929\u5730")],
                ["me", message('app.nav.me'), tr("\u6211\u7684")],
            ].map(([id, label, accessibleLabel]) => (<button data-audio-cue={section === id ? undefined : "navigate"} key={id} data-tab={id} aria-label={accessibleLabel ?? label} aria-current={section === id ? "page" : undefined} className={hopTab === id ? "tab-hop" : undefined} onClick={() => go({ page: id as Route["page"] }, { sound: 'navigate' })}>
                    <Icon name={id}/>
                    <span>{label}</span>
                    <i>{tabBadge(id)}</i>
                  </button>))}
              </nav>)}
            {/* The App's one polite voice: settle beats and landings. */}
            <p className="sr-only" role="status">
              {announcement && (<span key={announcement.n}>{announcement.text}</span>)}
            </p>
            {debugOverlay}
          </div>
        </div></SceneLibraryProvider></TestFeedbackProvider>
      </Context.Provider>
  </ContentContext.Provider></IntlProvider>);
}
