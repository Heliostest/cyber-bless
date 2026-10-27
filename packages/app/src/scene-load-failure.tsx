import { describeSceneLoadError } from "./scene-load-error";

/** Failed graphics never become an interactive illustration. */
export function SceneLoadFailure({ message, onRetry }: { message: string; onRetry(): void }) {
  const failure = describeSceneLoadError(message);
  return <div className="scene-load-error" role="alert">
    <p>暂时无法打开。记录和进度已保留。</p>
    <p>{failure.reason}</p>
    {failure.detail && <details><summary>查看技术细节</summary><code>{failure.detail}</code></details>}
    <button type="button" className="button primary" onClick={onRetry}>重试打开</button>
  </div>;
}
