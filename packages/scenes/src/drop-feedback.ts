const READY = '可以松手，轻轻落稳。'

/** Own only the ready hint. A later scene sync must win over stale restoration. */
export function createDropFeedback(hint: HTMLElement, safe: (text: string) => unknown) {
  let ready = false, previous = '', disposed = false
  safe(READY)
  const clear = () => {
    if (ready && hint.textContent === READY) hint.textContent = previous
    ready = false; delete hint.dataset.dropReady
  }
  return {
    setReady(next: boolean) {
      if (disposed) return
      if (!next) { clear(); return }
      if (!ready) previous = hint.textContent ?? ''
      ready = true; hint.dataset.dropReady = 'true'; hint.textContent = READY
    },
    clear,
    dispose() { clear(); disposed = true },
  }
}
