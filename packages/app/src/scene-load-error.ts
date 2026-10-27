import { hasProductCopy, translate } from '@wbr/i18n';

export const SCENE_LOAD_ERROR_COPY = {
  offline: "网络好像断开了。连上网络后点「重试打开」；仍打不开时，刷新页面再试。",
  graphics: "画面暂时没能显示出来。点「重试打开」，或刷新页面再试。",
  upgrade: "此场景需要更新 App 后打开。",
  other:
    "场景资源没能准备好，可能是网络不稳。点「重试打开」；仍打不开时，刷新页面再试。",
} as const;

/**
 * Only registered product messages are display copy. Unknown diagnostics stay in details,
 * regardless of whether they contain Han, Latin or another script.
 */
export function describeSceneLoadError(
  message: string,
  online = typeof navigator === "undefined" || navigator.onLine !== false,
): { reason: string; detail?: string } {
  if (hasProductCopy(message)) return { reason: translate(message) };
  if (message === '此场景需要更新 App 后打开') return { reason: translate(SCENE_LOAD_ERROR_COPY.upgrade) };
  const detail = message.trim() || undefined;
  const reason = !online
    ? SCENE_LOAD_ERROR_COPY.offline
    : /context lost|webgl|graphics|shader/i.test(message)
      ? SCENE_LOAD_ERROR_COPY.graphics
      : /upgrade the app/i.test(message)
        ? SCENE_LOAD_ERROR_COPY.upgrade
        : SCENE_LOAD_ERROR_COPY.other;
  return { reason: translate(reason), detail };
}
