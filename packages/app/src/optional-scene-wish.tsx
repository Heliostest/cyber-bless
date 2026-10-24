import { useId, useState } from "react";
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
  return <div className="scene-post-wish">
    <form onSubmit={event => {
      event.preventDefault();
      const text = line.trim();
      if (active && text && text.length <= WISH_TITLE_MAX) onSubmit(text);
    }}>
      <label htmlFor={inputId}>记下此刻的心愿（可选）</label>
      <input id={inputId} value={line} maxLength={WISH_TITLE_MAX}
        onChange={event => setLine(event.target.value)} disabled={!active}
        placeholder="写下想为自己或他人许的心愿…" enterKeyHint="done" />
      <p className="scene-post-wish-note">点「写好了」才会存进心愿。</p>
      <div className="scene-post-wish-actions">
        <button type="submit" className="button primary" disabled={!active || !line.trim()}>{WISH_WRITE_COPY.submit}</button>
        <button type="button" className="text-button scene-wish-cancel" disabled={!active}
          onClick={onClose}>暂不记录</button>
      </div>
    </form>
  </div>;
}
