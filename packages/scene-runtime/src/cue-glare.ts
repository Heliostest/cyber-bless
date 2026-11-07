/** Intermittent glass reflection; waiting never owns an animation-frame loop. */
export function createCueGlare(progress: { value: number }, redraw: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined, started: number | undefined
  let enabled = false, disposed = false
  const duration = 1100
  function cancel() {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined }
    started = undefined; progress.value = -1
  }
  function wait(delay: number) {
    timer = setTimeout(() => {
      timer = undefined
      if (!enabled || disposed) return
      started = performance.now(); progress.value = 0; redraw()
    }, delay)
  }
  return {
    get animating() { return started !== undefined },
    update(allowed: boolean, now = performance.now()) {
      if (disposed) return
      if (!allowed) { enabled = false; cancel(); return }
      if (!enabled) { enabled = true; wait(3200) }
      if (started === undefined) return
      const phase = Math.max(0, now - started) / duration
      if (phase >= 1) { started = undefined; progress.value = -1; wait(8500) }
      else progress.value = phase
    },
    dispose() { if (!disposed) { disposed = true; enabled = false; cancel() } },
  }
}
