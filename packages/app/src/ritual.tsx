import { translate as tr, message, translateScene, formatNumber } from '@wbr/i18n';
import { useEffect, useRef, useState } from "react";
import { localDay, rituals, sceneIntention, type RitualId } from "@wbr/core";
import { Icon } from "./art";
import { now, uid, useApp } from "./context";
import { Empty } from "./pages";
import { Woodfish } from "./woodfish";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { rewardOriginOf } from "./reward-flight";
import { SceneRewardReveal } from "./scene-reward-reveal";
import { LegacySceneRitual } from "./legacy-scene-ritual";
import { sceneSteps } from "./scene-placement";
import { builtInScenes } from "./scene-library";
import { captureSceneImage } from '@wbr/scene-runtime';
import { SceneShareButton } from './ritual-share';
/**
 * Compatibility host for sessions begun before scene-based rituals.
 * Their saved counters and rewards are preserved; every interaction is 3D.
 */
export function Ritual({ id, wishId: linkedWishId, whenIdleRef, }: {
    id?: string;
    wishId?: string;
    /** The woodfish scene's idle signal, so the beat can wait out the mallet. */
    whenIdleRef?: {
        current: (() => Promise<void>) | null;
    };
}) {
    const { state, dispatch, go, feedback, prepareFeedback, active } = useApp();
    const [wishId, setWishId] = useState(linkedWishId ?? "");
    const [paused, setPaused] = useState(false);
    const [ending, setEnding] = useState(false);
    const [view, setView] = useState("front");
    const [instruction, setInstruction] = useState("\u8F7B\u70B9\u6728\u9C7C\u6572\u4E00\u4E0B\uFF1B\u6309\u4F4F\u62D6\u52A8\uFF0C\u6728\u69CC\u4F1A\u8DDF\u7740\u79FB\u52A8\u3002");
    const r = state.activeSession;
    const kind: RitualId = r?.ritual ?? (id === "crane" || id === "lantern" ? id : "woodfish");
    const meta = rituals[kind];
    const progress = r?.progress ?? 0;
    const woodfishTotal = r?.strikes ?? progress;
    const ready = progress >= meta.steps;
    const legacyProgress = useRef(progress);
    legacyProgress.current = progress;
    function step() {
        if (!active || paused || document.hidden || ending || (ready && kind !== 'woodfish'))
            return false;
        if (dispatch({
            type: "ritual.strike",
            id: uid(),
            ritual: kind,
            wishId: wishId || undefined,
            at: now(),
        })) {
            if (kind === "woodfish")
                prepareFeedback();
            else
                feedback();
            return true;
        }
        return false;
    }
    function finish() {
        if (r && dispatch({ type: "ritual.finish", id: r.id, at: now() })) {
            const root = document.querySelector('.app-content');
            const shareSnapshot = root ? captureSceneImage(root) : undefined;
            go({ page: "complete", id: r.id, revealReward: true, shareSnapshot });
        }
    }
    // Finite rituals settle at their last step. The woodfish keeps sounding
    // until the user chooses to finish, then waits for the mallet to rest.
    useEffect(() => {
        if (!ready || !r || (kind === 'woodfish' && !ending))
            return;
        let settled = false;
        let timer = 0;
        const settle = () => {
            if (!settled) {
                settled = true;
                finish();
            }
        };
        if (kind === "woodfish" && whenIdleRef) {
            // The queue can never stall the beat for longer than the cap.
            timer = window.setTimeout(settle, 3000);
            void whenIdleRef.current?.().then(() => {
                window.clearTimeout(timer);
                timer = window.setTimeout(settle, 400);
            });
        }
        else {
            timer = window.setTimeout(settle, 600);
        }
        return () => {
            // Leaving during the beat cancels it; the session settles on return.
            settled = true;
            window.clearTimeout(timer);
        };
        // r?.id, not r: each strike replaces the session object.
    }, [ready, r?.id, kind, whenIdleRef, ending]);
    if (kind !== "woodfish") {
        const entry = builtInScenes.find(entry => entry.id === kind)!;
        const steps = sceneSteps(entry);
        return <LegacySceneRitual kind={kind} progress={Math.floor(progress * steps / meta.steps)} returning={!!r?.wishId && state.wishes.some(w => w.id === r.wishId && w.status === "realized")} checkpoint={next => {
                if (!active || document.hidden || !Number.isInteger(next) || next < 0 || next > steps)
                    return;
                const target = Math.ceil(next * meta.steps / steps);
                // Monotonic adapter: duplicate callbacks cannot create extra old steps.
                while (legacyProgress.current < target) {
                    if (!dispatch({ type: "ritual.strike", id: uid(), ritual: kind,
                        wishId: wishId || undefined, at: now() }))
                        break;
                    legacyProgress.current++;
                }
            }}/>;
    }
    const intention = sceneIntention("woodfish");
    return (<section className="scene-experience ritual-page ritual-woodfish" aria-label={translateScene(meta.name)}>
      <RitualNarrativeBlurb sceneId="woodfish"/>
      {intention && <aside className="scene-intention" data-kind={intention.kind} aria-label={tr("\u8FD9\u4E00\u573A\u7684\u5FC3\u610F")}>
        <strong>{translateScene(intention.label)}</strong><p>{translateScene(intention.action)}</p>
      </aside>}
      <p className="scene-progress sr-only" role="status">{message('app.woodfish.progress', { n: woodfishTotal, min: meta.steps })}</p>
      <div className="sr-only" role="progressbar" aria-label={kind === "woodfish" ? tr("\u8F7B\u6572\u8FDB\u5EA6") : tr("\u4EEA\u5F0F\u8FDB\u5EA6")} aria-valuemin={0} aria-valuemax={meta.steps} aria-valuenow={progress}/>
          <Woodfish active={active && !paused} reducedMotion={state.settings.reducedMotion} view={view} disabled={ending} strikes={woodfishTotal} minimumStrikes={meta.steps} instruction={instruction} onFinish={ready ? () => {
            if (active && !paused)
                setEnding(true);
        } : undefined} onStrike={step} onImpact={feedback} onInstruction={setInstruction} whenIdleRef={whenIdleRef}/>
      {kind === "woodfish" &&
            new URLSearchParams(window.location.search).has("inspectWoodfish") && (<label className="woodfish-inspection">{tr("\u6A21\u578B\u89C6\u89D2")}<select aria-label={tr("\u6A21\u578B\u89C6\u89D2")} value={view} onChange={(e) => setView(e.target.value)}>
              {["front", "left", "right", "back", "top", "bottom"].map((v) => (<option key={v}>{v}</option>))}
            </select>
          </label>)}
      {!r && (<div className="ritual-link">
          <label htmlFor="ritual-wish">{tr("\u4E3A\u4E00\u4E2A\u5FC3\u613F\u7559\u4E00\u5206\u949F")}<small>{tr("\u9009\u586B")}</small>
          </label>
          <select id="ritual-wish" value={wishId} onChange={(e) => setWishId(e.target.value)}>
            <option value="">{tr("\u6B64\u523B\u7684\u81EA\u5DF1")}</option>
            {state.wishes
                .filter((w) => !w.archived && w.status !== "fulfilled")
                .map((w) => (<option key={w.id} value={w.id}>
                  {w.title}
                </option>))}
          </select>
        </div>)}
      {kind === "woodfish" && !ending && (<div className="scene-actions">
        <button className="woodfish-pause" onClick={() => {
                if (paused)
                    prepareFeedback();
                setPaused((p) => !p);
            }}>
          {paused ? tr("\u7EE7\u7EED\u8F7B\u6572") : tr("\u6682\u505C\u7247\u523B")}
        </button>
        </div>)}
    </section>);
}
export function Complete({ id, revealReward, shareSnapshot }: {
    id: string;
    revealReward?: boolean;
    shareSnapshot?: string;
}) {
    const { state, go, launchReward } = useApp();
    const collectCta = useRef<HTMLButtonElement>(null);
    const r = state.sessions.find((s) => s.id === id);
    if (!r)
        return (<Empty title={tr("\u56DE\u5230\u4ECA\u5929\uFF0C\u7EE7\u7EED\u6536\u96C6\u7F8E\u597D")} body={tr("\u5DF2\u5B8C\u6210\u7684\u4EEA\u5F0F\u90FD\u5728\u300C\u6211\u7684\u300D\u91CC\u3002")} action={tr("\u56DE\u5230\u4ECA\u65E5")} onClick={() => go({ page: "today" })}/>);
    const day = localDay(new Date(r.completedAt!));
    const today = state.sessions
        .filter((s) => localDay(new Date(s.completedAt!)) === day)
        .reduce((n, s) => n + s.progress, 0);
    const days = new Set(state.sessions.map((s) => localDay(new Date(s.completedAt!))));
    let streak = 0;
    const cursor = new Date(day + "T12:00:00");
    while (days.has(localDay(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    const wish = state.wishes.find((w) => w.id === r.wishId && w.status === "realized" && !w.archived);
    // A linked wish still in progress gets a note; the card says so.
    const activeWish = state.wishes.find((w) => w.id === r.wishId && w.status === "active" && !w.archived);
    // The one confirm: measure the button, hand its rect to the flight,
    // then navigate. go() scrolls, so the rect must come first.
    function collect() {
        launchReward({
            kind: r!.ritual,
            from: rewardOriginOf(collectCta.current),
            collectibleId: `ritual:${r!.id}`,
            wishId: activeWish?.id,
            tab: "world",
            announce: tr("{p0}\u5DF2\u653E\u8FDB\u5C0F\u5929\u5730", { p0: tr(rituals[r!.ritual].object) }),
        });
        go({ page: "world" });
    }
    return (<div className="completion">
      {revealReward && <SceneRewardReveal sceneId={r.ritual} reducedMotion={state.settings.reducedMotion}/>}
      {!wish && activeWish && (<p className="reward-wish-note">{message('app.wish.linkedNote', { title: activeWish.title })}</p>)}
      <div className="completion-stats">
        <div>
          <span>{tr("\u4ECA\u65E5\u4E92\u52A8")}</span>
          <strong>
            {formatNumber(today)}
            <small>{tr("\u6B21")}</small>
          </strong>
        </div>
        <div>
          <span>{tr("\u5DF2\u8FDE\u7EED")}</span>
          <strong>
            {formatNumber(streak)}
            <small>{tr("\u5929")}</small>
          </strong>
        </div>
      </div>
      <button className="button primary full" data-reward-origin={!wish || undefined} ref={collectCta} onClick={wish ? () => go({ page: "fulfill", id: wish.id }) : collect}>
        {wish ? tr("\u7EE7\u7EED\u8FD8\u613F \u00B7 \u7559\u4E0B\u8FD9\u4EFD\u5FC3\u60C5") : tr("\u6536\u4E0B{p0}", { p0: tr(rituals[r.ritual].object) })}
      </button>
      <SceneShareButton sceneId={r.ritual} title={translateScene(rituals[r.ritual].name)} snapshot={shareSnapshot} className="full"/>
      <p className="leaf-footer">
        <Icon name="leaf"/>{tr("\u660E\u5929\u8FD8\u6709\u4E00\u4E2A\u5C0F\u60CA\u559C\u3002")}<Icon name="leaf"/>
      </p>
    </div>);
}
