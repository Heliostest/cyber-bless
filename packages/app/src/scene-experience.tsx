import { localizedTitle } from './localization';
import { translate as tr, message, productError, translateScene } from '@wbr/i18n';
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { mountScene, type SceneSession, type SceneController, } from "@wbr/scene-runtime";
import type { CatalogEntry, SceneLease, SceneProgress, } from "@wbr/content/catalog";
import { dailyCollectibleId, hasReturnRitual, localDay, openingExclusions, sceneIntention, } from "@wbr/core";
import { WISH_WRITE_COPY } from "@wbr/gestures";
import type { WoodfishContext } from "./scene-engines";
import { sceneEngines } from "./scene-engines";
import { Icon } from "./art";
import { now, uid, useApp } from "./context";
import { supportsScene, useSceneLibrary, woodfishPack } from "./scene-library";
import { Woodfish } from "./woodfish";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { SceneLoadFailure } from "./scene-load-failure";
import { sceneWish } from "./scene-wish";
import { dailyPrimaryScene, isWishScene, sceneRitual, sceneStage, sceneSteps, } from "./scene-placement";
import { rectOf, rewardOriginOf } from "./reward-flight";
import { OpeningGuide, OpeningDone } from './opening';
import { OptionalSceneWish } from './optional-scene-wish';
import { useSceneVisualPreference } from "./scene-visual-preference";
import { SceneRewardReveal } from "./scene-reward-reveal";
import { SceneShareButton } from "./ritual-share";
export function ProceduralScene({ entry, progress, checkpoint, saveWish, returning, initialVariant, onVariantChange, failed, }: {
    entry: CatalogEntry;
    progress: number;
    checkpoint(n: number): void;
    /** Present unless this walk keeps nothing from its wish box. */
    saveWish?(text: string): void;
    returning?: boolean;
    initialVariant?: string;
    onVariantChange?(variant: string): void;
    failed(error?: unknown): void;
}) {
    const host = useRef<HTMLDivElement>(null), session = useRef<SceneSession<SceneController>>(null);
    const { active, state, prepareFeedback, haptic } = useApp();
    useSceneVisualPreference(entry.id, () => {
        session.current?.setActive(false);
        session.current?.setActive(active);
    }, host);
    const callbacks = { checkpoint, saveWish, failed, prepareFeedback, haptic, onVariantChange };
    const latest = useRef({ ...callbacks, state });
    latest.current = { ...callbacks, state };
    const stage = sceneStage(entry.id);
    useEffect(() => {
        session.current = mountScene({
            host: host.current!,
            active,
            reducedMotion: state.settings.reducedMotion,
            context: {
                progress,
                checkpoint: (n: number) => latest.current.checkpoint(n),
                sceneId: entry.id,
                prepareFeedback: () => latest.current.prepareFeedback(),
                haptic: (strength?: Parameters<typeof haptic>[0]) => latest.current.haptic(strength),
                isSoundEnabled: () => latest.current.state.settings.sound,
                // Absent on a walk that keeps nothing: the box then says so itself.
                ...(saveWish
                    ? {
                        saveWish: (text: string) => latest.current.saveWish!(text),
                    }
                    : {}),
                stage,
                returning,
                deferWishWriting: true,
                initialVariant,
                onVariantChange: (variant: string) => latest.current.onVariantChange?.(variant),
            },
            load: () => sceneEngines.load(entry.engine as "celtic-folk-spring@1" | "theravada-water@1" | "tanzaku-tanabata@1" | "yeondeunghoe@1" | "furin-wind-chime@1"),
            ready: () => {
                if (host.current)
                    host.current.dataset.ready = "true";
            },
            failed: (error) => latest.current.failed(error),
        });
        return () => {
            session.current?.dispose();
            session.current = null;
        };
    }, []);
    useEffect(() => session.current?.setActive(active), [active]);
    useEffect(() => session.current?.setReducedMotion(state.settings.reducedMotion), [state.settings.reducedMotion]);
    // data-scene and data-stage are styling hooks; the scene lights for the stage too.
    return (<div className="library-scene-stage" data-scene={entry.id} data-stage={stage} ref={host}/>);
}
/** The scene page's favourite toggle. */
export const SCENE_FAVORITE_LABEL = "收藏";
/**
 * 收藏 as a heart toggle beside the completion action. Its state is the
 * filled heart and aria-pressed, so its name stays the same either way.
 */
export function FavoriteChip({ id, favorite }: {
    id: string;
    favorite: boolean;
}) {
    const { dispatch } = useApp();
    return (<button type="button" className="button favorite-chip" aria-pressed={favorite} onClick={() => dispatch({ type: "scene.favorite", id, favorite: !favorite })}>
      <Icon name="heart"/>
      {tr(SCENE_FAVORITE_LABEL)}
    </button>);
}
/** The exits shown when a scene's steps are done. */
export const SCENE_DONE_WISH_CTA = "去心愿看看";
export const SCENE_DONE_CTA = "完成";
/** A 还愿 visit's exit, back to 来还个愿. */
export const SCENE_RETURN_CTA = "继续还愿 · 留下这份心情";
/** A daily-set walk's closing moment: the keepsake settles, then flies home. */
export const SCENE_DAILY_CTA = "收下";
/** A vessel walk for a new wish: the held line gets an explicit choice. */
export const SCENE_KEEP_QUESTION = "刚才写下的话，要留下来吗？";
export const SCENE_KEEP_CTA = "留下它";
export const SCENE_DISCARD_CTA = "不留下";
export const SCENE_DISCARDED_COPY = "没有保存，只留此刻的心情。";
/** The caption while a daily-set scene is being walked. */
export const SCENE_DAILY_CAPTION = "今日随机仪式 · 完成后收进小天地";
/** Announced when the daily keepsake lands. */
export const sceneDailyAnnounce = (title: string) => tr("{p0}\u5DF2\u653E\u8FDB\u5C0F\u5929\u5730", { p0: title });
function LoadedScene({ entry, lease, wishId, daily, vessel, replay, opening, failed, }: {
    entry: CatalogEntry;
    lease?: SceneLease;
    /** On a 还愿 visit: the realized wish the ritual is walked for. */
    wishId?: string;
    /** On a daily-set visit: the local day the keepsake is collected for. */
    daily?: string;
    /** On a vessel visit: the wish-type keepsake being used. */
    vessel?: string;
    /** On a plain replay (小天地's 回看, 仪式时光's 再次体验): settles nothing. */
    replay?: boolean;
    opening?: boolean;
    failed(error?: unknown): void;
}) {
    const { state, dispatch, active, feedback, prepareFeedback, go, launchReward, announce, back, } = useApp();
    const { entries } = useSceneLibrary();
    const record = state.sceneRecords.find((r) => r.id === entry.id);
    const progress = record?.progress ?? 0;
    const steps = sceneSteps(entry);
    const woodfishStrikes = record?.strikes ?? progress;
    const woodfishFinished = progress >= steps;
    const intention = sceneIntention(entry.id);
    const [instruction, setInstruction] = useState("\u8F7B\u6572\u6728\u9C7C\uFF0C\u8BA9\u5FC3\u6162\u4E0B\u6765");
    // A 还愿 visit: a wish still waiting on its 还愿. The vessel path may walk
    // any wish scene; the legacy free walk (no vessel) only a core ritual's.
    const ritual = sceneRitual(entry.id);
    const returnWish = vessel || ritual
        ? state.wishes.find((w) => w.id === wishId && w.status === "realized" && !w.archived)
        : undefined;
    const gratitudeAction = entry.id === "daruma-eye-painting"
        ? tr("\u8865\u597D\u8FBE\u6469\u7684\u53E6\u4E00\u76EE\uFF0C\u4E3A\u5DF2\u7ECF\u5B9E\u73B0\u7684\u5FC3\u613F\u8868\u8FBE\u611F\u8C22\u3002") : entry.id === "omamori-cycle"
        ? tr("\u6574\u7406\u5FA1\u5B88\uFF0C\u628A\u5B83\u653E\u8FDB\u8FD4\u7EB3\u76D2\uFF0C\u8868\u8FBE\u8FD9\u6BB5\u966A\u4F34\u4E2D\u7684\u611F\u8C22\u3002") : tr("\u56DE\u60F3\u613F\u671B\u5B9E\u73B0\u7684\u7ECF\u5386\u4E0E\u5E2E\u52A9\u8FC7\u4F60\u7684\u4EBA\uFF0C\u5E26\u7740\u611F\u8C22\u5B8C\u6210\u773C\u524D\u7684\u52A8\u4F5C\u3002");
    // A vessel walk that is not a 还愿 is a 许愿: its line is held, not saved.
    const vesselMake = vessel && !returnWish;
    // The held line of a 许愿 walk, kept in the save under the vessel, so the
    // keep-or-discard choice (and the phrase) survive back, remount and reload.
    const draft = vesselMake ? state.vesselDrafts?.[vessel] : undefined;
    /** The wish this visit kept, as always: from a line saved on a plain walk. */
    const [keptWish, setKeptWish] = useState<string>();
    const [wishWriting, setWishWriting] = useState(false);
    const postWishSubmitted = useRef(false);
    /** A vessel 许愿 walk holds its box line for the keep-or-not choice. */
    const [heldWish, setHeldWish] = useState<string | undefined>(() => draft?.line);
    /** Whether this walk settled a daily keepsake; a vessel is spent by the
     * walk itself, so that one is read straight off the collectible. */
    const [dailyGranted, setDailyGranted] = useState(false);
    const [rewardRevealed, setRewardRevealed] = useState(false);
    const revealedThisWalk = useRef(false);
    const [discarded, setDiscarded] = useState(false);
    const vesselSpent = !!vessel && state.collectibles.some((c) => c.id === vessel && !!c.spentAt);
    const doneCta = useRef<HTMLButtonElement>(null);
    const collectCta = useRef<HTMLButtonElement>(null);
    // One record per visit, however often the last step reports.
    const [visit] = useState(() => ({ id: uid(), startedAt: now() }));
    const checkpoint = (n: number, strikes?: number) => {
        const advanced = dispatch({ type: "scene.progress", id: entry.id, progress: n, ...(strikes === undefined ? {} : { strikes }) });
        if (n < steps)
            return;
        if (advanced && progress < steps && !revealedThisWalk.current) {
            revealedThisWalk.current = true;
            setRewardRevealed(true);
        }
        // A daily-set walk settles its keepsake once. So
        // does an unflagged walk of 今日's main scene: finishing the day's walk
        // from 场景目录 or 仪式时光 counts for today too. A vessel, 还愿, or
        // 回看 visit never settles one.
        const settleDay = opening ? undefined : daily
            ? daily
            : !vessel &&
                !wishId &&
                !replay &&
                dailyPrimaryScene(entries, localDay(), openingExclusions(state.opening, localDay()))?.id === entry.id
                ? localDay()
                : undefined;
        if (settleDay) {
            const granted = dispatch({
                type: "daily.scene",
                id: visit.id,
                sceneId: entry.id,
                title: entry.title,
                wishScene: isWishScene(entry.id),
                day: settleDay,
                startedAt: visit.startedAt,
                at: now(),
            });
            if (granted)
                setDailyGranted(true);
        }
        // A vessel is spent by the walk itself, whichever way the line goes.
        if (vessel) {
            dispatch({
                type: "collectible.spend",
                id: vessel,
                at: now(),
                ...(returnWish ? { wishId: returnWish.id } : {}),
            });
        }
        else if (ritual && returnWish) {
            // The legacy 还愿 walk: a session and a note, without an extra keepsake.
            dispatch({
                type: "ritual.scene",
                id: visit.id,
                ritual,
                wishId: returnWish.id,
                startedAt: visit.startedAt,
                at: now(),
            });
        }
    };
    /** The wish to go on fulfilling, once this ritual counts for it. */
    const returnedFor = returnWish && hasReturnRitual(state, returnWish) ? returnWish.id : undefined;
    const favoriteChip = (<FavoriteChip id={entry.id} favorite={!!record?.favorite}/>);
    const canRecordWish = progress >= steps && !!intention?.optionalWish &&
        !returnWish && !keptWish && !heldWish && !discarded;
    const prayerButton = canRecordWish ? <button type="button" className="button secondary scene-wish-invite" disabled={!active} aria-expanded={wishWriting} onClick={() => setWishWriting(true)}>{tr("\u7948\u613F")}</button> : null;
    const completionActions = (completion: ReactNode) => (<div className="scene-completion-actions">
      {favoriteChip}
      {completion}
      {prayerButton}
    </div>);
    const pendingVesselChoice = !opening && !returnedFor && !dailyGranted &&
        vesselSpent && !!heldWish && !discarded && !keptWish;
    // The wish box, by path. A 许愿 vessel holds its line for the choice at
    // done — in the save, under the vessel, so the choice cannot be escaped
    // into a lost phrase; a 还愿 vessel keeps nothing (its box says so itself);
    // every other walk saves each line as its own new 心愿, as it always has.
    const saveWish = (text: string) => {
        if (vesselMake) {
            const line = text.trim();
            if (line) {
                setHeldWish(line);
                dispatch({ type: "vessel.hold", id: vessel!, line, at: now() });
            }
            return;
        }
        const wish = sceneWish(text, entry.id, uid(), now());
        if (wish && dispatch(wish))
            setKeptWish(wish.id);
    };
    // One exit at done: back to 来还个愿 on a 还愿 visit, else to the kept
    // wish, with the slip flying into its new card, or simply back.
    const goSeeWish = () => {
        launchReward({
            kind: "leaf",
            from: rectOf(doneCta.current),
            wishId: keptWish,
            tab: "wishes",
            announce: WISH_WRITE_COPY.saved,
        });
        go({ page: "wishes" });
    };
    /** A daily walk's 收下: the keepsake flies from the button into 小天地. */
    const collectDaily = () => {
        launchReward({
            kind: "scene",
            sceneId: entry.id,
            from: rewardOriginOf(collectCta.current),
            collectibleId: dailyCollectibleId(daily!, entry.id),
            tab: "world",
            announce: sceneDailyAnnounce(entry.title),
        });
        go({ page: "world" });
    };
    /** The keep choice of a 许愿 vessel: the held line becomes a new 心愿. */
    const keepHeld = () => {
        const line = (heldWish ?? "").trim();
        if (!line)
            return;
        const wish = sceneWish(line, entry.id, uid(), now());
        if (wish && dispatch(wish)) {
            setKeptWish(wish.id);
            setHeldWish(undefined);
            // The choice is settled: the save lets the line go.
            if (vessel)
                dispatch({ type: "vessel.clear", id: vessel });
        }
    };
    /** The not-keep choice of a 许愿 vessel: the line goes, the moment stays. */
    const discardHeld = () => {
        setDiscarded(true);
        announce(SCENE_DISCARDED_COPY);
        if (vessel)
            dispatch({ type: "vessel.clear", id: vessel });
    };
    const saveCompletedWish = (text: string) => {
        if (!active || !canRecordWish || postWishSubmitted.current)
            return;
        const wish = sceneWish(text, entry.id, uid(), now());
        if (!wish || !dispatch(wish))
            return;
        postWishSubmitted.current = true;
        setKeptWish(wish.id);
        setHeldWish(undefined);
        if (vessel)
            dispatch({ type: "vessel.clear", id: vessel });
        announce(WISH_WRITE_COPY.saved);
    };
    const client = useMemo<WoodfishContext["content"] | undefined>(() => lease && entry.engine === "woodfish@1"
        ? {
            prepareUpdate: async () => { },
            async load(initialize, options = {}) {
                const pack = woodfishPack(lease.manifest);
                const model = await lease.read("model", options.signal);
                const sound = pack.sound
                    ? await lease.read("sound", options.signal)
                    : undefined;
                return {
                    pack,
                    value: await initialize(pack, model, sound),
                    confirm: async () => { },
                };
            },
        }
        : undefined, [lease]);
    return (<>
      {rewardRevealed && <SceneRewardReveal sceneId={entry.id} reducedMotion={state.settings.reducedMotion}/>}
      {intention && <aside className="scene-intention" data-kind={returnWish ? "blessing" : intention.kind} aria-label={tr("\u8FD9\u4E00\u573A\u7684\u5FC3\u610F")}>
        <strong>{returnWish ? tr("\u4E3A\u5DF2\u7ECF\u5B9E\u73B0\u7684\u5FC3\u613F\u8FD8\u613F") : translateScene(intention.label)}</strong>
        <p>{returnWish ? tr("\u4E3A\u300C{p0}\u300D\u8FD8\u613F\u3002{p1}", { p0: returnWish.title, p1: gratitudeAction }) : translateScene(intention.action)}</p>
      </aside>}
      {returnWish && (<p className="scene-caption">{message('app.return.caption', { title: returnWish.title })}</p>)}
      {daily && (<p className="scene-caption">{tr(SCENE_DAILY_CAPTION)}</p>)}
      <p className="scene-progress sr-only" role="status">
        {entry.engine === 'woodfish@1' && !woodfishFinished
            ? message('app.woodfish.progress', { n: woodfishStrikes, min: steps }) : tr("\u5DF2\u5B8C\u6210 {p0} / {p1}", { p0: progress, p1: steps })}
      </p>
      {entry.engine === "woodfish@1" ? (<Woodfish sceneId={entry.id} contentClient={client} active={active} reducedMotion={state.settings.reducedMotion} view="front" disabled={woodfishFinished} strikes={woodfishStrikes} minimumStrikes={steps} instruction={instruction} onFinish={() => {
                if (active && !woodfishFinished)
                    checkpoint(steps);
            }} onStrike={() => {
                if (!active || woodfishFinished)
                    return false;
                prepareFeedback();
                // The final checkpoint belongs to the user's finish action.
                checkpoint(Math.min(steps - 1, woodfishStrikes + 1), woodfishStrikes + 1);
                return true;
            }} onImpact={feedback} onInstruction={setInstruction} onFailure={failed}/>) : (<ProceduralScene entry={entry} progress={progress} checkpoint={checkpoint} saveWish={vessel && returnWish ? undefined : saveWish} returning={Boolean(returnWish)} initialVariant={record?.variant} onVariantChange={variant => dispatch({ type: "scene.variant", id: entry.id, variant })} failed={failed}/>)}
      {progress >= steps && (<div className="scene-done-row">
          {opening ? <OpeningDone entry={entry} keptWish={!!keptWish} favorite={favoriteChip} prayer={prayerButton}/> : returnedFor ? (<>
              {/* No flight: the note is on the wish already, and the ritual
                        shows as done on 来还个愿. */}
              {completionActions(<button type="button" className="button primary" onClick={() => go({ page: "fulfill", id: returnedFor })}>
                {tr(SCENE_RETURN_CTA)}
              </button>)}
            </>) : dailyGranted ? (<>
              {completionActions(<button type="button" className="button primary" ref={collectCta} onClick={collectDaily}>
                {tr(SCENE_DAILY_CTA)}
              </button>)}
              {keptWish && (<button type="button" className="text-button" ref={doneCta} onClick={goSeeWish}>
                  {tr(SCENE_DONE_WISH_CTA)}
                </button>)}
            </>) : vesselSpent ? (<>
              {discarded ? (<>
                  <p className="scene-done">{tr(SCENE_DISCARDED_COPY)}</p>
                  {completionActions(<button type="button" className="button primary" onClick={back}>
                    {tr(SCENE_DONE_CTA)}
                  </button>)}
                </>) : heldWish ? (<>
                  <p className="scene-keep-line">「{heldWish}」</p>
                  <p className="scene-keep-question">{tr(SCENE_KEEP_QUESTION)}</p>
                  <div className="scene-keep-choice">
                    <button type="button" className="button primary" onClick={keepHeld}>
                      {tr(SCENE_KEEP_CTA)}
                    </button>
                    <button type="button" className="button secondary" onClick={discardHeld}>
                      {tr(SCENE_DISCARD_CTA)}
                    </button>
                  </div>
                </>) : keptWish ? (<>
                  {completionActions(<button type="button" className="button primary" ref={doneCta} onClick={goSeeWish}>
                    {tr(SCENE_DONE_WISH_CTA)}
                  </button>)}
                </>) : (<>
                  {completionActions(<button type="button" className="button primary" onClick={back}>
                    {tr(SCENE_DONE_CTA)}
                  </button>)}
                </>)}
            </>) : keptWish ? (<>
              {completionActions(<button type="button" className="button primary" ref={doneCta} onClick={goSeeWish}>
                {tr(SCENE_DONE_WISH_CTA)}
              </button>)}
            </>) : (<>
              {completionActions(<button type="button" className="button primary" onClick={back}>
                {tr(SCENE_DONE_CTA)}
              </button>)}
            </>)}
          <SceneShareButton sceneId={entry.id} title={localizedTitle(entry)}/>
        </div>)}
      {canRecordWish && wishWriting && (<OptionalSceneWish active={active} onSubmit={saveCompletedWish} onClose={() => setWishWriting(false)}/>)}
      {entry.engine !== "woodfish@1" && (
        // Present from the start (empty), so the confirmation is announced.
        <p className="scene-wish-saved" role="status">
          {keptWish && (<>
              {tr(WISH_WRITE_COPY.saved)}
              {!opening && <button className="text-button" onClick={() => go({ page: "wish", id: keptWish })}>{tr("\u53BB\u770B\u770B")}</button>}
            </>)}
        </p>)}
      {(progress < steps || pendingVesselChoice) && (<div className="scene-actions">{favoriteChip}</div>)}
    </>);
}
export function SceneExperience({ entry, wishId, daily, vessel, replay, opening, }: {
    entry?: CatalogEntry;
    /** Set when the scene is walked as a 还愿 ritual for this wish. */
    wishId?: string;
    /** Set when the scene is walked from 今日's daily set: the local day. */
    daily?: string;
    /** Set when a wish-type keepsake is being used: its collectible id. */
    vessel?: string;
    /** Set on a plain replay (回看, 再次体验): it settles nothing. */
    replay?: boolean;
    opening?: boolean;
}) {
    const { library, ready } = useSceneLibrary(), { dispatch, back } = useApp();
    const [attempt, setAttempt] = useState(0), [progress, setProgress] = useState<SceneProgress>();
    const [loaded, setLoaded] = useState<{
        lease?: SceneLease;
        caption?: string;
    }>();
    const [error, setError] = useState("");
    const cancel = useRef<AbortController>(null);
    const fail = (error?: unknown) => {
        cancel.current?.abort();
        setLoaded(undefined);
        setError(error instanceof Error && error.message ? error.message : "\u573A\u666F\u753B\u9762\u6682\u4E0D\u53EF\u7528");
    };
    useEffect(() => {
        if (!ready || !entry)
            return;
        const controller = new AbortController();
        cancel.current = controller;
        let lease: SceneLease | undefined;
        setLoaded(undefined);
        setError("");
        setProgress(undefined);
        void (async () => {
            if (!supportsScene(entry.engine))
                throw productError("\u6B64\u573A\u666F\u9700\u8981\u66F4\u65B0 App \u540E\u6253\u5F00");
            // Record the intent before network work; a failed download never erases history.
            if (!dispatch({ type: "scene.visit", entry, at: now() }))
                throw productError("\u573A\u666F\u8BB0\u5F55\u65E0\u6CD5\u66F4\u65B0");
            if (entry.manifestUrl)
                lease = await library.open(entry, {
                    signal: controller.signal,
                    onProgress: setProgress,
                });
            let caption: string | undefined;
            if (lease?.manifest.assets.presentation) {
                const value = JSON.parse(new TextDecoder().decode(await lease.read("presentation", controller.signal)));
                if (!value ||
                    typeof value.caption !== "string" ||
                    value.caption.length > 300)
                    throw productError("\u573A\u666F\u6587\u6848\u914D\u7F6E\u65E0\u6548");
                caption = value.caption;
            }
            if (!controller.signal.aborted)
                setLoaded({ lease, caption });
        })().catch((e) => {
            if (!controller.signal.aborted) {
                void lease?.release();
                setError(e instanceof Error && e.message ? e.message : "\u4E0B\u8F7D\u5931\u8D25");
            }
        });
        return () => {
            controller.abort();
            void lease?.release();
        };
    }, [entry, library, ready, attempt]);
    if (!entry)
        return <p role="alert">{tr("\u573A\u666F\u4FE1\u606F\u7F3A\u5931\uFF0C\u8BF7\u8FD4\u56DE\u76EE\u5F55\u91CD\u8BD5\u3002")}</p>;
    return (<section className="scene-experience" aria-label={localizedTitle(entry)}>
      {opening && <OpeningGuide sceneId={entry.id}/>}
      <RitualNarrativeBlurb sceneId={entry.id}/>
      {error ? (<SceneLoadFailure message={error} onRetry={() => setAttempt(n => n + 1)}/>) : loaded ? (<>
          {loaded.caption && <p className="scene-caption" lang="und">{loaded.caption}</p>}
          <LoadedScene key={attempt} entry={entry} lease={loaded.lease} wishId={wishId} daily={daily} vessel={vessel} replay={replay} opening={opening} failed={fail}/>
        </>) : (<div className="scene-download" role="status">
          <p>
            {progress?.phase === "downloading"
                ? tr("\u6B63\u5728\u4E0B\u8F7D\u5E76\u6821\u9A8C\u573A\u666F\u8D44\u6E90\u2026") : tr("\u6B63\u5728\u51C6\u5907\u573A\u666F\u2026")}
          </p>
          {progress && progress.totalBytes > 0 && (<progress value={progress.completedBytes} max={progress.totalBytes}/>)}
          <button className="button secondary" onClick={() => {
                cancel.current?.abort();
                back();
            }}>{tr("\u53D6\u6D88\u5E76\u8FD4\u56DE")}</button>
        </div>)}
    </section>);
}
