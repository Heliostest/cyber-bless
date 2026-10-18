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
  let owner: number | null = null, blocked = false, disposed = false
  let moved = false, lastX = 0, lastY = 0, releasing = false
  const active = () => !disposed && options.isActive()
  const releaseCapture = (id: number) => {
    try { layer.releasePointerCapture?.(id) } catch { /* Optional in embedded browsers. */ }
  }
  const abandon = () => {
    if (owner === null) return
    const id = owner; owner = null
    releaseCapture(id); options.onCancel?.()
  }
  const cancel = () => { abandon(); pointers.clear(); blocked = false }
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
    moved = false; lastX = event.clientX; lastY = event.clientY
    try { layer.setPointerCapture?.(owner) } catch { /* Button fallback remains available. */ }
    options.onStart?.(event.clientX, event.clientY)
  }
  const move = (event: PointerEvent) => {
    if (!active()) { cancel(); return }
    if (owner === event.pointerId && !blocked) {
      moved ||= event.clientX !== lastX || event.clientY !== lastY
      lastX = event.clientX; lastY = event.clientY
      options.onMove?.(lastX, lastY)
    }
  }
  const up = (event: PointerEvent) => {
    if (releasing) return
    releasing = true
    try {
      const ownsRelease = () => active() && !blocked && owner === event.pointerId && pointers.size === 1
      // Native input may deliver the destination only in pointerup. Update the
      // held pose before testing the drop, but do not invent a drag for a tap.
      if (ownsRelease() && moved && (event.clientX !== lastX || event.clientY !== lastY)) move(event)
      // Sampling can synchronously pause, cancel or dispose the scene.
      const valid = ownsRelease()
      pointers.delete(event.pointerId)
      if (owner === event.pointerId) {
        if (valid) {
          owner = null; releaseCapture(event.pointerId)
          options.onRelease?.(event.clientX, event.clientY)
        } else abandon()
      }
      if (!pointers.size) blocked = false
    } finally { releasing = false }
  }
  const cancelled = (event: PointerEvent) => {
    if (owner === event.pointerId) abandon()
    pointers.delete(event.pointerId)
    if (!pointers.size) blocked = false
  }
  const windowEnd = (event: PointerEvent) => {
    if (!layer.contains(event.target as Node) && owner === event.pointerId) abandon()
    pointers.delete(event.pointerId)
    if (!pointers.size) blocked = false
  }
  const stopTouches = claimObjectTouches(layer, (x, y) => active() && !blocked && options.canStart(x, y))
  layer.addEventListener('pointerdown', down); layer.addEventListener('pointermove', move)
  layer.addEventListener('pointerup', up); layer.addEventListener('pointercancel', cancelled)
  layer.addEventListener('lostpointercapture', cancelled)
  window.addEventListener('pointerdown', track, true)
  window.addEventListener('pointerup', windowEnd); window.addEventListener('pointercancel', windowEnd)
  window.addEventListener('blur', cancel)
  return {
    cancel,
    isBusy: () => !disposed && (blocked || owner !== null || pointers.size > 0),
    dispose() {
      if (disposed) return
      disposed = true; cancel(); stopTouches()
      layer.removeEventListener('pointerdown', down); layer.removeEventListener('pointermove', move)
      layer.removeEventListener('pointerup', up); layer.removeEventListener('pointercancel', cancelled)
      layer.removeEventListener('lostpointercapture', cancelled)
      window.removeEventListener('pointerdown', track, true)
      window.removeEventListener('pointerup', windowEnd); window.removeEventListener('pointercancel', windowEnd)
      window.removeEventListener('blur', cancel)
    },
  }
}
