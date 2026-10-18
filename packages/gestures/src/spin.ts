import type { GestureHandle } from './types'

export type SpinOpts = {
  /** Only a pointer that goes down where this is true starts a spin (default: anywhere). */
  startsOn?(clientX: number, clientY: number): boolean
  onAngle?(rad: number): void
  onRevolution?(n: number): void
}

/** One full element width of horizontal drag ≈ one revolution (2π rad). */
export function createSpin(opts: SpinOpts): GestureHandle {
  let el: HTMLElement | null = null
  let enabled = true
  let tracking = false
  let owner: number | undefined
  let lastX = 0
  let angle = 0
  let lastRev = 0
  let moved = false
  const reset = () => { tracking = false; owner = undefined }

  const onDown = (e: PointerEvent) => {
    if (!enabled || tracking || (opts.startsOn && !opts.startsOn(e.clientX, e.clientY))) return
    tracking = true
    owner = e.pointerId
    moved = false
    lastX = e.clientX
    el?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: PointerEvent) => {
    if (!tracking || !enabled || !el || e.pointerId !== owner) return
    const dx = e.clientX - lastX
    moved ||= dx !== 0
    lastX = e.clientX
    const width = el.clientWidth || 1
    angle += (dx / width) * Math.PI * 2
    opts.onAngle?.(angle)
    if (!enabled || !tracking || !el) return
    const rev = Math.floor(Math.abs(angle) / (Math.PI * 2))
    if (rev > lastRev) {
      for (let n = lastRev + 1; n <= rev; n++) {
        opts.onRevolution?.(n)
      }
      lastRev = rev
    }
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== owner) return
    if (moved && e.clientX !== lastX) onMove(e)
    if (e.pointerId === owner) reset()
  }
  const onCancel = (e: PointerEvent) => { if (e.pointerId === owner) reset() }

  return {
    mount(target) {
      el = target
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onCancel)
      el.addEventListener('lostpointercapture', onCancel)
      window.addEventListener('blur', reset)
    },
    update() {},
    dispose() {
      if (!el) return
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('lostpointercapture', onCancel)
      window.removeEventListener('blur', reset)
      el = null
      reset()
    },
    setEnabled(on) {
      enabled = on
      if (!on) reset()
    },
  }
}
