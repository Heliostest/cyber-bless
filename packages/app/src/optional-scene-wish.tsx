import { translate as tr, graphemeLength, message } from '@wbr/i18n';
import { useId, useState, useRef } from "react";
import { WISH_TITLE_MAX } from "@wbr/core";
import { WISH_WRITE_COPY } from "@wbr/gestures";
/** Recording a wish is a separate choice after completing the ritual. */
export function OptionalSceneWish({ active, onSubmit, onClose }: {
    active: boolean;
    onSubmit(line: string): void;
    onClose(): void;
}) {
    const [line, setLine] = useState("");
    const inputId = useId();
    const composing = useRef(false);
    const count = graphemeLength(line);
    return <div className="scene-post-wish">
    <form onSubmit={event => {
            event.preventDefault();
            const text = line.trim();
            if (active && !composing.current && text && graphemeLength(text) <= WISH_TITLE_MAX)
                onSubmit(text);
        }}>
      <label htmlFor={inputId}>{tr("\u8BB0\u4E0B\u6B64\u523B\u7684\u5FC3\u613F\uFF08\u53EF\u9009\uFF09")}</label>
      <input id={inputId} value={line} maxLength={8192} onChange={event => setLine(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} aria-invalid={count > WISH_TITLE_MAX} aria-describedby={`${inputId}-count`} disabled={!active} placeholder={tr("\u5199\u4E0B\u60F3\u4E3A\u81EA\u5DF1\u6216\u4ED6\u4EBA\u8BB8\u7684\u5FC3\u613F\u2026")} enterKeyHint="done"/>
      <p id={`${inputId}-count`} className="quiet">{message('app.input.counter', { n: count, max: WISH_TITLE_MAX })}</p>
      <p className="scene-post-wish-note">{tr("\u70B9\u300C\u5199\u597D\u4E86\u300D\u624D\u4F1A\u5B58\u8FDB\u5FC3\u613F\u3002")}</p>
      <div className="scene-post-wish-actions">
        <button type="submit" className="button primary" disabled={!active || !line.trim() || count > WISH_TITLE_MAX}>{tr(WISH_WRITE_COPY.submit)}</button>
        <button type="button" className="text-button scene-wish-cancel" disabled={!active} onClick={onClose}>{tr("\u6682\u4E0D\u8BB0\u5F55")}</button>
      </div>
    </form>
  </div>;
}
