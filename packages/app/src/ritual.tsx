import { useEffect, useRef, useState } from "react";
import { localDay, rituals, type RitualId } from "@wbr/core";
import { Art, Icon } from "./art";
import { now, uid, useApp } from "./context";
import { Empty } from "./pages";
import { ritualTitle } from "./home";
import { Woodfish } from "./woodfish";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { rectOf } from "./reward-flight";
import { PageHead } from "./page-heading";
import { SceneRewardReveal } from "./scene-reward-reveal";

/**
 * The 2D ritual page. Rituals open as their 3D scenes (useOpenRitual), so it
 * is reached only to settle a session begun here (今日's resume banner), or
 * when the catalog has no playable scene for a ritual.
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
  const [pulse, setPulse] = useState(0);
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
      setPulse((n) => n + 1);
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
  return (
    <div className={`ritual-page ritual-${kind}`}>
      {kind === "woodfish" && <RitualNarrativeBlurb sceneId="woodfish" />}
      <div className="ritual-goal">
        {kind === "woodfish" ? "本轮轻敲" : "今日目标"}{" "}
        <strong>
          {kind === 'woodfish' ? `已敲 ${woodfishTotal} 次 · 至少 ${meta.steps} 次` : `${progress} / ${meta.steps}`}
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={kind === "woodfish" ? "轻敲进度" : "仪式进度"}
        aria-valuemin={0}
        aria-valuemax={meta.steps}
        aria-valuenow={progress}
      >
        <span style={{ width: `${(progress / meta.steps) * 100}%` }} />
      </div>
      <div className="ritual-stage">
        <div className="ritual-feedback" key={pulse}>
          <strong>
            {kind === "woodfish"
              ? ending ? "本轮轻敲已结束" : ready ? "可以继续轻敲" : pulse ? "已记下一次轻敲" : "听一声木鱼"
              : ready ? "仪式已完成" : pulse ? "已记下这一步" : "留一点好心情"}
          </strong>
          <span>{kind === "woodfish" ? "听木槌敲击与余音" : "烦恼，轻轻放下"}</span>
        </div>
        {kind === "woodfish" ? (
          <Woodfish
            pulse={pulse}
            active={active && !paused}
            reducedMotion={state.settings.reducedMotion}
            view={view}
            disabled={ending}
            onStrike={step}
            onImpact={feedback}
            onInstruction={setInstruction}
            whenIdleRef={whenIdleRef}
          />
        ) : (
          <button
            className="ritual-object"
            aria-label={ready ? "仪式步骤已完成" : "完成当前步骤"}
            onClick={step}
            disabled={ready || !active || paused}
          >
            <span key={pulse} className={pulse ? "object-bounce" : ""}>
              <Art
                kind={kind}
                variant={kind === "lantern" ? "wish" : "default"}
              />
            </span>
          </button>
        )}
      </div>
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
      <div className="ritual-counter">{String(kind === 'woodfish' ? woodfishTotal : progress).padStart(3, "0")}</div>
      <p
        className="tap-instruction"
        id={kind === "woodfish" ? "woodfish-instruction" : undefined}
        // The beat line speaks the settle moment; while steps remain, the
        // prompts change too often to announce.
        aria-live={ready ? "polite" : "off"}
      >
        {paused
          ? "停一会儿，也很好。"
          : ready
            ? kind === "woodfish" ? ending ? "轻敲已记下，静听余音。" : "可以继续轻敲，想收尾时点「结束仪式」。" : "这一刻，已经很好。"
            : kind === "woodfish"
              ? instruction
              : meta.prompts[Math.min(progress, meta.prompts.length - 1)]}
      </p>
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
      {kind === 'woodfish' && ready && !ending && <button
        type="button" className="button primary scene-woodfish-finish"
        disabled={!active || paused}
        onClick={() => { if (active && !paused) setEnding(true); }}
      >结束仪式</button>}
      {kind === "woodfish" && !ending && (
        <button
          className="woodfish-pause"
          onClick={() => {
            if (paused) prepareFeedback();
            setPaused((p) => !p);
          }}
        >
          {paused ? "继续轻敲" : "暂停片刻"}
        </button>
      )}
      <p className="ritual-footer">
        <span />
        慢慢{kind === "woodfish" ? "敲" : "来"}，也可以。
        <span />
      </p>
    </div>
  );
}
export function Complete({ id, revealReward }: { id: string; revealReward?: boolean }) {
  const { state, go, launchReward } = useApp();
  const [shareText, setShareText] = useState("");
  const [copied, setCopied] = useState(false);
  const sticker = useRef<HTMLDivElement>(null);
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
  // The one confirm: measure the sticker, hand its rect to the flight,
  // then navigate. go() scrolls, so the rect must come first.
  function collect() {
    launchReward({
      kind: r!.ritual,
      from: rectOf(sticker.current),
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
      <PageHead
        title={r.ritual === "woodfish" ? "本轮轻敲结束" : "今日仪式完成"}
        eyebrow={r.ritual === "woodfish" ? "听过一轮敲击与余音。" : "今天的好心情，已到账。"}
      />
      <div className="celebration">
        <Art
          kind={r.ritual}
          variant={
            r.ritual === "woodfish"
              ? "complete"
              : r.ritual === "lantern"
                ? "fulfill"
                : "default"
          }
        />
        {r.ritual !== "woodfish" && (
          <span className="title-badge">
            {r.ritual === "crane" ? "小小心愿收藏家" : "温暖微光守护者"}
          </span>
        )}
      </div>
      {!wish && (
        <div className="reward-slot">
          <div className="reward-sticker" data-reward-sticker ref={sticker}>
            <Art kind={r.ritual} small />
          </div>
          <p className="reward-destination">它会住进你的小天地</p>
          {activeWish && (
            <p className="reward-wish-note">也为「{activeWish.title}」记了一笔</p>
          )}
        </div>
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
