import { localizedTitle, localizedNote, formatTime } from './localization';
import { translate as tr, message } from '@wbr/i18n';
import { useRef, useState, type FormEvent } from "react";
import { graphemeLength, sliceGraphemes } from '@wbr/i18n/text';
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
function ReturnChoices({ value, onChange, expanded = false, }: {
    value: ReturnMethod;
    onChange(value: ReturnMethod): void;
    expanded?: boolean;
}) {
    return (<fieldset className={`return-choices${expanded ? " expanded" : ""}`}>
      <legend className="sr-only">{tr("\u9009\u62E9\u8FD8\u613F\u65B9\u5F0F")}</legend>
      {(["kindness", "ritual"] as const).map((method) => (<label className={`choice-row${value === method ? " chosen" : ""}`} key={method}>
          <Icon name={method === "kindness" ? "heart" : "leaf"}/>
          <span>
            <strong>
              {method === "kindness" ? tr("\u505A\u4E00\u4EF6\u5C0F\u5584\u4E8B") : tr("\u5B8C\u6210\u4E00\u4E2A\u5C0F\u4EEA\u5F0F")}
            </strong>
            {expanded && (<small>
                {method === "kindness"
                    ? tr("\u5E2E\u52A9\u522B\u4EBA\uFF0C\u6216\u8868\u8FBE\u4E00\u6B21\u611F\u8C22") : tr("\u5B8C\u6210\u4E00\u573A\u8BB8\u613F\u5C0F\u4EEA\u5F0F")}
              </small>)}
          </span>
          <input type="radio" name="return-method" value={method} checked={value === method} onChange={() => onChange(method)}/>
        </label>))}
    </fieldset>);
}
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
    const method = wish.returnMethod ?? "kindness";
    const source = wish.sourceSceneId
        ? entries.find(e => e.id === wish.sourceSceneId) ??
            state.sceneRecords.find(e => e.id === wish.sourceSceneId) ??
            builtInScenes.find(e => e.id === wish.sourceSceneId)
        : undefined;
    return (<div className="wish-detail-page">
      <PageHead title={tr("\u6211\u7684\u5FC3\u613F")}/>
      <span className={`status-pill${wish.status === "fulfilled" ? " fulfilled" : ""}`}>
        <Icon name={wish.status === "active" ? "clock" : "check"}/>
        {wish.archived
            ? tr("\u5FC3\u613F\u4F11\u606F\u4E2D") : wish.status === "active"
            ? tr("\u5FC3\u613F\u8FDB\u884C\u4E2D") : wish.status === "realized"
            ? tr("\u5FC3\u613F\u5DF2\u5B9E\u73B0") : tr("\u5FC3\u613F\u5DF2\u5982\u613F")}
      </span>
      <h2 className="wish-title">{wish.title}</h2>
      <p className="wish-meta">
        <Icon name="lock"/>
        {message('app.wish.createdPrivate', { date: formatDate(wish.createdAt) })}</p>
      {source && <p className="wish-source">{message('app.wish.recordedIn', { title: localizedTitle(source) })}</p>}
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
          <h2>{tr("\u6211\u4E5F\u5728\u4E3A\u5B83\u52AA\u529B")}</h2>
          {!wish.archived && (<button className="small-button" onClick={() => go({ page: "note", id })}>
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
            </article>))) : (<p className="quiet empty-note">{tr("\u8FD8\u6CA1\u6709\u8BB0\u5F55\uFF0C\u968F\u65F6\u53EF\u4EE5\u8BB0\u4E0B\u4E00\u5C0F\u6B65\u3002")}</p>)}
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
      {wish.status === "fulfilled" ? (<button className="button primary full" onClick={() => go({ page: "collection", id: `wish:${id}` })}>{tr("\u770B\u770B\u6211\u7684\u300C\u5982\u613F\u300D\u7EAA\u5FF5\u7AE0")}</button>) : (<button className="text-button archive-button" onClick={() => dispatch({ type: "wish.archive", id, archived: !wish.archived })}>
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
    const { state, go, dispatch, fulfillmentDrafts, setFulfillmentDraft, arrival, } = useApp();
    const openScene = useOpenScene();
    const { entries } = useSceneLibrary();
    const vessels = usableVessels(state, entries);
    const wish = state.wishes.find((w) => w.id === id);
    const draft = fulfillmentDrafts[id] ?? {
        method: wish?.returnMethod ?? "kindness",
        text: "",
    };
    const { method, text } = draft;
    const composing = useRef(false);
    const setMethod = (method: ReturnMethod) => setFulfillmentDraft(id, { ...draft, method });
    const setText = (text: string) => setFulfillmentDraft(id, { ...draft, text });
    const noteField = useAutoGrow(text);
    if (!wish || wish.archived || wish.status !== "realized")
        return (<Empty title={wish?.status === "fulfilled"
                ? tr("\u8FD9\u4EFD\u7F8E\u597D\uFF0C\u5DF2\u7ECF\u8BB0\u4F4F\u4E86\u3002") : tr("\u5148\u786E\u8BA4\u5FC3\u613F\u5B9E\u73B0\uFF0C\u518D\u6765\u8FD8\u613F\u3002")} body={tr("\u613F\u6BCF\u4E00\u4EFD\u8BA4\u771F\uFF0C\u90FD\u6709\u56DE\u5E94\u3002")} action={tr("\u56DE\u5230\u5FC3\u613F")} onClick={() => go({ page: "wish", id })}/>);
    const completed = hasReturnRitual(state, wish);
    function submit(e: FormEvent) {
        e.preventDefault();
        if (composing.current || !text.trim() || graphemeLength(text) > 60)
            return;
        if (dispatch({
            type: "wish.fulfill",
            id,
            noteId: uid(),
            text,
            method,
            at: now(),
        })) {
            setFulfillmentDraft(id);
            go({ page: "collection", id: `wish:${id}` });
        }
    }
    return (<div className="fulfill-page">
      <PageHead title={tr("\u6765\u8FD8\u4E2A\u613F")} eyebrow={tr("\u8C22\u8C22\u81EA\u5DF1\u7684\u52AA\u529B\uFF0C\u4E5F\u8C22\u8C22\u9047\u5230\u7684\u5584\u610F\u3002")}/>
      <form onSubmit={submit}>
        <section className="form-card fulfillment-card">
          <h2>{tr("\u8FD9\u6B21\uFF0C\u6211\u60F3\u8FD9\u6837\u8FD8\u613F")}</h2>
          <ReturnChoices value={method} onChange={setMethod} expanded/>
          {method === "ritual" && (<div className="linked-ritual">
              {completed ? (
            /* A return-ritual's sticker can land on this row. */
            <p data-wish-id={id} data-arriving={arrival?.wishId === id && arrival.phase === "flying"
                    ? ""
                    : undefined} className={arrival?.wishId === id && arrival.phase === "landed"
                    ? "reward-landed"
                    : undefined}>
                  <Icon name="check"/>{tr("\u5DF2\u4E3A\u8FD9\u4E2A\u5FC3\u613F\u5B8C\u6210\u5C0F\u4EEA\u5F0F")}</p>) : vessels.length ? (<>
                  <p>{tr(FULFILL_VESSEL_COPY.pick)}</p>
                  {vessels.map((c) => {
                    const entry = entries.find((e) => e.id === c.sceneId);
                    if (!entry)
                        return null;
                    return (<button key={c.id} type="button" className="wish-practice-card vessel-card" data-scene={entry.id} onClick={() => openScene(entry, { vessel: c.id, wishId: id })}>
                        <SceneBadge id={entry.id}/>
                        <strong>{localizedTitle(entry)}</strong>
                        <small>{tr(FULFILL_VESSEL_COPY.use)}</small>
                        <Icon name="arrow"/>
                      </button>);
                })}
                </>) : (<>
                  <p>{tr(FULFILL_VESSEL_COPY.none)}</p>
                  <button type="button" className="button secondary full" onClick={() => go({ page: "today" })}>
                    {tr(FULFILL_VESSEL_COPY.noneAction)}
                  </button>
                </>)}
            </div>)}
          <div className="return-note">
            <div className="field-heading">
              <label htmlFor="return-note">
                {method === "kindness" ? tr("\u6211\u505A\u4E86\u4EC0\u4E48\u2026") : tr("\u6B64\u523B\uFF0C\u6211\u60F3\u8BF4\u2026")}
              </label>
              <span>{message('app.input.counter', { n: graphemeLength(text), max: 60 })}</span>
            </div>
            <textarea ref={noteField} id="return-note" rows={2} maxLength={8192} required value={text} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={e => { composing.current = false; setText(sliceGraphemes(e.currentTarget.value, 0, 60)); }} onChange={(e) => setText(composing.current ? e.target.value : sliceGraphemes(e.target.value, 0, 60))} onKeyDown={e => { if (composing.current || e.nativeEvent.isComposing) e.stopPropagation(); }} placeholder={method === "kindness"
            ? tr("\u8BF7\u5E2E\u52A9\u8FC7\u6211\u7684\u670B\u53CB\u559D\u4E86\u4E00\u676F\u5496\u5561\u3002") : tr("\u8C22\u8C22\u4E00\u76F4\u8BA4\u771F\u52AA\u529B\u7684\u81EA\u5DF1\u3002")}/>
          </div>
          <div className="badge-preview">
            <Art kind="badge" small/>
            <div>
              <strong>{tr("\u83B7\u5F97\u4E00\u679A\u300C\u5982\u613F\u300D\u7EAA\u5FF5\u7AE0")}</strong>
              <p>{tr("\u613F\u8FD9\u4EFD\u7F8E\u597D\uFF0C\u7EE7\u7EED\u4F20\u9012\u4E0B\u53BB\u3002")}</p>
            </div>
          </div>
        </section>
        <button className="button primary full" type="submit" disabled={!text.trim() || graphemeLength(text) > 60 || (method === "ritual" && !completed)}>{tr("\u5B8C\u6210\u8FD8\u613F")}</button>
      </form>
      <p className="leaf-footer">
        <Icon name="leaf"/>{tr("\u628A\u597D\u4E8B\u8BB0\u4E0B\u6765\u3002")}<Icon name="leaf"/>
      </p>
    </div>);
}
