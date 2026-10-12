import type { GestureHandle } from './types'

export type DragOpts = {
  /** Only a pointer that goes down where this is true starts a drag (default: anywhere). */
  startsOn?: (clientX: number, clientY: number) => boolean
  hitTest: (clientX: number, clientY: number) => boolean
  onProgress?: (t: number) => void
  onDrop?: (hit: boolean) => void
}

export function createDrag(opts: DragOpts): GestureHandle {
  let el: HTMLElement | null = null
  let enabled = true
  let dragging = false
  let owner: number | undefined
  const onDown = (e: PointerEvent) => {
    if (!enabled || dragging || (opts.startsOn && !opts.startsOn(e.clientX, e.clientY))) return
    dragging = true
    owner = e.pointerId
    el?.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging || !enabled || e.pointerId !== owner) return
    opts.onProgress?.(1)
  }
  const onUp = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== owner) return
    dragging = false
    owner = undefined
    opts.onDrop?.(opts.hitTest(e.clientX, e.clientY))
  }
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== owner) return
    dragging = false
    owner = undefined
  }
  return {
    mount(target) {
      el = target
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onCancel)
    },
    update() {},
    dispose() {
      if (!el) return
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el = null
      dragging = false
      owner = undefined
    },
    setEnabled(on) {
      enabled = on
      if (!on) { dragging = false; owner = undefined }
    },
  }
}
