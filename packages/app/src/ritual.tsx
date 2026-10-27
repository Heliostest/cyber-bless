import { useEffect, useRef, useState } from "react";
import { localDay, rituals, sceneIntention, type RitualId } from "@wbr/core";
import { Icon } from "./art";
import { now, uid, useApp } from "./context";
import { Empty } from "./pages";
import { ritualTitle } from "./home";
import { Woodfish } from "./woodfish";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { rewardOriginOf } from "./reward-flight";
import { SceneRewardReveal } from "./scene-reward-reveal";
import { LegacySceneRitual } from "./legacy-scene-ritual";
import { sceneSteps } from "./scene-placement";
import { builtInScenes } from "./scene-library";

/**
 * Compatibility host for sessions begun before scene-based rituals.
 * Their saved counters and rewards are preserved; every interaction is 3D.
 */
export function Ritual({
  id,
  wishId: linkedWishId,
  whenIdleRef,
}: {
  id?: string;
  wishId?: string;
  /** The woodfish scene's idle signal, so the beat can wait out the mallet. */
  whenIdleRef?: { current: (() => Promise<void>) | null };
}) {
  const { state, dispatch, go, feedback, prepareFeedback, active } = useApp();
  const [wishId, setWishId] = useState(linkedWishId ?? "");
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);
  const [view, setView] = useState("front");
  const [instruction, setInstruction] =
    useState("轻点木鱼敲一下；按住拖动，木槌会跟着移动。");
  const r = state.activeSession;
  const kind: RitualId =
    r?.ritual ?? (id === "crane" || id === "lantern" ? id : "woodfish");
  const meta = rituals[kind];
  const progress = r?.progress ?? 0;
  const woodfishTotal = r?.strikes ?? progress;
  const ready = progress >= meta.steps;
  const legacyProgress = useRef(progress);
  legacyProgress.current = progress;
  function step() {
    if (!active || paused || document.hidden || ending || (ready && kind !== 'woodfish')) return false;
    if (
      dispatch({
        type: "ritual.strike",
        id: uid(),
        ritual: kind,
        wishId: wishId || undefined,
        at: now(),
      })
    ) {
      if (kind === "woodfish") prepareFeedback();
      else feedback();
      return true;
    }
    return false;
  }
  function finish() {
    if (r && dispatch({ type: "ritual.finish", id: r.id, at: now() })) {
      feedback();
      go({ page: "complete", id: r.id, revealReward: true });
    }
  }
  // Finite rituals settle at their last step. The woodfish keeps sounding
  // until the user chooses to finish, then waits for the mallet to rest.
  useEffect(() => {
    if (!ready || !r || (kind === 'woodfish' && !ending)) return;
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
    } else {
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
    return <LegacySceneRitual kind={kind}
      progress={Math.floor(progress * steps / meta.steps)}
      returning={!!r?.wishId && state.wishes.some(w => w.id === r.wishId && w.status === "realized")}
      checkpoint={next => {
        if (!active || document.hidden || !Number.isInteger(next) || next < 0 || next > steps) return;
        const target = Math.ceil(next * meta.steps / steps);
        // Monotonic adapter: duplicate callbacks cannot create extra old steps.
        while (legacyProgress.current < target) {
          if (!dispatch({ type: "ritual.strike", id: uid(), ritual: kind,
            wishId: wishId || undefined, at: now() })) break;
          legacyProgress.current++;
        }
      }} />;
  }
  const intention = sceneIntention("woodfish");
  return (
    <section className="scene-experience ritual-page ritual-woodfish" aria-label={meta.name}>
      <RitualNarrativeBlurb sceneId="woodfish" />
      {intention && <aside className="scene-intention" data-kind={intention.kind} aria-label="这一场的心意">
        <strong>{intention.label}</strong><p>{intention.action}</p>
      </aside>}
      <p className="scene-progress sr-only" role="status">已轻敲 {woodfishTotal} 次 · 至少 {meta.steps} 次后可结束</p>
      <div
        className="sr-only"
        role="progressbar"
        aria-label={kind === "woodfish" ? "轻敲进度" : "仪式进度"}
        aria-valuemin={0}
        aria-valuemax={meta.steps}
        aria-valuenow={progress}
      />
          <Woodfish
            active={active && !paused}
            reducedMotion={state.settings.reducedMotion}
            view={view}
            disabled={ending}
            strikes={woodfishTotal}
            minimumStrikes={meta.steps}
            instruction={instruction}
            onFinish={ready ? () => { if (active && !paused) setEnding(true); } : undefined}
            onStrike={step}
            onImpact={feedback}
            onInstruction={setInstruction}
            whenIdleRef={whenIdleRef}
          />
      {kind === "woodfish" &&
        new URLSearchParams(window.location.search).has("inspectWoodfish") && (
          <label className="woodfish-inspection">
            模型视角
            <select
              aria-label="模型视角"
              value={view}
              onChange={(e) => setView(e.target.value)}
            >
              {["front", "left", "right", "back", "top", "bottom"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        )}
      {!r && (
        <div className="ritual-link">
          <label htmlFor="ritual-wish">
            为一个心愿留一分钟 <small>选填</small>
          </label>
          <select
            id="ritual-wish"
            value={wishId}
            onChange={(e) => setWishId(e.target.value)}
          >
            <option value="">此刻的自己</option>
            {state.wishes
              .filter((w) => !w.archived && w.status !== "fulfilled")
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
          </select>
        </div>
      )}
      {kind === "woodfish" && !ending && (
        <div className="scene-actions">
        <button
          className="woodfish-pause"
          onClick={() => {
            if (paused) prepareFeedback();
            setPaused((p) => !p);
          }}
        >
          {paused ? "继续轻敲" : "暂停片刻"}
        </button>
        </div>
      )}
    </section>
  );
}
export function Complete({ id, revealReward }: { id: string; revealReward?: boolean }) {
  const { state, go, launchReward } = useApp();
  const [shareText, setShareText] = useState("");
  const [copied, setCopied] = useState(false);
  const collectCta = useRef<HTMLButtonElement>(null);
  const r = state.sessions.find((s) => s.id === id);
  if (!r)
    return (
      <Empty
        title="回到今天，继续收集美好"
        body="已完成的仪式都在「我的」里。"
        action="回到今日"
        onClick={() => go({ page: "today" })}
      />
    );
  const day = localDay(new Date(r.completedAt!));
  const today = state.sessions
    .filter((s) => localDay(new Date(s.completedAt!)) === day)
    .reduce((n, s) => n + s.progress, 0);
  const days = new Set(
    state.sessions.map((s) => localDay(new Date(s.completedAt!))),
  );
  let streak = 0;
  const cursor = new Date(day + "T12:00:00");
  while (days.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const wish = state.wishes.find(
    (w) => w.id === r.wishId && w.status === "realized" && !w.archived,
  );
  // A linked wish still in progress gets a note; the card says so.
  const activeWish = state.wishes.find(
    (w) => w.id === r.wishId && w.status === "active" && !w.archived,
  );
  // The one confirm: measure the button, hand its rect to the flight,
  // then navigate. go() scrolls, so the rect must come first.
  function collect() {
    launchReward({
      kind: r!.ritual,
      from: rewardOriginOf(collectCta.current),
      collectibleId: `ritual:${r!.id}`,
      wishId: activeWish?.id,
      tab: "world",
      announce: `${rituals[r!.ritual].object}已放进小天地`,
    });
    go({ page: "world" });
  }
  async function share() {
    const text = r!.ritual === "woodfish"
      ? "今天轻敲木鱼，听一轮敲击与余音。"
      : `今天${ritualTitle[r!.ritual]}。把小仪式过成好心情。`;
    if (navigator.share) {
      try {
        await navigator.share({ title: r!.ritual === "woodfish" ? "木鱼静听" : "今日仪式", text });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    setShareText(text);
    setCopied(false);
  }
  return (
    <div className="completion">
      {revealReward && <SceneRewardReveal sceneId={r.ritual} reducedMotion={state.settings.reducedMotion} />}
      {!wish && activeWish && (
        <p className="reward-wish-note">也为「{activeWish.title}」记了一笔</p>
      )}
      <div className="completion-stats">
        <div>
          <span>今日互动</span>
          <strong>
            {today}
            <small> 次</small>
          </strong>
        </div>
        <div>
          <span>已连续</span>
          <strong>
            {streak}
            <small> 天</small>
          </strong>
        </div>
      </div>
      <button
        className="button primary full"
        data-reward-origin={!wish || undefined}
        ref={collectCta}
        onClick={wish ? () => go({ page: "fulfill", id: wish.id }) : collect}
      >
        {wish ? "继续还愿 · 留下这份心情" : `收下${rituals[r.ritual].object}`}
      </button>
      <button className="button outline full" onClick={() => void share()}>
        <Icon name="share" />
        {r.ritual === "woodfish" ? "分享这次静听" : "分享今日仪式"}
      </button>
      {shareText && (
        <div className="share-panel">
          <label htmlFor="share-copy">分享这份好心情</label>
          <textarea id="share-copy" value={shareText} readOnly rows={3} />
          <button
            className="small-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setCopied(true);
              } catch {
                document
                  .querySelector<HTMLTextAreaElement>("#share-copy")
                  ?.select();
              }
            }}
          >
            {copied ? "已复制" : "复制文案"}
          </button>
        </div>
      )}
      <p className="leaf-footer">
        <Icon name="leaf" />
        明天还有一个小惊喜。
        <Icon name="leaf" />
      </p>
    </div>
  );
}
