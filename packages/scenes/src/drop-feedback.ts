import { bindSceneText, captureSceneText, sceneCopy, sceneTextSource } from './scene-localization'
const READY = '可以松手，轻轻落稳。'

/** Own only the ready hint. A later scene sync must win over stale restoration. */
export function createDropFeedback(hint: HTMLElement, safe: (text: string) => unknown) {
  let ready = false, restore = () => {}, disposed = false
  safe(READY)
  const clear = () => {
    if (ready && sceneTextSource(hint) === READY && hint.textContent === sceneCopy(READY)) restore()
    ready = false; delete hint.dataset.dropReady
  }
  return {
    setReady(next: boolean) {
      if (disposed) return
      if (!next) { clear(); return }
      if (!ready) restore = captureSceneText(hint)
      ready = true; hint.dataset.dropReady = 'true'; bindSceneText(hint, READY)
    },
    clear,
    dispose() { clear(); disposed = true },
  }
}
