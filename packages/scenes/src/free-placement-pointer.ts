import { claimObjectTouches } from './procedural-kit'
import { insideCanvas } from './touch-target'

export type FreePlacementPointerOptions = {
  isActive(): boolean
  canStart(x: number, y: number): boolean
  onStart?(x: number, y: number): void
  onMove?(x: number, y: number): void
  onRelease?(x: number, y: number): void
  onCancel?(): void
  onRotate?(dx: number, dy: number): void
  onRebase?(x: number, y: number): void
  onInspectEnd?(): void
}

export function createFreePlacementPointer(layer: HTMLElement, canvas: HTMLCanvasElement, options: FreePlacementPointerOptions) {
  type Contact = { x: number; y: number; type: string; button: number }
  const pointers = new Map<number, Contact>()
  let owner: number | null = null, pair: [number, number] | null = null
  let blocked = false, consumed = false, disposed = false, releasing = false
  let inspect = false, inspected = false, translated = false, pairX = 0, pairY = 0, generation = 0
  const active = () => !disposed && options.isActive()
  const finite = (event: PointerEvent) => Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
  const releaseCapture = (id: number) => { try { layer.releasePointerCapture?.(id) } catch { /* Embedded browsers can omit capture. */ } }
  const capture = (id: number) => { try { layer.setPointerCapture?.(id) } catch { /* Whole-page end listeners retain ownership. */ } }
  const unlock = () => {
    if (pointers.size) return
    blocked = consumed = inspect = inspected = translated = false
  }
  const abandon = () => {
    if (owner === null) return
    const ids = pair ?? [owner]
    owner = null; pair = null; generation++
    ids.forEach(releaseCapture)
    options.onCancel?.()
  }
  const reject = () => { blocked = true; abandon() }
  const clear = () => { abandon(); pointers.clear(); pair = null; unlock() }
  const cancel = () => {
    generation++; abandon()
    // An accepted placement still owns every physical end event. A scene
    // pause must not let that gesture's tail operate the next object/button.
    if (!consumed) { pointers.clear(); pair = null; unlock() }
  }
  const track = (event: PointerEvent) => {
    if ((!active() && !consumed) || ![0, 2].includes(event.button ?? 0) || pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType ?? 'mouse', button: event.button ?? 0 })
    if (consumed || blocked) { blocked = true; return }
    if (pointers.size === 1) return
    const primary = owner === null ? undefined : pointers.get(owner)
    // Only a second touch which starts on the already held object can inspect
    // it. A page touch, a third finger or an unrelated initial touch cancels.
    if (pointers.size !== 2 || owner === null || !primary || primary.type !== 'touch' || event.pointerType !== 'touch'
      || !layer.contains(event.target as Node) || !finite(event) || !options.canStart(event.clientX, event.clientY)) { reject(); return }
    pair = [owner, event.pointerId]
    pairX = (primary.x + event.clientX) / 2; pairY = (primary.y + event.clientY) / 2
    inspected = inspect = true; translated = false
    capture(event.pointerId)
  }
  const down = (event: PointerEvent) => {
    if (!active() || ![0, 2].includes(event.button ?? 0)) return
    track(event)
    if (blocked || owner !== null || pointers.size !== 1) return
    if (event.isPrimary === false) { blocked = true; return }
    if (!finite(event) || !options.canStart(event.clientX, event.clientY)) return
    owner = event.pointerId
    inspect = event.pointerType === 'mouse' && (event.button === 2 || event.shiftKey)
    inspected = inspect; translated = false
    capture(owner)
    options.onStart?.(event.clientX, event.clientY)
  }
  const move = (event: PointerEvent) => {
    if (!active()) { cancel(); return }
    if (blocked || owner === null || !pointers.has(event.pointerId)) return
    if (!finite(event)) { reject(); return }
    const contact = pointers.get(event.pointerId)!, oldX = contact.x, oldY = contact.y
    contact.x = event.clientX; contact.y = event.clientY
    if (pair) {
      if (!pair.includes(event.pointerId)) return
      const a = pointers.get(pair[0])!, b = pointers.get(pair[1])!
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, dx = x - pairX, dy = y - pairY
      pairX = x; pairY = y
      if (dx || dy) options.onRotate?.(dx, dy)
      return
    }
    if (event.pointerId !== owner) return
    const rotating = contact.type === 'mouse' && (contact.button === 2 || event.shiftKey)
    if (inspect && !rotating) {
      inspect = false; translated = false
      options.onRebase?.(contact.x, contact.y)
      return
    }
    if (rotating) {
      inspect = inspected = true; translated = false
      if (contact.x !== oldX || contact.y !== oldY) options.onRotate?.(contact.x - oldX, contact.y - oldY)
    } else if (contact.x !== oldX || contact.y !== oldY) {
      translated = true
      options.onMove?.(contact.x, contact.y)
    }
  }
  const up = (event: PointerEvent) => {
    if (releasing || !pointers.has(event.pointerId)) return
    releasing = true
    try {
      const owns = () => active() && !blocked && owner !== null && (owner === event.pointerId || !!pair?.includes(event.pointerId))
      const before = generation
      if (owns()) {
        const old = pointers.get(event.pointerId)!
        // Inspection ends outside the canvas cancel before sampling a turn.
        // Ordinary operation releases retain their scene-specific acceptance.
        const inspecting=inspect||!!pair||(inspected&&!translated)||(old.type==='mouse'&&event.shiftKey)
        if (!finite(event)||(inspecting&&!insideCanvas(canvas,event.clientX,event.clientY))) reject()
        else if (event.clientX !== old.x || event.clientY !== old.y) move(event)
      }
      // Sampling the endpoint can finish, pause, cancel or dispose the scene.
      if (owns() && before === generation && pair?.includes(event.pointerId)) {
        const remaining = pair.find(id => id !== event.pointerId)!
        pointers.delete(event.pointerId); owner = remaining; pair = null
        inspect = false; translated = false
        releaseCapture(event.pointerId)
        const contact = pointers.get(remaining)!
        options.onRebase?.(contact.x, contact.y)
        return
      }
      const valid = owns() && before === generation && pointers.size === 1 && finite(event)
      const inspectionEnd = inspect || (inspected && !translated)
      pointers.delete(event.pointerId)
      if (owner === event.pointerId) {
        if (valid) {
          owner = null; releaseCapture(event.pointerId)
          if (inspectionEnd) options.onInspectEnd?.()
          else options.onRelease?.(event.clientX, event.clientY)
        } else abandon()
      }
      unlock()
    } finally { releasing = false }
  }
  const cancelled = (event: PointerEvent) => {
    if (event.type === 'lostpointercapture' && consumed && pointers.has(event.pointerId)) return
    if (owner === event.pointerId || pair?.includes(event.pointerId)) reject()
    // Capture loss is not a physical finger ending. Keep rejected gestures
    // blocked until their real pointerup/pointercancel events have all arrived.
    if (event.type === 'lostpointercapture' && blocked) return
    pointers.delete(event.pointerId); unlock()
  }
  const windowEnd = (event: PointerEvent) => {
    if (!layer.contains(event.target as Node) && (owner === event.pointerId || pair?.includes(event.pointerId))) reject()
    pointers.delete(event.pointerId); unlock()
  }
  const contextmenu = (event: Event) => event.preventDefault()
  const stopTouches = claimObjectTouches(layer, (x,y) => active() && !blocked && options.canStart(x,y))
  layer.addEventListener('pointerdown', down); layer.addEventListener('pointermove', move)
  layer.addEventListener('pointerup', up); layer.addEventListener('pointercancel', cancelled)
  layer.addEventListener('lostpointercapture', cancelled); layer.addEventListener('contextmenu', contextmenu)
  window.addEventListener('pointerdown', track, true)
  window.addEventListener('pointerup', windowEnd); window.addEventListener('pointercancel', windowEnd)
  window.addEventListener('blur', clear)
  return {
    cancel,
    finish() {
      if (!active() || blocked || owner === null || pair || pointers.size !== 1 || inspect || (inspected && !translated)) return false
      const id = owner; owner = null; blocked = consumed = true; generation++
      releaseCapture(id)
      return true
    },
    isBusy: () => !disposed && (blocked || owner !== null || pointers.size > 0),
    dispose() {
      if (disposed) return
      disposed = true; generation++; clear(); stopTouches()
      layer.removeEventListener('pointerdown', down); layer.removeEventListener('pointermove', move)
      layer.removeEventListener('pointerup', up); layer.removeEventListener('pointercancel', cancelled)
      layer.removeEventListener('lostpointercapture', cancelled); layer.removeEventListener('contextmenu', contextmenu)
      window.removeEventListener('pointerdown', track, true)
      window.removeEventListener('pointerup', windowEnd); window.removeEventListener('pointercancel', windowEnd)
      window.removeEventListener('blur', clear)
    },
  }
}
