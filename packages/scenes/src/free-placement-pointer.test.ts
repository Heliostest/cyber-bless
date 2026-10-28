// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFreePlacementPointer } from './free-placement-pointer'

const handles: ReturnType<typeof createFreePlacementPointer>[] = []
afterEach(() => { handles.splice(0).forEach(handle => handle.dispose()); document.body.replaceChildren() })
type Input = { id?: number; x?: number; y?: number; type?: string; button?: number; shift?: boolean; primary?: boolean }
function input(target: HTMLElement | Window, name: string, { id = 1, x = 50, y = 50, type = 'touch', button = 0, shift = false, primary = true }: Input = {}) {
  const event = new Event(name, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, pointerType: type, button, buttons: name === 'pointerup' ? 0 : button === 2 ? 2 : 1, shiftKey: shift, isPrimary: primary })
  target.dispatchEvent(event); return event
}
function mount() {
  const layer = document.createElement('div'), canvas = document.createElement('canvas'); document.body.append(canvas,layer)
  canvas.getBoundingClientRect = () => ({left:0,top:0,width:200,height:200}) as DOMRect
  layer.setPointerCapture = vi.fn(); layer.releasePointerCapture = vi.fn()
  let active = true
  const start = vi.fn(), move = vi.fn(), rotate = vi.fn(), rebase = vi.fn(), release = vi.fn(), cancel = vi.fn(), inspectEnd = vi.fn()
  const pointer = createFreePlacementPointer(layer, canvas, { isActive: () => active, canStart: (x,y) => x > 20 && x < 180 && y > 20 && y < 180,
    onStart: start, onMove: move, onRotate: rotate, onRebase: rebase, onRelease: release, onCancel: cancel, onInspectEnd: inspectEnd })
  handles.push(pointer)
  return { layer, pointer, start, move, rotate, rebase, release, cancel, inspectEnd, pause: () => { active = false } }
}

describe('free placement pointer ownership', () => {
  it('moves a grabbed object and samples the actual final release once', () => {
    const s = mount(); input(s.layer,'pointerdown'); input(s.layer,'pointermove',{x:80}); input(s.layer,'pointerup',{x:120}); input(s.layer,'pointerup',{x:120})
    expect(s.start).toHaveBeenCalledExactlyOnceWith(50,50)
    expect(s.move.mock.calls).toEqual([[80,50],[120,50]])
    expect(s.release).toHaveBeenCalledExactlyOnceWith(120,50)
    expect(s.pointer.isBusy()).toBe(false)
  })
  it('delegates an ordinary outside release to the scene owning its operation', () => {
    const s=mount();input(s.layer,'pointerdown');input(s.layer,'pointermove',{x:80});input(s.layer,'pointerup',{x:250,y:70})
    expect(s.move.mock.calls).toEqual([[80,50],[250,70]])
    expect(s.release).toHaveBeenCalledExactlyOnceWith(250,70)
    expect(s.cancel).not.toHaveBeenCalled();expect(s.inspectEnd).not.toHaveBeenCalled();expect(s.pointer.isBusy()).toBe(false)
  })
  it('turns two fingers on the same object into inspection, then rebases one-finger movement', () => {
    const s = mount(); input(s.layer,'pointerdown'); input(s.layer,'pointerdown',{id:2,x:70,primary:false})
    input(s.layer,'pointermove',{id:2,x:90,primary:false}); input(s.layer,'pointermove',{x:70})
    expect(s.rotate.mock.calls).toEqual([[10,0],[10,0]]); expect(s.move).not.toHaveBeenCalled()
    expect(s.pointer.finish()).toBe(false)
    input(s.layer,'pointerup',{id:2,x:90,primary:false}); expect(s.rebase).toHaveBeenCalledExactlyOnceWith(70,50)
    input(s.layer,'pointermove',{x:100}); input(s.layer,'pointerup',{x:100})
    expect(s.move).toHaveBeenCalledExactlyOnceWith(100,50); expect(s.release).toHaveBeenCalledOnce(); expect(s.cancel).not.toHaveBeenCalled()
  })
  it('transfers the owner when its finger lifts first and keeps a stationary inspection uncommitted', () => {
    const s = mount(); input(s.layer,'pointerdown'); input(s.layer,'pointerdown',{id:2,x:70,primary:false})
    input(s.layer,'pointermove',{id:2,x:90,primary:false}); input(s.layer,'pointerup')
    expect(s.rebase).toHaveBeenCalledExactlyOnceWith(90,50); expect(s.pointer.isBusy()).toBe(true)
    input(s.layer,'pointerup',{id:2,x:90,primary:false})
    expect(s.inspectEnd).toHaveBeenCalledOnce(); expect(s.release).not.toHaveBeenCalled(); expect(s.cancel).not.toHaveBeenCalled()
  })
  it.each(['third','outside-second','wrong-object-second','outside-first'] as const)('abandons unsafe %s input until every physical pointer ends', kind => {
    const s = mount()
    if (kind === 'outside-first') input(document.body,'pointerdown',{id:2})
    input(s.layer,'pointerdown')
    if (kind === 'third') { input(s.layer,'pointerdown',{id:2,x:70,primary:false}); input(s.layer,'pointerdown',{id:3,x:80,primary:false}) }
    if (kind === 'outside-second') input(document.body,'pointerdown',{id:2,primary:false})
    if (kind === 'wrong-object-second') input(s.layer,'pointerdown',{id:2,x:5,primary:false})
    input(s.layer,'pointermove',{x:100}); expect(s.move).not.toHaveBeenCalled(); expect(s.rotate).not.toHaveBeenCalled()
    expect(s.cancel).toHaveBeenCalledTimes(kind === 'outside-first' ? 0 : 1)
    expect(s.pointer.isBusy()).toBe(true)
    for (const id of [1,2,3]) input(document.body,'pointerup',{id})
    expect(s.pointer.isBusy()).toBe(false); expect(s.release).not.toHaveBeenCalled()
  })
  it.each([{button:2,shift:false},{button:0,shift:true}])('uses mouse inspection without accepting placement: %j', mode => {
    const s = mount(), event = {type:'mouse',...mode}
    input(s.layer,'pointerdown',event); input(s.layer,'pointermove',{...event,x:90,y:70}); input(s.layer,'pointerup',{...event,x:90,y:70})
    expect(s.rotate).toHaveBeenCalledExactlyOnceWith(40,20); expect(s.move).not.toHaveBeenCalled()
    expect(s.inspectEnd).toHaveBeenCalledOnce(); expect(s.release).not.toHaveBeenCalled(); expect(s.cancel).not.toHaveBeenCalled()
    expect(input(s.layer,'contextmenu').defaultPrevented).toBe(true)
    expect(input(document.body,'contextmenu').defaultPrevented).toBe(false)
  })
  it('rebases when Shift rotation returns to ordinary mouse movement', () => {
    const s = mount(); input(s.layer,'pointerdown',{type:'mouse',shift:true}); input(s.layer,'pointermove',{type:'mouse',shift:true,x:80})
    input(s.layer,'pointermove',{type:'mouse',x:90}); expect(s.rebase).toHaveBeenCalledExactlyOnceWith(90,50)
    input(s.layer,'pointermove',{type:'mouse',x:100}); input(s.layer,'pointerup',{type:'mouse',x:100})
    expect(s.move).toHaveBeenCalledExactlyOnceWith(100,50); expect(s.release).toHaveBeenCalledOnce()
  })
  it.each([{button:2,shift:false},{button:0,shift:true}])('cancels captured mouse inspection outside the canvas: %j', mode => {
    const s = mount(), event = {type:'mouse',...mode}
    input(s.layer,'pointerdown',event); input(s.layer,'pointermove',{...event,x:90,y:70})
    const rotations = s.rotate.mock.calls.length
    input(s.layer,'pointerup',{...event,x:250,y:70})
    expect(s.cancel).toHaveBeenCalledOnce(); expect(s.inspectEnd).not.toHaveBeenCalled(); expect(s.release).not.toHaveBeenCalled()
    expect(s.rotate).toHaveBeenCalledTimes(rotations); expect(s.pointer.isBusy()).toBe(false)
  })
  it('keeps a cancelled two-finger inspection blocked until the other physical finger ends', () => {
    const s = mount(); input(s.layer,'pointerdown'); input(s.layer,'pointerdown',{id:2,x:70,primary:false})
    input(s.layer,'pointermove',{id:2,x:90,primary:false}); input(s.layer,'pointerup',{id:2,x:250,primary:false})
    expect(s.cancel).toHaveBeenCalledOnce(); expect(s.rebase).not.toHaveBeenCalled(); expect(s.pointer.isBusy()).toBe(true)
    // Releasing capture also emits this event while the first finger is down.
    input(s.layer,'lostpointercapture'); expect(s.pointer.isBusy()).toBe(true)
    input(s.layer,'pointermove',{x:90}); input(s.layer,'pointerup',{x:90})
    expect(s.move).not.toHaveBeenCalled(); expect(s.release).not.toHaveBeenCalled(); expect(s.inspectEnd).not.toHaveBeenCalled()
    expect(s.pointer.isBusy()).toBe(false)
  })
  it('finishes only movement and consumes its complete physical tail through pause', () => {
    const s = mount(); input(s.layer,'pointerdown'); input(s.layer,'pointermove',{x:80})
    expect(s.pointer.finish()).toBe(true); expect(s.pointer.finish()).toBe(false)
    input(s.layer,'lostpointercapture'); s.pause(); s.pointer.cancel()
    input(document.body,'pointerdown',{id:2}); expect(s.pointer.isBusy()).toBe(true)
    input(document.body,'pointerup'); expect(s.pointer.isBusy()).toBe(true)
    input(document.body,'pointerup',{id:2}); expect(s.pointer.isBusy()).toBe(false)
    expect(s.release).not.toHaveBeenCalled(); expect(s.cancel).not.toHaveBeenCalled()
  })
  it.each(['cancel','pause','dispose'] as const)('does not release a stale terminal sample after synchronous %s', kind => {
    const s = mount(); s.move.mockImplementation(x => { if(x === 120) { if(kind==='cancel')s.pointer.cancel(); else if(kind==='pause')s.pause(); else s.pointer.dispose() } })
    input(s.layer,'pointerdown'); input(s.layer,'pointerup',{x:120})
    expect(s.release).not.toHaveBeenCalled(); expect(s.inspectEnd).not.toHaveBeenCalled()
  })
  it.each(['cancel','pause','dispose'] as const)('never commits after an inspection callback causes synchronous %s', kind => {
    const s = mount(); s.rotate.mockImplementation(() => { if(kind==='cancel')s.pointer.cancel(); else if(kind==='pause')s.pause(); else s.pointer.dispose() })
    input(s.layer,'pointerdown',{type:'mouse',shift:true}); input(s.layer,'pointerup',{type:'mouse',shift:true,x:90})
    expect(s.rotate).toHaveBeenCalledOnce(); expect(s.release).not.toHaveBeenCalled(); expect(s.inspectEnd).not.toHaveBeenCalled()
  })
  it.each(['pointercancel','lostpointercapture','blur','dispose'] as const)('cleans up %s without committing an inspected object', kind => {
    const s = mount(); input(s.layer,'pointerdown'); input(s.layer,'pointerdown',{id:2,x:70,primary:false}); input(s.layer,'pointermove',{id:2,x:90,primary:false})
    if(kind==='blur') window.dispatchEvent(new Event('blur'))
    else if(kind==='dispose')s.pointer.dispose()
    else input(s.layer,kind)
    expect(s.cancel).toHaveBeenCalledOnce(); expect(s.release).not.toHaveBeenCalled(); expect(s.inspectEnd).not.toHaveBeenCalled()
  })
  it('ignores foreign ends and cancels a nonfinite endpoint', () => {
    const s = mount(); input(s.layer,'pointerdown'); input(s.layer,'pointerup',{id:8}); expect(s.pointer.isBusy()).toBe(true)
    input(s.layer,'pointerup',{x:NaN}); expect(s.cancel).toHaveBeenCalledOnce(); expect(s.release).not.toHaveBeenCalled()
  })
  it('claims touches only on the object and removes every local listener on disposal', () => {
    const s = mount()
    const touch = (x: number) => { const e = new Event('touchstart',{cancelable:true}); Object.assign(e,{changedTouches:[{clientX:x,clientY:50}]}); s.layer.dispatchEvent(e); return e.defaultPrevented }
    expect(touch(5)).toBe(false); expect(touch(50)).toBe(true)
    s.pointer.dispose(); s.pointer.dispose()
    expect(touch(50)).toBe(false); expect(input(s.layer,'contextmenu').defaultPrevented).toBe(false)
    input(s.layer,'pointerdown'); input(s.layer,'pointermove',{x:90}); input(s.layer,'pointerup',{x:90})
    expect(s.start).not.toHaveBeenCalled(); expect(s.move).not.toHaveBeenCalled(); expect(s.release).not.toHaveBeenCalled()
  })
})
