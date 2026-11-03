import { translate as tr } from '@wbr/i18n';
import { useRef, useState } from 'react';
import { useApp } from './context';
import { describeSceneLoadError } from "./scene-load-error";
/** Failed graphics never become an interactive illustration. */
export function SceneLoadFailure({ message, onRetry }: {
    message: string;
    onRetry(): void;
}) {
    const app = useApp();
    const detailsOpen = useRef(false);
    const [expanded, setExpanded] = useState(false);
    const failure = describeSceneLoadError(message);
    return <div className="scene-load-error" role="alert">
    <p>{tr("\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\u3002\u8BB0\u5F55\u548C\u8FDB\u5EA6\u5DF2\u4FDD\u7559\u3002")}</p>
    <p>{failure.reason}</p>
    {failure.detail && <details onToggle={event => {
        const open = event.currentTarget.open;
        if (detailsOpen.current === open) return;
        detailsOpen.current = open;
        setExpanded(open);
        app?.uiSound?.(open ? 'open' : 'close');
    }}><summary data-audio-cue={app?.uiSound ? expanded ? 'close' : 'open' : undefined}>{tr("\u67E5\u770B\u6280\u672F\u7EC6\u8282")}</summary><code>{failure.detail}</code></details>}
    <button data-audio-cue="select" type="button" className="button primary" onClick={() => { app?.uiSound?.('select'); onRetry(); }}>{tr("\u91CD\u8BD5\u6253\u5F00")}</button>
  </div>;
}
