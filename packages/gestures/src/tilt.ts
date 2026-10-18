import type { GestureHandle } from './types'

export type TiltOpts = {
  /** Only a pointer that goes down where this is true starts tilting (default: anywhere). */
  startsOn?(clientX: number, clientY: number): boolean
  pourAngleDeg?: number
  holdMs?: number
  onAngle?(deg: number): void
  onPour?(): void
}

/** 1 CSS px of vertical drag ≈ 1° of tilt (upward → positive). */
export function createTilt(opts: TiltOpts): GestureHandle {
  const pourAngleDeg = opts.pourAngleDeg ?? 45
  const holdMs = opts.holdMs ?? 0

  let el: HTMLElement | null = null
  let enabled = true
  let tracking = false
  let owner: number | undefined
  let startY = 0
  let angle = 0
  let holdAccumMs = 0
  let poured = false
  let moved = false, lastY = 0
  const reset = () => { tracking = false; owner = undefined; angle = 0; holdAccumMs = 0 }

  const maybePourFromHold = () => {
    if (poured) return
    if (Math.abs(angle) < pourAngleDeg) return
    if (holdAccumMs < holdMs) return
    poured = true
    opts.onPour?.()
  }

  const applyAngle = (clientY: number) => {
    angle = startY - clientY
    opts.onAngle?.(angle)
    if (!enabled || !tracking || !el) return
    if (Math.abs(angle) >= pourAngleDeg) {
      if (holdMs === 0) {
        holdAccumMs = holdMs
        maybePourFromHold()
      }
      // holdMs > 0: accumulate in update(dt) while still above threshold
    } else {
      holdAccumMs = 0
      poured = false
    }
  }

  const onDown = (e: PointerEvent) => {
    if (!enabled || tracking || (opts.startsOn && !opts.startsOn(e.clientX, e.clientY))) return
    tracking = true
    owner = e.pointerId
    startY = e.clientY
    lastY = e.clientY; moved = false
    angle = 0
    holdAccumMs = 0
    poured = false
    el?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: PointerEvent) => {
    if (!tracking || !enabled || e.pointerId !== owner) return
    moved ||= e.clientY !== lastY
    lastY = e.clientY
    applyAngle(e.clientY)
  }

  const onUp = (e: PointerEvent) => {
    if (!tracking || e.pointerId !== owner) return
    if (moved && e.clientY !== lastY) onMove(e)
    if (e.pointerId === owner) reset()
    // poured stays until next down (fresh gesture) — cleared on down
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
    update(dt) {
      if (!enabled || !tracking) return
      if (Math.abs(angle) < pourAngleDeg) {
        holdAccumMs = 0
        poured = false
        return
      }
      // dt is seconds (scene rAF convention)
      holdAccumMs += dt * 1000
      maybePourFromHold()
    },
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
      if (!on) {
        reset()
      }
    },
  }
}
