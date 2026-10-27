import { translate as tr } from '@wbr/i18n';
import { describeSceneLoadError } from "./scene-load-error";
/** Failed graphics never become an interactive illustration. */
export function SceneLoadFailure({ message, onRetry }: {
    message: string;
    onRetry(): void;
}) {
    const failure = describeSceneLoadError(message);
    return <div className="scene-load-error" role="alert">
    <p>{tr("\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\u3002\u8BB0\u5F55\u548C\u8FDB\u5EA6\u5DF2\u4FDD\u7559\u3002")}</p>
    <p>{failure.reason}</p>
    {failure.detail && <details><summary>{tr("\u67E5\u770B\u6280\u672F\u7EC6\u8282")}</summary><code>{failure.detail}</code></details>}
    <button type="button" className="button primary" onClick={onRetry}>{tr("\u91CD\u8BD5\u6253\u5F00")}</button>
  </div>;
}
