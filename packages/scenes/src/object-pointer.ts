export type ObjectPointerOptions = {
  isActive(): boolean
  canStart(x: number, y: number): boolean
  onStart?(x: number, y: number): void
  onMove?(x: number, y: number): void
  onRelease?(x: number, y: number): void
  onCancel?(): void
}
import { claimObjectTouches } from './procedural-kit'

/** One object gesture, with whole-page pointer ownership and matched cleanup. */
export function createObjectPointer(layer: HTMLElement, options: ObjectPointerOptions) {
  const pointers = new Set<number>()
  let owner: number | null = null, arrived: number | null = null, blocked = false, consumed = false, disposed = false
  let lastX = 0, lastY = 0, releasing = false
  const active = () => !disposed && options.isActive()
  const releaseCapture = (id: number) => {
    try { layer.releasePointerCapture?.(id) } catch { /* Optional in embedded browsers. */ }
  }
  const abandon = () => {
    if (owner === null) return
    const id = owner; owner = null
    releaseCapture(id); options.onCancel?.()
  }
  const unlock = () => { if (!pointers.size) { blocked = false; consumed = false } }
  const clear = () => { abandon(); arrived = null; pointers.clear(); unlock() }
  const cancel = () => {
    abandon()
    // Pausing cancels an unfinished grab, but cannot release a finger whose
    // placement was already accepted. Its real end event still owns the tail.
    if (!consumed) { pointers.clear(); unlock() }
  }
  const track = (event: PointerEvent) => {
    if (!active() || (event.button ?? 0) !== 0) return
    pointers.add(event.pointerId)
    if (pointers.size > 1 || event.isPrimary === false) { blocked = true; abandon() }
  }
  const down = (event: PointerEvent) => {
    if (!active() || (event.button ?? 0) !== 0) return
    // Synthetic events need not bubble through the window capture listener.
    track(event)
    if (blocked || owner !== null || !options.canStart(event.clientX, event.clientY)) return
    owner = event.pointerId
    lastX = event.clientX; lastY = event.clientY
    try { layer.setPointerCapture?.(owner) } catch { /* Button fallback remains available. */ }
    options.onStart?.(event.clientX, event.clientY)
  }
  const move = (event: PointerEvent) => {
    if (!active()) { cancel(); return }
    if (owner === event.pointerId && !blocked) {
      lastX = event.clientX; lastY = event.clientY
      options.onMove?.(lastX, lastY)
    }
  }
  const up = (event: PointerEvent) => {
    if (releasing) return
    releasing = true
    try {
      const ownsRelease = () => active() && !blocked && owner === event.pointerId && pointers.size === 1
      // Native input can deliver even a nearby destination only in pointerup.
      // Sample the real endpoint; each scene owns its tap/motion distinction.
      const finite = Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      if (ownsRelease() && finite
        && (event.clientX !== lastX || event.clientY !== lastY)) move(event)
      // Sampling can synchronously pause, cancel or dispose the scene.
      const valid = ownsRelease() && finite
      pointers.delete(event.pointerId)
      if (arrived === event.pointerId) arrived = null
      if (owner === event.pointerId) {
        if (valid) {
          owner = null; releaseCapture(event.pointerId)
          options.onRelease?.(event.clientX, event.clientY)
        } else abandon()
      }
      unlock()
    } finally { releasing = false }
  }
  const cancelled = (event: PointerEvent) => {
    // Finishing a placement releases capture but still owns the physical touch.
    if (event.type === 'lostpointercapture' && arrived === event.pointerId) return
    if (owner === event.pointerId) abandon()
    if (arrived === event.pointerId) arrived = null
    pointers.delete(event.pointerId)
    unlock()
  }
  const windowEnd = (event: PointerEvent) => {
    if (!layer.contains(event.target as Node) && owner === event.pointerId) abandon()
    pointers.delete(event.pointerId)
    if (arrived === event.pointerId) arrived = null
    unlock()
  }
  const stopTouches = claimObjectTouches(layer, (x, y) => active() && !blocked && options.canStart(x, y))
  layer.addEventListener('pointerdown', down); layer.addEventListener('pointermove', move)
  layer.addEventListener('pointerup', up); layer.addEventListener('pointercancel', cancelled)
  layer.addEventListener('lostpointercapture', cancelled)
  window.addEventListener('pointerdown', track, true)
  window.addEventListener('pointerup', windowEnd); window.addEventListener('pointercancel', windowEnd)
  window.addEventListener('blur', clear)
  return {
    cancel,
    /** Commit an arrived object without inventing a pointerup. The scene may
     * settle this step, while later events cannot operate the next object. */
    finish() {
      if (!active() || blocked || owner === null || pointers.size !== 1) return false
      const id = owner; owner = null; arrived = id; blocked = true; consumed = true
      releaseCapture(id)
      return true
    },
    isBusy: () => !disposed && (blocked || owner !== null || pointers.size > 0),
    dispose() {
      if (disposed) return
      disposed = true; clear(); stopTouches()
      layer.removeEventListener('pointerdown', down); layer.removeEventListener('pointermove', move)
      layer.removeEventListener('pointerup', up); layer.removeEventListener('pointercancel', cancelled)
      layer.removeEventListener('lostpointercapture', cancelled)
      window.removeEventListener('pointerdown', track, true)
      window.removeEventListener('pointerup', windowEnd); window.removeEventListener('pointercancel', windowEnd)
      window.removeEventListener('blur', clear)
    },
  }
}
