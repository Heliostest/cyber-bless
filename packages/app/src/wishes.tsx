import { useState, type FormEvent } from "react";
import { hasReturnRitual, type ReturnMethod } from "@wbr/core";
import { Art, Icon } from "./art";
import { useAutoGrow } from "./auto-grow";
import { formatDate, now, uid, useApp } from "./context";
import { Empty } from "./pages";
import { builtInScenes, useOpenScene, useSceneLibrary } from "./scene-library";
import { SceneBadge } from "./scene-icons";
import { FULFILL_VESSEL_COPY, usableVessels } from "./vessels";
import { PageHead } from "./page-heading";
import { WishRitualPicker } from "./wish-ritual-picker";

function ReturnChoices({
  value,
  onChange,
  expanded = false,
}: {
  value: ReturnMethod;
  onChange(value: ReturnMethod): void;
  expanded?: boolean;
}) {
  return (
    <fieldset className={`return-choices${expanded ? " expanded" : ""}`}>
      <legend className="sr-only">选择还愿方式</legend>
      {(["kindness", "ritual"] as const).map((method) => (
        <label
          className={`choice-row${value === method ? " chosen" : ""}`}
          key={method}
        >
          <Icon name={method === "kindness" ? "heart" : "leaf"} />
          <span>
            <strong>
              {method === "kindness" ? "做一件小善事" : "完成一个小仪式"}
            </strong>
            {expanded && (
              <small>
                {method === "kindness"
                  ? "帮助别人，或表达一次感谢"
                  : "完成一场许愿小仪式"}
              </small>
            )}
          </span>
          <input
            type="radio"
            name="return-method"
            value={method}
            checked={value === method}
            onChange={() => onChange(method)}
          />
        </label>
      ))}
    </fieldset>
  );
}
export function NewWish() {
  return (
    <div className="new-wish-page">
      <PageHead title="选一个小仪式" eyebrow="亲手做完，再记下此刻的心愿。" />
      <WishRitualPicker />
      <p className="privacy-note">心愿仅保存在这台设备上。</p>
    </div>
  );
}
export function WishDetail({ id }: { id: string }) {
  const { state, go, dispatch } = useApp();
  const { entries } = useSceneLibrary();
  const wish = state.wishes.find((w) => w.id === id);
  const [showAll, setShowAll] = useState(false);
  if (!wish)
    return (
      <Empty
        title="暂时没找到这个心愿"
        body="回到心愿页看看吧。"
        action="我的心愿"
        onClick={() => go({ page: "wishes" })}
      />
    );
  const latest = [...wish.notes].reverse();
  const method = wish.returnMethod ?? "kindness";
  const source = wish.sourceSceneId
    ? entries.find(e => e.id === wish.sourceSceneId) ??
      state.sceneRecords.find(e => e.id === wish.sourceSceneId) ??
      builtInScenes.find(e => e.id === wish.sourceSceneId)
    : undefined;
  return (
    <div className="wish-detail-page">
      <PageHead title="我的心愿" />
      <span
        className={`status-pill${wish.status === "fulfilled" ? " fulfilled" : ""}`}
      >
        <Icon name={wish.status === "active" ? "clock" : "check"} />
        {wish.archived
          ? "心愿休息中"
          : wish.status === "active"
            ? "心愿进行中"
            : wish.status === "realized"
              ? "心愿已实现"
              : "心愿已如愿"}
      </span>
      <h2 className="wish-title">{wish.title}</h2>
      <p className="wish-meta">
        <Icon name="lock" />
        {formatDate(wish.createdAt)}许下 · 仅自己可见
      </p>
      {source && <p className="wish-source">记于「{source.title}」</p>}
      {wish.intention.trim() && (
        <section className="form-card effort-card">
          <h2>和自己做个小约定</h2>
          <div className="note-preview">
            <div>
              <p>{wish.intention}</p>
            </div>
          </div>
        </section>
      )}
      <section className="form-card effort-card">
        <div className="field-heading">
          <h2>我也在为它努力</h2>
          {!wish.archived && (
            <button
              className="small-button"
              onClick={() => go({ page: "note", id })}
            >
              <Icon name="edit" />
              记一笔
            </button>
          )}
        </div>
        {latest.length ? (
          (showAll ? latest : latest.slice(0, 1)).map((n) => (
            <article className="note-preview" key={n.id}>
              <div>
                <p>{n.text}</p>
                <time>
                  {formatDate(n.at)}{" "}
                  {new Date(n.at).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </article>
          ))
        ) : (
          <p className="quiet empty-note">还没有记录，随时可以记下一小步。</p>
        )}
        {latest.length > 1 && (
          <button className="text-button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "收起记录" : `查看全部 ${latest.length} 条记录`}
          </button>
        )}
      </section>
      <div className={`return-summary method-${method}`}>
        <Icon name={method === "kindness" ? "heart" : "leaf"} />
        <span>
          <strong>
            {wish.status === "fulfilled" ? "已还愿：" : "实现后："}
          </strong>
          {method === "kindness" ? "做一件小善事" : "完成一个小仪式"}
        </span>
      </div>
      {!wish.archived && wish.status === "active" && (
        <button
          className="button primary full"
          onClick={() => {
            if (dispatch({ type: "wish.realize", id, at: now() }))
              go({ page: "fulfill", id });
          }}
        >
          我的心愿实现了
        </button>
      )}
      {!wish.archived && wish.status === "realized" && (
        <button
          className="button primary full"
          onClick={() => go({ page: "fulfill", id })}
        >
          来还个愿
        </button>
      )}
      {wish.status === "fulfilled" ? (
        <button
          className="button primary full"
          onClick={() => go({ page: "collection", id: `wish:${id}` })}
        >
          看看我的「如愿」纪念章
        </button>
      ) : (
        <button
          className="text-button archive-button"
          onClick={() =>
            dispatch({ type: "wish.archive", id, archived: !wish.archived })
          }
        >
          {wish.archived ? "重新拾起这个心愿" : "让这个心愿先休息。"}
        </button>
      )}
    </div>
  );
}
export function WishNote({ id }: { id: string }) {
  const { dispatch, go, state } = useApp();
  const [text, setText] = useState("");
  const noteField = useAutoGrow(text);
  const wish = state.wishes.find((w) => w.id === id);
  if (!wish) return <Empty title="没找到这个心愿" body="回到心愿页看看吧。" />;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dispatch({ type: "wish.note", id, noteId: uid(), text, at: now() }))
          go({ page: "wish", id });
      }}
      className="note-page"
    >
      <PageHead title="记一笔" eyebrow="每一步，都值得记住。" />
      <p className="note-context">关于「{wish.title}」</p>
      <section className="form-card">
        <div className="field-heading">
          <label htmlFor="wish-note">我也在为它努力</label>
          <span>{text.length} / 500</span>
        </div>
        <textarea
          ref={noteField}
          id="wish-note"
          required
          maxLength={500}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="今天认真准备了自我介绍…"
        />
      </section>
      <button
        type="submit"
        className="button primary full"
        disabled={!text.trim()}
      >
        记下这一小步
      </button>
    </form>
  );
}
export function FulfillWish({ id }: { id: string }) {
  const {
    state,
    go,
    dispatch,
    fulfillmentDrafts,
    setFulfillmentDraft,
    arrival,
  } = useApp();
  const openScene = useOpenScene();
  const { entries } = useSceneLibrary();
  const vessels = usableVessels(state, entries);
  const wish = state.wishes.find((w) => w.id === id);
  const draft = fulfillmentDrafts[id] ?? {
    method: wish?.returnMethod ?? "kindness",
    text: "",
  };
  const { method, text } = draft;
  const setMethod = (method: ReturnMethod) =>
    setFulfillmentDraft(id, { ...draft, method });
  const setText = (text: string) => setFulfillmentDraft(id, { ...draft, text });
  const noteField = useAutoGrow(text);
  if (!wish || wish.archived || wish.status !== "realized")
    return (
      <Empty
        title={
          wish?.status === "fulfilled"
            ? "这份美好，已经记住了。"
            : "先确认心愿实现，再来还愿。"
        }
        body="愿每一份认真，都有回应。"
        action="回到心愿"
        onClick={() => go({ page: "wish", id })}
      />
    );
  const completed = hasReturnRitual(state, wish);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      dispatch({
        type: "wish.fulfill",
        id,
        noteId: uid(),
        text,
        method,
        at: now(),
      })
    ) {
      setFulfillmentDraft(id);
      go({ page: "collection", id: `wish:${id}` });
    }
  }
  return (
    <div className="fulfill-page">
      <PageHead title="来还个愿" eyebrow="谢谢自己的努力，也谢谢遇到的善意。" />
      <form onSubmit={submit}>
        <section className="form-card fulfillment-card">
          <h2>这次，我想这样还愿</h2>
          <ReturnChoices value={method} onChange={setMethod} expanded />
          {method === "ritual" && (
            <div className="linked-ritual">
              {completed ? (
                /* A return-ritual's sticker can land on this row. */
                <p
                  data-wish-id={id}
                  data-arriving={
                    arrival?.wishId === id && arrival.phase === "flying"
                      ? ""
                      : undefined
                  }
                  className={
                    arrival?.wishId === id && arrival.phase === "landed"
                      ? "reward-landed"
                      : undefined
                  }
                >
                  <Icon name="check" />
                  已为这个心愿完成小仪式
                </p>
              ) : vessels.length ? (
                <>
                  <p>{FULFILL_VESSEL_COPY.pick}</p>
                  {vessels.map((c) => {
                    const entry = entries.find((e) => e.id === c.sceneId);
                    if (!entry) return null;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="wish-practice-card vessel-card"
                        data-scene={entry.id}
                        onClick={() =>
                          openScene(entry, { vessel: c.id, wishId: id })
                        }
                      >
                        <SceneBadge id={entry.id} />
                        <strong>{entry.title}</strong>
                        <small>{FULFILL_VESSEL_COPY.use}</small>
                        <Icon name="arrow" />
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <p>{FULFILL_VESSEL_COPY.none}</p>
                  <button
                    type="button"
                    className="button secondary full"
                    onClick={() => go({ page: "today" })}
                  >
                    {FULFILL_VESSEL_COPY.noneAction}
                  </button>
                </>
              )}
            </div>
          )}
          <div className="return-note">
            <div className="field-heading">
              <label htmlFor="return-note">
                {method === "kindness" ? "我做了什么…" : "此刻，我想说…"}
              </label>
              <span>{text.length} / 60</span>
            </div>
            <textarea
              ref={noteField}
              id="return-note"
              rows={2}
              maxLength={60}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                method === "kindness"
                  ? "请帮助过我的朋友喝了一杯咖啡。"
                  : "谢谢一直认真努力的自己。"
              }
            />
          </div>
          <div className="badge-preview">
            <Art kind="badge" small />
            <div>
              <strong>获得一枚「如愿」纪念章</strong>
              <p>愿这份美好，继续传递下去。</p>
            </div>
          </div>
        </section>
        <button
          className="button primary full"
          type="submit"
          disabled={!text.trim() || (method === "ritual" && !completed)}
        >
          完成还愿
        </button>
      </form>
      <p className="leaf-footer">
        <Icon name="leaf" />
        把好事记下来。
        <Icon name="leaf" />
      </p>
    </div>
  );
}
