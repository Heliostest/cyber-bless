import { localizedTitle, localizedNote, formatTime } from './localization';
import { translate as tr, message } from '@wbr/i18n';
import { useRef, useState, type FormEvent } from "react";
import { graphemeLength, sliceGraphemes } from '@wbr/i18n/text';
import { Art, Icon } from "./art";
import { useAutoGrow } from "./auto-grow";
import { formatDate, now, uid, useApp } from "./context";
import { Empty } from "./pages";
import { builtInScenes, useSceneLibrary } from "./scene-library";
import { PageHead } from "./page-heading";
import { WishRitualPicker } from "./wish-ritual-picker";
import { hasSceneIcon, SceneIcon } from "./scene-icons";
export function NewWish() {
    return (<div className="new-wish-page">
      <PageHead title={tr("\u9009\u4E00\u4E2A\u5C0F\u4EEA\u5F0F")} eyebrow={tr("\u4EB2\u624B\u505A\u5B8C\uFF0C\u518D\u8BB0\u4E0B\u6B64\u523B\u7684\u5FC3\u613F\u3002")}/>
      <WishRitualPicker />
      <p className="privacy-note">{tr("\u5FC3\u613F\u4EC5\u4FDD\u5B58\u5728\u8FD9\u53F0\u8BBE\u5907\u4E0A\u3002")}</p>
    </div>);
}
export function WishDetail({ id }: {
    id: string;
}) {
    const { state, go, dispatch } = useApp();
    const { entries } = useSceneLibrary();
    const wish = state.wishes.find((w) => w.id === id);
    const [showAll, setShowAll] = useState(false);
    if (!wish)
        return (<Empty title={tr("\u6682\u65F6\u6CA1\u627E\u5230\u8FD9\u4E2A\u5FC3\u613F")} body={tr("\u56DE\u5230\u5FC3\u613F\u9875\u770B\u770B\u5427\u3002")} action={tr("\u6211\u7684\u5FC3\u613F")} onClick={() => go({ page: "wishes" })}/>);
    const latest = [...wish.notes].reverse();
    const method = wish.status === "fulfilled" ? wish.returnMethod ?? "kindness" : "kindness";
    const source = wish.sourceSceneId
        ? entries.find(e => e.id === wish.sourceSceneId) ??
            state.sceneRecords.find(e => e.id === wish.sourceSceneId) ??
            builtInScenes.find(e => e.id === wish.sourceSceneId)
        : undefined;
    const statusTitle = wish.archived
            ? tr("\u5FC3\u613F\u4F11\u606F\u4E2D") : wish.status === "active"
            ? tr("\u5FC3\u613F\u8FDB\u884C\u4E2D") : wish.status === "realized"
            ? tr("\u5FC3\u613F\u5DF2\u5B9E\u73B0") : tr("\u5FC3\u613F\u5DF2\u5982\u613F");
    return (<div className="wish-detail-page">
      <PageHead title={statusTitle}/>
      <section className="wish-record" aria-labelledby="wish-record-title">
        {source && <div className="wish-record-origin">
          <span className="wish-record-icon" aria-hidden="true">
            {hasSceneIcon(source.id) ? <SceneIcon id={source.id}/> : <Icon name="leaf"/>}
          </span>
          <span className="wish-source">{localizedTitle(source)}</span>
        </div>}
        <h2 id="wish-record-title" className="wish-title">{wish.title}</h2>
        <p className="wish-meta">
          <Icon name="lock"/>
          <span>{message('app.wish.createdPrivate', { date: formatDate(wish.createdAt) })}</span>
        </p>
      </section>
      {wish.intention.trim() && (<section className="form-card effort-card">
          <h2>{tr("\u548C\u81EA\u5DF1\u505A\u4E2A\u5C0F\u7EA6\u5B9A")}</h2>
          <div className="note-preview">
            <div>
              <p>{wish.intention}</p>
            </div>
          </div>
        </section>)}
      <section className="form-card effort-card">
        <div className="field-heading">
          <h2>{wish.status === "fulfilled" ? message('app.wish.effortPast') : tr("\u6211\u4E5F\u5728\u4E3A\u5B83\u52AA\u529B")}</h2>
          {!wish.archived && wish.status !== "fulfilled" && (<button className="small-button" onClick={() => go({ page: "note", id })}>
              <Icon name="edit"/>{tr("\u8BB0\u4E00\u7B14")}</button>)}
        </div>
        {latest.length ? ((showAll ? latest : latest.slice(0, 1)).map((n) => (<article className="note-preview" key={n.id}>
              <div>
                <p>{localizedNote(n, state)}</p>
                <time>
                  {formatDate(n.at)}{" "}
                  {formatTime(n.at)}
                </time>
              </div>
            </article>))) : (<p className="quiet empty-note">{wish.status === "fulfilled" ? message('app.wish.noPastNotes') : tr("\u8FD8\u6CA1\u6709\u8BB0\u5F55\uFF0C\u968F\u65F6\u53EF\u4EE5\u8BB0\u4E0B\u4E00\u5C0F\u6B65\u3002")}</p>)}
        {latest.length > 1 && (<button className="text-button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? tr("\u6536\u8D77\u8BB0\u5F55") : tr("\u67E5\u770B\u5168\u90E8 {p0} \u6761\u8BB0\u5F55", { p0: latest.length })}
          </button>)}
      </section>
      <div className={`return-summary method-${method}`}>
        <Icon name={method === "kindness" ? "heart" : "leaf"}/>
        <span>
          {message('app.wish.returnSummary', { status: wish.status, method })}
        </span>
      </div>
      {!wish.archived && wish.status === "active" && (<button className="button primary full" onClick={() => {
                if (dispatch({ type: "wish.realize", id, at: now() }))
                    go({ page: "fulfill", id });
            }}>{tr("\u6211\u7684\u5FC3\u613F\u5B9E\u73B0\u4E86")}</button>)}
      {!wish.archived && wish.status === "realized" && (<button className="button primary full" onClick={() => go({ page: "fulfill", id })}>{tr("\u6765\u8FD8\u4E2A\u613F")}</button>)}
      {wish.status === "fulfilled" ? (<section className="wish-keepsake" aria-labelledby="wish-keepsake-title">
          <Art kind="badge" sceneId={wish.sourceSceneId}/>
          <h2 id="wish-keepsake-title">{tr("\u5982\u613F\u7EAA\u5FF5\u7AE0")}</h2>
          {wish.fulfilledAt && <time dateTime={wish.fulfilledAt}>{formatDate(wish.fulfilledAt)}</time>}
        </section>) : (<button className="text-button archive-button" onClick={() => dispatch({ type: "wish.archive", id, archived: !wish.archived })}>
          {wish.archived ? tr("\u91CD\u65B0\u62FE\u8D77\u8FD9\u4E2A\u5FC3\u613F") : tr("\u8BA9\u8FD9\u4E2A\u5FC3\u613F\u5148\u4F11\u606F\u3002")}
        </button>)}
    </div>);
}
export function WishNote({ id }: {
    id: string;
}) {
    const { dispatch, go, state } = useApp();
    const [text, setText] = useState("");
    const composing = useRef(false);
    const noteField = useAutoGrow(text);
    const wish = state.wishes.find((w) => w.id === id);
    if (!wish)
        return <Empty title={tr("\u6CA1\u627E\u5230\u8FD9\u4E2A\u5FC3\u613F")} body={tr("\u56DE\u5230\u5FC3\u613F\u9875\u770B\u770B\u5427\u3002")}/>;
    if (wish.archived || wish.status === "fulfilled")
        return <WishDetail id={id}/>;
    return (<form onSubmit={(e) => {
            e.preventDefault();
            if (composing.current || !text.trim() || graphemeLength(text) > 500)
                return;
            if (dispatch({ type: "wish.note", id, noteId: uid(), text, at: now() }))
                go({ page: "wish", id });
        }} className="note-page">
      <PageHead title={tr("\u8BB0\u4E00\u7B14")} eyebrow={tr("\u6BCF\u4E00\u6B65\uFF0C\u90FD\u503C\u5F97\u8BB0\u4F4F\u3002")}/>
      <p className="note-context">{message('app.note.about', { title: wish.title })}</p>
      <section className="form-card">
        <div className="field-heading">
          <label htmlFor="wish-note">{tr("\u6211\u4E5F\u5728\u4E3A\u5B83\u52AA\u529B")}</label>
          <span>{message('app.input.counter', { n: graphemeLength(text), max: 500 })}</span>
        </div>
        <textarea ref={noteField} id="wish-note" required maxLength={8192} rows={5} value={text} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={e => { composing.current = false; setText(sliceGraphemes(e.currentTarget.value, 0, 500)); }} onChange={(e) => setText(composing.current ? e.target.value : sliceGraphemes(e.target.value, 0, 500))} onKeyDown={e => { if (composing.current || e.nativeEvent.isComposing) e.stopPropagation(); }} placeholder={tr("\u4ECA\u5929\u8BA4\u771F\u51C6\u5907\u4E86\u81EA\u6211\u4ECB\u7ECD\u2026")}/>
      </section>
      <button type="submit" className="button primary full" disabled={!text.trim() || graphemeLength(text) > 500}>{tr("\u8BB0\u4E0B\u8FD9\u4E00\u5C0F\u6B65")}</button>
    </form>);
}
export function FulfillWish({ id }: {
    id: string;
}) {
    const { state, go, dispatch, fulfillmentDrafts, setFulfillmentDraft, } = useApp();
    const wish = state.wishes.find((w) => w.id === id);
    const text = fulfillmentDrafts[id]?.text ?? "";
    const composing = useRef(false);
    const setText = (text: string) => setFulfillmentDraft(id, { method: "kindness", text });
    const noteField = useAutoGrow(text);
    if (!wish || wish.archived || wish.status !== "realized")
        return (<Empty title={wish?.status === "fulfilled"
                ? tr("\u8FD9\u4EFD\u7F8E\u597D\uFF0C\u5DF2\u7ECF\u8BB0\u4F4F\u4E86\u3002") : tr("\u5148\u786E\u8BA4\u5FC3\u613F\u5B9E\u73B0\uFF0C\u518D\u6765\u8FD8\u613F\u3002")} body={tr("\u613F\u6BCF\u4E00\u4EFD\u8BA4\u771F\uFF0C\u90FD\u6709\u56DE\u5E94\u3002")} action={tr("\u56DE\u5230\u5FC3\u613F")} onClick={() => go({ page: "wish", id })}/>);
    function submit(e: FormEvent) {
        e.preventDefault();
        if (composing.current || !text.trim() || graphemeLength(text) > 60)
            return;
        if (dispatch({
            type: "wish.fulfill",
            id,
            noteId: uid(),
            text,
            method: "kindness",
            at: now(),
        })) {
            setFulfillmentDraft(id);
            go({ page: "wish", id });
        }
    }
    return (<div className="fulfill-page">
      <PageHead title={tr("\u6765\u8FD8\u4E2A\u613F")} eyebrow={tr("\u8C22\u8C22\u81EA\u5DF1\u7684\u52AA\u529B\uFF0C\u4E5F\u8C22\u8C22\u9047\u5230\u7684\u5584\u610F\u3002")}/>
      <form onSubmit={submit}>
        <section className="form-card fulfillment-card">
          <h2>{tr("\u505A\u4E00\u4EF6\u5C0F\u5584\u4E8B")}</h2>
          <p className="quiet">{tr("\u5E2E\u52A9\u522B\u4EBA\uFF0C\u6216\u8868\u8FBE\u4E00\u6B21\u611F\u8C22")}</p>
          <div className="return-note">
            <div className="field-heading">
              <label htmlFor="return-note">
                {tr("\u6211\u505A\u4E86\u4EC0\u4E48\u2026")}
              </label>
              <span>{message('app.input.counter', { n: graphemeLength(text), max: 60 })}</span>
            </div>
            <textarea ref={noteField} id="return-note" rows={2} maxLength={8192} required value={text} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={e => { composing.current = false; setText(sliceGraphemes(e.currentTarget.value, 0, 60)); }} onChange={(e) => setText(composing.current ? e.target.value : sliceGraphemes(e.target.value, 0, 60))} onKeyDown={e => { if (composing.current || e.nativeEvent.isComposing) e.stopPropagation(); }} placeholder={tr("\u8BF7\u5E2E\u52A9\u8FC7\u6211\u7684\u670B\u53CB\u559D\u4E86\u4E00\u676F\u5496\u5561\u3002")}/>
          </div>
          <div className="badge-preview">
            <Art kind="badge" sceneId={wish.sourceSceneId} small/>
            <div>
              <strong>{tr("\u83B7\u5F97\u4E00\u679A\u300C\u5982\u613F\u300D\u7EAA\u5FF5\u7AE0")}</strong>
              <p>{tr("\u613F\u8FD9\u4EFD\u7F8E\u597D\uFF0C\u7EE7\u7EED\u4F20\u9012\u4E0B\u53BB\u3002")}</p>
            </div>
          </div>
        </section>
        <button className="button primary full" type="submit" disabled={!text.trim() || graphemeLength(text) > 60}>{tr("\u5B8C\u6210\u8FD8\u613F")}</button>
      </form>
      <p className="leaf-footer">
        <Icon name="leaf"/>{tr("\u628A\u597D\u4E8B\u8BB0\u4E0B\u6765\u3002")}<Icon name="leaf"/>
      </p>
    </div>);
}
